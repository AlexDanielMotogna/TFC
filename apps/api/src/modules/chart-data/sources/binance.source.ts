import { Injectable, Logger } from '@nestjs/common';
import { Candle, DataSource, BinanceKlineRaw } from '../types.js';
import { adaptBinanceCandles } from '../adapters/index.js';
import { mapSymbol, mapInterval, isSymbolSupported } from '../symbol-mapping.js';

const BINANCE_FUTURES_API = 'https://fapi.binance.com';
const MAX_CANDLES_PER_REQUEST = 1500;

/**
 * Binance Futures API data source.
 * Provides historical OHLCV data from September 2019.
 */
@Injectable()
export class BinanceSource implements DataSource {
  readonly name = 'binance';
  private readonly logger = new Logger(BinanceSource.name);

  /**
   * Binance Futures launched in September 2019.
   */
  getHistoricalStart(): Date {
    return new Date('2019-09-01');
  }

  /**
   * Check if a TFC symbol is supported by Binance.
   */
  supportsSymbol(tfcSymbol: string): boolean {
    return isSymbolSupported(tfcSymbol, 'binance');
  }

  /**
   * Fetch candles from Binance Futures API.
   * Handles pagination for large date ranges.
   */
  async fetchCandles(
    tfcSymbol: string,
    interval: string,
    startTime: number,
    endTime: number
  ): Promise<Candle[]> {
    const binanceSymbol = mapSymbol(tfcSymbol, 'binance');
    const binanceInterval = mapInterval(interval, 'binance');

    if (!binanceSymbol) {
      this.logger.warn(`Symbol ${tfcSymbol} not supported by Binance`);
      return [];
    }

    const allCandles: Candle[] = [];
    let currentStart = startTime;

    // Paginate through the date range
    while (currentStart < endTime) {
      try {
        const url = `${BINANCE_FUTURES_API}/fapi/v1/klines?symbol=${binanceSymbol}&interval=${binanceInterval}&startTime=${currentStart}&endTime=${endTime}&limit=${MAX_CANDLES_PER_REQUEST}`;

        this.logger.debug(`Fetching from Binance: ${url}`);

        const response = await fetch(url);

        if (!response.ok) {
          const errorText = await response.text();
          this.logger.error(`Binance API error: ${response.status} - ${errorText}`);
          throw new Error(`Binance API error: ${response.status}`);
        }

        const data: BinanceKlineRaw[] = await response.json();

        if (data.length === 0) {
          break;
        }

        const candles = adaptBinanceCandles(data);
        allCandles.push(...candles);

        // Move start time to after the last candle
        const lastCandle = candles[candles.length - 1];
        currentStart = lastCandle.t + 1;

        // If we got fewer candles than the limit, we've reached the end
        if (data.length < MAX_CANDLES_PER_REQUEST) {
          break;
        }

        // Small delay to avoid rate limiting
        await this.delay(50);
      } catch (error) {
        this.logger.error(`Failed to fetch from Binance: ${error}`);
        throw error;
      }
    }

    this.logger.log(`Fetched ${allCandles.length} candles from Binance for ${tfcSymbol}`);
    return allCandles;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
