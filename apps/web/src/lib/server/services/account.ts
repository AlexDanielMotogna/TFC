/**
 * Account service - ported from NestJS
 * Handles Pacifica account data fetching
 */
import { prisma } from '../db';
import * as Pacifica from '../pacifica';
import { UnauthorizedError } from '../errors';

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
  return Pacifica.getPositions(accountAddress);
}

export async function getOpenOrders(userId: string) {
  const accountAddress = await getAccountAddress(userId);
  return Pacifica.getOpenOrders(accountAddress);
}

export async function getFills(userId: string, since?: number) {
  const accountAddress = await getAccountAddress(userId);
  return Pacifica.getTradeHistory({
    accountAddress,
    startTime: since,
  });
}

export async function getSettings(userId: string) {
  const accountAddress = await getAccountAddress(userId);
  return Pacifica.getAccountSettings(accountAddress);
}
