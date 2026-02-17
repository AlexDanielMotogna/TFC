/**
 * Market Data Provider Interface
 * Abstract interface for fetching market data from any exchange.
 * The AI service depends on this interface, never on a specific exchange.
 */

import type { MarketDataBundle, CandleData, OrderbookSnapshot, MarketSnapshot } from '../types/AiBias.types';

export interface IMarketDataProvider {
  readonly name: string;  // "pacifica", "hyperliquid", "lighter"

  /** Fetch current market snapshot (price, funding, volume, OI) */
  getMarketSnapshot(symbol: string): Promise<MarketSnapshot>;

  /** Fetch OHLCV candles for a given interval */
  getCandles(symbol: string, interval: string, limit: number): Promise<CandleData[]>;

  /** Fetch order book snapshot (top N levels) */
  getOrderbook(symbol: string, levels?: number): Promise<OrderbookSnapshot>;

  /** Check if this provider supports a given symbol */
  supportsSymbol(symbol: string): boolean;
}

export interface IMarketDataAggregator {
  /**
   * Fetch complete market data bundle for AI analysis.
   * Uses the primary provider, falls back to secondary if available.
   */
  getMarketDataBundle(symbol: string): Promise<MarketDataBundle>;
}
