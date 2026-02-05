import { Candle, BinanceKlineRaw } from '../types.js';

/**
 * Adapt Binance Futures kline data to unified Candle format.
 *
 * Binance format: [openTime, open, high, low, close, volume, closeTime, quoteVolume, trades, ...]
 * Unified format: { t, o, h, l, c, v }
 */
export function adaptBinanceCandle(raw: BinanceKlineRaw): Candle {
  return {
    t: raw[0],                    // Open time (already ms)
    o: parseFloat(raw[1]),        // Open
    h: parseFloat(raw[2]),        // High
    l: parseFloat(raw[3]),        // Low
    c: parseFloat(raw[4]),        // Close
    v: parseFloat(raw[5]),        // Volume
  };
}

/**
 * Adapt multiple Binance candles.
 */
export function adaptBinanceCandles(raw: BinanceKlineRaw[]): Candle[] {
  return raw.map(adaptBinanceCandle);
}
