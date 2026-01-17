import { Controller, Get, Param, Query } from '@nestjs/common';
import { MarketsService } from './markets.service.js';

@Controller('markets')
export class MarketsController {
  constructor(private readonly marketsService: MarketsService) {}

  @Get()
  async getMarkets() {
    const markets = await this.marketsService.getMarkets();
    return { success: true, data: markets };
  }

  @Get('prices')
  async getPrices() {
    const prices = await this.marketsService.getPrices();
    return { success: true, data: prices };
  }

  @Get(':symbol/orderbook')
  async getOrderbook(
    @Param('symbol') symbol: string,
    @Query('aggLevel') aggLevel?: string
  ) {
    const orderbook = await this.marketsService.getOrderbook(
      symbol,
      aggLevel ? parseInt(aggLevel, 10) : 1
    );
    return { success: true, data: orderbook };
  }

  @Get(':symbol/klines')
  async getKlines(
    @Param('symbol') symbol: string,
    @Query('interval') interval: string,
    @Query('startTime') startTime: string,
    @Query('endTime') endTime?: string
  ) {
    const klines = await this.marketsService.getKlines(
      symbol,
      interval,
      parseInt(startTime, 10),
      endTime ? parseInt(endTime, 10) : undefined
    );
    return { success: true, data: klines };
  }

  @Get(':symbol/trades')
  async getRecentTrades(@Param('symbol') symbol: string) {
    const trades = await this.marketsService.getRecentTrades(symbol);
    return { success: true, data: trades };
  }
}
