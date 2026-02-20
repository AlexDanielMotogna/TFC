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
  symbol: string;          // "BTC-USD" (normalized)
  side: 'bid' | 'ask';    // Pacifica format (kept for backward compat)
  amount: string;
  entry_price: string;
  margin: string;
  funding: string;
  isolated: boolean;
  liq_price: string | null;
  updated_at: number;
}

export interface WsOrder {
  order_id: number;
  client_order_id: string | null;
  symbol: string;          // "BTC-USD" (normalized)
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
  symbol: string;          // "BTC-USD" (normalized)
  price: string;
  entry_price: string;
  amount: string;
  side: string;            // e.g., 'close_long', 'open_short'
  fee: string;
  pnl: string;
  created_at: number;
}

export interface WsPrice {
  symbol: string;          // "BTC-USD" (normalized)
  price: number;           // mark price
  oracle: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  openInterest: number;
  funding: number;         // percentage
  nextFunding: number;     // percentage
  lastUpdate: number;
  maxLeverage: number;
  tickSize: number;
  lotSize: number;
}

export interface WsMarket {
  symbol: string;          // "BTC-USD"
  name: string;            // "Bitcoin"
  maxLeverage: number;
}

// ─────────────────────────────────────────────────────────────
// WebSocket Adapter Interface
// ─────────────────────────────────────────────────────────────

export interface ExchangeWsCallbacks {
  onPositions?: (positions: WsPosition[]) => void;
  onOrders?: (orders: WsOrder[]) => void;
  onTrades?: (trades: WsTrade[]) => void;
  onPrices?: (prices: WsPrice[], markets: WsMarket[]) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: string) => void;
}

export interface ExchangeWsAdapter {
  readonly exchangeType: ExchangeType;

  /** Connect to the exchange WebSocket */
  connect(callbacks: ExchangeWsCallbacks): void;

  /** Disconnect from the exchange WebSocket */
  disconnect(): void;

  /** Whether the WebSocket is currently connected */
  isConnected(): boolean;

  /** Subscribe to account-specific data (positions, orders, trades) */
  subscribeAccount(accountId: string): void;

  /** Unsubscribe from account-specific data */
  unsubscribeAccount(): void;

  /** Subscribe to price feed (public, no auth needed) */
  subscribePrices(): void;

  /** Force refresh subscriptions */
  refresh(): void;
}
