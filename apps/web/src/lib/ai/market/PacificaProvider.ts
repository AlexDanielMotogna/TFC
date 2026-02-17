/**
 * Pacifica Market Data Provider
 * Wraps existing ExchangeAdapter to implement IMarketDataProvider.
 * Delegates to the established Pacifica infrastructure.
 */

import type { IMarketDataProvider } from './IMarketDataProvider';
import type { MarketSnapshot, CandleData, OrderbookSnapshot } from '../types/AiBias.types';
import { ExchangeProvider } from '@/lib/server/exchanges/provider';

// Pacifica symbol normalization: "BTC-USD" → "BTC"
function toPacificaSymbol(symbol: string): string {
  return symbol.replace('-USD', '');
}

export class PacificaProvider implements IMarketDataProvider {
  readonly name = 'pacifica';

  private getAdapter() {
    return ExchangeProvider.getAdapter('pacifica');
  }

  supportsSymbol(_symbol: string): boolean {
    // Pacifica supports all symbols we list
    return true;
  }

  async getMarketSnapshot(symbol: string): Promise<MarketSnapshot> {
    const adapter = this.getAdapter();
    const prices = await adapter.getPrices();

    const normalizedSymbol = symbol.includes('-USD') ? symbol : `${symbol}-USD`;
    const price = prices.find(p => p.symbol === normalizedSymbol);

    if (!price) {
      throw new Error(`Symbol ${symbol} not found on Pacifica`);
    }

    return {
      symbol: normalizedSymbol,
      currentPrice: parseFloat(price.index) || parseFloat(price.mark),
      markPrice: parseFloat(price.mark),
      change24h: parseFloat(price.change24h),
      volume24h: parseFloat(price.volume24h),
      openInterest: 0, // Not available in Price interface, will be filled from candle context
      fundingRate: parseFloat(price.funding),
      nextFundingRate: 0,
      timestamp: price.timestamp,
    };
  }

  async getCandles(symbol: string, interval: string, limit: number): Promise<CandleData[]> {
    const adapter = this.getAdapter();

    // Calculate start time based on interval and limit
    const intervalMs = intervalToMs(interval);
    const endTime = Date.now();
    const startTime = endTime - (intervalMs * limit);

    const candles = await adapter.getKlines({
      symbol: symbol.includes('-USD') ? symbol : `${symbol}-USD`,
      interval,
      startTime,
      endTime,
      limit,
    });

    return candles.map(c => ({
      timestamp: c.timestamp,
      open: parseFloat(c.open),
      high: parseFloat(c.high),
      low: parseFloat(c.low),
      close: parseFloat(c.close),
      volume: parseFloat(c.volume),
    }));
  }

  async getOrderbook(symbol: string, levels: number = 10): Promise<OrderbookSnapshot> {
    const adapter = this.getAdapter();
    const normalizedSymbol = symbol.includes('-USD') ? symbol : `${symbol}-USD`;
    const book = await adapter.getOrderbook(normalizedSymbol, 1);

    return {
      bids: book.bids.slice(0, levels).map(([p, s]) => [parseFloat(p), parseFloat(s)]),
      asks: book.asks.slice(0, levels).map(([p, s]) => [parseFloat(p), parseFloat(s)]),
      timestamp: book.timestamp,
    };
  }
}

function intervalToMs(interval: string): number {
  const map: Record<string, number> = {
    '1m': 60_000,
    '3m': 180_000,
    '5m': 300_000,
    '15m': 900_000,
    '30m': 1_800_000,
    '1h': 3_600_000,
    '2h': 7_200_000,
    '4h': 14_400_000,
    '8h': 28_800_000,
    '12h': 43_200_000,
    '1d': 86_400_000,
  };
  return map[interval] || 3_600_000;
}
