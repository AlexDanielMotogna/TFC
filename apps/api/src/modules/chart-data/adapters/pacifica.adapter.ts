import { Candle, PacificaKlineRaw } from '../types.js';

/**
 * Adapt Pacifica kline data to unified Candle format.
 *
 * Pacifica format: { t, T, s, i, o, h, l, c, v, n }
 * Unified format: { t, o, h, l, c, v }
 */
export function adaptPacificaCandle(raw: PacificaKlineRaw): Candle {
  return {
    t: raw.t,                     // Open time (already ms)
    o: parseFloat(raw.o),         // Open
    h: parseFloat(raw.h),         // High
    l: parseFloat(raw.l),         // Low
    c: parseFloat(raw.c),         // Close
    v: parseFloat(raw.v),         // Volume
  };
}

/**
 * Adapt multiple Pacifica candles.
 */
export function adaptPacificaCandles(raw: PacificaKlineRaw[]): Candle[] {
  return raw.map(adaptPacificaCandle);
}
