/**
 * TradingView Datafeed implementation for Pacifica API
 * Connects Pacifica's kline data to TradingView Charting Library
 */

import { wsManager, type Bar } from './WebSocketManager';

const PACIFICA_API_BASE = 'https://api.pacifica.fi';

// TradingView resolution to Pacifica interval mapping
const RESOLUTION_MAP: Record<string, string> = {
  '1': '1m',
  '3': '3m',
  '5': '5m',
  '15': '15m',
  '30': '30m',
  '60': '1h',
  '120': '2h',
  '240': '4h',
  '480': '8h',
  '720': '12h',
  'D': '1d',
  '1D': '1d',
};

// Pacifica interval to TradingView resolution mapping
const INTERVAL_TO_RESOLUTION: Record<string, string> = {
  '1m': '1',
  '3m': '3',
  '5m': '5',
  '15m': '15',
  '30m': '30',
  '1h': '60',
  '2h': '120',
  '4h': '240',
  '8h': '480',
  '12h': '720',
  '1d': 'D',
};

// Supported resolutions for TradingView
const SUPPORTED_RESOLUTIONS = ['1', '3', '5', '15', '30', '60', '120', '240', '480', '720', 'D'];

/**
 * Convert app symbol format (BTC-USD) to Pacifica format (BTC)
 */
function symbolToPacifica(symbol: string): string {
  if (symbol === 'KPEPE-USD') return '1000PEPE';
  return symbol.replace('-USD', '');
}

/**
 * Get price scale based on symbol (for proper decimal display)
 */
function getPriceScale(symbol: string): number {
  const baseSymbol = symbolToPacifica(symbol);

  // High-value assets with 2 decimals
  if (['BTC', 'ETH'].includes(baseSymbol)) {
    return 100;
  }

  // Medium-value assets with 4 decimals
  if (['SOL', 'BNB', 'AVAX', 'LINK', 'UNI', 'AAVE'].includes(baseSymbol)) {
    return 10000;
  }

  // Small-value assets with more decimals
  return 1000000;
}

interface PacificaKlineResponse {
  success: boolean;
  data: Array<{
    t: number;   // open time ms
    T: number;   // close time ms
    s: string;   // symbol
    i: string;   // interval
    o: string;   // open
    c: string;   // close
    h: string;   // high
    l: string;   // low
    v: string;   // volume
    n: number;   // number of trades
  }>;
  error: string | null;
}

// Response from /api/v1/info endpoint
interface PacificaInfoResponse {
  success: boolean;
  data: Array<{
    symbol: string;       // e.g., "BTC", "ETH"
    max_leverage: number;
    tick_size: string;
    lot_size: string;
  }>;
}

interface DatafeedConfiguration {
  exchanges: Array<{ value: string; name: string; desc: string }>;
  supported_resolutions: string[];
  supports_marks: boolean;
  supports_time: boolean;
  supports_timescale_marks: boolean;
}

interface LibrarySymbolInfo {
  name: string;
  ticker: string;
  description: string;
  type: string;
  session: string;
  timezone: string;
  exchange: string;
  listed_exchange: string;
  format: string;
  pricescale: number;
  minmov: number;
  has_intraday: boolean;
  intraday_multipliers: string[];
  has_daily: boolean;
  daily_multipliers: string[];
  supported_resolutions: string[];
  volume_precision: number;
  data_status: string;
}

interface PeriodParams {
  from: number;
  to: number;
  countBack: number;
  firstDataRequest: boolean;
}

interface HistoryMetadata {
  noData?: boolean;
  nextTime?: number | null;
}

interface SearchSymbolResultItem {
  symbol: string;
  description: string;
  exchange: string;
  ticker?: string;
  type: string;
}

export class PacificaDatafeed {
  private marketsCache: Array<{ symbol: string; baseAsset: string }> = [];
  private lastBars: Map<string, Bar> = new Map();

  /**
   * Called when the library needs datafeed configuration
   */
  onReady(callback: (configuration: DatafeedConfiguration) => void): void {
    console.log('[Datafeed] onReady');

    // Fetch markets list and then call callback
    this.fetchMarkets().then(() => {
      setTimeout(() => {
        callback({
          exchanges: [{ value: 'PACIFICA', name: 'Pacifica', desc: 'Pacifica DEX' }],
          supported_resolutions: SUPPORTED_RESOLUTIONS,
          supports_marks: false,
          supports_time: true,
          supports_timescale_marks: false,
        });
      }, 0);
    });
  }

  /**
   * Fetch available markets from Pacifica API
   * Uses /api/v1/info endpoint which returns market info including symbols
   */
  private async fetchMarkets(): Promise<void> {
    try {
      const response = await fetch(`${PACIFICA_API_BASE}/api/v1/info`);

      if (!response.ok) {
        console.error('[Datafeed] Markets API returned', response.status);
        return;
      }

      const data: PacificaInfoResponse = await response.json();

      if (data.success && data.data) {
        this.marketsCache = data.data.map((m) => ({
          symbol: `${m.symbol}-USD`,
          baseAsset: m.symbol,
        }));
      }
    } catch (error) {
      console.error('[Datafeed] Failed to fetch markets:', error);
    }
  }

  /**
   * Search for symbols
   */
  searchSymbols(
    userInput: string,
    _exchange: string,
    _symbolType: string,
    onResult: (items: SearchSymbolResultItem[]) => void
  ): void {
    console.log('[Datafeed] searchSymbols:', userInput);

    const query = userInput.toUpperCase();
    const results = this.marketsCache
      .filter((m) => m.symbol.includes(query) || m.baseAsset.includes(query))
      .map((m) => ({
        symbol: m.symbol,
        description: `${m.baseAsset} Perpetual`,
        exchange: 'PACIFICA',
        ticker: m.symbol,
        type: 'crypto',
      }));

    onResult(results);
  }

  /**
   * Resolve symbol info
   */
  resolveSymbol(
    symbolName: string,
    onResolve: (symbolInfo: LibrarySymbolInfo) => void,
    onError: (reason: string) => void
  ): void {
    console.log('[Datafeed] resolveSymbol:', symbolName);

    // Normalize symbol name
    const symbol = symbolName.includes('-USD') ? symbolName : `${symbolName}-USD`;
    const baseSymbol = symbolToPacifica(symbol);

    setTimeout(() => {
      const symbolInfo: LibrarySymbolInfo = {
        name: symbol,
        ticker: symbol,
        description: `${baseSymbol} Perpetual`,
        type: 'crypto',
        session: '24x7',
        timezone: 'Etc/UTC',
        exchange: 'PACIFICA',
        listed_exchange: 'PACIFICA',
        format: 'price',
        pricescale: getPriceScale(symbol),
        minmov: 1,
        has_intraday: true,
        intraday_multipliers: ['1', '3', '5', '15', '30', '60', '120', '240', '480', '720'],
        has_daily: true,
        daily_multipliers: ['1'],
        supported_resolutions: SUPPORTED_RESOLUTIONS,
        volume_precision: 4,
        data_status: 'streaming',
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onResolve(symbolInfo as any);
    }, 0);
  }

  /**
   * Get historical bars
   */
  async getBars(
    symbolInfo: LibrarySymbolInfo,
    resolution: string,
    periodParams: PeriodParams,
    onResult: (bars: Bar[], meta?: HistoryMetadata) => void,
    onError: (reason: string) => void
  ): Promise<void> {
    console.log('[Datafeed] getBars:', symbolInfo.name, resolution, periodParams);

    const pacificaSymbol = symbolToPacifica(symbolInfo.name);
    const interval = RESOLUTION_MAP[resolution] || '5m';

    // Convert from/to from seconds to milliseconds
    const fromMs = periodParams.from * 1000;
    const toMs = periodParams.to * 1000;

    try {
      const url = `${PACIFICA_API_BASE}/api/v1/kline?symbol=${pacificaSymbol}&interval=${interval}&start_time=${fromMs}&end_time=${toMs}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data: PacificaKlineResponse = await response.json();

      if (!data.success || !data.data || data.data.length === 0) {
        onResult([], { noData: true });
        return;
      }

      // Convert to TradingView bar format (time in ms)
      const bars: Bar[] = data.data.map((c) => ({
        time: c.t,
        open: parseFloat(c.o),
        high: parseFloat(c.h),
        low: parseFloat(c.l),
        close: parseFloat(c.c),
        volume: parseFloat(c.v),
      }));

      // Sort by time ascending
      bars.sort((a, b) => a.time - b.time);

      // Store last bar for real-time updates
      const lastBar = bars[bars.length - 1];
      if (lastBar) {
        const key = `${symbolInfo.name}:${resolution}`;
        this.lastBars.set(key, lastBar);
      }

      console.log(`[Datafeed] Loaded ${bars.length} bars for ${symbolInfo.name}`);
      onResult(bars);
    } catch (error) {
      console.error('[Datafeed] getBars error:', error);
      onError(error instanceof Error ? error.message : 'Failed to fetch data');
    }
  }

  /**
   * Subscribe to real-time updates
   */
  subscribeBars(
    symbolInfo: LibrarySymbolInfo,
    resolution: string,
    onTick: (bar: Bar) => void,
    listenerGuid: string,
    _onResetCacheNeededCallback: () => void
  ): void {
    console.log('[Datafeed] subscribeBars:', symbolInfo.name, resolution, listenerGuid);

    const pacificaSymbol = symbolToPacifica(symbolInfo.name);
    const interval = RESOLUTION_MAP[resolution] || '5m';
    const key = `${symbolInfo.name}:${resolution}`;

    // Subscribe via WebSocket manager
    wsManager.subscribe(pacificaSymbol, interval, (bar) => {
      // Update last bar tracking
      const lastBar = this.lastBars.get(key);

      if (lastBar && bar.time < lastBar.time) {
        // Ignore old bars
        return;
      }

      this.lastBars.set(key, bar);
      onTick(bar);
    }, listenerGuid);
  }

  /**
   * Unsubscribe from real-time updates
   */
  unsubscribeBars(listenerGuid: string): void {
    console.log('[Datafeed] unsubscribeBars:', listenerGuid);
    wsManager.unsubscribe(listenerGuid);
  }

  /**
   * Get server time (optional)
   */
  getServerTime(callback: (serverTime: number) => void): void {
    callback(Math.floor(Date.now() / 1000));
  }
}

// Helper function to convert app interval to TradingView resolution
export function intervalToResolution(interval: string): string {
  return INTERVAL_TO_RESOLUTION[interval] || '5';
}

// Helper function to convert TradingView resolution to app interval
export function resolutionToInterval(resolution: string): string {
  return RESOLUTION_MAP[resolution] || '5m';
}
