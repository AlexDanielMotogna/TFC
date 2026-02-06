import { Injectable, Logger } from '@nestjs/common';
import { Candle, DataSource, BybitKlineRaw } from '../types.js';
import { adaptBybitCandles } from '../adapters/index.js';
import { mapSymbol, mapInterval, isSymbolSupported } from '../symbol-mapping.js';

const BYBIT_API = 'https://api.bybit.com';
const MAX_CANDLES_PER_REQUEST = 1000;

interface BybitResponse {
  retCode: number;
  retMsg: string;
  result: {
    symbol: string;
    category: string;
    list: BybitKlineRaw[];
  };
}

/**
 * Bybit API data source.
 * Provides historical OHLCV data from 2020.
 * Used as fallback when Binance is unavailable.
 */
@Injectable()
export class BybitSource implements DataSource {
  readonly name = 'bybit';
  private readonly logger = new Logger(BybitSource.name);

  /**
   * Bybit has perpetuals data from around 2020.
   */
  getHistoricalStart(): Date {
    return new Date('2020-01-01');
  }

  /**
   * Check if a TFC symbol is supported by Bybit.
   */
  supportsSymbol(tfcSymbol: string): boolean {
    return isSymbolSupported(tfcSymbol, 'bybit');
  }

  /**
   * Fetch candles from Bybit API.
   * Handles pagination for large date ranges.
   */
  async fetchCandles(
    tfcSymbol: string,
    interval: string,
    startTime: number,
    endTime: number
  ): Promise<Candle[]> {
    const bybitSymbol = mapSymbol(tfcSymbol, 'bybit');
    const bybitInterval = mapInterval(interval, 'bybit');

    if (!bybitSymbol) {
      this.logger.warn(`Symbol ${tfcSymbol} not supported by Bybit`);
      return [];
    }

    const allCandles: Candle[] = [];
    let currentEnd = endTime;

    // Bybit returns data in reverse order (newest first), so we paginate backwards
    while (currentEnd > startTime) {
      try {
        const url = `${BYBIT_API}/v5/market/kline?category=linear&symbol=${bybitSymbol}&interval=${bybitInterval}&start=${startTime}&end=${currentEnd}&limit=${MAX_CANDLES_PER_REQUEST}`;

        this.logger.debug(`Fetching from Bybit: ${url}`);

        const response = await fetch(url);

        if (!response.ok) {
          const errorText = await response.text();
          this.logger.error(`Bybit API error: ${response.status} - ${errorText}`);
          throw new Error(`Bybit API error: ${response.status}`);
        }

        const data: BybitResponse = await response.json();

        if (data.retCode !== 0) {
          this.logger.error(`Bybit API returned error: ${data.retMsg}`);
          throw new Error(`Bybit API error: ${data.retMsg}`);
        }

        const rawCandles = data.result.list;

        if (rawCandles.length === 0) {
          break;
        }

        // adaptBybitCandles reverses the order
        const candles = adaptBybitCandles(rawCandles);
        allCandles.unshift(...candles);

        // Move end time to before the oldest candle we received
        const oldestCandle = candles[0];
        currentEnd = oldestCandle.t - 1;

        // If we got fewer candles than the limit, we've reached the beginning
        if (rawCandles.length < MAX_CANDLES_PER_REQUEST) {
          break;
        }

        // Small delay to avoid rate limiting
        await this.delay(50);
      } catch (error) {
        this.logger.error(`Failed to fetch from Bybit: ${error}`);
        throw error;
      }
    }

    this.logger.log(`Fetched ${allCandles.length} candles from Bybit for ${tfcSymbol}`);
    return allCandles;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
