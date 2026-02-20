/**
 * Hyperliquid Exchange Adapter
 *
 * Implements the ExchangeAdapter interface for Hyperliquid DEX.
 * Uses the Hyperliquid REST API (POST-only to /info and /exchange).
 *
 * Key differences from Pacifica:
 * - Symbols use string names ("BTC") but orders use integer asset indices
 * - Sides: isBuy boolean (orders), "A"/"B" strings (info responses)
 * - All REST is POST-only with { type: "..." } body
 * - Signing uses EIP-712 (ECDSA) via agent wallet
 * - Info endpoint requires NO authentication
 */

import type {
  ExchangeAdapter,
  AuthContext,
  Market,
  Price,
  Orderbook,
  Candle,
  RecentTrade,
  Account,
  Position,
  Order,
  OrderSide,
  OrderType,
  TradeHistoryItem,
  AccountSetting,
  MarketOrderParams,
  LimitOrderParams,
  StopOrderParams,
  CancelOrderParams,
  CancelAllOrdersParams,
  KlineParams,
  TradeHistoryParams,
} from './adapter';

const HL_API_URL = process.env.HYPERLIQUID_API_URL || 'https://api.hyperliquid.xyz';

// ─────────────────────────────────────────────────────────────
// Hyperliquid API response types
// ─────────────────────────────────────────────────────────────

interface HlAssetMeta {
  name: string;
  szDecimals: number;
  maxLeverage: number;
  onlyIsolated?: boolean;
}

interface HlAssetCtx {
  funding: string;
  openInterest: string;
  prevDayPx: string;
  dayNtlVlm: string;
  premium?: string;
  oraclePx: string;
  markPx: string;
  midPx?: string;
  impactPxs?: [string, string]; // [bid impact, ask impact]
}

interface HlPosition {
  coin: string;
  entryPx: string | null;
  leverage: { type: string; value: number; rawUsd?: string };
  liquidationPx: string | null;
  marginUsed: string;
  maxLeverage: number;
  positionValue: string;
  returnOnEquity: string;
  szi: string; // signed size: positive=long, negative=short
  unrealizedPnl: string;
  cumFunding?: { allTime: string; sinceOpen: string; sinceChange: string };
}

interface HlOpenOrder {
  coin: string;
  limitPx: string;
  oid: number;
  side: 'A' | 'B'; // A=ask/sell, B=bid/buy
  sz: string;
  timestamp: number;
  // frontendOpenOrders extra fields
  orderType?: string;
  origSz?: string;
  reduceOnly?: boolean;
  isTrigger?: boolean;
  triggerPx?: string;
  triggerCondition?: string;
  isPositionTpsl?: boolean;
  cloid?: string;
}

interface HlFill {
  coin: string;
  px: string;
  sz: string;
  side: 'A' | 'B';
  time: number;
  hash: string;
  oid: number;
  fee: string;
  feeToken: string;
  closedPnl: string;
  dir: string; // "Open Long", "Close Short", etc.
  crossed: boolean;
  startPosition: string;
  tid: number;
}

interface HlL2Level {
  px: string;
  sz: string;
  n: number; // number of orders
}

// ─────────────────────────────────────────────────────────────
// Symbol mapping cache
// ─────────────────────────────────────────────────────────────

let assetMetaCache: HlAssetMeta[] = [];
let assetCtxCache: HlAssetCtx[] = [];
let metaLoaded = false;

// ─────────────────────────────────────────────────────────────
// Helper: POST to Hyperliquid info endpoint
// ─────────────────────────────────────────────────────────────

async function hlInfo<T>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${HL_API_URL}/info`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Hyperliquid API error (${response.status}): ${text}`);
  }

  return response.json();
}

// ─────────────────────────────────────────────────────────────
// Adapter implementation
// ─────────────────────────────────────────────────────────────

export class HyperliquidAdapter implements ExchangeAdapter {
  readonly name = 'hyperliquid';
  readonly version = 'v1';

  /**
   * Load perpetual metadata (symbol→index mapping, leverage limits, etc.)
   * Called lazily on first use, cached for the lifetime of the adapter.
   */
  private async ensureMeta(): Promise<void> {
    if (metaLoaded) return;

    const result = await hlInfo<[{ universe: HlAssetMeta[] }, HlAssetCtx[]]>({
      type: 'metaAndAssetCtxs',
    });

    assetMetaCache = result[0].universe;
    assetCtxCache = result[1];
    metaLoaded = true;
  }

  /** Convert normalized symbol ("BTC-USD") → Hyperliquid coin ("BTC") */
  private denormalizeSymbol(symbol: string): string {
    return symbol.replace(/-USD$/, '');
  }

  /** Convert Hyperliquid coin ("BTC") → normalized symbol ("BTC-USD") */
  private normalizeSymbol(coin: string): string {
    return `${coin}-USD`;
  }

  /** Get asset index for a coin name */
  private getAssetIndex(coin: string): number {
    const idx = assetMetaCache.findIndex((m) => m.name === coin);
    if (idx === -1) throw new Error(`Unknown Hyperliquid asset: ${coin}`);
    return idx;
  }

  /** Convert Hyperliquid side to normalized */
  private normalizeSide(side: 'A' | 'B'): OrderSide {
    return side === 'B' ? 'BUY' : 'SELL';
  }

  /** Convert Hyperliquid fill direction to normalized side */
  private normalizeFillSide(dir: string): OrderSide {
    return dir.includes('Long') ? 'BUY' : 'SELL';
  }

  // ─── Public Market Data ────────────────────────────────────

  async getMarkets(): Promise<Market[]> {
    await this.ensureMeta();

    return assetMetaCache.map((meta, i) => {
      const ctx = assetCtxCache[i];
      const stepSize = (1 / Math.pow(10, meta.szDecimals)).toFixed(meta.szDecimals);

      return {
        symbol: this.normalizeSymbol(meta.name),
        baseAsset: meta.name,
        quoteAsset: 'USD',
        tickSize: '0.1', // HL uses 5 sig figs
        stepSize,
        minOrderSize: stepSize,
        maxOrderSize: '1000000',
        minNotional: '10',
        maxLeverage: meta.maxLeverage,
        fundingRate: ctx?.funding || '0',
        fundingInterval: 1, // HL funds every 1 hour
        metadata: {
          assetIndex: i,
          onlyIsolated: meta.onlyIsolated || false,
          szDecimals: meta.szDecimals,
        },
      };
    });
  }

  async getPrices(): Promise<Price[]> {
    await this.ensureMeta();

    // Refresh asset contexts for latest prices
    const result = await hlInfo<[{ universe: HlAssetMeta[] }, HlAssetCtx[]]>({
      type: 'metaAndAssetCtxs',
    });
    assetCtxCache = result[1];

    return assetMetaCache.map((meta, i) => {
      const ctx = assetCtxCache[i];
      if (!ctx) return null;

      const markPx = ctx.markPx || '0';
      const oraclePx = ctx.oraclePx || '0';
      const prevDayPx = parseFloat(ctx.prevDayPx || '0');
      const currentPx = parseFloat(oraclePx);
      const change24h =
        prevDayPx > 0 ? (((currentPx - prevDayPx) / prevDayPx) * 100).toString() : '0';

      return {
        symbol: this.normalizeSymbol(meta.name),
        mark: markPx,
        index: oraclePx,
        last: markPx, // HL doesn't have a distinct "last" — use mark
        bid: ctx.impactPxs?.[0] || markPx,
        ask: ctx.impactPxs?.[1] || markPx,
        funding: ctx.funding || '0',
        volume24h: ctx.dayNtlVlm || '0',
        change24h,
        timestamp: Date.now(),
      };
    }).filter(Boolean) as Price[];
  }

  async getOrderbook(symbol: string, aggLevel?: number): Promise<Orderbook> {
    const coin = this.denormalizeSymbol(symbol);
    const params: Record<string, unknown> = { type: 'l2Book', coin };
    if (aggLevel) params.nSigFigs = aggLevel;

    const result = await hlInfo<{ levels: [HlL2Level[], HlL2Level[]] }>( params);

    return {
      symbol,
      bids: result.levels[0].map((l) => [l.px, l.sz] as [string, string]),
      asks: result.levels[1].map((l) => [l.px, l.sz] as [string, string]),
      timestamp: Date.now(),
    };
  }

  async getKlines(params: KlineParams): Promise<Candle[]> {
    const coin = this.denormalizeSymbol(params.symbol);
    const req: Record<string, unknown> = {
      coin,
      interval: params.interval,
    };
    if (params.startTime) req.startTime = params.startTime;
    if (params.endTime) req.endTime = params.endTime;

    const result = await hlInfo<
      Array<{ t: number; T: number; o: string; h: string; l: string; c: string; v: string }>
    >({ type: 'candleSnapshot', req });

    const candles = result.map((c) => ({
      timestamp: c.t,
      open: c.o,
      high: c.h,
      low: c.l,
      close: c.c,
      volume: c.v,
    }));

    return params.limit ? candles.slice(0, params.limit) : candles;
  }

  async getRecentTrades(symbol: string): Promise<RecentTrade[]> {
    const coin = this.denormalizeSymbol(symbol);

    // HL doesn't have a public recent trades endpoint per coin via /info.
    // Use l2Book trades or return empty. For now, return empty.
    // WebSocket "trades" subscription handles real-time trades.
    console.warn(`[HyperliquidAdapter] getRecentTrades not fully supported for ${coin}`);
    return [];
  }

  // ─── Account Data ──────────────────────────────────────────

  async getAccount(accountId: string): Promise<Account> {
    const state = await hlInfo<{
      assetPositions: Array<{ position: HlPosition }>;
      marginSummary: {
        accountValue: string;
        totalMarginUsed: string;
        totalNtlPos: string;
        totalRawUsd: string;
      };
      crossMarginSummary: {
        accountValue: string;
        totalMarginUsed: string;
        totalNtlPos: string;
        totalRawUsd: string;
      };
      withdrawable: string;
    }>({ type: 'clearinghouseState', user: accountId });

    const margin = state.marginSummary;
    const unrealizedPnl = state.assetPositions.reduce(
      (sum, ap) => sum + parseFloat(ap.position.unrealizedPnl || '0'),
      0
    );

    return {
      accountId,
      balance: margin.totalRawUsd,
      accountEquity: margin.accountValue,
      availableToSpend: state.withdrawable,
      marginUsed: margin.totalMarginUsed,
      unrealizedPnl: unrealizedPnl.toString(),
      makerFee: '0.0002', // 2 bps maker
      takerFee: '0.0005', // 5 bps taker
      metadata: {
        crossMarginSummary: state.crossMarginSummary,
      },
    };
  }

  async getPositions(accountId: string): Promise<Position[]> {
    const state = await hlInfo<{
      assetPositions: Array<{ position: HlPosition }>;
    }>({ type: 'clearinghouseState', user: accountId });

    return state.assetPositions
      .filter((ap) => parseFloat(ap.position.szi) !== 0)
      .map((ap) => {
        const pos = ap.position;
        const szi = parseFloat(pos.szi);
        const isLong = szi > 0;

        return {
          symbol: this.normalizeSymbol(pos.coin),
          side: (isLong ? 'LONG' : 'SHORT') as 'LONG' | 'SHORT',
          amount: Math.abs(szi).toString(),
          entryPrice: pos.entryPx || '0',
          markPrice: '0', // Not in position data, get from prices
          margin: pos.marginUsed,
          leverage: pos.leverage.value.toString(),
          unrealizedPnl: pos.unrealizedPnl,
          liquidationPrice: pos.liquidationPx || '0',
          funding: pos.cumFunding?.sinceOpen || '0',
          metadata: {
            leverageType: pos.leverage.type,
            returnOnEquity: pos.returnOnEquity,
            positionValue: pos.positionValue,
            maxLeverage: pos.maxLeverage,
          },
        };
      });
  }

  async getOpenOrders(accountId: string): Promise<Order[]> {
    const orders = await hlInfo<HlOpenOrder[]>({
      type: 'frontendOpenOrders',
      user: accountId,
    });

    await this.ensureMeta();

    return orders.map((o) => {
      let orderType: OrderType = 'LIMIT';
      if (o.isTrigger) {
        const isTP = o.orderType?.includes('Take-Profit') || o.triggerCondition === 'tp';
        const isMarket = o.orderType?.includes('Market');
        if (isTP) {
          orderType = isMarket ? 'TAKE_PROFIT_MARKET' : 'TAKE_PROFIT_LIMIT';
        } else {
          orderType = isMarket ? 'STOP_MARKET' : 'STOP_LIMIT';
        }
      }

      return {
        orderId: o.oid,
        clientOrderId: o.cloid || undefined,
        symbol: this.normalizeSymbol(o.coin),
        side: this.normalizeSide(o.side),
        type: orderType,
        price: o.isTrigger ? (o.triggerPx || o.limitPx) : o.limitPx,
        amount: o.origSz || o.sz,
        filled: '0',
        remaining: o.sz,
        status: 'OPEN' as const,
        timeInForce: 'GTC' as const,
        reduceOnly: o.reduceOnly || false,
        createdAt: o.timestamp,
        updatedAt: o.timestamp,
        metadata: {
          isTrigger: o.isTrigger || false,
          isPositionTpsl: o.isPositionTpsl || false,
          triggerPx: o.triggerPx,
        },
      };
    });
  }

  async getTradeHistory(params: TradeHistoryParams): Promise<TradeHistoryItem[]> {
    let fills: HlFill[];

    if (params.startTime || params.endTime) {
      fills = await hlInfo<HlFill[]>({
        type: 'userFillsByTime',
        user: params.accountId,
        startTime: params.startTime || 0,
        endTime: params.endTime,
      });
    } else {
      fills = await hlInfo<HlFill[]>({
        type: 'userFills',
        user: params.accountId,
      });
    }

    // Filter by symbol if specified
    if (params.symbol) {
      const coin = this.denormalizeSymbol(params.symbol);
      fills = fills.filter((f) => f.coin === coin);
    }

    // Apply limit
    if (params.limit) {
      fills = fills.slice(0, params.limit);
    }

    return fills.map((f) => ({
      historyId: f.tid.toString(),
      orderId: f.oid,
      symbol: this.normalizeSymbol(f.coin),
      side: this.normalizeFillSide(f.dir),
      amount: f.sz,
      price: f.px,
      fee: f.fee,
      pnl: parseFloat(f.closedPnl) !== 0 ? f.closedPnl : null,
      executedAt: f.time,
      metadata: {
        hash: f.hash,
        dir: f.dir,
        crossed: f.crossed,
        feeToken: f.feeToken,
        startPosition: f.startPosition,
      },
    }));
  }

  async getAccountSettings(accountId: string): Promise<AccountSetting[]> {
    const state = await hlInfo<{
      assetPositions: Array<{ position: HlPosition }>;
    }>({ type: 'clearinghouseState', user: accountId });

    await this.ensureMeta();

    return state.assetPositions.map((ap) => ({
      symbol: this.normalizeSymbol(ap.position.coin),
      leverage: ap.position.leverage.value,
      metadata: {
        leverageType: ap.position.leverage.type,
        maxLeverage: ap.position.maxLeverage,
      },
    }));
  }

  // ─── Trading Operations ────────────────────────────────────
  // These are handled by the HyperliquidOrderRouter (server-side signing).
  // The adapter's trading methods are for direct API use with an AuthContext.

  async createMarketOrder(
    _auth: AuthContext,
    _params: MarketOrderParams
  ): Promise<{ orderId: string | number }> {
    throw new Error(
      'Use HyperliquidOrderRouter for order operations (server-side signing)'
    );
  }

  async createLimitOrder(
    _auth: AuthContext,
    _params: LimitOrderParams
  ): Promise<{ orderId: string | number }> {
    throw new Error(
      'Use HyperliquidOrderRouter for order operations (server-side signing)'
    );
  }

  async createStopOrder(
    _auth: AuthContext,
    _params: StopOrderParams
  ): Promise<{ orderId: string | number }> {
    throw new Error(
      'Use HyperliquidOrderRouter for order operations (server-side signing)'
    );
  }

  async cancelOrder(
    _auth: AuthContext,
    _params: CancelOrderParams
  ): Promise<{ success: boolean }> {
    throw new Error(
      'Use HyperliquidOrderRouter for order operations (server-side signing)'
    );
  }

  async cancelAllOrders(
    _auth: AuthContext,
    _params: CancelAllOrdersParams
  ): Promise<{ cancelledCount: number }> {
    throw new Error(
      'Use HyperliquidOrderRouter for order operations (server-side signing)'
    );
  }

  async updateLeverage(
    _auth: AuthContext,
    _symbol: string,
    _leverage: number
  ): Promise<{ success: boolean }> {
    throw new Error(
      'Use HyperliquidOrderRouter for order operations (server-side signing)'
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Exported helpers for use by order router and WS adapter
// ─────────────────────────────────────────────────────────────

/**
 * Get the asset index for a normalized symbol.
 * Loads metadata if not yet cached.
 */
export async function getHlAssetIndex(symbol: string): Promise<number> {
  if (!metaLoaded) {
    const result = await hlInfo<[{ universe: HlAssetMeta[] }, HlAssetCtx[]]>({
      type: 'metaAndAssetCtxs',
    });
    assetMetaCache = result[0].universe;
    assetCtxCache = result[1];
    metaLoaded = true;
  }

  const coin = symbol.replace(/-USD$/, '');
  const idx = assetMetaCache.findIndex((m) => m.name === coin);
  if (idx === -1) throw new Error(`Unknown Hyperliquid asset: ${coin}`);
  return idx;
}

/**
 * Get size decimals for a given coin.
 */
export function getHlSzDecimals(coin: string): number {
  const meta = assetMetaCache.find((m) => m.name === coin);
  return meta?.szDecimals ?? 5;
}

/**
 * Get all loaded asset metadata. Returns empty if not yet loaded.
 */
export function getHlAssetMeta(): HlAssetMeta[] {
  return assetMetaCache;
}

/** Invalidate metadata cache (for testing or refresh) */
export function invalidateHlMetaCache(): void {
  metaLoaded = false;
  assetMetaCache = [];
  assetCtxCache = [];
}
