import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { prisma } from '@tfc/db';
import { PacificaService } from '../../pacifica/pacifica.service.js';

@Injectable()
export class AccountService {
  constructor(private readonly pacifica: PacificaService) {}

  private async getAccountAddress(userId: string): Promise<string> {
    const connection = await prisma.pacificaConnection.findUnique({
      where: { userId },
      select: { accountAddress: true, isActive: true },
    });

    if (!connection || !connection.isActive) {
      throw new HttpException('No active Pacifica connection', HttpStatus.UNAUTHORIZED);
    }

    return connection.accountAddress;
  }

  async getSummary(userId: string) {
    const accountAddress = await this.getAccountAddress(userId);
    const accountInfo = await this.pacifica.getAccount(accountAddress);

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

  async getPositions(userId: string) {
    const accountAddress = await this.getAccountAddress(userId);
    return this.pacifica.getPositions(accountAddress);
  }

  async getOpenOrders(userId: string) {
    const accountAddress = await this.getAccountAddress(userId);
    return this.pacifica.getOpenOrders(accountAddress);
  }

  async getFills(userId: string, since?: number) {
    const accountAddress = await this.getAccountAddress(userId);
    return this.pacifica.getTradeHistory({
      accountAddress,
      startTime: since,
    });
  }

  async getSettings(userId: string) {
    const accountAddress = await this.getAccountAddress(userId);
    return this.pacifica.getAccountSettings(accountAddress);
  }
}
