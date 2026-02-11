/**
 * Unified candle format used across all data sources.
 * Matches Pacifica's format for seamless integration.
 */
export interface Candle {
  t: number;  // timestamp (ms)
  o: number;  // open
  h: number;  // high
  l: number;  // low
  c: number;  // close
  v: number;  // volume
}

/**
 * Interface for data source implementations.
 * Each source (Pacifica, Binance, Bybit) implements this interface.
 */
export interface DataSource {
  readonly name: string;
  fetchCandles(
    symbol: string,
    interval: string,
    startTime: number,
    endTime: number
  ): Promise<Candle[]>;
  getHistoricalStart(): Date;
  supportsSymbol(symbol: string): boolean;
}

/**
 * Supported intervals across all data sources.
 */
export type Interval = '1m' | '3m' | '5m' | '15m' | '30m' | '1h' | '2h' | '4h' | '8h' | '12h' | '1d';

/**
 * Raw response format from Binance Futures API.
 * Array of: [openTime, open, high, low, close, volume, closeTime, quoteVolume, trades, takerBuyBase, takerBuyQuote, ignore]
 */
export type BinanceKlineRaw = [
  number,   // 0: Open time
  string,   // 1: Open
  string,   // 2: High
  string,   // 3: Low
  string,   // 4: Close
  string,   // 5: Volume
  number,   // 6: Close time
  string,   // 7: Quote asset volume
  number,   // 8: Number of trades
  string,   // 9: Taker buy base asset volume
  string,   // 10: Taker buy quote asset volume
  string    // 11: Ignore
];

/**
 * Raw response format from Bybit API.
 * Array of: [startTime, open, high, low, close, volume, turnover]
 */
export type BybitKlineRaw = [
  string,   // 0: Start time (ms as string)
  string,   // 1: Open
  string,   // 2: High
  string,   // 3: Low
  string,   // 4: Close
  string,   // 5: Volume
  string    // 6: Turnover
];

/**
 * Raw response format from Pacifica API.
 */
export interface PacificaKlineRaw {
  t: number;    // open time (ms)
  T: number;    // close time (ms)
  s: string;    // symbol
  i: string;    // interval
  o: string;    // open
  c: string;    // close
  h: string;    // high
  l: string;    // low
  v: string;    // volume
  n: number;    // number of trades
}
