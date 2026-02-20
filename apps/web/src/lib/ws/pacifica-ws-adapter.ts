/**
 * Pacifica WebSocket Adapter
 *
 * Wraps Pacifica's WebSocket API into the ExchangeWsAdapter interface.
 * Handles both price streams (public) and account streams (positions, orders, trades).
 *
 * Pacifica WS format uses compact field names:
 * - Positions: s(symbol), d(side), a(amount), p(price), m(margin), etc.
 * - Orders: i(id), s(symbol), d(side), p(price), a(amount), etc.
 * - Trades: h(history_id), i(order_id), s(symbol), p(price), etc.
 */

import type {
  ExchangeWsAdapter,
  ExchangeWsCallbacks,
  WsPosition,
  WsOrder,
  WsTrade,
  WsPrice,
  WsMarket,
} from './types';

const PACIFICA_WS_URL = process.env.NEXT_PUBLIC_PACIFICA_WS_URL || 'wss://ws.pacifica.fi/ws';
const PACIFICA_API_BASE = 'https://api.pacifica.fi';
const PING_INTERVAL = 30000;
const RECONNECT_DELAY = 3000;

// ─────────────────────────────────────────────────────────────
// Pacifica raw WS message types
// ─────────────────────────────────────────────────────────────

interface PacificaPositionWs {
  s: string; d: string; a: string; p: string; m: string;
  f: string; i: boolean; l: string | null; t: number; li: number;
}

interface PacificaOrderWs {
  i: number; I: string | null; s: string; d: string; p: string;
  a: string; f: string; c: string; t: number; st: string | null;
  ot: string; sp: string | null; ro: boolean; li: number;
}

interface PacificaTradeWs {
  h: number; i: number; I: string | null; u: string; s: string;
  p: string; o: string; a: string; te: string; ts: string;
  tc: string; f: string; n: string; t: number; li: number;
}

interface PacificaWsPriceData {
  symbol: string;
  mark: string;
  oracle: string;
  mid: string;
  funding: string;
  next_funding: string;
  open_interest: string;
  volume_24h: string;
  yesterday_price: string;
  timestamp: number;
}

interface PacificaMarketInfo {
  symbol: string;
  max_leverage: number;
  tick_size: string;
  lot_size: string;
}

// ─────────────────────────────────────────────────────────────
// Symbol mapping
// ─────────────────────────────────────────────────────────────

const pacificaToSymbol = (pacificaSymbol: string): string => {
  if (pacificaSymbol === '1000PEPE') return 'KPEPE-USD';
  if (pacificaSymbol === '1000BONK') return 'KBONK-USD';
  return `${pacificaSymbol}-USD`;
};

const symbolNames: Record<string, string> = {
  BTC: 'Bitcoin', ETH: 'Ethereum', SOL: 'Solana', BNB: 'BNB',
  HYPE: 'Hyperliquid', XMR: 'Monero', ZEC: 'Zcash', XRP: 'XRP',
  ENA: 'Ethena', SUI: 'Sui', PUMP: 'Pump', LTC: 'Litecoin',
  PAXG: 'PAX Gold', '1000PEPE': 'kPEPE', KPEPE: 'kPEPE',
  LIT: 'Litentry', FARTCOIN: 'Fartcoin', XAG: 'Silver',
  DOGE: 'Dogecoin', NVDA: 'Nvidia', AAVE: 'Aave', BCH: 'Bitcoin Cash',
  WLFI: 'WorldLibertyFi', JUP: 'Jupiter', XPL: 'XPL', TAO: 'Bittensor',
  ADA: 'Cardano', CL: 'Crude Oil', UNI: 'Uniswap', AVAX: 'Avalanche',
  ARB: 'Arbitrum', WIF: 'dogwifhat', VIRTUAL: 'Virtual',
  ICP: 'Internet Computer', LINK: 'Chainlink', '1000BONK': 'kBONK',
  KBONK: 'kBONK', ASTER: 'Aster', TRUMP: 'Trump', LDO: 'Lido DAO',
  PENGU: 'Pudgy Penguins', NEAR: 'NEAR Protocol', ZK: 'zkSync',
  WLD: 'Worldcoin', PIPPIN: 'Pippin', ZZ: 'ZZ', STRK: 'Starknet',
  CRV: 'Curve', MON: 'Mon Protocol',
};

// ─────────────────────────────────────────────────────────────
// Normalization functions
// ─────────────────────────────────────────────────────────────

function normalizePosition(p: PacificaPositionWs): WsPosition {
  return {
    symbol: pacificaToSymbol(p.s),
    side: p.d as 'bid' | 'ask',
    amount: p.a,
    entry_price: p.p,
    margin: p.m,
    funding: p.f,
    isolated: p.i,
    liq_price: p.l,
    updated_at: p.t,
  };
}

function normalizeOrder(o: PacificaOrderWs): WsOrder {
  return {
    order_id: o.i,
    client_order_id: o.I,
    symbol: pacificaToSymbol(o.s),
    side: o.d as 'bid' | 'ask',
    price: o.p,
    initial_amount: o.a,
    filled_amount: o.f,
    cancelled_amount: o.c,
    order_type: o.ot,
    stop_price: o.sp,
    stop_type: o.st,
    reduce_only: o.ro,
    created_at: o.t,
  };
}

function normalizeTrade(t: PacificaTradeWs): WsTrade {
  return {
    history_id: t.h,
    order_id: t.i,
    client_order_id: t.I,
    symbol: pacificaToSymbol(t.s),
    price: t.p,
    entry_price: t.o,
    amount: t.a,
    side: t.ts,
    fee: t.f,
    pnl: t.n,
    created_at: t.t,
  };
}

// ─────────────────────────────────────────────────────────────
// Market info cache
// ─────────────────────────────────────────────────────────────

let marketInfoCache: Record<string, PacificaMarketInfo> = {};
let marketInfoLoaded = false;

async function fetchMarketInfo(): Promise<void> {
  if (marketInfoLoaded) return;
  try {
    const response = await fetch(`${PACIFICA_API_BASE}/api/v1/info`, {
      signal: AbortSignal.timeout(10000),
    });
    const result = await response.json();
    if (result.success && result.data) {
      result.data.forEach((m: PacificaMarketInfo) => {
        marketInfoCache[m.symbol] = m;
      });
      marketInfoLoaded = true;
    }
  } catch (err) {
    console.error('[PacificaWsAdapter] Failed to fetch market info:', err);
  }
}

// ─────────────────────────────────────────────────────────────
// Adapter implementation
// ─────────────────────────────────────────────────────────────

export class PacificaWsAdapter implements ExchangeWsAdapter {
  readonly exchangeType = 'pacifica' as const;

  private ws: WebSocket | null = null;
  private callbacks: ExchangeWsCallbacks = {};
  private accountId: string | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private connected = false;
  private subscribedPrices = false;
  private subscribedAccount = false;

  connect(callbacks: ExchangeWsCallbacks): void {
    this.callbacks = callbacks;
    this.doConnect();
    // Fetch market info in parallel
    fetchMarketInfo();
  }

  disconnect(): void {
    this.clearTimers();
    if (this.ws) {
      this.ws.close(1000);
      this.ws = null;
    }
    this.connected = false;
    this.subscribedPrices = false;
    this.subscribedAccount = false;
    this.callbacks.onDisconnected?.();
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
    this.accountId = null;
    this.subscribedAccount = false;
  }

  subscribePrices(): void {
    this.subscribedPrices = true;
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendPriceSubscription();
    }
  }

  refresh(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      if (this.subscribedPrices) this.sendPriceSubscription();
      if (this.accountId) this.sendAccountSubscriptions(this.accountId);
    }
  }

  // ─── Private methods ────────────────────────────────────────

  private doConnect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.clearTimers();
    if (this.ws && this.ws.readyState !== WebSocket.CLOSED) {
      this.ws.close();
    }

    try {
      console.log('[PacificaWsAdapter] Connecting to', PACIFICA_WS_URL);
      const ws = new WebSocket(PACIFICA_WS_URL);
      this.ws = ws;

      ws.onopen = () => {
        console.log('[PacificaWsAdapter] Connected');
        this.connected = true;
        this.callbacks.onConnected?.();

        // Re-subscribe to previously active subscriptions
        if (this.subscribedPrices) this.sendPriceSubscription();
        if (this.accountId) this.sendAccountSubscriptions(this.accountId);

        // Start ping interval
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
          console.error('[PacificaWsAdapter] Parse error:', err);
        }
      };

      ws.onerror = () => {
        this.callbacks.onError?.('WebSocket connection error');
      };

      ws.onclose = (event) => {
        console.log('[PacificaWsAdapter] Disconnected:', event.code);
        this.connected = false;
        this.ws = null;
        this.clearTimers();
        this.callbacks.onDisconnected?.();

        // Reconnect unless intentional close
        if (event.code !== 1000) {
          this.reconnectTimeout = setTimeout(() => this.doConnect(), RECONNECT_DELAY);
        }
      };
    } catch (err) {
      console.error('[PacificaWsAdapter] Connection error:', err);
      this.callbacks.onError?.('Failed to connect to Pacifica WebSocket');
    }
  }

  private handleMessage(msg: { channel: string; data: unknown }): void {
    if (msg.channel === 'pong') return;

    if (msg.channel === 'prices' && msg.data) {
      const raw = msg.data as PacificaWsPriceData[];
      const prices: WsPrice[] = [];
      const markets: WsMarket[] = [];

      raw.forEach((p) => {
        const symbol = pacificaToSymbol(p.symbol);
        const markPrice = parseFloat(p.mark);
        const oraclePrice = parseFloat(p.oracle);
        const yesterdayPrice = parseFloat(p.yesterday_price);
        const change24h = yesterdayPrice > 0
          ? ((oraclePrice - yesterdayPrice) / yesterdayPrice) * 100
          : 0;
        const info = marketInfoCache[p.symbol];

        prices.push({
          symbol,
          price: markPrice,
          oracle: oraclePrice,
          change24h,
          high24h: oraclePrice * 1.02,
          low24h: oraclePrice * 0.98,
          volume24h: parseFloat(p.volume_24h),
          openInterest: parseFloat(p.open_interest) * oraclePrice,
          funding: parseFloat(p.funding) * 100,
          nextFunding: parseFloat(p.next_funding) * 100,
          lastUpdate: p.timestamp,
          maxLeverage: info?.max_leverage || 10,
          tickSize: info?.tick_size ? parseFloat(info.tick_size) : 0.01,
          lotSize: info?.lot_size ? parseFloat(info.lot_size) : 0.00001,
        });

        markets.push({
          symbol,
          name: symbolNames[p.symbol] || p.symbol,
          maxLeverage: info?.max_leverage || 10,
        });
      });

      this.callbacks.onPrices?.(prices, markets);
    }

    if (msg.channel === 'account_positions') {
      const raw = (msg.data || []) as PacificaPositionWs[];
      this.callbacks.onPositions?.(raw.map(normalizePosition));
    }

    if (msg.channel === 'account_orders') {
      const raw = (msg.data || []) as PacificaOrderWs[];
      // Filter out fully filled/cancelled orders (keep TP/SL orders)
      const filtered = raw.filter(o => {
        const isTpSlOrder = o.ot && (
          o.ot.includes('take_profit') || o.ot.includes('stop_loss')
        );
        if (isTpSlOrder) return true;
        const remaining = parseFloat(o.a) - parseFloat(o.f) - parseFloat(o.c);
        return remaining > 0;
      });
      this.callbacks.onOrders?.(filtered.map(normalizeOrder));
    }

    if (msg.channel === 'account_trades') {
      const raw = (msg.data || []) as PacificaTradeWs[];
      this.callbacks.onTrades?.(raw.map(normalizeTrade));
    }

    if (msg.channel === 'error') {
      const errorData = msg.data as { message?: string } | undefined;
      this.callbacks.onError?.(errorData?.message || 'WebSocket error');
    }
  }

  private sendPriceSubscription(): void {
    this.ws?.send(JSON.stringify({
      method: 'subscribe',
      params: { source: 'prices' },
    }));
  }

  private sendAccountSubscriptions(account: string): void {
    this.subscribedAccount = true;
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    ws.send(JSON.stringify({
      method: 'subscribe',
      params: { source: 'account_positions', account },
    }));
    ws.send(JSON.stringify({
      method: 'subscribe',
      params: { source: 'account_orders', account },
    }));
    ws.send(JSON.stringify({
      method: 'subscribe',
      params: { source: 'account_trades', account },
    }));
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
  }
}
