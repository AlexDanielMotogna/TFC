/**
 * Exchange WebSocket Adapter Types
 *
 * Normalizes real-time WebSocket data across exchanges.
 * Each exchange has its own WS format — adapters normalize to these types.
 */

import type { ExchangeType } from '@tfc/shared';

// ─────────────────────────────────────────────────────────────
// Normalized WebSocket data types (exchange-agnostic)
// ─────────────────────────────────────────────────────────────

export interface WsPosition {
  symbol: string; // "BTC-USD" (normalized)
  side: 'bid' | 'ask'; // Pacifica format (kept for backward compat)
  amount: string;
  entry_price: string;
  margin: string;
  funding: string;
  isolated: boolean;
  liq_price: string | null;
  updated_at: number;
  // Optional fields provided by Hyperliquid (not available on Pacifica)
  leverage?: number;
  leverage_type?: string; // 'cross' | 'isolated'
  unrealized_pnl?: string;
  return_on_equity?: string;
  position_value?: string;
}

export interface WsOrder {
  order_id: number;
  client_order_id: string | null;
  symbol: string; // "BTC-USD" (normalized)
  side: 'bid' | 'ask';
  price: string;
  initial_amount: string;
  filled_amount: string;
  cancelled_amount: string;
  order_type: string;
  stop_price: string | null;
  stop_type: string | null;
  reduce_only: boolean;
  created_at: number;
}

export interface WsTrade {
  history_id: number;
  order_id: number;
  client_order_id: string | null;
  symbol: string; // "BTC-USD" (normalized)
  price: string;
  entry_price: string;
  amount: string;
  side: string; // e.g., 'close_long', 'open_short'
  fee: string;
  pnl: string;
  created_at: number;
}

export interface WsPrice {
  symbol: string; // "BTC-USD" (normalized)
  price: number; // mark price
  oracle: number;
  indexPrice?: number; // index/spot reference price (not all exchanges provide this)
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  openInterest: number;
  funding: number; // percentage
  nextFunding: number; // percentage
  lastUpdate: number;
  maxLeverage: number;
  tickSize: number;
  lotSize: number;
}

export interface WsMarket {
  symbol: string; // "BTC-USD"
  name: string; // "Bitcoin"
  maxLeverage: number;
}

export interface WsOrderbookLevel {
  price: number;
  size: number;
  orders: number;
}

export interface WsOrderbookSnapshot {
  symbol: string; // "BTC-USD" (normalized)
  bids: WsOrderbookLevel[];
  asks: WsOrderbookLevel[];
  timestamp: number;
}

export interface WsCandle {
  symbol: string; // "BTC-USD" (normalized)
  interval: string;
  time: number; // Unix seconds (for lightweight-charts)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ─────────────────────────────────────────────────────────────
// WebSocket Adapter Interface
// ─────────────────────────────────────────────────────────────

export interface WsAccountLeverage {
  symbol: string; // "BTC-USD" (normalized)
  leverage: number;
  timestamp: number;
}

export interface ExchangeWsCallbacks {
  onPositions?: (positions: WsPosition[]) => void;
  onOrders?: (orders: WsOrder[]) => void;
  onTrades?: (trades: WsTrade[]) => void;
  onPrices?: (prices: WsPrice[], markets: WsMarket[]) => void;
  onOrderbook?: (data: WsOrderbookSnapshot) => void;
  onCandle?: (data: WsCandle) => void;
  onAccountLeverage?: (leverage: WsAccountLeverage) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: string) => void;
}

export interface ExchangeWsAdapter {
  readonly exchangeType: ExchangeType;

  /** Connect to the exchange WebSocket and register callbacks (merged with existing) */
  connect(callbacks: ExchangeWsCallbacks): void;

  /** Remove a specific set of callbacks without killing the connection */
  removeCallbacks(callbacks: ExchangeWsCallbacks): void;

  /** Fully disconnect from the exchange WebSocket */
  disconnect(): void;

  /** Whether the WebSocket is currently connected */
  isConnected(): boolean;

  /** Subscribe to account-specific data (positions, orders, trades) */
  subscribeAccount(accountId: string): void;

  /** Unsubscribe from account-specific data */
  unsubscribeAccount(): void;

  /** Subscribe to price feed (public, no auth needed) */
  subscribePrices(): void;

  /** Subscribe to orderbook for a symbol */
  subscribeOrderbook(symbol: string, aggLevel?: number): void;

  /** Unsubscribe from orderbook */
  unsubscribeOrderbook(symbol: string): void;

  /** Subscribe to candle/kline updates for a symbol + interval */
  subscribeCandles(symbol: string, interval: string): void;

  /** Unsubscribe from candle updates */
  unsubscribeCandles(symbol: string, interval: string): void;

  /** Force refresh subscriptions */
  refresh(): void;
}
