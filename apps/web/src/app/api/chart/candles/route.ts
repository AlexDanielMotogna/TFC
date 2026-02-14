/**
 * Chart Candles API endpoint with multi-source aggregation
 * GET /api/chart/candles - Get historical candles from multiple sources
 *
 * Strategy:
 * 1. Pacifica (primary) - Recent data from June 2025+
 * 2. Binance (fallback) - Historical futures data (2019+)
 * 3. Bybit (fallback) - Historical futures data (2019+)
 * 4. CoinGecko (fallback) - Maximum historical coverage, daily data only
 */
import { errorResponse, BadRequestError, ApiError, ServiceUnavailableError } from '@/lib/server/errors';
import { ErrorCode } from '@/lib/server/error-codes';
import * as Pacifica from '@/lib/server/pacifica';

const BINANCE_FUTURES_API = 'https://fapi.binance.com';
const BYBIT_API = 'https://api.bybit.com';
const COINGECKO_API = 'https://api.coingecko.com/api/v3';

// Unified candle format
interface Candle {
  t: number;  // timestamp (ms)
  o: number;  // open
  h: number;  // high
  l: number;  // low
  c: number;  // close
  v: number;  // volume
}

// Symbol mapping (including CoinGecko IDs)
const SYMBOL_MAP: Record<string, { pacifica: string; binance: string; bybit: string; coingecko: string }> = {
  'BTC-USD': { pacifica: 'BTC', binance: 'BTCUSDT', bybit: 'BTCUSDT', coingecko: 'bitcoin' },
  'ETH-USD': { pacifica: 'ETH', binance: 'ETHUSDT', bybit: 'ETHUSDT', coingecko: 'ethereum' },
  'SOL-USD': { pacifica: 'SOL', binance: 'SOLUSDT', bybit: 'SOLUSDT', coingecko: 'solana' },
  'BNB-USD': { pacifica: 'BNB', binance: 'BNBUSDT', bybit: 'BNBUSDT', coingecko: 'binancecoin' },
  'XRP-USD': { pacifica: 'XRP', binance: 'XRPUSDT', bybit: 'XRPUSDT', coingecko: 'ripple' },
  'DOGE-USD': { pacifica: 'DOGE', binance: 'DOGEUSDT', bybit: 'DOGEUSDT', coingecko: 'dogecoin' },
  'ADA-USD': { pacifica: 'ADA', binance: 'ADAUSDT', bybit: 'ADAUSDT', coingecko: 'cardano' },
  'AVAX-USD': { pacifica: 'AVAX', binance: 'AVAXUSDT', bybit: 'AVAXUSDT', coingecko: 'avalanche-2' },
  'LINK-USD': { pacifica: 'LINK', binance: 'LINKUSDT', bybit: 'LINKUSDT', coingecko: 'chainlink' },
  'SUI-USD': { pacifica: 'SUI', binance: 'SUIUSDT', bybit: 'SUIUSDT', coingecko: 'sui' },
  'APT-USD': { pacifica: 'APT', binance: 'APTUSDT', bybit: 'APTUSDT', coingecko: 'aptos' },
  'SEI-USD': { pacifica: 'SEI', binance: 'SEIUSDT', bybit: 'SEIUSDT', coingecko: 'sei-network' },
  'TIA-USD': { pacifica: 'TIA', binance: 'TIAUSDT', bybit: 'TIAUSDT', coingecko: 'celestia' },
  'INJ-USD': { pacifica: 'INJ', binance: 'INJUSDT', bybit: 'INJUSDT', coingecko: 'injective-protocol' },
  'ARB-USD': { pacifica: 'ARB', binance: 'ARBUSDT', bybit: 'ARBUSDT', coingecko: 'arbitrum' },
  'OP-USD': { pacifica: 'OP', binance: 'OPUSDT', bybit: 'OPUSDT', coingecko: 'optimism' },
  'STX-USD': { pacifica: 'STX', binance: 'STXUSDT', bybit: 'STXUSDT', coingecko: 'blockstack' },
  'IMX-USD': { pacifica: 'IMX', binance: 'IMXUSDT', bybit: 'IMXUSDT', coingecko: 'immutable-x' },
  'AAVE-USD': { pacifica: 'AAVE', binance: 'AAVEUSDT', bybit: 'AAVEUSDT', coingecko: 'aave' },
  'JUP-USD': { pacifica: 'JUP', binance: 'JUPUSDT', bybit: 'JUPUSDT', coingecko: 'jupiter-exchange-solana' },
  'PENDLE-USD': { pacifica: 'PENDLE', binance: 'PENDLEUSDT', bybit: 'PENDLEUSDT', coingecko: 'pendle' },
  'ENA-USD': { pacifica: 'ENA', binance: 'ENAUSDT', bybit: 'ENAUSDT', coingecko: 'ethena' },
  'RENDER-USD': { pacifica: 'RENDER', binance: 'RENDERUSDT', bybit: 'RENDERUSDT', coingecko: 'render-token' },
  'FET-USD': { pacifica: 'FET', binance: 'FETUSDT', bybit: 'FETUSDT', coingecko: 'fetch-ai' },
  'WIF-USD': { pacifica: 'WIF', binance: 'WIFUSDT', bybit: 'WIFUSDT', coingecko: 'dogwifcoin' },
  'KPEPE-USD': { pacifica: '1000PEPE', binance: '1000PEPEUSDT', bybit: '1000PEPEUSDT', coingecko: 'pepe' },
  'WLD-USD': { pacifica: 'WLD', binance: 'WLDUSDT', bybit: 'WLDUSDT', coingecko: 'worldcoin-wld' },
  'HYPE-USD': { pacifica: 'HYPE', binance: 'HYPEUSDT', bybit: 'HYPEUSDT', coingecko: 'hyperliquid' },
};

// Interval mapping for Bybit
const BYBIT_INTERVAL_MAP: Record<string, string> = {
  '1m': '1', '3m': '3', '5m': '5', '15m': '15', '30m': '30',
  '1h': '60', '2h': '120', '4h': '240', '8h': '480', '12h': '720', '1d': 'D',
};

function mapSymbol(tfcSymbol: string, source: 'binance' | 'bybit' | 'pacifica'): string | null {
  const mapping = SYMBOL_MAP[tfcSymbol];
  if (mapping) return mapping[source];
  // Fallback for unknown symbols
  const base = tfcSymbol.replace('-USD', '');
  if (source === 'pacifica') return base;
  return `${base}USDT`;
}

// Fetch from Binance Futures
async function fetchFromBinance(
  tfcSymbol: string,
  interval: string,
  startTime: number,
  endTime: number
): Promise<Candle[]> {
  const binanceSymbol = mapSymbol(tfcSymbol, 'binance');
  if (!binanceSymbol) return [];

  const allCandles: Candle[] = [];
  let currentStart = startTime;
  const MAX_LIMIT = 1500;

  while (currentStart < endTime) {
    const url = `${BINANCE_FUTURES_API}/fapi/v1/klines?symbol=${binanceSymbol}&interval=${interval}&startTime=${currentStart}&endTime=${endTime}&limit=${MAX_LIMIT}`;

    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Binance API error: ${response.status}`);
      throw new ServiceUnavailableError(`Binance API error: ${response.status}`, ErrorCode.ERR_EXTERNAL_PACIFICA_API);
    }

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) break;

    // Binance format: [openTime, open, high, low, close, volume, closeTime, ...]
    const candles: Candle[] = data.map((k: (number | string)[]) => ({
      t: k[0] as number,
      o: parseFloat(k[1] as string),
      h: parseFloat(k[2] as string),
      l: parseFloat(k[3] as string),
      c: parseFloat(k[4] as string),
      v: parseFloat(k[5] as string),
    }));

    allCandles.push(...candles);

    // Move to next batch
    const lastCandle = candles[candles.length - 1];
    if (!lastCandle) break;
    currentStart = lastCandle.t + 1;

    if (data.length < MAX_LIMIT) break;

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  return allCandles;
}

// Fetch from Bybit (fallback)
async function fetchFromBybit(
  tfcSymbol: string,
  interval: string,
  startTime: number,
  endTime: number
): Promise<Candle[]> {
  const bybitSymbol = mapSymbol(tfcSymbol, 'bybit');
  const bybitInterval = BYBIT_INTERVAL_MAP[interval] || interval;
  if (!bybitSymbol) return [];

  const allCandles: Candle[] = [];
  let currentEnd = endTime;
  const MAX_LIMIT = 1000;

  while (currentEnd > startTime) {
    const url = `${BYBIT_API}/v5/market/kline?category=linear&symbol=${bybitSymbol}&interval=${bybitInterval}&start=${startTime}&end=${currentEnd}&limit=${MAX_LIMIT}`;

    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Bybit API error: ${response.status}`);
      throw new ServiceUnavailableError(`Bybit API error: ${response.status}`, ErrorCode.ERR_EXTERNAL_PACIFICA_API);
    }

    const data = await response.json();
    if (data.retCode !== 0) {
      throw new ServiceUnavailableError(`Bybit API error: ${data.retMsg}`, ErrorCode.ERR_EXTERNAL_PACIFICA_API);
    }

    if (!data.result || !data.result.list) {
      console.warn(`[Chart] Bybit returned invalid data structure`);
      break;
    }

    const rawCandles = data.result.list;
    if (rawCandles.length === 0) break;

    // Bybit format: [startTime, open, high, low, close, volume, turnover] - newest first
    const candles: Candle[] = rawCandles.map((k: string[]) => ({
      t: parseInt(k[0] ?? '0'),
      o: parseFloat(k[1] ?? '0'),
      h: parseFloat(k[2] ?? '0'),
      l: parseFloat(k[3] ?? '0'),
      c: parseFloat(k[4] ?? '0'),
      v: parseFloat(k[5] ?? '0'),
    })).reverse(); // Reverse to get oldest first

    allCandles.unshift(...candles);

    // Move end time to before oldest candle
    const oldestCandle = candles[0];
    if (!oldestCandle) break;
    currentEnd = oldestCandle.t - 1;

    if (rawCandles.length < MAX_LIMIT) break;

    await new Promise(resolve => setTimeout(resolve, 50));
  }

  return allCandles;
}

// Fetch from CoinGecko (maximum historical coverage)
async function fetchFromCoinGecko(
  tfcSymbol: string,
  interval: string,
  startTime: number,
  endTime: number
): Promise<Candle[]> {
  const coingeckoId = SYMBOL_MAP[tfcSymbol]?.coingecko;
  if (!coingeckoId) return [];

  // CoinGecko OHLC endpoint supports daily and hourly data
  // For intervals >= 1 day: use daily data
  // For intervals < 1 day: use hourly data (limited to 90 days)
  const isDailyOrGreater = ['1d'].includes(interval);

  // Calculate time range in days
  const daysRange = Math.ceil((endTime - startTime) / (24 * 60 * 60 * 1000));

  try {
    let url: string;

    if (isDailyOrGreater) {
      // Use /ohlc endpoint for daily data (max 365 days)
      const days = Math.min(daysRange, 365);
      url = `${COINGECKO_API}/coins/${coingeckoId}/ohlc?vs_currency=usd&days=${days}`;
    } else {
      // For intraday intervals, CoinGecko doesn't have granular OHLC
      // We can only get market_chart data which has limited granularity
      // Skip CoinGecko for intraday intervals as it won't match the requested interval
      console.log(`[Chart] CoinGecko skipped for ${tfcSymbol} - doesn't support ${interval} interval`);
      return [];
    }

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`CoinGecko API error: ${response.status}`);
      return [];
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      console.log(`[Chart] CoinGecko returned no data for ${tfcSymbol}`);
      return [];
    }

    // CoinGecko OHLC format: [timestamp_ms, open, high, low, close]
    // Note: CoinGecko doesn't provide volume in OHLC endpoint
    const candles: Candle[] = data
      .filter((k: number[]) => k.length >= 5 && k[0] != null) // Ensure valid data
      .map((k: number[]) => ({
        t: k[0]!,
        o: k[1]!,
        h: k[2]!,
        l: k[3]!,
        c: k[4]!,
        v: 0, // CoinGecko OHLC doesn't include volume
      }))
      .filter(c => c.t >= startTime && c.t <= endTime); // Filter to requested range

    console.log(`[Chart] CoinGecko returned ${candles.length} candles for ${tfcSymbol}`);
    return candles;
  } catch (error: any) {
    console.warn(`[Chart] CoinGecko failed for ${tfcSymbol}:`, error?.message || error);
    return [];
  }
}

// Fetch from Pacifica with rate limit handling
async function fetchFromPacifica(
  tfcSymbol: string,
  interval: string,
  startTime: number,
  endTime: number,
  retryCount = 0
): Promise<Candle[]> {
  const pacificaSymbol = mapSymbol(tfcSymbol, 'pacifica');
  if (!pacificaSymbol) return [];

  // Validate time range - Pacifica requires start < end
  if (startTime >= endTime) {
    console.warn(`[Chart] Invalid time range for Pacifica: start=${startTime} >= end=${endTime}`);
    return [];
  }

  const USE_EXCHANGE_ADAPTER = process.env.USE_EXCHANGE_ADAPTER !== 'false';

  try {
    if (USE_EXCHANGE_ADAPTER) {
      // Use Exchange Adapter (with caching if Redis configured)
      const { ExchangeProvider } = await import('@/lib/server/exchanges/provider');
      const adapter = ExchangeProvider.getAdapter('pacifica');
      const rawCandles = await adapter.getKlines({
        symbol: tfcSymbol, // Adapter expects normalized symbol (BTC-USD)
        interval,
        startTime,
        endTime,
      });

      // Adapter returns normalized {timestamp, open, high, low, close, volume}
      // Convert to chart format {t, o, h, l, c, v}
      return rawCandles.map(c => ({
        t: c.timestamp,
        o: parseFloat(c.open),
        h: parseFloat(c.high),
        l: parseFloat(c.low),
        c: parseFloat(c.close),
        v: parseFloat(c.volume),
      }));
    }

    // Fallback to direct Pacifica calls
    const rawCandles = await Pacifica.getKlines({
      symbol: pacificaSymbol,
      interval,
      startTime,
      endTime,
    });

    return rawCandles.map(c => ({
      t: c.t,
      o: parseFloat(c.o),
      h: parseFloat(c.h),
      l: parseFloat(c.l),
      c: parseFloat(c.c),
      v: parseFloat(c.v),
    }));
  } catch (error: any) {
    // Handle rate limit errors with exponential backoff
    const isRateLimit = error?.message?.includes('rate limit') ||
                        error?.name === 'RateLimitError' ||
                        error?.status === 429;

    if (isRateLimit && retryCount < 3) {
      const delayMs = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
      console.log(`[Chart] Pacifica rate limited, retrying in ${delayMs}ms (attempt ${retryCount + 1}/3)`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      return fetchFromPacifica(tfcSymbol, interval, startTime, endTime, retryCount + 1);
    }

    console.error('Pacifica fetch error:', error);
    throw error;
  }
}

// Fetch historical data with fallback chain: Binance → Bybit → CoinGecko
async function fetchHistorical(
  tfcSymbol: string,
  interval: string,
  startTime: number,
  endTime: number
): Promise<Candle[]> {
  // Try Binance first
  try {
    console.log(`[Chart] Trying Binance for ${tfcSymbol}...`);
    const candles = await fetchFromBinance(tfcSymbol, interval, startTime, endTime);
    if (candles.length > 0) {
      console.log(`[Chart] Binance success: ${candles.length} candles`);
      return candles;
    }
    console.log(`[Chart] Binance returned 0 candles`);
  } catch (error: any) {
    console.warn(`[Chart] Binance failed for ${tfcSymbol}:`, error?.message || error);
  }

  // Try Bybit as second fallback
  try {
    console.log(`[Chart] Trying Bybit for ${tfcSymbol}...`);
    const candles = await fetchFromBybit(tfcSymbol, interval, startTime, endTime);
    if (candles.length > 0) {
      console.log(`[Chart] Bybit success: ${candles.length} candles`);
      return candles;
    }
    console.log(`[Chart] Bybit returned 0 candles`);
  } catch (error: any) {
    console.warn(`[Chart] Bybit failed for ${tfcSymbol}:`, error?.message || error);
  }

  // Try CoinGecko as third fallback (best for older historical data)
  try {
    console.log(`[Chart] Trying CoinGecko for ${tfcSymbol}...`);
    const candles = await fetchFromCoinGecko(tfcSymbol, interval, startTime, endTime);
    if (candles.length > 0) {
      console.log(`[Chart] CoinGecko success: ${candles.length} candles`);
      return candles;
    }
    console.log(`[Chart] CoinGecko returned 0 candles`);
  } catch (error: any) {
    console.warn(`[Chart] CoinGecko failed for ${tfcSymbol}:`, error?.message || error);
  }

  // All sources failed - return empty array (will use only Pacifica data)
  console.log(`[Chart] No historical data available from Binance/Bybit/CoinGecko for ${tfcSymbol}`);
  return [];
}

// Find the last available Pacifica candle timestamp
function findLastPacificaCandle(candles: Candle[]): number | null {
  if (candles.length === 0) return null;
  // Candles are sorted by time, so last candle has the latest timestamp
  const lastCandle = candles[candles.length - 1];
  return lastCandle ? lastCandle.t : null;
}

// Check if there are gaps in candle data (missing days)
function hasGaps(candles: Candle[], interval: string, expectedEnd: number): boolean {
  if (candles.length === 0) return true;

  const intervalMs = getIntervalMs(interval);
  const lastCandle = candles[candles.length - 1];

  if (!lastCandle) return true;

  // Check 1: Gap at the end (data doesn't reach expectedEnd)
  const gapAtEnd = expectedEnd - lastCandle.t;
  if (gapAtEnd > intervalMs * 2) {
    console.log(`[Chart] Gap detected at end: last candle is ${gapAtEnd / 1000 / 60 / 60 / 24} days before expected end`);
    return true;
  }

  // Check 2: Internal gaps (missing candles between data points)
  // Allow some tolerance: 2x interval for potential market closures
  const maxGap = intervalMs * 3;
  for (let i = 1; i < candles.length; i++) {
    const currentCandle = candles[i];
    const prevCandle = candles[i - 1];

    if (!currentCandle || !prevCandle) continue;

    const timeDiff = currentCandle.t - prevCandle.t;
    if (timeDiff > maxGap) {
      console.log(`[Chart] Internal gap detected: ${timeDiff / 1000 / 60 / 60 / 24} days between ${new Date(prevCandle.t).toISOString()} and ${new Date(currentCandle.t).toISOString()}`);
      return true;
    }
  }

  return false;
}

// Get interval in milliseconds
function getIntervalMs(interval: string): number {
  const map: Record<string, number> = {
    '1m': 60 * 1000,
    '3m': 3 * 60 * 1000,
    '5m': 5 * 60 * 1000,
    '15m': 15 * 60 * 1000,
    '30m': 30 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '2h': 2 * 60 * 60 * 1000,
    '4h': 4 * 60 * 60 * 1000,
    '8h': 8 * 60 * 60 * 1000,
    '12h': 12 * 60 * 60 * 1000,
    '1d': 24 * 60 * 60 * 1000,
  };
  return map[interval] || 60 * 1000;
}

// Merge candles from multiple sources
function mergeCandles(historical: Candle[], recent: Candle[]): Candle[] {
  const map = new Map<number, Candle>();
  for (const c of historical) map.set(c.t, c);
  for (const c of recent) map.set(c.t, c); // Recent overwrites historical
  return Array.from(map.values()).sort((a, b) => a.t - b.t);
}

// Fill gaps in candle data with synthetic candles (OHLC = previous close, volume = 0)
function fillCandleGaps(candles: Candle[], interval: string): Candle[] {
  if (candles.length < 2) return candles;

  const intervalMs = getIntervalMs(interval);
  const filled: Candle[] = [candles[0]];

  for (let i = 1; i < candles.length; i++) {
    const prev = filled[filled.length - 1];
    const curr = candles[i];

    const gap = curr.t - prev.t;
    const missingCount = Math.round(gap / intervalMs) - 1;

    // Fill gaps (cap at 1000 to avoid memory issues on large ranges)
    if (missingCount > 0 && missingCount <= 1000) {
      for (let j = 1; j <= missingCount; j++) {
        filled.push({
          t: prev.t + j * intervalMs,
          o: prev.c,
          h: prev.c,
          l: prev.c,
          c: prev.c,
          v: 0,
        });
      }
    }

    filled.push(curr);
  }

  return filled;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const interval = searchParams.get('interval');
    const startStr = searchParams.get('start');
    const endStr = searchParams.get('end');

    if (!symbol || !interval || !startStr || !endStr) {
      throw new BadRequestError('symbol, interval, start, and end are required', ErrorCode.ERR_VALIDATION_MISSING_FIELD);
    }

    const startTime = parseInt(startStr, 10);
    const endTime = parseInt(endStr, 10);

    if (isNaN(startTime) || isNaN(endTime)) {
      throw new BadRequestError('start and end must be valid timestamps', ErrorCode.ERR_VALIDATION_INVALID_FORMAT);
    }

    if (startTime >= endTime) {
      throw new BadRequestError('start must be before end', ErrorCode.ERR_VALIDATION_INVALID_DATE);
    }

    // Ensure minimum time range to avoid Pacifica API errors
    const minRange = getIntervalMs(interval);
    if (endTime - startTime < minRange) {
      console.warn(`[Chart] Time range too small (${endTime - startTime}ms), minimum is ${minRange}ms`);
      return Response.json({
        success: true,
        data: [],
        meta: { symbol, interval, startTime, endTime, count: 0 },
      });
    }

    let candles: Candle[];

    // Strategy: Always try Pacifica first, then fill gaps with Binance/Bybit/CoinGecko
    let pacificaCandles: Candle[] = [];

    try {
      // Try fetching from Pacifica for the full requested range
      console.log(`[Chart] Requesting from Pacifica: ${symbol} ${interval} from ${new Date(startTime).toISOString()} to ${new Date(endTime).toISOString()}`);
      pacificaCandles = await fetchFromPacifica(symbol, interval, startTime, endTime);
      console.log(`[Chart] Pacifica returned ${pacificaCandles.length} candles for ${symbol} ${interval}`);

      if (pacificaCandles.length > 0) {
        const firstCandle = pacificaCandles[0];
        const lastCandle = pacificaCandles[pacificaCandles.length - 1];
        if (firstCandle && lastCandle) {
          console.log(`[Chart] Pacifica first candle: ${new Date(firstCandle.t).toISOString()} - last candle: ${new Date(lastCandle.t).toISOString()}`);
        }
      }
    } catch (error: any) {
      const isRateLimit = error?.message?.includes('rate limit') ||
                          error?.name === 'RateLimitError';

      if (isRateLimit) {
        console.warn(`[Chart] Pacifica rate limited for ${symbol}, will use Binance/Bybit/CoinGecko only`);
      } else {
        console.warn(`[Chart] Pacifica fetch failed for ${symbol}:`, error?.message || error);
      }
    }

    // Check if we need fallback data
    if (pacificaCandles.length === 0) {
      // No Pacifica data at all - use historical sources entirely
      console.log(`[Chart] No Pacifica data, using Binance/Bybit/CoinGecko for entire range`);
      candles = await fetchHistorical(symbol, interval, startTime, endTime);
    } else {
      // Pacifica has data - check if we need older data from fallback
      const oldestCandle = pacificaCandles[0];

      if (!oldestCandle) {
        // Should not happen since we checked length > 0, but TypeScript needs this
        candles = pacificaCandles;
      } else {
        const oldestPacificaTime = oldestCandle.t;
        const intervalMs = getIntervalMs(interval);

        // Need data BEFORE Pacifica's oldest candle?
        if (startTime < oldestPacificaTime - intervalMs) {
          const fallbackEnd = oldestPacificaTime - intervalMs;
          console.log(`[Chart] Need older data: fetching from Binance/Bybit/CoinGecko from ${new Date(startTime).toISOString()} to ${new Date(fallbackEnd).toISOString()}`);

          const olderCandles = await fetchHistorical(symbol, interval, startTime, fallbackEnd);

          if (olderCandles.length > 0) {
            // Successfully got older data from fallback sources
            candles = mergeCandles(olderCandles, pacificaCandles);
            console.log(`[Chart] Final merged: ${candles.length} total candles (${olderCandles.length} historical + ${pacificaCandles.length} Pacifica)`);
          } else {
            // Token doesn't exist on any fallback sources - use only Pacifica data
            console.log(`[Chart] Token not available on fallback sources, using only Pacifica data (${pacificaCandles.length} candles)`);
            candles = pacificaCandles;
          }
        } else {
          // Pacifica data covers the full requested range
          console.log(`[Chart] Pacifica data is complete for requested range`);
          candles = pacificaCandles;
        }
      }
    }

    // Fill gaps in the final candle data to ensure continuous chart display
    const filledCandles = fillCandleGaps(candles, interval);
    if (filledCandles.length !== candles.length) {
      console.log(`[Chart] Gap fill: ${candles.length} → ${filledCandles.length} candles (+${filledCandles.length - candles.length} synthetic)`);
    }

    return Response.json({
      success: true,
      data: filledCandles,
      meta: {
        symbol,
        interval,
        startTime,
        endTime,
        count: filledCandles.length,
      },
    });
  } catch (error) {
    console.error('Chart candles error:', error);
    return errorResponse(error);
  }
}
