/**
 * Lighter Order Router (Stub)
 *
 * Server-side signing: backend signs with stored API private key (Ed25519).
 * Frontend sends order params only — no client signature needed.
 *
 * TODO (Phase 9):
 * - Load API private key from ExchangeConnection (encrypted)
 * - Sign with Ed25519 via Go binary or zklighter-sdk
 * - Use OptimisticNonceManager for nonce tracking
 * - Post to mainnet.zklighter.elliot.ai/api/v1/sendTx
 * - No builder code needed — Lighter has zero trading fees
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

const NOT_IMPLEMENTED = 'Lighter order routing not yet implemented (Phase 9)';

export class LighterOrderRouter implements ExchangeOrderRouter {
  readonly exchangeType = 'lighter' as const;
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
