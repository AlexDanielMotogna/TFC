/**
 * Market Data Aggregator
 * Orchestrates data collection from one or more IMarketDataProvider instances.
 * Supports primary + fallback strategy and parallel fetching.
 */

import type { IMarketDataProvider, IMarketDataAggregator } from './IMarketDataProvider';
import type { MarketDataBundle } from '../types/AiBias.types';

export class MarketDataAggregator implements IMarketDataAggregator {
  private providers: IMarketDataProvider[];

  constructor(providers: IMarketDataProvider[]) {
    if (providers.length === 0) {
      throw new Error('MarketDataAggregator requires at least one provider');
    }
    this.providers = providers;
  }

  /**
   * Fetch complete market data bundle.
   * Tries providers in order (primary first, then fallbacks).
   * Fetches candles, snapshot, and orderbook in parallel for speed.
   */
  async getMarketDataBundle(symbol: string): Promise<MarketDataBundle> {
    const provider = this.resolveProvider(symbol);

    const [snapshot, candles1h, candles4h, candles1d, orderbook] = await Promise.all([
      provider.getMarketSnapshot(symbol),
      provider.getCandles(symbol, '1h', 50),
      provider.getCandles(symbol, '4h', 20),
      provider.getCandles(symbol, '1d', 10),
      provider.getOrderbook(symbol, 10),
    ]);

    return {
      snapshot,
      candles1h,
      candles4h,
      candles1d,
      orderbook,
    };
  }

  /**
   * Find the first provider that supports the symbol.
   * Falls back through the provider list in order.
   */
  private resolveProvider(symbol: string): IMarketDataProvider {
    for (const provider of this.providers) {
      if (provider.supportsSymbol(symbol)) {
        return provider;
      }
    }
    throw new Error(`No provider supports symbol: ${symbol}`);
  }
}
