/**
 * Hyperliquid Order Router (Stub)
 *
 * Server-side signing: backend signs with stored agent wallet private key (ECDSA / EIP-712).
 * Frontend sends order params only — no client signature needed.
 *
 * TODO (Phase 8):
 * - Load agent wallet private key from ExchangeConnection (encrypted)
 * - Sign actions with EIP-712 phantom agent construction
 * - Include builder code: {"b": "0xOurAddress", "f": 50}
 * - Post to api.hyperliquid.xyz/exchange
 * - Nonce: current timestamp in milliseconds
 */

import type {
  ExchangeOrderRouter,
  OrderResult,
  CreateOrderParams,
  CancelOrderParams,
  CancelAllOrdersParams,
  StopOrderParams,
  CancelStopOrderParams,
  EditOrderParams,
  BatchOrderParams,
  SetTpSlParams,
  SetLeverageParams,
  SetMarginParams,
  WithdrawParams,
} from './order-router';

const NOT_IMPLEMENTED = 'Hyperliquid order routing not yet implemented (Phase 8)';

export class HyperliquidOrderRouter implements ExchangeOrderRouter {
  readonly exchangeType = 'hyperliquid' as const;
  readonly signsServerSide = true;

  async createOrder(_params: CreateOrderParams): Promise<OrderResult> {
    return { success: false, error: NOT_IMPLEMENTED };
  }

  async cancelOrder(_params: CancelOrderParams): Promise<OrderResult> {
    return { success: false, error: NOT_IMPLEMENTED };
  }

  async cancelAllOrders(_params: CancelAllOrdersParams): Promise<OrderResult> {
    return { success: false, error: NOT_IMPLEMENTED };
  }

  async createStopOrder(_params: StopOrderParams): Promise<OrderResult> {
    return { success: false, error: NOT_IMPLEMENTED };
  }

  async cancelStopOrder(_params: CancelStopOrderParams): Promise<OrderResult> {
    return { success: false, error: NOT_IMPLEMENTED };
  }

  async editOrder(_params: EditOrderParams): Promise<OrderResult> {
    return { success: false, error: NOT_IMPLEMENTED };
  }

  async batchOrders(_params: BatchOrderParams): Promise<OrderResult> {
    return { success: false, error: NOT_IMPLEMENTED };
  }

  async setTpSl(_params: SetTpSlParams): Promise<OrderResult> {
    return { success: false, error: NOT_IMPLEMENTED };
  }

  async setLeverage(_params: SetLeverageParams): Promise<OrderResult> {
    return { success: false, error: NOT_IMPLEMENTED };
  }

  async setMargin(_params: SetMarginParams): Promise<OrderResult> {
    return { success: false, error: NOT_IMPLEMENTED };
  }

  async withdraw(_params: WithdrawParams): Promise<OrderResult> {
    return { success: false, error: NOT_IMPLEMENTED };
  }
}
