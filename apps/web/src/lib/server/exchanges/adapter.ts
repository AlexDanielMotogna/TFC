/**
 * Universal Exchange Adapter Interface
 * Abstracts Pacifica, Hyperliquid, Binance, and future exchanges
 */

// ─────────────────────────────────────────────────────────────
// Authentication Context
// ─────────────────────────────────────────────────────────────

export interface AuthContext {
  accountId: string; // Pacifica: accountAddress, Hyperliquid: wallet address, Binance: API key
  credentials: ExchangeCredentials; // Exchange-specific secrets
}

export type ExchangeCredentials =
  | { type: 'pacifica'; privateKey: string } // Base58 Ed25519 private key
  | { type: 'hyperliquid'; privateKey: string } // Ethereum private key (hex)
  | { type: 'binance'; apiKey: string; apiSecret: string }; // HMAC API keys

// ─────────────────────────────────────────────────────────────
// Normalized Data Types (Exchange-Agnostic)
// ─────────────────────────────────────────────────────────────

export interface Market {
  symbol: string; // Normalized: "BTC-USD", "ETH-USD"
  baseAsset: string; // "BTC", "ETH"
  quoteAsset: string; // "USD", "USDT"
  tickSize: string; // Minimum price increment
  stepSize: string; // Minimum quantity increment
  minOrderSize: string; // Minimum order size
  maxOrderSize: string; // Maximum order size
  minNotional: string; // Minimum order value in USD
  maxLeverage: number; // Maximum allowed leverage
  fundingRate: string; // Current funding rate
  fundingInterval: number; // Funding interval in hours

  // Exchange-specific metadata
  metadata: Record<string, unknown>;
}

export interface Price {
  symbol: string; // Normalized: "BTC-USD"
  mark: string; // Mark price for PnL calculation
  index: string; // Index price (oracle)
  last: string; // Last traded price
  bid: string; // Best bid
  ask: string; // Best ask
  funding: string; // Current funding rate
  volume24h: string; // 24h volume
  change24h: string; // 24h price change %
  timestamp: number; // Epoch milliseconds
}

export interface Orderbook {
  symbol: string;
  bids: [string, string][]; // [price, size]
  asks: [string, string][]; // [price, size]
  timestamp: number;
}

export interface Candle {
  timestamp: number; // Open time (epoch ms)
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

export interface RecentTrade {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  price: string;
  amount: string;
  timestamp: number;
}

export interface Account {
  accountId: string; // Exchange account identifier
  balance: string; // Total balance (USD)
  accountEquity: string; // Equity including unrealized PnL
  availableToSpend: string; // Available for new positions
  marginUsed: string; // Margin locked in positions
  unrealizedPnl: string; // Unrealized PnL
  makerFee: string; // Maker fee rate (0.0002 = 0.02%)
  takerFee: string; // Taker fee rate

  // Exchange-specific metadata
  metadata: Record<string, unknown>;
}

export interface Position {
  symbol: string;
  side: 'LONG' | 'SHORT';
  amount: string; // Position size
  entryPrice: string; // Average entry price
  markPrice: string; // Current mark price
  margin: string; // Margin allocated
  leverage: string; // Actual leverage used
  unrealizedPnl: string; // Unrealized PnL
  liquidationPrice: string; // Liquidation price
  funding: string; // Cumulative funding paid/received

  // Exchange-specific metadata
  metadata: Record<string, unknown>;
}

export type OrderSide = 'BUY' | 'SELL';
export type OrderType = 'MARKET' | 'LIMIT' | 'STOP_MARKET' | 'STOP_LIMIT' | 'TAKE_PROFIT_MARKET' | 'TAKE_PROFIT_LIMIT';
export type TimeInForce = 'GTC' | 'IOC' | 'FOK' | 'POST_ONLY'; // Normalized across exchanges

export interface Order {
  orderId: string | number; // Exchange order ID
  clientOrderId?: string; // Client-provided order ID
  symbol: string;
  side: OrderSide;
  type: OrderType;
  price: string; // Limit price (empty for market orders)
  amount: string; // Order size
  filled: string; // Filled amount
  remaining: string; // Remaining amount
  status: 'OPEN' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELLED' | 'REJECTED';
  timeInForce: TimeInForce;
  reduceOnly: boolean; // Position close only
  createdAt: number; // Epoch milliseconds
  updatedAt: number;

  // Exchange-specific metadata
  metadata: Record<string, unknown>;
}

export interface TradeHistoryItem {
  historyId: string; // Unique fill ID (Pacifica: history_id, Binance: trade ID)
  orderId: string | number; // Order that generated this fill
  symbol: string;
  side: OrderSide;
  amount: string; // Fill size
  price: string; // Fill price
  fee: string; // Trading fee (USD)
  pnl: string | null; // Realized PnL (null for opens)
  executedAt: number; // Fill timestamp (epoch ms)

  // Exchange-specific metadata
  metadata: Record<string, unknown>;
}

export interface AccountSetting {
  symbol: string;
  leverage: number; // User-configured leverage for this symbol

  // Exchange-specific metadata
  metadata: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────
// Request Parameters
// ─────────────────────────────────────────────────────────────

export interface MarketOrderParams {
  symbol: string;
  side: OrderSide;
  amount: string;
  slippagePercent?: string; // Max slippage tolerance
  reduceOnly?: boolean; // Close position only
  clientOrderId?: string;
}

export interface LimitOrderParams {
  symbol: string;
  side: OrderSide;
  price: string;
  amount: string;
  timeInForce?: TimeInForce; // Default: GTC
  reduceOnly?: boolean;
  clientOrderId?: string;
}

export interface StopOrderParams {
  symbol: string;
  side: OrderSide;
  amount: string;
  stopPrice: string;         // Trigger price
  limitPrice?: string;       // Makes it stop-limit if provided
  reduceOnly?: boolean;
  clientOrderId?: string;
}

export interface CancelOrderParams {
  symbol: string;
  orderId?: string | number;
  clientOrderId?: string; // Alternative to orderId
}

export interface CancelAllOrdersParams {
  symbol?: string; // Cancel all for symbol, or all symbols if omitted
  excludeReduceOnly?: boolean; // Don't cancel reduce-only orders
}

export interface KlineParams {
  symbol: string;
  interval: string; // "1m", "5m", "15m", "1h", "4h", "1d"
  startTime?: number; // Epoch milliseconds
  endTime?: number; // Epoch milliseconds
  limit?: number; // Max candles to return
}

export interface TradeHistoryParams {
  accountId: string;
  symbol?: string; // Filter by symbol
  startTime?: number; // Filter by timestamp
  endTime?: number;
  limit?: number; // Max trades to return
}

// ─────────────────────────────────────────────────────────────
// Exchange Adapter Interface
// ─────────────────────────────────────────────────────────────

export interface ExchangeAdapter {
  // Metadata
  readonly name: string; // "pacifica", "hyperliquid", "binance"
  readonly version: string; // "v1", "v2", etc.

  // ─────────────────────────────────────────────────────────────
  // Public Market Data (No Authentication)
  // ─────────────────────────────────────────────────────────────

  getMarkets(): Promise<Market[]>;
  getPrices(): Promise<Price[]>;
  getOrderbook(symbol: string, aggLevel?: number): Promise<Orderbook>;
  getKlines(params: KlineParams): Promise<Candle[]>;
  getRecentTrades(symbol: string): Promise<RecentTrade[]>;

  // ─────────────────────────────────────────────────────────────
  // Account Data (Authentication Required)
  // ─────────────────────────────────────────────────────────────

  getAccount(accountId: string): Promise<Account>;
  getPositions(accountId: string): Promise<Position[]>;
  getOpenOrders(accountId: string): Promise<Order[]>;
  getTradeHistory(params: TradeHistoryParams): Promise<TradeHistoryItem[]>;
  getAccountSettings(accountId: string): Promise<AccountSetting[]>;

  // ─────────────────────────────────────────────────────────────
  // Trading Operations (Signing Required)
  // ─────────────────────────────────────────────────────────────

  createMarketOrder(auth: AuthContext, params: MarketOrderParams): Promise<{ orderId: string | number }>;
  createLimitOrder(auth: AuthContext, params: LimitOrderParams): Promise<{ orderId: string | number }>;
  createStopOrder(auth: AuthContext, params: StopOrderParams): Promise<{ orderId: string | number }>;
  cancelOrder(auth: AuthContext, params: CancelOrderParams): Promise<{ success: boolean }>;
  cancelAllOrders(auth: AuthContext, params: CancelAllOrdersParams): Promise<{ cancelledCount: number }>;
  updateLeverage(auth: AuthContext, symbol: string, leverage: number): Promise<{ success: boolean }>;

  // ─────────────────────────────────────────────────────────────
  // Optional: Exchange-Specific Features
  // ─────────────────────────────────────────────────────────────

  // Builder code (Pacifica-specific)
  approveBuilderCode?(auth: AuthContext, builderCode: string, maxFeeRate: number): Promise<{ success: boolean }>;

  // Withdraw funds (if supported)
  withdraw?(auth: AuthContext, amount: string): Promise<{ success: boolean }>;
}
