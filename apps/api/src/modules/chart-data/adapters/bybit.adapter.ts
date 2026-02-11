import { Candle, BybitKlineRaw } from '../types.js';

/**
 * Adapt Bybit kline data to unified Candle format.
 *
 * Bybit format: [startTime, open, high, low, close, volume, turnover]
 * Unified format: { t, o, h, l, c, v }
 *
 * Note: Bybit returns data in REVERSE order (newest first), so we need to reverse it.
 */
export function adaptBybitCandle(raw: BybitKlineRaw): Candle {
  return {
    t: parseInt(raw[0], 10),      // Start time (ms as string)
    o: parseFloat(raw[1]),        // Open
    h: parseFloat(raw[2]),        // High
    l: parseFloat(raw[3]),        // Low
    c: parseFloat(raw[4]),        // Close
    v: parseFloat(raw[5]),        // Volume
  };
}

/**
 * Adapt multiple Bybit candles and reverse to ascending order.
 */
export function adaptBybitCandles(raw: BybitKlineRaw[]): Candle[] {
  // Bybit returns newest first, we need oldest first
  return raw.map(adaptBybitCandle).reverse();
}
