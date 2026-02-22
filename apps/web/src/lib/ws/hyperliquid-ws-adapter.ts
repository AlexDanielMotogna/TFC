/**
 * Hyperliquid WebSocket Adapter
 *
 * Connects to wss://api.hyperliquid.xyz/ws for real-time data.
 *
 * Subscriptions:
 * - allMids: real-time mid prices for all assets (public, no auth)
 * - userEvents: positions, orders, fills for a user (public, address only)
 * - l2Book: orderbook updates (not used here, handled by trade page directly)
 *
 * Message format:
 * - Subscribe: {"method": "subscribe", "subscription": {"type": "allMids"}}
 * - Unsubscribe: {"method": "unsubscribe", "subscription": {"type": "allMids"}}
 * - Response: {"channel": "allMids", "data": {"mids": {"BTC": "65000.0", ...}}}
 * - Heartbeat: {"channel": "pong"}
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
  WsCandle,
} from './types';

const HL_WS_URL = process.env.NEXT_PUBLIC_HYPERLIQUID_WS_URL || 'wss://api.hyperliquid.xyz/ws';
const HL_API_URL = process.env.NEXT_PUBLIC_HYPERLIQUID_API_URL || 'https://api.hyperliquid.xyz';
const PING_INTERVAL = 30000;
const RECONNECT_DELAY = 3000;

// ─────────────────────────────────────────────────────────────
// Hyperliquid WS message types
// ─────────────────────────────────────────────────────────────

interface HlAssetMeta {
  name: string;
  szDecimals: number;
  maxLeverage: number;
}

interface HlAssetCtx {
  funding: string;
  openInterest: string;
  prevDayPx: string;
  dayNtlVlm: string;
  oraclePx: string;
  markPx: string;
}

interface HlWsPosition {
  coin: string;
  entryPx: string | null;
  leverage: { type: string; value: number };
  liquidationPx: string | null;
  marginUsed: string;
  positionValue: string;
  returnOnEquity: string;
  szi: string; // signed size
  unrealizedPnl: string;
  cumFunding?: { allTime: string; sinceOpen: string; sinceChange: string };
}

interface HlWsOrder {
  coin: string;
  limitPx: string;
  oid: number;
  side: 'A' | 'B';
  sz: string;
  timestamp: number;
  origSz?: string;
  orderType?: string;
  reduceOnly?: boolean;
  isTrigger?: boolean;
  triggerPx?: string;
  triggerCondition?: string;
  cloid?: string;
}

interface HlWsFill {
  coin: string;
  px: string;
  sz: string;
  side: 'A' | 'B';
  time: number;
  hash: string;
  oid: number;
  fee: string;
  closedPnl: string;
  dir: string; // "Open Long", "Close Short", etc.
  startPosition: string;
  tid: number;
}

// ─────────────────────────────────────────────────────────────
// Asset metadata cache (loaded via REST, used for normalization)
// ─────────────────────────────────────────────────────────────

let assetMeta: HlAssetMeta[] = [];
let assetCtx: HlAssetCtx[] = [];
let metaLoaded = false;

/** Fetch metadata + asset contexts from REST. Called once on first connect. */
async function ensureMeta(): Promise<void> {
  if (metaLoaded) return;
  await fetchMeta();
}

/** Refresh metadata + asset contexts (volume, OI, funding) from REST. */
async function fetchMeta(): Promise<void> {
  try {
    const resp = await fetch(`${HL_API_URL}/info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'metaAndAssetCtxs' }),
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) return; // Rate limited — skip, will retry on next refresh cycle

    const result = await resp.json() as [{ universe: HlAssetMeta[] }, HlAssetCtx[]];
    assetMeta = result[0].universe;
    assetCtx = result[1];
    metaLoaded = true;
  } catch (err) {
    console.error('[HLWsAdapter] Failed to fetch metadata:', err);
  }
}

function getMetaByName(coin: string): HlAssetMeta | undefined {
  return assetMeta.find((m) => m.name === coin);
}

function getCtxByName(coin: string): HlAssetCtx | undefined {
  const idx = assetMeta.findIndex((m) => m.name === coin);
  return idx >= 0 ? assetCtx[idx] : undefined;
}

/** Coin name → normalized symbol */
function normalizeSymbol(coin: string): string {
  return `${coin}-USD`;
}

// ─────────────────────────────────────────────────────────────
// Normalization functions
// ─────────────────────────────────────────────────────────────

function normalizePosition(p: HlWsPosition): WsPosition {
  const szi = parseFloat(p.szi);
  const isLong = szi > 0;

  return {
    symbol: normalizeSymbol(p.coin),
    side: isLong ? 'bid' : 'ask', // bid=long, ask=short (Pacifica convention)
    amount: Math.abs(szi).toString(),
    entry_price: p.entryPx || '0',
    margin: p.marginUsed,
    funding: p.cumFunding?.sinceOpen || '0',
    isolated: p.leverage.type === 'isolated',
    liq_price: p.liquidationPx,
    updated_at: Date.now(),
    // HL-specific fields
    leverage: p.leverage.value,
    leverage_type: p.leverage.type,
    unrealized_pnl: p.unrealizedPnl,
    return_on_equity: p.returnOnEquity,
    position_value: p.positionValue,
  };
}

function normalizeOrder(o: HlWsOrder): WsOrder {
  let orderType = 'limit';
  if (o.isTrigger) {
    // frontendOpenOrders: orderType = "Take Profit Market" / "Stop Market" / "Stop Limit"
    // WS trigger orders: triggerCondition = "tp" / "sl"
    const isTP = o.orderType?.toLowerCase().includes('take profit')
      || o.triggerCondition === 'tp';
    const isLimit = o.orderType?.toLowerCase().includes('limit');
    if (isTP) {
      orderType = isLimit ? 'take_profit_limit' : 'take_profit_market';
    } else {
      orderType = isLimit ? 'stop_loss_limit' : 'stop_loss_market';
    }
  }

  return {
    order_id: o.oid,
    client_order_id: o.cloid || null,
    symbol: normalizeSymbol(o.coin),
    side: o.side === 'B' ? 'bid' : 'ask',
    price: o.isTrigger ? (o.triggerPx || o.limitPx) : o.limitPx,
    initial_amount: o.origSz || o.sz,
    filled_amount: '0', // HL doesn't provide filled amount in WS, it's always the remaining
    cancelled_amount: '0',
    order_type: orderType,
    stop_price: o.triggerPx || null,
    stop_type: o.isTrigger ? (o.triggerCondition || 'sl') : null,
    reduce_only: o.reduceOnly || false,
    created_at: o.timestamp,
  };
}

function normalizeFill(f: HlWsFill): WsTrade {
  const isLong = f.dir.includes('Long');

  return {
    history_id: f.tid,
    order_id: f.oid,
    client_order_id: null,
    symbol: normalizeSymbol(f.coin),
    price: f.px,
    entry_price: f.px, // HL doesn't provide entry price in fill
    amount: f.sz,
    side: f.dir.toLowerCase().replace(' ', '_'), // "Open Long" → "open_long"
    fee: f.fee,
    pnl: f.closedPnl,
    created_at: f.time,
  };
}

// ─────────────────────────────────────────────────────────────
// Adapter implementation
// ─────────────────────────────────────────────────────────────

export class HyperliquidWsAdapter implements ExchangeWsAdapter {
  readonly exchangeType = 'hyperliquid' as const;

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
  private orderbookSubs: Set<string> = new Set(); // coin names
  private candlePollers: Map<string, ReturnType<typeof setInterval>> = new Map(); // "symbol:interval" → timer

  // Cache of latest mid prices for building WsPrice snapshots
  private latestMids: Record<string, string> = {};

  connect(callbacks: ExchangeWsCallbacks): void {
    this.callbackSets.add(callbacks);
    this.rebuildCallbacks();
    this.doConnect();
    ensureMeta();

    // Refresh metadata (volume, OI, funding) every 30s to keep data fresh
    if (!this.metaRefreshInterval) {
      this.metaRefreshInterval = setInterval(() => {
        fetchMeta().then(() => {
          // Re-emit prices with updated ctx data
          if (this.subscribedPrices && Object.keys(this.latestMids).length > 0) {
            this.emitPrices();
          }
        });
      }, 30_000);
    }
  }

  removeCallbacks(callbacks: ExchangeWsCallbacks): void {
    this.callbackSets.delete(callbacks);
    this.rebuildCallbacks();
  }

  private rebuildCallbacks(): void {
    const sets = Array.from(this.callbackSets);
    this.callbacks = {
      onConnected: () => sets.forEach(s => s.onConnected?.()),
      onDisconnected: () => sets.forEach(s => s.onDisconnected?.()),
      onPrices: (prices, markets) => sets.forEach(s => s.onPrices?.(prices, markets)),
      onPositions: (positions) => sets.forEach(s => s.onPositions?.(positions)),
      onOrders: (orders) => sets.forEach(s => s.onOrders?.(orders)),
      onTrades: (trades) => sets.forEach(s => s.onTrades?.(trades)),
      onOrderbook: (data) => sets.forEach(s => s.onOrderbook?.(data)),
      onCandle: (data) => sets.forEach(s => s.onCandle?.(data)),
      onError: (error) => sets.forEach(s => s.onError?.(error)),
    };
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
    this.orderbookSubs.clear();
    this.callbacks.onDisconnected?.();
    this.callbacks = {};
  }

  isConnected(): boolean {
    return this.connected;
  }

  subscribeAccount(accountId: string): void {
    this.accountId = accountId;
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendAccountSubscription(accountId);
    }
  }

  unsubscribeAccount(): void {
    if (this.accountId && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        method: 'unsubscribe',
        subscription: { type: 'userEvents', user: this.accountId },
      }));
    }
    this.accountId = null;
    this.subscribedAccount = false;
  }

  subscribePrices(): void {
    this.subscribedPrices = true;
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendPriceSubscription();
    }
  }

  subscribeOrderbook(symbol: string, _aggLevel?: number): void {
    const coin = symbol.replace('-USD', '');
    this.orderbookSubs.add(coin);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        method: 'subscribe',
        subscription: { type: 'l2Book', coin },
      }));
    }
  }

  unsubscribeOrderbook(symbol: string): void {
    const coin = symbol.replace('-USD', '');
    this.orderbookSubs.delete(coin);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        method: 'unsubscribe',
        subscription: { type: 'l2Book', coin },
      }));
    }
  }

  subscribeCandles(symbol: string, interval: string): void {
    const key = `${symbol}:${interval}`;
    // HL WS doesn't support candle subscriptions — use REST polling
    if (this.candlePollers.has(key)) return;
    const coin = symbol.replace('-USD', '');

    // Fetch immediately, then poll every 5 seconds
    this.fetchCandle(coin, interval, symbol);
    const poller = setInterval(() => this.fetchCandle(coin, interval, symbol), 5000);
    this.candlePollers.set(key, poller);
  }

  unsubscribeCandles(symbol: string, interval: string): void {
    const key = `${symbol}:${interval}`;
    const poller = this.candlePollers.get(key);
    if (poller) {
      clearInterval(poller);
      this.candlePollers.delete(key);
    }
  }

  refresh(): void {
    // Re-fetch metadata (volume, OI, funding)
    fetchMeta();

    if (this.ws?.readyState === WebSocket.OPEN) {
      if (this.subscribedPrices) this.sendPriceSubscription();
      if (this.accountId) this.sendAccountSubscription(this.accountId);
      this.orderbookSubs.forEach(coin => {
        this.ws?.send(JSON.stringify({
          method: 'subscribe',
          subscription: { type: 'l2Book', coin },
        }));
      });
    }
  }

  // ─── Private methods ────────────────────────────────────────

  private doConnect(): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) return;

    this.clearTimers();

    try {
      console.log('[HLWsAdapter] Connecting to', HL_WS_URL);
      const ws = new WebSocket(HL_WS_URL);
      this.ws = ws;

      ws.onopen = () => {
        console.log('[HLWsAdapter] Connected');
        this.connected = true;
        this.callbacks.onConnected?.();

        if (this.subscribedPrices) this.sendPriceSubscription();
        if (this.accountId) this.sendAccountSubscription(this.accountId);
        this.orderbookSubs.forEach(coin => {
          ws.send(JSON.stringify({
            method: 'subscribe',
            subscription: { type: 'l2Book', coin },
          }));
        });

        // Ping every 30s to keep alive
        this.pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ method: 'ping' }));
          }
        }, PING_INTERVAL);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleMessage(msg);
        } catch (err) {
          console.error('[HLWsAdapter] Parse error:', err);
        }
      };

      ws.onerror = () => {
        this.callbacks.onError?.('Hyperliquid WebSocket connection error');
      };

      ws.onclose = (event) => {
        console.log('[HLWsAdapter] Disconnected:', event.code);
        this.connected = false;
        this.ws = null;
        this.clearTimers();
        this.callbacks.onDisconnected?.();

        if (event.code !== 1000) {
          this.reconnectTimeout = setTimeout(() => this.doConnect(), RECONNECT_DELAY);
        }
      };
    } catch (err) {
      console.error('[HLWsAdapter] Connection error:', err);
      this.callbacks.onError?.('Failed to connect to Hyperliquid WebSocket');
    }
  }

  private handleMessage(msg: { channel?: string; data?: unknown }): void {
    if (!msg.channel) return;
    if (msg.channel === 'pong') return;

    // ─── allMids: price feed ──────────────────────────────────
    if (msg.channel === 'allMids') {
      const data = msg.data as { mids: Record<string, string> };
      if (!data?.mids) return;

      this.latestMids = data.mids;
      this.emitPrices();
    }

    // ─── userEvents: account data ─────────────────────────────
    if (msg.channel === 'user') {
      const data = msg.data as {
        fills?: HlWsFill[];
        openOrders?: HlWsOrder[];
        // userEvents can also contain position updates via "ledgerUpdates"
      };

      if (data.fills && data.fills.length > 0) {
        this.callbacks.onTrades?.(data.fills.map(normalizeFill));
        // Fills mean positions changed — refresh from REST
        this.fetchAndEmitPositions();
      }

      if (data.openOrders) {
        // WS openOrders doesn't include trigger orders (TP/SL) or their metadata.
        // Use REST frontendOpenOrders which has isTrigger, triggerCondition, etc.
        this.fetchAndEmitOrders();
      }
    }

    // ─── userFills / notification ──────────────────────────────
    if (msg.channel === 'userFills') {
      const fills = msg.data as HlWsFill[];
      if (fills && fills.length > 0) {
        this.callbacks.onTrades?.(fills.map(normalizeFill));
        // Fills mean positions changed — refresh from REST
        this.fetchAndEmitPositions();
      }
    }

    // ─── userNonFundingLedgerUpdates: position changes ────────
    if (msg.channel === 'activeAssetCtx' || msg.channel === 'activeAssetData') {
      // Position updates come through clearinghouse state changes
      // We re-fetch positions via REST when fills come in
      this.fetchAndEmitPositions();
    }

    // ─── notification: general event (e.g., order fill) ───────
    if (msg.channel === 'notification') {
      // Notifications contain fill events — trigger position refresh
      this.fetchAndEmitPositions();
    }

    // ─── l2Book: orderbook updates ─────────────────────────────
    if (msg.channel === 'l2Book') {
      const data = msg.data as {
        coin: string;
        levels: [Array<{ px: string; sz: string; n: number }>, Array<{ px: string; sz: string; n: number }>];
        time: number;
      };
      if (data?.levels) {
        const [bids, asks] = data.levels;
        this.callbacks.onOrderbook?.({
          symbol: normalizeSymbol(data.coin),
          bids: bids.map(l => ({ price: parseFloat(l.px), size: parseFloat(l.sz), orders: l.n })),
          asks: asks.map(l => ({ price: parseFloat(l.px), size: parseFloat(l.sz), orders: l.n })),
          timestamp: data.time || Date.now(),
        });
      }
    }
  }

  /**
   * Build WsPrice[] from cached mids and metadata, then emit.
   */
  private emitPrices(): void {
    if (!metaLoaded) return;

    const prices: WsPrice[] = [];
    const markets: WsMarket[] = [];

    for (const meta of assetMeta) {
      const mid = this.latestMids[meta.name];
      if (!mid) continue;

      const ctx = getCtxByName(meta.name);
      const midPx = parseFloat(mid);
      const oraclePx = ctx ? parseFloat(ctx.oraclePx) : midPx;
      const prevDayPx = ctx ? parseFloat(ctx.prevDayPx) : 0;
      const change24h = prevDayPx > 0 ? ((oraclePx - prevDayPx) / prevDayPx) * 100 : 0;
      const stepSize = 1 / Math.pow(10, meta.szDecimals);

      prices.push({
        symbol: normalizeSymbol(meta.name),
        price: midPx,
        oracle: oraclePx,
        change24h,
        high24h: oraclePx * 1.02, // HL doesn't provide 24h high/low via WS
        low24h: oraclePx * 0.98,
        volume24h: ctx ? parseFloat(ctx.dayNtlVlm) : 0,
        openInterest: ctx ? parseFloat(ctx.openInterest) * oraclePx : 0,
        funding: ctx ? parseFloat(ctx.funding) * 100 : 0,
        nextFunding: ctx ? parseFloat(ctx.funding) * 100 : 0, // HL uses same rate for current/next
        lastUpdate: Date.now(),
        maxLeverage: meta.maxLeverage,
        tickSize: 0.1,
        lotSize: stepSize,
      });

      markets.push({
        symbol: normalizeSymbol(meta.name),
        name: meta.name,
        maxLeverage: meta.maxLeverage,
      });
    }

    this.callbacks.onPrices?.(prices, markets);
  }

  /**
   * Fetch positions via REST and emit.
   * Hyperliquid WS doesn't push position snapshots directly —
   * we re-fetch on fill/notification events.
   */
  private async fetchAndEmitPositions(): Promise<void> {
    if (!this.accountId) return;

    try {
      const resp = await fetch(`${HL_API_URL}/info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'clearinghouseState', user: this.accountId }),
        signal: AbortSignal.timeout(5000),
      });
      if (!resp.ok) return; // Rate limited or error — skip silently, will retry on next event

      const state = await resp.json() as {
        assetPositions: Array<{ position: HlWsPosition }>;
      };

      const positions = state.assetPositions
        .filter((ap) => parseFloat(ap.position.szi) !== 0)
        .map((ap) => normalizePosition(ap.position));

      this.callbacks.onPositions?.(positions);
    } catch (err) {
      console.error('[HLWsAdapter] Failed to fetch positions:', err);
    }
  }

  /**
   * Fetch open orders via REST (frontendOpenOrders) and emit.
   * Unlike the WS openOrders channel, this includes trigger orders (TP/SL)
   * with full metadata: isTrigger, triggerCondition, triggerPx, orderType, etc.
   */
  private async fetchAndEmitOrders(): Promise<void> {
    if (!this.accountId) return;

    try {
      const resp = await fetch(`${HL_API_URL}/info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'frontendOpenOrders', user: this.accountId }),
        signal: AbortSignal.timeout(5000),
      });
      if (!resp.ok) return; // Rate limited or error — skip silently, will retry on next event

      const orders = await resp.json() as HlWsOrder[];
      const normalized = orders.map(normalizeOrder);
      this.callbacks.onOrders?.(normalized);
    } catch (err) {
      console.error('[HLWsAdapter] Failed to fetch orders:', err);
    }
  }

  private sendPriceSubscription(): void {
    this.ws?.send(JSON.stringify({
      method: 'subscribe',
      subscription: { type: 'allMids' },
    }));
  }

  private sendAccountSubscription(accountId: string): void {
    this.subscribedAccount = true;
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    // Subscribe to user events (fills + order updates)
    ws.send(JSON.stringify({
      method: 'subscribe',
      subscription: { type: 'userEvents', user: accountId },
    }));

    ws.send(JSON.stringify({
      method: 'subscribe',
      subscription: { type: 'userFills', user: accountId },
    }));

    // Stagger initial REST fetches to avoid rate limiting
    setTimeout(() => this.fetchAndEmitPositions(), 500);
    setTimeout(() => this.fetchAndEmitOrders(), 1000);
  }

  /**
   * Fetch the latest candle via REST (HL doesn't support WS candle subscriptions).
   */
  private async fetchCandle(coin: string, interval: string, symbol: string): Promise<void> {
    try {
      // HL interval format: '1m', '5m', '15m', '1h', '4h', '1d'
      const now = Date.now();
      const resp = await fetch(`${HL_API_URL}/info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'candleSnapshot',
          req: { coin, interval, startTime: now - 120000, endTime: now },
        }),
        signal: AbortSignal.timeout(5000),
      });
      if (!resp.ok) return; // Rate limited — skip this poll cycle

      const candles = await resp.json() as Array<{
        t: number; T: number; s: string; i: string;
        o: string; c: string; h: string; l: string; v: string; n: number;
      }>;

      if (candles && candles.length > 0) {
        // Emit the latest candle
        const latest = candles[candles.length - 1];
        if (latest) {
          this.callbacks.onCandle?.({
            symbol,
            interval,
            time: Math.floor(latest.t / 1000),
            open: parseFloat(latest.o),
            high: parseFloat(latest.h),
            low: parseFloat(latest.l),
            close: parseFloat(latest.c),
            volume: parseFloat(latest.v),
          });
        }
      }
    } catch {
      // Silently ignore candle fetch errors
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
    // Clear candle pollers
    this.candlePollers.forEach(poller => clearInterval(poller));
    this.candlePollers.clear();
  }
}
