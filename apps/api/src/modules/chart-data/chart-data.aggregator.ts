import { Injectable, Logger } from '@nestjs/common';
import { Candle } from './types.js';
import { BinanceSource } from './sources/binance.source.js';
import { BybitSource } from './sources/bybit.source.js';
import { PacificaSource } from './sources/pacifica.source.js';

/**
 * ChartDataAggregator orchestrates data fetching from multiple sources.
 *
 * Strategy:
 * - June 2025+ → Pacifica (primary, real-time)
 * - Before June 2025 → Binance (6+ years of history)
 * - Fallback → Bybit (if Binance fails)
 *
 * This ensures users get deep historical data for technical analysis
 * while keeping Pacifica as the source of truth for recent data.
 */
@Injectable()
export class ChartDataAggregator {
  private readonly logger = new Logger(ChartDataAggregator.name);

  /**
   * Pacifica data starts June 1, 2025.
   * Before this date, we use Binance/Bybit.
   */
  private readonly pacificaStartDate = new Date('2025-06-01');

  constructor(
    private readonly pacificaSource: PacificaSource,
    private readonly binanceSource: BinanceSource,
    private readonly bybitSource: BybitSource
  ) {}

  /**
   * Get candles for a symbol, automatically choosing the best source(s).
   *
   * @param tfcSymbol - TFC format symbol (e.g., "BTC-USD")
   * @param interval - Candle interval (e.g., "1h", "1d")
   * @param startTime - Start timestamp in milliseconds
   * @param endTime - End timestamp in milliseconds
   * @returns Array of candles sorted by time ascending
   */
  async getCandles(
    tfcSymbol: string,
    interval: string,
    startTime: number,
    endTime: number
  ): Promise<Candle[]> {
    const pacificaStartMs = this.pacificaStartDate.getTime();

    this.logger.log(
      `Getting candles for ${tfcSymbol} ${interval} from ${new Date(startTime).toISOString()} to ${new Date(endTime).toISOString()}`
    );

    // Case 1: All data is within Pacifica's range (June 2025+)
    if (startTime >= pacificaStartMs) {
      this.logger.debug('All data within Pacifica range');
      return this.fetchFromPacifica(tfcSymbol, interval, startTime, endTime);
    }

    // Case 2: All data is before Pacifica's range (historical only)
    if (endTime < pacificaStartMs) {
      this.logger.debug('All data is historical (before Pacifica)');
      return this.fetchHistorical(tfcSymbol, interval, startTime, endTime);
    }

    // Case 3: Split request - need both historical and recent data
    this.logger.debug('Split request: historical + recent');

    const historicalEnd = pacificaStartMs - 1;
    const recentStart = pacificaStartMs;

    const [historical, recent] = await Promise.all([
      this.fetchHistorical(tfcSymbol, interval, startTime, historicalEnd),
      this.fetchFromPacifica(tfcSymbol, interval, recentStart, endTime),
    ]);

    // Merge and deduplicate
    return this.mergeCandles(historical, recent);
  }

  /**
   * Fetch recent data from Pacifica.
   */
  private async fetchFromPacifica(
    tfcSymbol: string,
    interval: string,
    startTime: number,
    endTime: number
  ): Promise<Candle[]> {
    try {
      return await this.pacificaSource.fetchCandles(tfcSymbol, interval, startTime, endTime);
    } catch (error) {
      this.logger.error(`Pacifica fetch failed: ${error}`);
      // Pacifica is primary for recent data - don't fallback for recent data
      throw error;
    }
  }

  /**
   * Fetch historical data with fallback.
   * Try Binance first, fallback to Bybit if Binance fails.
   */
  private async fetchHistorical(
    tfcSymbol: string,
    interval: string,
    startTime: number,
    endTime: number
  ): Promise<Candle[]> {
    // Try Binance first (better coverage)
    try {
      this.logger.debug('Trying Binance for historical data');
      const candles = await this.binanceSource.fetchCandles(
        tfcSymbol,
        interval,
        startTime,
        endTime
      );
      if (candles.length > 0) {
        return candles;
      }
    } catch (error) {
      this.logger.warn(`Binance failed, trying Bybit: ${error}`);
    }

    // Fallback to Bybit
    try {
      this.logger.debug('Trying Bybit as fallback');
      return await this.bybitSource.fetchCandles(tfcSymbol, interval, startTime, endTime);
    } catch (error) {
      this.logger.error(`Bybit also failed: ${error}`);
      // Return empty array instead of throwing - allows partial data
      return [];
    }
  }

  /**
   * Merge candles from multiple sources, removing duplicates.
   * Recent data (Pacifica) takes precedence over historical.
   */
  private mergeCandles(historical: Candle[], recent: Candle[]): Candle[] {
    const map = new Map<number, Candle>();

    // Add historical first
    for (const candle of historical) {
      map.set(candle.t, candle);
    }

    // Recent overwrites historical (Pacifica is source of truth for Jun 2025+)
    for (const candle of recent) {
      map.set(candle.t, candle);
    }

    // Sort by timestamp ascending
    return Array.from(map.values()).sort((a, b) => a.t - b.t);
  }

  /**
   * Get the earliest available date for historical data.
   */
  getEarliestAvailableDate(): Date {
    return this.binanceSource.getHistoricalStart();
  }
}
