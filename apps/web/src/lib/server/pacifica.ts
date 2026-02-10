/**
 * Pacifica API client service
 * Ported from NestJS to standalone functions for Next.js API routes
 */
import * as nacl from 'tweetnacl';
import * as PacificaSigning from './pacifica-signing';
import { RateLimitError, ApiError } from './errors';

interface PacificaResponse<T> {
  success: boolean;
  data: T;
  error: string | null;
  code: number | null;
}

const API_URL = process.env.PACIFICA_API_URL || 'https://api.pacifica.fi';
const BUILDER_CODE = process.env.PACIFICA_BUILDER_CODE || 'TradeClub';
const API_KEY = process.env.PACIFICA_API_KEY;

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  if (API_KEY) {
    headers['PF-API-KEY'] = API_KEY;
  }

  return headers;
}

async function request<T>(
  method: 'GET' | 'POST',
  endpoint: string,
  body?: Record<string, unknown>
): Promise<T> {
  const url = `${API_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      method,
      headers: getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });

    if (response.status === 429) {
      console.warn('Pacifica API rate limited:', endpoint);
      throw new RateLimitError('Pacifica API rate limited');
    }

    const data = (await response.json()) as PacificaResponse<T>;

    if (!response.ok || !data.success) {
      throw new ApiError(
        data.error || 'Pacifica API error',
        response.status || 400
      );
    }

    return data.data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    console.error('Pacifica API request failed:', error, { endpoint, method });
    throw new ApiError('Pacifica API unavailable', 503);
  }
}

// ─────────────────────────────────────────────────────────────
// Public Market Data (no auth required)
// ─────────────────────────────────────────────────────────────

/**
 * Get all market info
 * GET /api/v1/info
 */
export async function getMarkets(): Promise<MarketInfo[]> {
  return request<MarketInfo[]>('GET', '/api/v1/info');
}

/**
 * Get all market prices
 * GET /api/v1/info/prices
 */
export async function getPrices(): Promise<MarketPrice[]> {
  return request<MarketPrice[]>('GET', '/api/v1/info/prices');
}

/**
 * Get orderbook for a symbol
 * GET /api/v1/book?symbol=...
 */
export async function getOrderbook(symbol: string, aggLevel = 1): Promise<OrderbookResponse> {
  return request<OrderbookResponse>('GET', `/api/v1/book?symbol=${symbol}&agg_level=${aggLevel}`);
}

/**
 * Get historical candles
 * GET /api/v1/kline
 */
export async function getKlines(params: {
  symbol: string;
  interval: string;
  startTime: number;
  endTime?: number;
}): Promise<Candle[]> {
  let url = `/api/v1/kline?symbol=${params.symbol}&interval=${params.interval}&start_time=${params.startTime}`;

  if (params.endTime) {
    url += `&end_time=${params.endTime}`;
  }

  return request<Candle[]>('GET', url);
}

/**
 * Get recent trades for a symbol
 * GET /api/v1/trades?symbol=...
 */
export async function getRecentTrades(symbol: string): Promise<RecentTrade[]> {
  return request<RecentTrade[]>('GET', `/api/v1/trades?symbol=${symbol}`);
}

// ─────────────────────────────────────────────────────────────
// Account Data (requires account address)
// ─────────────────────────────────────────────────────────────

/**
 * Get account info
 * GET /api/v1/account?account=...
 * Returns a single AccountInfo object (not an array)
 */
export async function getAccount(accountAddress: string): Promise<AccountInfo> {
  return request<AccountInfo>('GET', `/api/v1/account?account=${accountAddress}`);
}

/**
 * Get positions for an account
 * GET /api/v1/positions?account=...
 */
export async function getPositions(accountAddress: string): Promise<Position[]> {
  return request<Position[]>('GET', `/api/v1/positions?account=${accountAddress}`);
}

/**
 * Get open orders for an account
 * GET /api/v1/orders?account=...
 */
export async function getOpenOrders(accountAddress: string): Promise<OpenOrder[]> {
  return request<OpenOrder[]>('GET', `/api/v1/orders?account=${accountAddress}`);
}

/**
 * Get trade history (fills) for an account
 * GET /api/v1/trades/history?account=...
 */
export async function getTradeHistory(params: {
  accountAddress: string;
  symbol?: string;
  startTime?: number;
  endTime?: number;
  limit?: number;
}): Promise<TradeHistoryResponse[]> {
  let url = `/api/v1/trades/history?account=${params.accountAddress}`;

  if (params.symbol) url += `&symbol=${params.symbol}`;
  if (params.startTime) url += `&start_time=${params.startTime}`;
  if (params.endTime) url += `&end_time=${params.endTime}`;
  if (params.limit) url += `&limit=${params.limit}`;

  return request<TradeHistoryResponse[]>('GET', url);
}

/**
 * Get account settings (leverage per symbol)
 * GET /api/v1/account/settings?account=...
 */
export async function getAccountSettings(accountAddress: string): Promise<AccountSetting[]> {
  return request<AccountSetting[]>('GET', `/api/v1/account/settings?account=${accountAddress}`);
}

// ─────────────────────────────────────────────────────────────
// Trading (requires signing)
// ─────────────────────────────────────────────────────────────

/**
 * Create a market order
 * POST /api/v1/orders/create_market
 */
export async function createMarketOrder(
  keypair: nacl.SignKeyPair,
  params: {
    symbol: string;
    amount: string;
    side: 'bid' | 'ask';
    slippagePercent: string;
    reduceOnly: boolean;
    clientOrderId?: string;
  }
): Promise<{ order_id: number }> {
  const signedPayload = PacificaSigning.signMarketOrder(keypair, {
    ...params,
    builderCode: BUILDER_CODE,
  });

  return request<{ order_id: number }>('POST', '/api/v1/orders/create_market', signedPayload);
}

/**
 * Create a limit order
 * POST /api/v1/orders/create
 */
export async function createLimitOrder(
  keypair: nacl.SignKeyPair,
  params: {
    symbol: string;
    price: string;
    amount: string;
    side: 'bid' | 'ask';
    tif: 'GTC' | 'IOC' | 'ALO' | 'TOB';
    reduceOnly: boolean;
    clientOrderId?: string;
  }
): Promise<{ order_id: number }> {
  const signedPayload = PacificaSigning.signLimitOrder(keypair, {
    ...params,
    builderCode: BUILDER_CODE,
  });

  return request<{ order_id: number }>('POST', '/api/v1/orders/create', signedPayload);
}

/**
 * Create a stop order
 * POST /api/v1/orders/stop/create
 */
export async function createStopOrder(
  keypair: nacl.SignKeyPair,
  params: {
    symbol: string;
    side: 'bid' | 'ask';
    amount: string;
    stopPrice: string;
    limitPrice?: string;
    reduceOnly: boolean;
    clientOrderId?: string;
  }
): Promise<{ order_id: number }> {
  const signedPayload = PacificaSigning.signStopOrder(keypair, params);

  return request<{ order_id: number }>('POST', '/api/v1/orders/stop/create', signedPayload);
}

/**
 * Cancel an order
 * POST /api/v1/orders/cancel
 */
export async function cancelOrder(
  keypair: nacl.SignKeyPair,
  params: {
    symbol: string;
    orderId?: number;
    clientOrderId?: string;
  }
): Promise<{ success: boolean }> {
  const signedPayload = PacificaSigning.signCancelOrder(keypair, params);

  return request<{ success: boolean }>('POST', '/api/v1/orders/cancel', signedPayload);
}

/**
 * Cancel all orders
 * POST /api/v1/orders/cancel_all
 */
export async function cancelAllOrders(
  keypair: nacl.SignKeyPair,
  params: {
    allSymbols: boolean;
    excludeReduceOnly: boolean;
    symbol?: string;
  }
): Promise<{ cancelled_count: number }> {
  const signedPayload = PacificaSigning.signCancelAllOrders(keypair, params);

  return request<{ cancelled_count: number }>('POST', '/api/v1/orders/cancel_all', signedPayload);
}

/**
 * Update leverage for a symbol
 * POST /api/v1/account/leverage
 */
export async function updateLeverage(
  keypair: nacl.SignKeyPair,
  params: {
    symbol: string;
    leverage: number;
  }
): Promise<{ success: boolean }> {
  const signedPayload = PacificaSigning.signUpdateLeverage(keypair, params);

  return request<{ success: boolean }>('POST', '/api/v1/account/leverage', signedPayload);
}

/**
 * Approve builder code
 * POST /api/v1/account/builder_codes/approve
 */
export async function approveBuilderCode(
  keypair: nacl.SignKeyPair,
  maxFeeRate = '0.001'
): Promise<{ success: boolean }> {
  const signedPayload = PacificaSigning.signBuilderCodeApproval(keypair, BUILDER_CODE, maxFeeRate);

  return request<{ success: boolean }>('POST', '/api/v1/account/builder_codes/approve', signedPayload);
}

/**
 * Check builder code approvals
 * GET /api/v1/account/builder_codes/approvals?account=...
 */
export async function getBuilderCodeApprovals(accountAddress: string): Promise<BuilderCodeApproval[]> {
  return request<BuilderCodeApproval[]>(
    'GET',
    `/api/v1/account/builder_codes/approvals?account=${accountAddress}`
  );
}

/**
 * Request withdrawal from Pacifica to wallet
 * POST /api/v1/account/withdraw
 */
export async function withdraw(
  keypair: nacl.SignKeyPair,
  amount: string
): Promise<{ success: boolean; error?: string }> {
  const signedPayload = PacificaSigning.signWithdraw(keypair, amount);
  const url = `${API_URL}/api/v1/account/withdraw`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(signedPayload),
    });

    const data = await response.json() as PacificaResponse<unknown>;

    // For withdraw, success is indicated at the top level, not in data
    if (data.success) {
      return { success: true };
    }

    return { success: false, error: data.error || 'Withdraw failed' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Pacifica withdraw failed:', message);
    return { success: false, error: message };
  }
}

// ─────────────────────────────────────────────────────────────
// Response Types (exported for use in other modules)
// ─────────────────────────────────────────────────────────────

export interface MarketInfo {
  symbol: string;
  tick_size: string;
  min_tick: string;
  max_tick: string;
  lot_size: string;
  max_leverage: number;
  isolated_only: boolean;
  min_order_size: string;
  max_order_size: string;
  funding_rate: string;
  next_funding_rate: string;
  created_at: number;
}

export interface MarketPrice {
  symbol: string;
  funding: string;
  mark: string;
  mid: string;
  next_funding: string;
  open_interest: string;
  oracle: string;
  timestamp: number;
  volume_24h: string;
  yesterday_price: string;
}

export interface OrderbookResponse {
  s: string;
  l: Array<Array<{ p: string; a: string; n: number }>>;
  t: number;
}

export interface Candle {
  t: number;
  T: number;
  s: string;
  i: string;
  o: string;
  c: string;
  h: string;
  l: string;
  v: string;
  n: number;
}

export interface RecentTrade {
  event_type: string;
  price: string;
  amount: string;
  side: string;
  cause: string;
  created_at: number;
}

export interface AccountInfo {
  balance: string;
  fee_level: number;
  maker_fee: string;  // Dynamic fee from Pacifica API (e.g., "0.000575" = 0.0575%)
  taker_fee: string;  // Dynamic fee from Pacifica API (e.g., "0.0007" = 0.07%)
  account_equity: string;
  available_to_spend: string;
  available_to_withdraw: string;
  pending_balance: string;
  total_margin_used: string;
  cross_mmr: string;
  positions_count: number;
  orders_count: number;
  stop_orders_count: number;
  updated_at: number;
  use_ltp_for_stop_orders: boolean;
}

export interface Position {
  symbol: string;
  side: string;
  amount: string;
  entry_price: string;
  margin: string;
  funding: string;
  leverage: string;
  liq_price: string;
  isolated: boolean;
  created_at: number;
  updated_at: number;
}

export interface OpenOrder {
  order_id: number;
  client_order_id: string | null;
  symbol: string;
  side: string;
  price: string;
  initial_amount: string;
  filled_amount: string;
  cancelled_amount: string;
  stop_price: string | null;
  order_type: string;
  stop_parent_order_id: number | null;
  reduce_only: boolean;
  created_at: number;
  updated_at: number;
}

export interface TradeHistoryResponse {
  history_id: number;
  order_id: number;
  client_order_id: string | null;
  symbol: string;
  amount: string;
  price: string;
  entry_price: string;
  fee: string;
  pnl: string | null;
  event_type: string;
  side: string;
  created_at: number;
  cause: string;
}

export interface AccountSetting {
  symbol: string;
  isolated: boolean;
  leverage: number;
  created_at: number;
  updated_at: number;
}

export interface BuilderCodeApproval {
  builder_code: string;
  description: string;
  max_fee_rate: string;
  updated_at: number;
}
