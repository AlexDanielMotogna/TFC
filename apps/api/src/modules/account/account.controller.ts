import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { AccountService } from './account.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

@Controller('account')
@UseGuards(JwtAuthGuard)
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Get('summary')
  async getSummary(@Request() req: { user: { userId: string } }) {
    const summary = await this.accountService.getSummary(req.user.userId);
    return { success: true, data: summary };
  }

  @Get('positions')
  async getPositions(@Request() req: { user: { userId: string } }) {
    const positions = await this.accountService.getPositions(req.user.userId);
    return { success: true, data: positions };
  }

  @Get('orders/open')
  async getOpenOrders(@Request() req: { user: { userId: string } }) {
    const orders = await this.accountService.getOpenOrders(req.user.userId);
    return { success: true, data: orders };
  }

  @Get('fills')
  async getFills(
    @Request() req: { user: { userId: string } },
    @Query('since') since?: string
  ) {
    const fills = await this.accountService.getFills(
      req.user.userId,
      since ? parseInt(since, 10) : undefined
    );
    return { success: true, data: fills };
  }
}
