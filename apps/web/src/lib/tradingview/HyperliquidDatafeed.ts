/**
 * TradingView Datafeed implementation for Hyperliquid API
 * Fetches historical candles via REST and polls for real-time updates.
 */

const HL_API_URL = process.env.NEXT_PUBLIC_HYPERLIQUID_API_URL || 'https://api.hyperliquid.xyz';

// TradingView resolution → HL interval
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

const SUPPORTED_RESOLUTIONS = ['1', '3', '5', '15', '30', '60', '120', '240', '480', '720', 'D'];

const RESOLUTION_MS: Record<string, number> = {
  '1': 60_000,
  '3': 180_000,
  '5': 300_000,
  '15': 900_000,
  '30': 1_800_000,
  '60': 3_600_000,
  '120': 7_200_000,
  '240': 14_400_000,
  '480': 28_800_000,
  '720': 43_200_000,
  'D': 86_400_000,
  '1D': 86_400_000,
};

interface Bar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
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
  has_empty_bars: boolean;
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

interface HlCandle {
  t: number; T: number; s: string; i: string;
  o: string; c: string; h: string; l: string; v: string; n: number;
}

interface HlAssetMeta {
  name: string;
  szDecimals: number;
  maxLeverage: number;
}

function symbolToCoin(symbol: string): string {
  return symbol.replace('-USD', '');
}

function getPriceScale(symbol: string): number {
  const coin = symbolToCoin(symbol);
  if (['BTC', 'ETH'].includes(coin)) return 100;
  if (['SOL', 'BNB', 'AVAX', 'LINK', 'AAVE', 'HYPE'].includes(coin)) return 10000;
  return 1000000;
}

function fillBarGaps(bars: Bar[], resolution: string): Bar[] {
  if (bars.length < 2) return bars;
  const intervalMs = RESOLUTION_MS[resolution];
  if (!intervalMs) return bars;

  const filled: Bar[] = [bars[0]!];
  for (let i = 1; i < bars.length; i++) {
    const prevBar = filled[filled.length - 1]!;
    const currentBar = bars[i]!;
    const missingCount = Math.round((currentBar.time - prevBar.time) / intervalMs) - 1;
    if (missingCount > 0 && missingCount <= 500) {
      for (let j = 1; j <= missingCount; j++) {
        filled.push({
          time: prevBar.time + j * intervalMs,
          open: prevBar.close, high: prevBar.close,
          low: prevBar.close, close: prevBar.close, volume: 0,
        });
      }
    }
    filled.push(currentBar);
  }
  return filled;
}

export class HyperliquidDatafeed {
  private marketsCache: Array<{ symbol: string; baseAsset: string }> = [];
  private lastBars: Map<string, Bar> = new Map();
  private pollers: Map<string, ReturnType<typeof setInterval>> = new Map();

  onReady(callback: (configuration: DatafeedConfiguration) => void): void {
    console.log('[HLDatafeed] onReady called — fetching markets from', HL_API_URL);
    this.fetchMarkets().then(() => {
      console.log('[HLDatafeed] Markets fetched:', this.marketsCache.length, 'symbols');
      setTimeout(() => {
        callback({
          exchanges: [{ value: 'HYPERLIQUID', name: 'Hyperliquid', desc: 'Hyperliquid DEX' }],
          supported_resolutions: SUPPORTED_RESOLUTIONS,
          supports_marks: false,
          supports_time: true,
          supports_timescale_marks: false,
        });
      }, 0);
    });
  }

  private async fetchMarkets(): Promise<void> {
    try {
      const resp = await fetch(`${HL_API_URL}/info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'meta' }),
      });
      if (!resp.ok) return; // Rate limited — skip, will use cached markets

      const data = await resp.json() as { universe: HlAssetMeta[] };
      this.marketsCache = data.universe.map((m) => ({
        symbol: `${m.name}-USD`,
        baseAsset: m.name,
      }));
    } catch (err) {
      console.error('[HLDatafeed] Failed to fetch markets:', err);
    }
  }

  searchSymbols(
    userInput: string, _exchange: string, _symbolType: string,
    onResult: (items: SearchSymbolResultItem[]) => void,
  ): void {
    const query = userInput.toUpperCase();
    onResult(
      this.marketsCache
        .filter((m) => m.symbol.includes(query) || m.baseAsset.includes(query))
        .map((m) => ({
          symbol: m.symbol,
          description: `${m.baseAsset} Perpetual`,
          exchange: 'HYPERLIQUID',
          ticker: m.symbol,
          type: 'crypto',
        })),
    );
  }

  resolveSymbol(
    symbolName: string,
    onResolve: (symbolInfo: LibrarySymbolInfo) => void,
    _onError: (reason: string) => void,
  ): void {
    const symbol = symbolName.includes('-USD') ? symbolName : `${symbolName}-USD`;
    const coin = symbolToCoin(symbol);
    console.log(`[HLDatafeed] resolveSymbol: "${symbolName}" → coin=${coin}, symbol=${symbol}, pricescale=${getPriceScale(symbol)}`);

    setTimeout(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onResolve({
        name: symbol,
        ticker: symbol,
        description: `${coin} Perpetual`,
        type: 'crypto',
        session: '24x7',
        timezone: 'Etc/UTC',
        exchange: 'HYPERLIQUID',
        listed_exchange: 'HYPERLIQUID',
        format: 'price',
        pricescale: getPriceScale(symbol),
        minmov: 1,
        has_intraday: true,
        intraday_multipliers: ['1', '3', '5', '15', '30', '60', '120', '240', '480', '720'],
        has_daily: true,
        daily_multipliers: ['1'],
        has_empty_bars: false,
        supported_resolutions: SUPPORTED_RESOLUTIONS,
        volume_precision: 4,
        data_status: 'streaming',
      } as any);
    }, 0);
  }

  async getBars(
    symbolInfo: LibrarySymbolInfo,
    resolution: string,
    periodParams: PeriodParams,
    onResult: (bars: Bar[], meta?: HistoryMetadata) => void,
    onError: (reason: string) => void,
  ): Promise<void> {
    const coin = symbolToCoin(symbolInfo.name);
    const interval = RESOLUTION_MAP[resolution] || '5m';
    const startTime = periodParams.from * 1000;
    const endTime = periodParams.to * 1000;

    console.log(`[HLDatafeed] getBars: coin=${coin}, interval=${interval}, from=${new Date(startTime).toISOString()}, to=${new Date(endTime).toISOString()}`);

    try {
      const resp = await fetch(`${HL_API_URL}/info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'candleSnapshot',
          req: { coin, interval, startTime, endTime },
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!resp.ok) {
        onResult([], { noData: true });
        return;
      }

      const candles = await resp.json() as HlCandle[];
      console.log(`[HLDatafeed] getBars response: ${candles?.length || 0} candles for ${coin}`);

      if (!candles || candles.length === 0) {
        onResult([], { noData: true });
        return;
      }

      // Log last 3 raw candles from API
      const lastRaw = candles.slice(-3);
      console.log(`[HLDatafeed] Last 3 raw candles:`, lastRaw.map(c => ({
        time: new Date(c.t).toISOString(),
        o: c.o, h: c.h, l: c.l, c: c.c, v: c.v
      })));

      const bars: Bar[] = candles.map((c) => ({
        time: c.t,
        open: parseFloat(c.o),
        high: parseFloat(c.h),
        low: parseFloat(c.l),
        close: parseFloat(c.c),
        volume: parseFloat(c.v),
      }));

      bars.sort((a, b) => a.time - b.time);
      const filledBars = fillBarGaps(bars, resolution);
      console.log(`[HLDatafeed] After fillBarGaps: ${bars.length} → ${filledBars.length} bars (${filledBars.length - bars.length} gaps filled)`);

      const lastBar = filledBars[filledBars.length - 1];
      if (lastBar) {
        this.lastBars.set(`${symbolInfo.name}:${resolution}`, lastBar);
      }

      onResult(filledBars);
    } catch (error) {
      console.error('[HLDatafeed] getBars error:', error);
      onError(error instanceof Error ? error.message : 'Failed to fetch data');
    }
  }

  subscribeBars(
    symbolInfo: LibrarySymbolInfo,
    resolution: string,
    onTick: (bar: Bar) => void,
    listenerGuid: string,
    _onResetCacheNeededCallback: () => void,
  ): void {
    const coin = symbolToCoin(symbolInfo.name);
    const interval = RESOLUTION_MAP[resolution] || '5m';
    const barKey = `${symbolInfo.name}:${resolution}`;

    console.log(`[HLDatafeed] subscribeBars: coin=${coin}, interval=${interval}, guid=${listenerGuid}`);

    // Poll HL REST every 5 seconds for candle updates
    const poll = async () => {
      try {
        const now = Date.now();
        const resp = await fetch(`${HL_API_URL}/info`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'candleSnapshot',
            req: { coin, interval, startTime: now - 120_000, endTime: now },
          }),
          signal: AbortSignal.timeout(5000),
        });
        if (!resp.ok) return; // Rate limited — skip this poll cycle

        const candles = await resp.json() as HlCandle[];
        if (candles && candles.length > 0) {
          const latest = candles[candles.length - 1]!;
          const bar: Bar = {
            time: latest.t,
            open: parseFloat(latest.o),
            high: parseFloat(latest.h),
            low: parseFloat(latest.l),
            close: parseFloat(latest.c),
            volume: parseFloat(latest.v),
          };

          const lastBar = this.lastBars.get(barKey);
          if (lastBar && bar.time < lastBar.time) return; // ignore old bars

          this.lastBars.set(barKey, bar);
          onTick(bar);
        }
      } catch {
        // Silently ignore polling errors
      }
    };

    poll();
    const poller = setInterval(poll, 5000);
    this.pollers.set(listenerGuid, poller);
  }

  unsubscribeBars(listenerGuid: string): void {
    const poller = this.pollers.get(listenerGuid);
    if (poller) {
      clearInterval(poller);
      this.pollers.delete(listenerGuid);
    }
  }

  getServerTime(callback: (serverTime: number) => void): void {
    callback(Math.floor(Date.now() / 1000));
  }
}
