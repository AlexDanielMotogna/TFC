/**
 * Account service - ported from NestJS
 * Handles account data fetching via Exchange Adapter
 */
import { prisma } from '../db';
import * as Pacifica from '../pacifica';
import { ExchangeProvider } from '../exchanges/provider';
import { NotFoundError } from '../errors';

// Feature flag for Exchange Adapter (set to false to use direct Pacifica calls)
const USE_EXCHANGE_ADAPTER = process.env.USE_EXCHANGE_ADAPTER !== 'false';

async function getAccountAddress(userId: string, exchangeType?: string): Promise<string | null> {
  const connection = exchangeType
    ? await prisma.exchangeConnection.findUnique({
        where: { userId_exchangeType: { userId, exchangeType } },
        select: { accountAddress: true, isActive: true },
      })
    : await prisma.exchangeConnection.findFirst({
        where: { userId, isActive: true },
        select: { accountAddress: true, isActive: true },
      });

  if (!connection || !connection.isActive) {
    return null;
  }

  // Hyperliquid requires EVM addresses (0x...). Reject if the stored address
  // is a Solana address (from the auth wallet) rather than the DEX-specific EVM wallet.
  if (exchangeType === 'hyperliquid' && connection.accountAddress) {
    if (!connection.accountAddress.startsWith('0x') || connection.accountAddress.length !== 42) {
      console.error(`[AccountService] Hyperliquid connection for user ${userId} has non-EVM address: ${connection.accountAddress.slice(0, 10)}... — needs re-sync from EVM wallet`);
      return null;
    }
  }

  return connection.accountAddress;
}

export async function getSummary(userId: string, exchangeType?: string) {
  const accountAddress = await getAccountAddress(userId, exchangeType);
  if (!accountAddress) {
    throw new NotFoundError(`No active ${exchangeType || 'exchange'} connection`);
  }

  if (USE_EXCHANGE_ADAPTER) {
    const adapter = await ExchangeProvider.getUserAdapter(userId, exchangeType);
    const accountInfo = await adapter.getAccount(accountAddress);

    if (!accountInfo) return null;

    return {
      balance: accountInfo.balance,
      accountEquity: accountInfo.accountEquity,
      availableToSpend: accountInfo.availableToSpend,
      availableToWithdraw: accountInfo.metadata.availableToWithdraw || accountInfo.availableToSpend,
      pendingBalance: accountInfo.metadata.pendingBalance || '0',
      totalMarginUsed: accountInfo.marginUsed,
      crossMmr: accountInfo.metadata.crossMmr || '0',
      positionsCount: accountInfo.metadata.positionsCount || 0,
      ordersCount: accountInfo.metadata.ordersCount || 0,
      feeLevel: accountInfo.metadata.feeLevel || 0,
      makerFee: accountInfo.makerFee,
      takerFee: accountInfo.takerFee,
    };
  }

  // Fallback to direct Pacifica calls
  const accountInfo = await Pacifica.getAccount(accountAddress);

  if (!accountInfo) return null;

  return {
    balance: accountInfo.balance,
    accountEquity: accountInfo.account_equity,
    availableToSpend: accountInfo.available_to_spend,
    availableToWithdraw: accountInfo.available_to_withdraw,
    pendingBalance: accountInfo.pending_balance,
    totalMarginUsed: accountInfo.total_margin_used,
    crossMmr: accountInfo.cross_mmr,
    positionsCount: accountInfo.positions_count,
    ordersCount: accountInfo.orders_count,
    feeLevel: accountInfo.fee_level,
    makerFee: accountInfo.maker_fee,
    takerFee: accountInfo.taker_fee,
  };
}

export async function getPositions(userId: string, exchangeType?: string) {
  const accountAddress = await getAccountAddress(userId, exchangeType);
  if (!accountAddress) {
    throw new NotFoundError(`No active ${exchangeType || 'exchange'} connection`);
  }

  if (USE_EXCHANGE_ADAPTER) {
    const adapter = await ExchangeProvider.getUserAdapter(userId, exchangeType);
    return adapter.getPositions(accountAddress);
  }

  return Pacifica.getPositions(accountAddress);
}

export async function getOpenOrders(userId: string, exchangeType?: string) {
  const accountAddress = await getAccountAddress(userId, exchangeType);
  if (!accountAddress) {
    throw new NotFoundError(`No active ${exchangeType || 'exchange'} connection`);
  }

  if (USE_EXCHANGE_ADAPTER) {
    const adapter = await ExchangeProvider.getUserAdapter(userId, exchangeType);
    return adapter.getOpenOrders(accountAddress);
  }

  return Pacifica.getOpenOrders(accountAddress);
}

export async function getFills(userId: string, exchangeType?: string, since?: number) {
  const accountAddress = await getAccountAddress(userId, exchangeType);
  if (!accountAddress) {
    throw new NotFoundError(`No active ${exchangeType || 'exchange'} connection`);
  }

  if (USE_EXCHANGE_ADAPTER) {
    const adapter = await ExchangeProvider.getUserAdapter(userId, exchangeType);
    return adapter.getTradeHistory({
      accountId: accountAddress,
      startTime: since,
    });
  }

  return Pacifica.getTradeHistory({
    accountAddress,
    startTime: since,
  });
}

export async function getOrderHistory(userId: string, exchangeType?: string) {
  const accountAddress = await getAccountAddress(userId, exchangeType);
  if (!accountAddress) {
    throw new NotFoundError(`No active ${exchangeType || 'exchange'} connection`);
  }

  if (USE_EXCHANGE_ADAPTER) {
    const adapter = await ExchangeProvider.getUserAdapter(userId, exchangeType);
    // Use dedicated order history if the adapter supports it, otherwise fall back to trade fills
    if (adapter.getOrderHistory) {
      return adapter.getOrderHistory(accountAddress);
    }
    return adapter.getTradeHistory({ accountId: accountAddress });
  }

  // Fallback to Pacifica trade history (Pacifica doesn't have separate order history)
  return Pacifica.getTradeHistory({ accountAddress });
}

export async function getSettings(userId: string, exchangeType?: string) {
  const accountAddress = await getAccountAddress(userId, exchangeType);
  if (!accountAddress) {
    throw new NotFoundError(`No active ${exchangeType || 'exchange'} connection`);
  }

  if (USE_EXCHANGE_ADAPTER) {
    const adapter = await ExchangeProvider.getUserAdapter(userId, exchangeType);
    return adapter.getAccountSettings(accountAddress);
  }

  return Pacifica.getAccountSettings(accountAddress);
}
