/**
 * Exchange Order Router Interface
 *
 * Routes trading operations (orders, cancels, leverage, TP/SL, etc.)
 * to the correct exchange backend.
 *
 * - Pacifica: proxy client-signed requests (backend is pass-through)
 * - Hyperliquid: sign with agent wallet on backend, then submit
 * - Lighter: sign with API key on backend, then submit
 */

import type { ExchangeType } from '@tfc/shared';

// ─────────────────────────────────────────────────────────────
// Common types for order routing
// ─────────────────────────────────────────────────────────────

export interface OrderResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

/**
 * Base params present on all trading operations.
 * For client-signed exchanges (Pacifica), includes signature + timestamp.
 * For server-signed exchanges (HL, Lighter), signature/timestamp are absent.
 */
export interface BaseOrderParams {
  account: string;
  signature?: string;
  timestamp?: number;
  /** Extra exchange-specific params forwarded from the frontend signer */
  [key: string]: unknown;
}

export interface CreateOrderParams extends BaseOrderParams {
  symbol: string;
  side: string;
  type: 'MARKET' | 'LIMIT';
  amount: string;
  price?: string;
  slippage_percent?: string;
  reduce_only?: boolean;
  post_only?: boolean;
  tif?: string;
  builder_code?: string;
  take_profit?: { stop_price: string; limit_price?: string } | null;
  stop_loss?: { stop_price: string; limit_price?: string } | null;
}

export interface CancelOrderParams extends BaseOrderParams {
  order_id: string;
  symbol: string;
}

export interface CancelAllOrdersParams extends BaseOrderParams {
  symbol?: string;
}

export interface StopOrderParams extends BaseOrderParams {
  symbol: string;
  side: string;
  reduce_only: boolean;
  stop_order: {
    stop_price: string;
    amount: string;
    limit_price?: string;
  };
}

export interface CancelStopOrderParams extends BaseOrderParams {
  symbol: string;
  order_id: string;
}

export interface EditOrderParams extends BaseOrderParams {
  symbol: string;
  price: string;
  amount: string;
  order_id?: string;
  client_order_id?: string;
}

export interface BatchOrderParams extends BaseOrderParams {
  actions: Array<{
    type: string;
    data: Record<string, unknown>;
  }>;
}

export interface SetTpSlParams extends BaseOrderParams {
  symbol: string;
  side: string;
  take_profit?: { stop_price: string; limit_price?: string } | null;
  stop_loss?: { stop_price: string; limit_price?: string } | null;
  size?: string;
  builder_code?: string;
}

export interface SetLeverageParams extends BaseOrderParams {
  symbol: string;
  leverage: number;
}

export interface SetMarginParams extends BaseOrderParams {
  symbol: string;
  is_isolated: boolean;
}

export interface WithdrawParams extends BaseOrderParams {
  amount: string;
}

// ─────────────────────────────────────────────────────────────
// Exchange Order Router Interface
// ─────────────────────────────────────────────────────────────

export interface ExchangeOrderRouter {
  readonly exchangeType: ExchangeType;

  /**
   * Whether this exchange signs orders on the server side.
   * - false: Pacifica (client signs, backend proxies)
   * - true: Hyperliquid, Lighter (backend signs with stored keys)
   */
  readonly signsServerSide: boolean;

  createOrder(params: CreateOrderParams): Promise<OrderResult>;
  cancelOrder(params: CancelOrderParams): Promise<OrderResult>;
  cancelAllOrders(params: CancelAllOrdersParams): Promise<OrderResult>;
  createStopOrder(params: StopOrderParams): Promise<OrderResult>;
  cancelStopOrder(params: CancelStopOrderParams): Promise<OrderResult>;
  editOrder(params: EditOrderParams): Promise<OrderResult>;
  batchOrders(params: BatchOrderParams): Promise<OrderResult>;
  setTpSl(params: SetTpSlParams): Promise<OrderResult>;
  setLeverage(params: SetLeverageParams): Promise<OrderResult>;
  setMargin(params: SetMarginParams): Promise<OrderResult>;
  withdraw(params: WithdrawParams): Promise<OrderResult>;
}

// ─────────────────────────────────────────────────────────────
// Router Factory
// ─────────────────────────────────────────────────────────────

import { PacificaOrderRouter } from './pacifica-order-router';
import { HyperliquidOrderRouter } from './hyperliquid-order-router';
import { LighterOrderRouter } from './lighter-order-router';

const routerInstances: Partial<Record<ExchangeType, ExchangeOrderRouter>> = {};

/**
 * Get the order router for the given exchange type.
 * Routers are singletons (stateless — safe to reuse).
 */
export function getOrderRouter(exchangeType: ExchangeType = 'pacifica'): ExchangeOrderRouter {
  if (!routerInstances[exchangeType]) {
    switch (exchangeType) {
      case 'pacifica':
        routerInstances[exchangeType] = new PacificaOrderRouter();
        break;
      case 'hyperliquid':
        routerInstances[exchangeType] = new HyperliquidOrderRouter();
        break;
      case 'lighter':
        routerInstances[exchangeType] = new LighterOrderRouter();
        break;
      default:
        throw new Error(`Unknown exchange type: ${exchangeType}`);
    }
  }
  return routerInstances[exchangeType]!;
}
