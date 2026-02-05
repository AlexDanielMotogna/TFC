/**
 * Chart Candles API endpoint with multi-source aggregation
 * GET /api/chart/candles - Get historical candles from Pacifica + Binance/Bybit
 *
 * Pacifica has data from June 2025+
 * Binance/Bybit provide historical data (2019+)
 */
import { errorResponse, BadRequestError, ApiError, ServiceUnavailableError } from '@/lib/server/errors';
import { ErrorCode } from '@/lib/server/error-codes';
import * as Pacifica from '@/lib/server/pacifica';

const PACIFICA_START_DATE = new Date('2025-06-01').getTime();
const BINANCE_FUTURES_API = 'https://fapi.binance.com';
const BYBIT_API = 'https://api.bybit.com';

// Unified candle format
interface Candle {
  t: number;  // timestamp (ms)
  o: number;  // open
  h: number;  // high
  l: number;  // low
  c: number;  // close
  v: number;  // volume
}

// Symbol mapping
const SYMBOL_MAP: Record<string, { pacifica: string; binance: string; bybit: string }> = {
  'BTC-USD': { pacifica: 'BTC', binance: 'BTCUSDT', bybit: 'BTCUSDT' },
  'ETH-USD': { pacifica: 'ETH', binance: 'ETHUSDT', bybit: 'ETHUSDT' },
  'SOL-USD': { pacifica: 'SOL', binance: 'SOLUSDT', bybit: 'SOLUSDT' },
  'BNB-USD': { pacifica: 'BNB', binance: 'BNBUSDT', bybit: 'BNBUSDT' },
  'XRP-USD': { pacifica: 'XRP', binance: 'XRPUSDT', bybit: 'XRPUSDT' },
  'DOGE-USD': { pacifica: 'DOGE', binance: 'DOGEUSDT', bybit: 'DOGEUSDT' },
  'ADA-USD': { pacifica: 'ADA', binance: 'ADAUSDT', bybit: 'ADAUSDT' },
  'AVAX-USD': { pacifica: 'AVAX', binance: 'AVAXUSDT', bybit: 'AVAXUSDT' },
  'LINK-USD': { pacifica: 'LINK', binance: 'LINKUSDT', bybit: 'LINKUSDT' },
  'SUI-USD': { pacifica: 'SUI', binance: 'SUIUSDT', bybit: 'SUIUSDT' },
  'APT-USD': { pacifica: 'APT', binance: 'APTUSDT', bybit: 'APTUSDT' },
  'SEI-USD': { pacifica: 'SEI', binance: 'SEIUSDT', bybit: 'SEIUSDT' },
  'TIA-USD': { pacifica: 'TIA', binance: 'TIAUSDT', bybit: 'TIAUSDT' },
  'INJ-USD': { pacifica: 'INJ', binance: 'INJUSDT', bybit: 'INJUSDT' },
  'ARB-USD': { pacifica: 'ARB', binance: 'ARBUSDT', bybit: 'ARBUSDT' },
  'OP-USD': { pacifica: 'OP', binance: 'OPUSDT', bybit: 'OPUSDT' },
  'STX-USD': { pacifica: 'STX', binance: 'STXUSDT', bybit: 'STXUSDT' },
  'IMX-USD': { pacifica: 'IMX', binance: 'IMXUSDT', bybit: 'IMXUSDT' },
  'AAVE-USD': { pacifica: 'AAVE', binance: 'AAVEUSDT', bybit: 'AAVEUSDT' },
  'JUP-USD': { pacifica: 'JUP', binance: 'JUPUSDT', bybit: 'JUPUSDT' },
  'PENDLE-USD': { pacifica: 'PENDLE', binance: 'PENDLEUSDT', bybit: 'PENDLEUSDT' },
  'ENA-USD': { pacifica: 'ENA', binance: 'ENAUSDT', bybit: 'ENAUSDT' },
  'RENDER-USD': { pacifica: 'RENDER', binance: 'RENDERUSDT', bybit: 'RENDERUSDT' },
  'FET-USD': { pacifica: 'FET', binance: 'FETUSDT', bybit: 'FETUSDT' },
  'WIF-USD': { pacifica: 'WIF', binance: 'WIFUSDT', bybit: 'WIFUSDT' },
  'KPEPE-USD': { pacifica: '1000PEPE', binance: '1000PEPEUSDT', bybit: '1000PEPEUSDT' },
  'WLD-USD': { pacifica: 'WLD', binance: 'WLDUSDT', bybit: 'WLDUSDT' },
  'HYPE-USD': { pacifica: 'HYPE', binance: 'HYPEUSDT', bybit: 'HYPEUSDT' },
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
    if (data.length === 0) break;

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

// Fetch from Pacifica
async function fetchFromPacifica(
  tfcSymbol: string,
  interval: string,
  startTime: number,
  endTime: number
): Promise<Candle[]> {
  const pacificaSymbol = mapSymbol(tfcSymbol, 'pacifica');
  if (!pacificaSymbol) return [];

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
  } catch (error) {
    console.error('Pacifica fetch error:', error);
    throw error;
  }
}

// Fetch historical data with fallback
async function fetchHistorical(
  tfcSymbol: string,
  interval: string,
  startTime: number,
  endTime: number
): Promise<Candle[]> {
  try {
    const candles = await fetchFromBinance(tfcSymbol, interval, startTime, endTime);
    if (candles.length > 0) return candles;
  } catch (error) {
    console.warn('Binance failed, trying Bybit:', error);
  }

  try {
    return await fetchFromBybit(tfcSymbol, interval, startTime, endTime);
  } catch (error) {
    console.error('Bybit also failed:', error);
    return [];
  }
}

// Merge candles from multiple sources
function mergeCandles(historical: Candle[], recent: Candle[]): Candle[] {
  const map = new Map<number, Candle>();
  for (const c of historical) map.set(c.t, c);
  for (const c of recent) map.set(c.t, c); // Recent overwrites historical
  return Array.from(map.values()).sort((a, b) => a.t - b.t);
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

    let candles: Candle[];

    // Case 1: All data within Pacifica range (June 2025+)
    if (startTime >= PACIFICA_START_DATE) {
      candles = await fetchFromPacifica(symbol, interval, startTime, endTime);
    }
    // Case 2: All data before Pacifica range (historical only)
    else if (endTime < PACIFICA_START_DATE) {
      candles = await fetchHistorical(symbol, interval, startTime, endTime);
    }
    // Case 3: Split request - historical + recent
    else {
      const [historical, recent] = await Promise.all([
        fetchHistorical(symbol, interval, startTime, PACIFICA_START_DATE - 1),
        fetchFromPacifica(symbol, interval, PACIFICA_START_DATE, endTime),
      ]);
      candles = mergeCandles(historical, recent);
    }

    return Response.json({
      success: true,
      data: candles,
      meta: {
        symbol,
        interval,
        startTime,
        endTime,
        count: candles.length,
      },
    });
  } catch (error) {
    console.error('Chart candles error:', error);
    return errorResponse(error);
  }
}
