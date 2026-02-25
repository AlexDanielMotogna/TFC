/**
 * Nado WebSocket Adapter
 *
 * Connects to wss://gateway.test.nado.xyz/v1/subscribe for real-time data.
 *
 * Key differences from HL adapter:
 * - Authentication required for `order_update` stream (EIP-712 StreamAuthentication)
 * - Incremental orderbook — must maintain local book state (unlike HL/Pacifica snapshots)
 * - x18 decoding on all price/amount fields
 * - Product-based subscriptions — need product_id lookup
 * - Native candle stream (latest_candlestick) — no REST polling needed
 * - Ping frames every 30s
 */

import type {
  ExchangeWsAdapter,
  ExchangeWsCallbacks,
  WsPosition,
  WsOrder,
  WsTrade,
  WsPrice,
  WsMarket,
  WsOrderbookSnapshot,
  WsOrderbookLevel,
  WsCandle,
} from './types';
import { addressToSubaccount } from '@/lib/nado-utils';
import { useAuthStore } from '@/lib/store';

// ─────────────────────────────────────────────────────────────
// Conditional debug logging — silent in production
// ─────────────────────────────────────────────────────────────
const DEBUG = process.env.NODE_ENV !== 'production';
function debugLog(...args: unknown[]) {
  if (DEBUG) console.log('[NadoWS]', ...args);
}
function debugWarn(...args: unknown[]) {
  if (DEBUG) console.warn('[NadoWS]', ...args);
}

const NADO_WS_URL =
  process.env.NEXT_PUBLIC_NADO_WS_URL || 'wss://gateway.test.nado.xyz/v1/subscribe';
// Use local proxy to avoid CORS issues (Nado API doesn't support CORS)
const NADO_QUERY_PROXY = '/api/nado/query';
const NADO_WS_AUTH_URL = '/api/nado/ws-auth';
const PING_INTERVAL = 30000;
const RECONNECT_DELAY = 3000;

/**
 * Build headers for authenticated proxy requests.
 * Includes the JWT Bearer token from the auth store so the server-side
 * proxy routes can verify the caller is a logged-in user.
 */
function getAuthHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extra,
  };
  const token = useAuthStore.getState().token;
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// Interval string → granularity in seconds (used by candle subscribe/unsubscribe and handler)
const GRANULARITY_MAP: Record<string, number> = {
  '1': 60,
  '1m': 60,
  '5': 300,
  '5m': 300,
  '15': 900,
  '15m': 900,
  '60': 3600,
  '1h': 3600,
  '1H': 3600,
  '120': 7200,
  '2h': 7200,
  '240': 14400,
  '4h': 14400,
  '4H': 14400,
  '1D': 86400,
  D: 86400,
  '1d': 86400,
  '1W': 604800,
  W: 604800,
  '1M': 2419200,
};

// Reverse mapping: granularity in seconds → canonical interval string
const GRANULARITY_TO_INTERVAL: Record<number, string> = {};
for (const [key, val] of Object.entries(GRANULARITY_MAP)) {
  // Prefer short lowercase keys like '1m', '5m', '1h', '1d', '1w'
  if (
    !GRANULARITY_TO_INTERVAL[val] ||
    key.endsWith('m') ||
    key.endsWith('h') ||
    key.endsWith('d') ||
    key.endsWith('w')
  ) {
    GRANULARITY_TO_INTERVAL[val] = key;
  }
}

// ─────────────────────────────────────────────────────────────
// x18 helpers (client-side, same as adapter)
// ─────────────────────────────────────────────────────────────

const X18 = BigInt(10) ** BigInt(18);

function fromX18(x18: string): number {
  try {
    return Number(BigInt(x18)) / Number(X18);
  } catch {
    return 0;
  }
}

// ─────────────────────────────────────────────────────────────
// Product metadata cache (loaded via REST on first connect)
// ─────────────────────────────────────────────────────────────

interface NadoProductInfo {
  productId: number;
  symbol: string; // "BTC-PERP"
  baseAsset: string; // "BTC"
  isPerp: boolean;
  oraclePrice: number; // from all_products oracle_price_x18
  markPrice: number; // from archive perp_prices mark_price_x18
  indexPrice: number; // from archive perp_prices index_price_x18
  maxLeverage: number;
  sizeIncrement: number;
  priceIncrement: number;
  fundingRate: number; // 24h rate from WS funding_rate stream
  cumulativeFundingLong: number; // current cumulative funding index for longs
  cumulativeFundingShort: number; // current cumulative funding index for shorts
  openInterest: number; // base units from all_products
  openInterestUsd: number; // USD from market_snapshots (preferred)
  volume24h: number; // base volume from candles (fallback)
  volume24hUsd: number; // USD volume from market_snapshots (preferred)
  high24h: number;
  low24h: number;
  change24h: number;
}

const NADO_ARCHIVE_PROXY = '/api/nado/archive';

let productMeta: NadoProductInfo[] = [];
let productMetaLoaded = false;
let productMetaPromise: Promise<void> | null = null;
let marketStatsPromise: Promise<void> | null = null;
let lastMarketStatsFetch = 0;
const MARKET_STATS_COOLDOWN = 30_000; // Min 30s between fetchMarketStats calls

async function ensureProductMeta(): Promise<void> {
  if (productMetaLoaded) return;
  // Deduplicate concurrent calls — share a single in-flight promise
  if (!productMetaPromise) {
    productMetaPromise = fetchProductMeta().finally(() => {
      productMetaPromise = null;
    });
  }
  await productMetaPromise;
}

async function fetchProductMeta(): Promise<void> {
  try {
    const resp = await fetch(NADO_QUERY_PROXY, {
      method: 'POST',
      headers: getAuthHeaders({ 'Accept-Encoding': 'gzip, deflate, br' }),
      body: JSON.stringify({ type: 'symbols' }),
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) return;

    const result = (await resp.json()) as {
      data: {
        symbols: Record<
          string,
          {
            type: string;
            product_id: number;
            symbol: string;
            price_increment_x18: string;
            size_increment: string;
            min_size: string;
            long_weight_initial_x18: string;
            max_open_interest_x18: string | null;
            trading_status: string;
          }
        >;
      };
    };

    // Build lookup of existing stats to preserve across refreshes
    const existingStats = new Map<
      number,
      Omit<
        NadoProductInfo,
        | 'productId'
        | 'symbol'
        | 'baseAsset'
        | 'isPerp'
        | 'maxLeverage'
        | 'sizeIncrement'
        | 'priceIncrement'
      >
    >();
    for (const p of productMeta) {
      existingStats.set(p.productId, {
        oraclePrice: p.oraclePrice,
        markPrice: p.markPrice,
        indexPrice: p.indexPrice,
        fundingRate: p.fundingRate,
        cumulativeFundingLong: p.cumulativeFundingLong,
        cumulativeFundingShort: p.cumulativeFundingShort,
        openInterest: p.openInterest,
        openInterestUsd: p.openInterestUsd,
        volume24h: p.volume24h,
        volume24hUsd: p.volume24hUsd,
        high24h: p.high24h,
        low24h: p.low24h,
        change24h: p.change24h,
      });
    }

    const products: NadoProductInfo[] = [];
    for (const [, info] of Object.entries(result.data.symbols)) {
      if (info.type !== 'perp') continue;
      if (info.trading_status !== 'live') continue;

      // Keep native Nado symbol format: "BTC-PERP", "ETH-PERP"
      const symbol = info.symbol;
      const baseAsset = symbol.replace('-PERP', '');
      const longWeightInit = fromX18(info.long_weight_initial_x18);
      const maxLeverage = longWeightInit < 1 ? Math.round(1 / (1 - longWeightInit)) : 20;

      // Preserve existing stats (volume, change, funding) so 30s refresh doesn't wipe them
      const prev = existingStats.get(info.product_id);

      products.push({
        productId: info.product_id,
        symbol,
        baseAsset,
        isPerp: true,
        oraclePrice: prev?.oraclePrice ?? 0,
        markPrice: prev?.markPrice ?? 0,
        indexPrice: prev?.indexPrice ?? 0,
        maxLeverage,
        sizeIncrement: fromX18(info.size_increment),
        priceIncrement: fromX18(info.price_increment_x18),
        fundingRate: prev?.fundingRate ?? 0,
        cumulativeFundingLong: prev?.cumulativeFundingLong ?? 0,
        cumulativeFundingShort: prev?.cumulativeFundingShort ?? 0,
        openInterest: prev?.openInterest ?? 0,
        openInterestUsd: prev?.openInterestUsd ?? 0,
        volume24h: prev?.volume24h ?? 0,
        volume24hUsd: prev?.volume24hUsd ?? 0,
        high24h: prev?.high24h ?? 0,
        low24h: prev?.low24h ?? 0,
        change24h: prev?.change24h ?? 0,
      });
    }

    productMeta = products;
    productMetaLoaded = true;
    debugLog('Loaded', productMeta.length, 'products');

    // Fetch all_products for oracle prices and open interest
    await fetchAllProducts();
  } catch (err) {
    console.error('[NadoWS] Failed to fetch product metadata:', err);
  }
}

/** Fetch oracle prices and open interest from gateway all_products query.
 *  Returns true if data was loaded successfully. */
async function fetchAllProducts(): Promise<boolean> {
  try {
    const allProdsResp = await fetch(NADO_QUERY_PROXY, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ type: 'all_products' }),
      signal: AbortSignal.timeout(15000),
    });
    if (allProdsResp.ok) {
      const allProds = (await allProdsResp.json()) as {
        data: {
          perp_products: Array<{
            product_id: number;
            oracle_price_x18: string;
            state: {
              open_interest: string;
              cumulative_funding_long_x18: string;
              cumulative_funding_short_x18: string;
            };
          }>;
        };
      };
      for (const pp of allProds.data.perp_products || []) {
        const p = productMeta.find((pm) => pm.productId === pp.product_id);
        if (p) {
          p.oraclePrice = fromX18(pp.oracle_price_x18);
          p.openInterest = fromX18(pp.state.open_interest);
          p.cumulativeFundingLong = fromX18(pp.state.cumulative_funding_long_x18);
          p.cumulativeFundingShort = fromX18(pp.state.cumulative_funding_short_x18);
        }
      }
      debugLog('Loaded oracle/OI for', allProds.data.perp_products?.length || 0, 'products');
      return true;
    }
    return false;
  } catch (err) {
    debugWarn('Failed to fetch all_products:', err);
    return false;
  }
}

/** Fetch 24h candles and funding rates for all products */
async function fetchMarketStats(): Promise<void> {
  if (!productMetaLoaded || productMeta.length === 0) return;

  // Cooldown: skip if called too recently
  const now = Date.now();
  if (now - lastMarketStatsFetch < MARKET_STATS_COOLDOWN) return;

  // Deduplicate: skip if already in-flight
  if (marketStatsPromise) return;

  lastMarketStatsFetch = now;
  marketStatsPromise = fetchMarketStatsInner().finally(() => {
    marketStatsPromise = null;
  });
  await marketStatsPromise;
}

async function fetchMarketStatsInner(): Promise<void> {
  const perpProducts = productMeta.filter((p) => p.isPerp);
  if (perpProducts.length === 0) return;

  const productIds = perpProducts.map((p) => p.productId);

  // 1. Single market_snapshots request for 24h volume, OI, and funding
  //    Returns cumulative data; 24h volume = latest - previous (in USDT)
  try {
    const snapshotResp = await fetch(NADO_ARCHIVE_PROXY, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        market_snapshots: {
          interval: {
            count: 2,
            granularity: 86400,
            max_time: Math.floor(Date.now() / 1000),
          },
          product_ids: productIds,
        },
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (snapshotResp.ok) {
      const data = await snapshotResp.json();
      const snapshots = data.snapshots || [];

      if (snapshots.length >= 2) {
        const latest = snapshots[0];
        const previous = snapshots[1];

        for (const p of perpProducts) {
          const pid = String(p.productId);

          // 24h volume = cumulative delta (already in USDT from archive)
          const latestVol = latest.cumulative_volumes?.[pid];
          const prevVol = previous.cumulative_volumes?.[pid];
          if (latestVol && prevVol) {
            const vol = fromX18(latestVol) - fromX18(prevVol);
            if (vol > 0) p.volume24hUsd = vol;
          }

          // Open interest (already in USDT from archive)
          const oi = latest.open_interests?.[pid];
          if (oi) {
            p.openInterestUsd = fromX18(oi);
          }
          // Funding rate: prefer WS real-time stream, only use snapshot as initial fallback
          if (p.fundingRate === 0) {
            const fr = latest.funding_rates?.[pid];
            if (fr) p.fundingRate = fromX18(fr);
          }
        }
        debugLog('market_snapshots: loaded volume/OI for', perpProducts.length, 'products');
      } else if (snapshots.length === 1) {
        // Only 1 snapshot — can still get OI
        const latest = snapshots[0];
        for (const p of perpProducts) {
          const pid = String(p.productId);
          const oi = latest.open_interests?.[pid];
          if (oi) p.openInterestUsd = fromX18(oi);
        }
        debugLog('market_snapshots: loaded OI/funding (single snapshot)');
      }
    }
  } catch (err) {
    debugWarn('market_snapshots failed:', err);
  }

  // 2. Single perp_prices request for mark + index prices (all products at once)
  try {
    const pricesResp = await fetch(NADO_ARCHIVE_PROXY, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ perp_prices: { product_ids: productIds } }),
      signal: AbortSignal.timeout(8000),
    });
    if (pricesResp.ok) {
      const pricesData = await pricesResp.json();
      for (const p of perpProducts) {
        const pp = pricesData[String(p.productId)];
        if (pp) {
          p.markPrice = fromX18(pp.mark_price_x18);
          p.indexPrice = fromX18(pp.index_price_x18);
        }
      }
      debugLog('Loaded mark/index prices for', perpProducts.length, 'products');
    }
  } catch (err) {
    debugWarn('perp_prices failed:', err);
  }

  // 3. Batched hourly candle requests for rolling 24h change, high, low
  //    Use 1h candles (24 of them) for accurate rolling 24h window
  const nowSec = Math.floor(Date.now() / 1000);
  const candleTasks = perpProducts.map(
    (p) => () =>
      fetch(NADO_ARCHIVE_PROXY, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          candlesticks: {
            product_id: p.productId,
            granularity: 3600, // 1-hour candles
            max_time: nowSec,
            limit: 25, // ~25h of data to ensure full 24h coverage
          },
        }),
        signal: AbortSignal.timeout(8000),
      })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)
  );
  // Run in batches of 5 to respect rate limits
  const candleResults: unknown[] = new Array(candleTasks.length);
  const batchSize = 5;
  for (let bi = 0; bi < candleTasks.length; bi += batchSize) {
    const batch = candleTasks.slice(bi, bi + batchSize);
    const batchResults = await Promise.all(batch.map((fn) => fn()));
    for (let bj = 0; bj < batchResults.length; bj++) {
      candleResults[bi + bj] = batchResults[bj];
    }
    if (bi + batchSize < candleTasks.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  for (let i = 0; i < perpProducts.length; i++) {
    const candles = (candleResults[i] as { candlesticks?: unknown[] } | null)?.candlesticks as
      | Array<{
          close_x18: string;
          high_x18: string;
          low_x18: string;
          volume: string;
          timestamp?: string;
        }>
      | undefined;
    const p = perpProducts[i];
    if (!candles || candles.length === 0 || !p) continue;

    // candles[0] = most recent, candles[N-1] = oldest (descending order)
    const latestCandle = candles[0]!;
    const currentClose = fromX18(latestCandle.close_x18);

    // Find the candle closest to 24h ago for rolling change
    // Archive timestamps are in seconds (server adapter confirms: parseInt(c.timestamp) * 1000)
    const target24hAgo = nowSec - 86400;
    let refPrice = 0;
    for (let j = candles.length - 1; j >= 0; j--) {
      const c = candles[j]!;
      const candleTime = c.timestamp
        ? Number(c.timestamp) // already in seconds
        : nowSec - (candles.length - 1 - j) * 3600; // estimate: oldest first from end
      if (candleTime <= target24hAgo + 1800) {
        // within 30min tolerance
        refPrice = fromX18(c.close_x18);
        break;
      }
    }
    // Fallback: use oldest candle's close
    if (refPrice === 0 && candles.length > 1) {
      refPrice = fromX18(candles[candles.length - 1]!.close_x18);
    }

    p.change24h = refPrice > 0 ? ((currentClose - refPrice) / refPrice) * 100 : 0;

    // 24h high/low from all hourly candles
    let high = 0;
    let low = Infinity;
    for (const c of candles) {
      const h = fromX18(c.high_x18);
      const l = fromX18(c.low_x18);
      if (h > high) high = h;
      if (l < low) low = l;
    }
    p.high24h = high;
    p.low24h = low === Infinity ? 0 : low;

    // Base volume fallback (prefer market_snapshots USD volume)
    p.volume24h = fromX18(latestCandle.volume);
  }

  debugLog('Loaded rolling 24h stats for', perpProducts.length, 'products');
}

function getProductById(productId: number): NadoProductInfo | undefined {
  return productMeta.find((p) => p.productId === productId);
}

function getProductBySymbol(symbol: string): NadoProductInfo | undefined {
  return productMeta.find((p) => p.symbol === symbol);
}

// ─────────────────────────────────────────────────────────────
// Adapter implementation
// ─────────────────────────────────────────────────────────────

export class NadoWsAdapter implements ExchangeWsAdapter {
  readonly exchangeType = 'nado' as const;

  private ws: WebSocket | null = null;
  private callbacks: ExchangeWsCallbacks = {};
  private callbackSets: Set<ExchangeWsCallbacks> = new Set();
  private accountId: string | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private metaRefreshInterval: ReturnType<typeof setInterval> | null = null;
  private connected = false;
  private subscribedPrices = false;
  private subscribedAccount = false;
  private orderbookSubs: Map<string, number> = new Map(); // symbol → product_id
  private candleSubs: Map<string, number> = new Map(); // "symbol:interval" → product_id
  private msgIdCounter = 1;

  // Local orderbook state (incremental)
  private orderbooks: Map<number, { bids: Map<number, number>; asks: Map<number, number> }> =
    new Map();

  // Cache of latest BBO prices for building WsPrice snapshots
  private latestPrices: Map<number, { bid: number; ask: number; bidQty: number; askQty: number }> =
    new Map();

  // Debounce timer for emitPrices (100ms window)
  private priceEmitTimer: ReturnType<typeof setTimeout> | null = null;

  // Periodic orderbook resync interval (30s)
  private orderbookResyncInterval: ReturnType<typeof setInterval> | null = null;

  // WS authentication state for order_update stream
  private wsAuthenticated = false;
  private wsAuthInFlight = false;

  connect(callbacks: ExchangeWsCallbacks): void {
    this.callbackSets.add(callbacks);
    this.rebuildCallbacks();

    // Load product metadata first, then connect WS
    ensureProductMeta().then(() => {
      // Emit initial prices/markets from oracle data (before WS connects)
      if (this.subscribedPrices) this.emitPrices();
      this.doConnect();
      // Fetch 24h stats (candles, funding) in background
      fetchMarketStats().then(() => {
        if (this.subscribedPrices) this.emitPrices();
      });
      // If oracle data didn't load (all_products timeout), retry quickly
      const hasOracle = productMeta.some((p) => p.oraclePrice > 0);
      if (!hasOracle) {
        this.retryAllProducts();
      }
    });

    // Refresh metadata + market stats every 60s
    if (!this.metaRefreshInterval) {
      this.metaRefreshInterval = setInterval(() => {
        fetchProductMeta().then(() => {
          if (this.subscribedPrices) this.emitPrices();
          // Also refresh 24h stats (volume, change) from archive API
          fetchMarketStats().then(() => {
            if (this.subscribedPrices) this.emitPrices();
          });
        });
      }, 60_000);
    }
  }

  removeCallbacks(callbacks: ExchangeWsCallbacks): void {
    this.callbackSets.delete(callbacks);
    this.rebuildCallbacks();
  }

  private rebuildCallbacks(): void {
    const sets = Array.from(this.callbackSets);
    this.callbacks = {
      onConnected: () => sets.forEach((s) => s.onConnected?.()),
      onDisconnected: () => sets.forEach((s) => s.onDisconnected?.()),
      onPrices: (prices, markets) => sets.forEach((s) => s.onPrices?.(prices, markets)),
      onPositions: (positions) => sets.forEach((s) => s.onPositions?.(positions)),
      onOrders: (orders) => sets.forEach((s) => s.onOrders?.(orders)),
      onTrades: (trades) => sets.forEach((s) => s.onTrades?.(trades)),
      onOrderbook: (data) => sets.forEach((s) => s.onOrderbook?.(data)),
      onCandle: (data) => sets.forEach((s) => s.onCandle?.(data)),
      onError: (error) => sets.forEach((s) => s.onError?.(error)),
    };
  }

  /** Retry all_products fetch with backoff when initial load fails.
   *  Oracle prices + OI are needed for volume/OI display. */
  private retryAllProducts(attempt = 0): void {
    if (attempt >= 3) {
      debugWarn('all_products retry exhausted after 3 attempts');
      return;
    }
    const delay = 5000 * (attempt + 1); // 5s, 10s, 15s
    setTimeout(async () => {
      const ok = await fetchAllProducts();
      if (ok) {
        if (this.subscribedPrices) this.emitPrices();
      } else {
        this.retryAllProducts(attempt + 1);
      }
    }, delay);
  }

  disconnect(): void {
    this.callbackSets.clear();
    this.clearTimers();
    if (this.ws) {
      this.ws.close(1000);
      this.ws = null;
    }
    this.connected = false;
    this.subscribedPrices = false;
    this.subscribedAccount = false;
    this.wsAuthenticated = false;
    this.wsAuthInFlight = false;
    this.orderbookSubs.clear();
    this.candleSubs.clear();
    this.orderbooks.clear();
    this.latestPrices.clear();
    this.callbacks.onDisconnected?.();
    this.callbacks = {};
  }

  isConnected(): boolean {
    return this.connected;
  }

  subscribeAccount(accountId: string): void {
    this.accountId = accountId;
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendAccountSubscriptions(accountId);
    }
  }

  unsubscribeAccount(): void {
    if (this.accountId && this.ws?.readyState === WebSocket.OPEN) {
      const subaccount = addressToSubaccount(this.accountId);
      this.send({
        method: 'unsubscribe',
        stream: { type: 'fill', subaccount },
      });
      this.send({
        method: 'unsubscribe',
        stream: { type: 'position_change', subaccount },
      });
      this.send({
        method: 'unsubscribe',
        stream: { type: 'order_update', subaccount },
      });
    }
    this.accountId = null;
    this.subscribedAccount = false;
    this.wsAuthenticated = false;
    this.wsAuthInFlight = false;
  }

  subscribePrices(): void {
    this.subscribedPrices = true;
    if (this.ws?.readyState === WebSocket.OPEN && productMetaLoaded) {
      this.sendPriceSubscriptions();
    }
  }

  subscribeOrderbook(symbol: string, _aggLevel?: number): void {
    const product = getProductBySymbol(symbol);
    if (!product) {
      debugWarn(`Unknown symbol for orderbook: ${symbol}, retrying after metadata load`);
      ensureProductMeta().then(() => {
        const p = getProductBySymbol(symbol);
        if (p) this.subscribeOrderbook(symbol, _aggLevel);
        else console.error(`[NadoWS] Symbol still unknown after metadata load: ${symbol}`);
      });
      return;
    }
    this.orderbookSubs.set(symbol, product.productId);
    // Initialize local book
    this.orderbooks.set(product.productId, {
      bids: new Map(),
      asks: new Map(),
    });

    // Fetch initial orderbook snapshot via REST, then subscribe to incremental diffs
    this.fetchOrderbookSnapshot(product.productId).then(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({
          method: 'subscribe',
          stream: { type: 'book_depth', product_id: product.productId },
        });
        this.send({
          method: 'subscribe',
          stream: { type: 'best_bid_offer', product_id: product.productId },
        });
      }
    });

    // Start periodic resync to guard against missed WS diffs
    this.startOrderbookResync();
  }

  unsubscribeOrderbook(symbol: string): void {
    const productId = this.orderbookSubs.get(symbol);
    if (productId != null && this.ws?.readyState === WebSocket.OPEN) {
      this.send({
        method: 'unsubscribe',
        stream: { type: 'book_depth', product_id: productId },
      });
      this.send({
        method: 'unsubscribe',
        stream: { type: 'best_bid_offer', product_id: productId },
      });
    }
    this.orderbookSubs.delete(symbol);
    if (productId != null) this.orderbooks.delete(productId);

    // Stop resync timer if no more orderbook subscriptions
    if (this.orderbookSubs.size === 0) {
      this.stopOrderbookResync();
    }
  }

  subscribeCandles(symbol: string, interval: string): void {
    const product = getProductBySymbol(symbol);
    if (!product) return;
    const key = `${symbol}:${interval}`;
    if (this.candleSubs.has(key)) return;
    this.candleSubs.set(key, product.productId);

    const granularity = GRANULARITY_MAP[interval] || 60;

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({
        method: 'subscribe',
        stream: {
          type: 'latest_candlestick',
          product_id: product.productId,
          granularity,
        },
      });
    }
  }

  unsubscribeCandles(symbol: string, interval: string): void {
    const key = `${symbol}:${interval}`;
    const productId = this.candleSubs.get(key);
    if (productId == null) return;

    const granularity = GRANULARITY_MAP[interval] || 60;

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({
        method: 'unsubscribe',
        stream: {
          type: 'latest_candlestick',
          product_id: productId,
          granularity,
        },
      });
    }
    this.candleSubs.delete(key);
  }

  refresh(): void {
    fetchProductMeta();
    if (this.ws?.readyState === WebSocket.OPEN) {
      if (this.subscribedPrices) this.sendPriceSubscriptions();
      if (this.accountId) this.sendAccountSubscriptions(this.accountId);
    }
  }

  // ─── Private methods ────────────────────────────────────────

  private send(msg: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      msg.id = this.msgIdCounter++;
      this.ws.send(JSON.stringify(msg));
    }
  }

  private doConnect(): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING)
      return;

    this.clearTimers();

    try {
      debugLog('Connecting to', NADO_WS_URL);
      const ws = new WebSocket(NADO_WS_URL);
      this.ws = ws;

      ws.onopen = () => {
        debugLog('Connected');
        this.connected = true;
        this.callbacks.onConnected?.();

        // Resubscribe
        if (this.subscribedPrices && productMetaLoaded) this.sendPriceSubscriptions();
        if (this.accountId) this.sendAccountSubscriptions(this.accountId);

        // Resubscribe orderbooks (with fresh snapshots)
        this.orderbookSubs.forEach((productId) => {
          // Clear stale book data
          this.orderbooks.set(productId, { bids: new Map(), asks: new Map() });
          // Fetch snapshot then subscribe to diffs
          this.fetchOrderbookSnapshot(productId).then(() => {
            this.send({
              method: 'subscribe',
              stream: { type: 'book_depth', product_id: productId },
            });
            this.send({
              method: 'subscribe',
              stream: { type: 'best_bid_offer', product_id: productId },
            });
          });
        });

        // Ping every 30s
        this.pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ method: 'ping' }));
          }
        }, PING_INTERVAL);
      };

      ws.onmessage = (event) => {
        const raw = typeof event.data === 'string' ? event.data : '';
        // Nado may send plain-text error messages (e.g. "error: ...")
        if (!raw.startsWith('{') && !raw.startsWith('[')) {
          debugWarn('Non-JSON message:', raw.slice(0, 200));
          return;
        }
        try {
          const msg = JSON.parse(raw);
          this.handleMessage(msg);
        } catch (err) {
          console.error('[NadoWS] Parse error:', raw.slice(0, 200), err);
        }
      };

      ws.onerror = () => {
        this.callbacks.onError?.('Nado WebSocket connection error');
      };

      ws.onclose = (event) => {
        debugLog('Disconnected:', event.code);
        this.connected = false;
        this.wsAuthenticated = false;
        this.wsAuthInFlight = false;
        this.ws = null;
        this.clearTimers();
        this.callbacks.onDisconnected?.();

        if (event.code !== 1000) {
          this.reconnectTimeout = setTimeout(() => this.doConnect(), RECONNECT_DELAY);
        }
      };
    } catch (err) {
      console.error('[NadoWS] Connection error:', err);
      this.callbacks.onError?.('Failed to connect to Nado WebSocket');
    }
  }

  private handleMessage(msg: Record<string, unknown>): void {
    const type = msg.type as string;
    if (!type) return;

    // ─── best_bid_offer: price feed ─────────────────────────
    if (type === 'best_bid_offer') {
      const data = msg as {
        product_id: number;
        bid_price: string;
        bid_qty: string;
        ask_price: string;
        ask_qty: string;
      };
      this.latestPrices.set(data.product_id, {
        bid: fromX18(data.bid_price),
        ask: fromX18(data.ask_price),
        bidQty: fromX18(data.bid_qty),
        askQty: fromX18(data.ask_qty),
      });
      this.scheduleEmitPrices();

      // Also update local orderbook BBO
      this.updateOrderbookBBO(data.product_id, data);
    }

    // ─── book_depth: incremental orderbook ──────────────────
    if (type === 'book_depth') {
      const data = msg as {
        product_id: number;
        bids: [string, string][];
        asks: [string, string][];
      };
      this.applyOrderbookDiff(data.product_id, data.bids, data.asks);
    }

    // ─── fill: user trade fill ──────────────────────────────
    if (type === 'fill') {
      const data = msg as {
        product_id: number;
        subaccount: string;
        order_digest: string;
        filled_qty: string;
        remaining_qty: string;
        original_qty: string;
        price: string;
        is_taker: boolean;
        is_bid: boolean;
        fee: string;
      };

      const product = getProductById(data.product_id);
      if (!product) return;

      // Determine if this fill opens or closes a position by checking current position direction
      const positionAmount = (product as NadoProductInfo & { amount?: number }).amount || 0;
      const isClosing = (data.is_bid && positionAmount < 0) || (!data.is_bid && positionAmount > 0);
      const side = data.is_bid
        ? isClosing
          ? 'close_short'
          : 'open_long'
        : isClosing
          ? 'close_long'
          : 'open_short';

      const trade: WsTrade = {
        history_id: Date.now(),
        order_id: 0,
        client_order_id: null,
        symbol: product.symbol,
        price: fromX18(data.price).toString(),
        entry_price: fromX18(data.price).toString(),
        amount: fromX18(data.filled_qty).toString(),
        side,
        fee: fromX18(data.fee).toString(),
        pnl: '0',
        created_at: Date.now(),
      };

      this.callbacks.onTrades?.([trade]);
      // Fills mean positions changed — refresh
      this.fetchAndEmitPositions();
    }

    // ─── position_change: position update ───────────────────
    if (type === 'position_change') {
      const data = msg as {
        product_id: number;
        subaccount: string;
        amount: string;
        v_quote_amount: string;
        reason: string;
      };

      const product = getProductById(data.product_id);
      if (!product) return;

      // Update product state from the WS event so other code sees latest values
      const amount = fromX18(data.amount);
      const vQuote = fromX18(data.v_quote_amount);
      // Store on product for fill side detection (FIX 6)
      (product as NadoProductInfo & { amount?: number; vQuoteBalance?: number }).amount = amount;
      (product as NadoProductInfo & { vQuoteBalance?: number }).vQuoteBalance = vQuote;

      // Fetch the FULL position set from REST and emit all at once.
      // Emitting a single position here would overwrite the entire positions list in the UI.
      this.fetchAndEmitPositions();
    }

    // ─── order_update: order lifecycle ──────────────────────
    if (type === 'order_update') {
      // Refresh orders from REST since WS only gives digest + reason
      this.fetchAndEmitOrders();
    }

    // ─── latest_candlestick: candle update ──────────────────
    if (type === 'latest_candlestick') {
      const data = msg as {
        product_id: number;
        granularity: number;
        open_x18: string;
        high_x18: string;
        low_x18: string;
        close_x18: string;
        volume: string;
      };

      const product = getProductById(data.product_id);
      if (!product) return;

      // Find which interval this granularity maps to
      const interval = GRANULARITY_TO_INTERVAL[data.granularity] || '1m';

      const candle: WsCandle = {
        symbol: product.symbol,
        interval,
        time: Math.floor(Date.now() / 1000),
        open: fromX18(data.open_x18),
        high: fromX18(data.high_x18),
        low: fromX18(data.low_x18),
        close: fromX18(data.close_x18),
        volume: data.volume ? fromX18(data.volume) : 0,
      };

      this.callbacks.onCandle?.(candle);
    }

    // ─── trade: public trade stream (no-op, BBO handles price updates) ─

    // ─── funding_rate: live funding updates (every ~20s) ─────
    if (type === 'funding_rate') {
      const data = msg as {
        product_id: number;
        funding_rate_x18: string;
      };
      const product = getProductById(data.product_id);
      if (product) {
        product.fundingRate = fromX18(data.funding_rate_x18);
        if (this.subscribedPrices) this.scheduleEmitPrices();
      }
    }

    // ─── funding_payment: hourly settlement (update cumulative) ─
    if (type === 'funding_payment') {
      const data = msg as {
        product_id: number;
        cumulative_funding_long_x18: string;
        cumulative_funding_short_x18: string;
        open_interest: string;
      };
      const product = getProductById(data.product_id);
      if (product) {
        product.cumulativeFundingLong = fromX18(data.cumulative_funding_long_x18);
        product.cumulativeFundingShort = fromX18(data.cumulative_funding_short_x18);
        if (data.open_interest) product.openInterest = fromX18(data.open_interest);
      }
    }
  }

  // ─── Price emission ─────────────────────────────────────────

  /** Debounced price emission — coalesces rapid BBO/funding updates into a single callback */
  private scheduleEmitPrices(): void {
    if (this.priceEmitTimer) return; // already scheduled
    this.priceEmitTimer = setTimeout(() => {
      this.priceEmitTimer = null;
      this.emitPrices();
    }, 100);
  }

  private emitPrices(): void {
    if (!productMetaLoaded) return;

    const prices: WsPrice[] = [];
    const markets: WsMarket[] = [];

    for (const product of productMeta) {
      const bbo = this.latestPrices.get(product.productId);
      const midPx = bbo ? (bbo.bid + bbo.ask) / 2 : 0;

      // Always emit markets so the perps table shows all assets
      markets.push({
        symbol: product.symbol,
        name: product.baseAsset,
        maxLeverage: product.maxLeverage,
      });

      // BBO mid from WebSocket is the real-time price (sub-second updates).
      // Fall back to oracle before WS connects.
      const livePx = midPx || product.oraclePrice;
      if (livePx === 0) continue;

      prices.push({
        symbol: product.symbol,
        price: livePx,
        oracle: product.oraclePrice,
        indexPrice: product.indexPrice || undefined,
        change24h: product.change24h,
        high24h: product.high24h || 0,
        low24h: product.low24h || 0,
        volume24h: product.volume24hUsd || product.volume24h * livePx,
        openInterest: product.openInterestUsd || product.openInterest * product.oraclePrice,
        funding: (product.fundingRate / 24) * 100, // API returns daily rate; show hourly
        nextFunding: (product.fundingRate / 24) * 100, // Nado settles funding every hour
        lastUpdate: Date.now(),
        maxLeverage: product.maxLeverage,
        tickSize: product.priceIncrement,
        lotSize: product.sizeIncrement,
      });
    }

    this.callbacks.onPrices?.(prices, markets);
  }

  // ─── Orderbook snapshot fetch ───────────────────────────────

  private async fetchOrderbookSnapshot(productId: number): Promise<void> {
    try {
      const resp = await fetch(NADO_QUERY_PROXY, {
        method: 'POST',
        headers: getAuthHeaders({ 'Accept-Encoding': 'gzip, deflate, br' }),
        body: JSON.stringify({
          type: 'market_liquidity',
          product_id: productId,
          depth: 50,
        }),
        signal: AbortSignal.timeout(5000),
      });
      if (!resp.ok) return;

      const result = (await resp.json()) as {
        data: {
          bids: [string, string][];
          asks: [string, string][];
        };
      };

      let book = this.orderbooks.get(productId);
      if (!book) {
        book = { bids: new Map(), asks: new Map() };
        this.orderbooks.set(productId, book);
      }

      // Populate from snapshot
      for (const [priceX18, qtyX18] of result.data.bids || []) {
        const price = fromX18(priceX18);
        const qty = fromX18(qtyX18);
        if (qty > 0) book.bids.set(price, qty);
      }
      for (const [priceX18, qtyX18] of result.data.asks || []) {
        const price = fromX18(priceX18);
        const qty = fromX18(qtyX18);
        if (qty > 0) book.asks.set(price, qty);
      }

      this.emitOrderbook(productId);
    } catch (err) {
      debugWarn('Failed to fetch orderbook snapshot:', err);
    }
  }

  /** Start a 30-second periodic resync for all subscribed orderbooks.
   *  Incremental book_depth diffs can desync if a WS message is lost. */
  private startOrderbookResync(): void {
    if (this.orderbookResyncInterval) return; // already running
    this.orderbookResyncInterval = setInterval(() => {
      for (const [, productId] of this.orderbookSubs) {
        this.fetchOrderbookSnapshot(productId);
      }
    }, 30_000);
  }

  private stopOrderbookResync(): void {
    if (this.orderbookResyncInterval) {
      clearInterval(this.orderbookResyncInterval);
      this.orderbookResyncInterval = null;
    }
  }

  // ─── Incremental orderbook management ───────────────────────

  private applyOrderbookDiff(
    productId: number,
    bids: [string, string][],
    asks: [string, string][]
  ): void {
    let book = this.orderbooks.get(productId);
    if (!book) {
      book = { bids: new Map(), asks: new Map() };
      this.orderbooks.set(productId, book);
    }

    for (const [priceX18, qtyX18] of bids) {
      const price = fromX18(priceX18);
      const qty = fromX18(qtyX18);
      if (qty === 0) {
        book.bids.delete(price);
      } else {
        book.bids.set(price, qty);
      }
    }

    for (const [priceX18, qtyX18] of asks) {
      const price = fromX18(priceX18);
      const qty = fromX18(qtyX18);
      if (qty === 0) {
        book.asks.delete(price);
      } else {
        book.asks.set(price, qty);
      }
    }

    this.emitOrderbook(productId);
  }

  private updateOrderbookBBO(
    productId: number,
    data: {
      bid_price: string;
      bid_qty: string;
      ask_price: string;
      ask_qty: string;
    }
  ): void {
    // BBO updates are also used for orderbook display when full depth isn't subscribed
    const book = this.orderbooks.get(productId);
    if (!book) return;

    const bidPrice = fromX18(data.bid_price);
    const bidQty = fromX18(data.bid_qty);
    const askPrice = fromX18(data.ask_price);
    const askQty = fromX18(data.ask_qty);

    if (bidQty > 0) book.bids.set(bidPrice, bidQty);
    if (askQty > 0) book.asks.set(askPrice, askQty);

    this.emitOrderbook(productId);
  }

  private emitOrderbook(productId: number): void {
    const book = this.orderbooks.get(productId);
    if (!book) return;

    const product = getProductById(productId);
    if (!product) return;

    // Sort bids descending, asks ascending
    const bids: WsOrderbookLevel[] = Array.from(book.bids.entries())
      .sort(([a], [b]) => b - a)
      .slice(0, 50)
      .map(([price, size]) => ({ price, size, orders: 1 }));

    const asks: WsOrderbookLevel[] = Array.from(book.asks.entries())
      .sort(([a], [b]) => a - b)
      .slice(0, 50)
      .map(([price, size]) => ({ price, size, orders: 1 }));

    // Find the symbol that's subscribed
    let symbol = product.symbol;
    for (const [sub, pid] of this.orderbookSubs) {
      if (pid === productId) {
        symbol = sub;
        break;
      }
    }

    this.callbacks.onOrderbook?.({
      symbol,
      bids,
      asks,
      timestamp: Date.now(),
    });
  }

  // ─── REST-backed position/order fetch ──────────────────────

  private async fetchAndEmitPositions(): Promise<void> {
    if (!this.accountId) return;

    try {
      const subaccount = addressToSubaccount(this.accountId);
      const resp = await fetch(NADO_QUERY_PROXY, {
        method: 'POST',
        headers: getAuthHeaders({ 'Accept-Encoding': 'gzip, deflate, br' }),
        body: JSON.stringify({ type: 'subaccount_info', subaccount }),
        signal: AbortSignal.timeout(5000),
      });
      if (!resp.ok) return;

      const result = (await resp.json()) as {
        data: {
          exists: boolean;
          perp_balances: Array<{
            product_id: number;
            balance: {
              amount: string;
              v_quote_balance: string;
              last_cumulative_funding_x18: string;
            };
          }>;
        };
      };

      if (!result.data.exists) {
        this.callbacks.onPositions?.([]);
        return;
      }

      const positions: WsPosition[] = result.data.perp_balances
        .filter((pb) => fromX18(pb.balance.amount) !== 0)
        .map((pb) => {
          const amount = fromX18(pb.balance.amount);
          const product = getProductById(pb.product_id);
          if (!product) return null;

          const vQuote = fromX18(pb.balance.v_quote_balance);
          const entryPrice = amount !== 0 ? Math.abs(vQuote / amount) : 0;
          const unrealizedPnl = amount * product.oraclePrice + vQuote;

          // Funding PnL = amount * (currentCumulativeFunding - positionCumulativeFunding)
          // Longs use cumulativeFundingLong, shorts use cumulativeFundingShort
          const lastCumFunding = fromX18(pb.balance.last_cumulative_funding_x18);
          const currentCumFunding =
            amount > 0 ? product.cumulativeFundingLong : product.cumulativeFundingShort;
          const fundingPnl = amount * (currentCumFunding - lastCumFunding);

          return {
            symbol: product.symbol,
            side: (amount > 0 ? 'bid' : 'ask') as 'bid' | 'ask',
            amount: Math.abs(amount).toString(),
            entry_price: entryPrice.toString(),
            margin: '0',
            funding: fundingPnl.toString(),
            isolated: false,
            liq_price: null,
            updated_at: Date.now(),
            unrealized_pnl: unrealizedPnl.toString(),
          };
        })
        .filter(Boolean) as WsPosition[];

      this.callbacks.onPositions?.(positions);
    } catch (err) {
      console.error('[NadoWS] Failed to fetch positions:', err);
    }
  }

  private async fetchAndEmitOrders(): Promise<void> {
    if (!this.accountId || !productMetaLoaded) return;

    try {
      const subaccount = addressToSubaccount(this.accountId);
      const perpProducts = productMeta.filter((p) => p.isPerp);

      // Query all products in parallel
      const results = await Promise.all(
        perpProducts.map((p) =>
          fetch(NADO_QUERY_PROXY, {
            method: 'POST',
            headers: getAuthHeaders({ 'Accept-Encoding': 'gzip, deflate, br' }),
            body: JSON.stringify({
              type: 'subaccount_orders',
              sender: subaccount,
              product_id: p.productId,
            }),
            signal: AbortSignal.timeout(5000),
          })
            .then((r) => (r.ok ? r.json() : { data: { orders: [] } }))
            .catch(() => ({ data: { orders: [] } }))
        )
      );

      const allOrders: Array<{
        digest: string;
        product_id: number;
        price_x18: string;
        amount: string;
        appendix: string;
      }> = [];

      for (let i = 0; i < results.length; i++) {
        const r = results[i] as { data?: { orders?: typeof allOrders } };
        const orders = r.data?.orders || [];
        for (const o of orders) {
          if (!o.product_id) o.product_id = perpProducts[i]?.productId ?? 0;
          allOrders.push(o);
        }
      }

      const orders: WsOrder[] = allOrders.map((o) => {
        const product = getProductById(o.product_id);
        const symbol = product?.symbol || `UNKNOWN-${o.product_id}`;
        const amount = fromX18(o.amount);
        const price = fromX18(o.price_x18);

        const appendix = BigInt(o.appendix);
        const orderTypeVal = Number((appendix >> BigInt(9)) & BigInt(3));
        const reduceOnly = ((appendix >> BigInt(11)) & BigInt(1)) === BigInt(1);
        const triggerType = Number((appendix >> BigInt(12)) & BigInt(3));

        let orderType = 'limit';
        if (triggerType > 0) {
          orderType = orderTypeVal === 1 ? 'stop_loss_market' : 'stop_loss_limit';
        }

        return {
          order_id: 0,
          client_order_id: o.digest,
          symbol,
          side: (amount > 0 ? 'bid' : 'ask') as 'bid' | 'ask',
          price: price.toString(),
          initial_amount: Math.abs(amount).toString(),
          filled_amount: '0',
          cancelled_amount: '0',
          order_type: orderType,
          stop_price: null,
          stop_type: triggerType > 0 ? 'sl' : null,
          reduce_only: reduceOnly,
          created_at: Date.now(),
        };
      });

      this.callbacks.onOrders?.(orders);
    } catch (err) {
      console.error('[NadoWS] Failed to fetch orders:', err);
    }
  }

  // ─── Subscription helpers ──────────────────────────────────

  private sendPriceSubscriptions(): void {
    // Subscribe to best_bid_offer, funding_rate, and funding_payment for all perp products
    for (const product of productMeta) {
      this.send({
        method: 'subscribe',
        stream: { type: 'best_bid_offer', product_id: product.productId },
      });
      this.send({
        method: 'subscribe',
        stream: { type: 'funding_rate', product_id: product.productId },
      });
      this.send({
        method: 'subscribe',
        stream: { type: 'funding_payment', product_id: product.productId },
      });
    }
  }

  private sendAccountSubscriptions(accountId: string): void {
    this.subscribedAccount = true;
    const subaccount = addressToSubaccount(accountId);

    // Subscribe to public account streams (no auth needed)
    this.send({
      method: 'subscribe',
      stream: { type: 'fill', subaccount },
    });
    this.send({
      method: 'subscribe',
      stream: { type: 'position_change', subaccount },
    });

    // Authenticate WS and subscribe to order_update (requires EIP-712 StreamAuthentication)
    this.authenticateAndSubscribeOrders(accountId, subaccount);

    // Stagger initial REST fetches
    setTimeout(() => this.fetchAndEmitPositions(), 500);
    setTimeout(() => this.fetchAndEmitOrders(), 1000);
  }

  /**
   * Authenticate the WS connection for the `order_update` stream.
   *
   * The linked signer key lives server-side (encrypted in DB). We call
   * /api/nado/ws-auth to get a pre-signed StreamAuthentication payload,
   * then send it verbatim over the WebSocket. Once authenticated, we
   * subscribe to order_update for the given subaccount.
   */
  private async authenticateAndSubscribeOrders(
    accountId: string,
    subaccount: string
  ): Promise<void> {
    if (this.wsAuthenticated || this.wsAuthInFlight) return;
    this.wsAuthInFlight = true;

    try {
      const token = useAuthStore.getState().token;
      if (!token) {
        debugLog('No auth token available, skipping WS authentication');
        return;
      }

      const resp = await fetch(NADO_WS_AUTH_URL, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ walletAddress: accountId }),
        signal: AbortSignal.timeout(10000),
      });

      if (!resp.ok) {
        const body = await resp.json().catch(() => ({ error: 'unknown' }));
        debugWarn('WS auth request failed:', resp.status, body.error);
        return;
      }

      const result = (await resp.json()) as {
        success: boolean;
        payload?: {
          method: string;
          tx: { sender: string; expiration: string };
          signature: string;
        };
        error?: string;
      };

      if (!result.success || !result.payload) {
        debugWarn('WS auth response unsuccessful:', result.error);
        return;
      }

      // Send the authenticate message over WS
      if (this.ws?.readyState !== WebSocket.OPEN) {
        debugWarn('WS not open when sending auth, will retry on reconnect');
        return;
      }

      this.send(result.payload as unknown as Record<string, unknown>);
      this.wsAuthenticated = true;
      debugLog('WS authenticated, subscribing to order_update');

      // Now subscribe to order_update
      this.send({
        method: 'subscribe',
        stream: { type: 'order_update', subaccount },
      });
    } catch (err) {
      debugWarn('WS authentication failed:', err);
    } finally {
      this.wsAuthInFlight = false;
    }
  }

  private clearTimers(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.metaRefreshInterval) {
      clearInterval(this.metaRefreshInterval);
      this.metaRefreshInterval = null;
    }
    if (this.priceEmitTimer) {
      clearTimeout(this.priceEmitTimer);
      this.priceEmitTimer = null;
    }
    if (this.orderbookResyncInterval) {
      clearInterval(this.orderbookResyncInterval);
      this.orderbookResyncInterval = null;
    }
  }
}
