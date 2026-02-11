import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { ChartDataAggregator } from './chart-data.aggregator.js';

@Controller('chart')
export class ChartDataController {
  constructor(private readonly aggregator: ChartDataAggregator) {}

  /**
   * GET /api/chart/candles
   *
   * Fetches OHLCV candle data, automatically aggregating from multiple sources:
   * - Pacifica (June 2025+) for recent data
   * - Binance/Bybit (2019+) for historical data
   *
   * @param symbol - TFC format symbol (e.g., "BTC-USD")
   * @param interval - Candle interval (e.g., "1m", "5m", "1h", "1d")
   * @param start - Start timestamp in milliseconds
   * @param end - End timestamp in milliseconds
   */
  @Get('candles')
  async getCandles(
    @Query('symbol') symbol: string,
    @Query('interval') interval: string,
    @Query('start') start: string,
    @Query('end') end: string
  ) {
    // Validate required parameters
    if (!symbol) {
      throw new BadRequestException('symbol is required');
    }
    if (!interval) {
      throw new BadRequestException('interval is required');
    }
    if (!start) {
      throw new BadRequestException('start timestamp is required');
    }
    if (!end) {
      throw new BadRequestException('end timestamp is required');
    }

    const startTime = parseInt(start, 10);
    const endTime = parseInt(end, 10);

    if (isNaN(startTime) || isNaN(endTime)) {
      throw new BadRequestException('start and end must be valid timestamps');
    }

    if (startTime >= endTime) {
      throw new BadRequestException('start must be before end');
    }

    // Validate interval
    const validIntervals = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '8h', '12h', '1d'];
    if (!validIntervals.includes(interval)) {
      throw new BadRequestException(
        `Invalid interval. Valid values: ${validIntervals.join(', ')}`
      );
    }

    const candles = await this.aggregator.getCandles(symbol, interval, startTime, endTime);

    return {
      success: true,
      data: candles,
      meta: {
        symbol,
        interval,
        startTime,
        endTime,
        count: candles.length,
      },
    };
  }

  /**
   * GET /api/chart/info
   *
   * Returns information about available historical data.
   */
  @Get('info')
  getInfo() {
    return {
      success: true,
      data: {
        sources: {
          pacifica: {
            name: 'Pacifica',
            startDate: '2025-06-01',
            description: 'Primary source for recent data',
          },
          binance: {
            name: 'Binance Futures',
            startDate: '2019-09-01',
            description: 'Secondary source for historical data',
          },
          bybit: {
            name: 'Bybit',
            startDate: '2020-01-01',
            description: 'Fallback source for historical data',
          },
        },
        intervals: ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '8h', '12h', '1d'],
        earliestAvailableDate: this.aggregator.getEarliestAvailableDate().toISOString(),
      },
    };
  }
}
