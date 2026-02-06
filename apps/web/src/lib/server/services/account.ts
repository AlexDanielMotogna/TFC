/**
 * Account service - ported from NestJS
 * Handles account data fetching via Exchange Adapter
 */
import { prisma } from '../db';
import * as Pacifica from '../pacifica';
import { ExchangeProvider } from '../exchanges/provider';
import { UnauthorizedError } from '../errors';

// Feature flag for Exchange Adapter (set to false to use direct Pacifica calls)
const USE_EXCHANGE_ADAPTER = process.env.USE_EXCHANGE_ADAPTER !== 'false';

async function getAccountAddress(userId: string): Promise<string> {
  const connection = await prisma.pacificaConnection.findUnique({
    where: { userId },
    select: { accountAddress: true, isActive: true },
  });

  if (!connection || !connection.isActive) {
    throw new UnauthorizedError('No active Pacifica connection');
  }

  return connection.accountAddress;
}

export async function getSummary(userId: string) {
  const accountAddress = await getAccountAddress(userId);

  if (USE_EXCHANGE_ADAPTER) {
    // Use Exchange Adapter (with caching if Redis configured)
    const adapter = await ExchangeProvider.getUserAdapter(userId);
    const accountInfo = await adapter.getAccount(accountAddress);

    if (!accountInfo) return null;

    // Adapter returns normalized format - map to frontend expectations
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
    };
  }

  // Fallback to direct Pacifica calls
  const accountInfo = await Pacifica.getAccount(accountAddress);

  if (!accountInfo) return null;

  // Transform snake_case to camelCase for frontend
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
  };
}

export async function getPositions(userId: string) {
  const accountAddress = await getAccountAddress(userId);

  if (USE_EXCHANGE_ADAPTER) {
    const adapter = await ExchangeProvider.getUserAdapter(userId);
    return adapter.getPositions(accountAddress);
  }

  return Pacifica.getPositions(accountAddress);
}

export async function getOpenOrders(userId: string) {
  const accountAddress = await getAccountAddress(userId);

  if (USE_EXCHANGE_ADAPTER) {
    const adapter = await ExchangeProvider.getUserAdapter(userId);
    return adapter.getOpenOrders(accountAddress);
  }

  return Pacifica.getOpenOrders(accountAddress);
}

export async function getFills(userId: string, since?: number) {
  const accountAddress = await getAccountAddress(userId);

  if (USE_EXCHANGE_ADAPTER) {
    const adapter = await ExchangeProvider.getUserAdapter(userId);
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

export async function getSettings(userId: string) {
  const accountAddress = await getAccountAddress(userId);

  if (USE_EXCHANGE_ADAPTER) {
    const adapter = await ExchangeProvider.getUserAdapter(userId);
    return adapter.getAccountSettings(accountAddress);
  }

  return Pacifica.getAccountSettings(accountAddress);
}
