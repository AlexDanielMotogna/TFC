/**
 * Lighter Signer — Server-Side Signing (stub)
 *
 * Lighter uses an API key pattern:
 * - User generates an Ed25519 API key pair (index 2-254)
 * - User signs `ChangePubKey` once (ETH signature) to register the key
 * - After that, our backend signs all trades using the API private key (Ed25519 via Go binary)
 *
 * This signer does NOT sign on the client — it packages normalized params
 * for the backend to sign and submit.
 *
 * Symbol mapping: 'BTC-USD' → market index (uint8, handled server-side)
 * Side mapping: BUY → { is_ask: false }, SELL → { is_ask: true }
 * No builder code — Lighter has zero trading fees
 */

import type {
  ExchangeSigner,
  SignedOperation,
  MarketOrderParams,
  LimitOrderParams,
  CancelOrderParams,
  CancelAllOrdersParams,
  StopOrderParams,
  SetTpSlParams,
  SetLeverageParams,
  SetMarginModeParams,
  EditOrderParams,
  WithdrawParams,
} from './types';

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** Build a server-side operation (no client signature — backend signs) */
function buildServerOp(account: string, params: Record<string, unknown>): SignedOperation {
  return {
    exchangeType: 'lighter',
    signingLocation: 'server',
    account,
    params,
  };
}

// ─────────────────────────────────────────────────────────────
// Lighter Signer
// ─────────────────────────────────────────────────────────────

export class LighterSigner implements ExchangeSigner {
  readonly exchangeType = 'lighter' as const;
  readonly signingLocation = 'server' as const;

  /**
   * @param evmAddress - User's EVM wallet address
   */
  constructor(private evmAddress: string) {
    if (!evmAddress) {
      throw new Error('EVM wallet address required for Lighter');
    }
  }

  getAccountId(): string {
    return this.evmAddress;
  }

  // ─── Trading Operations ───
  // All return params only — backend signs with API key

  async signMarketOrder(params: MarketOrderParams): Promise<SignedOperation> {
    return buildServerOp(this.evmAddress, {
      symbol: params.symbol,
      side: params.side,
      amount: params.amount,
      slippage_percent: params.slippagePercent || '0.5',
      reduce_only: params.reduceOnly || false,
      ...(params.takeProfit && { take_profit: { stop_price: params.takeProfit.stopPrice } }),
      ...(params.stopLoss && { stop_loss: { stop_price: params.stopLoss.stopPrice } }),
    });
  }

  async signLimitOrder(params: LimitOrderParams): Promise<SignedOperation> {
    return buildServerOp(this.evmAddress, {
      symbol: params.symbol,
      side: params.side,
      price: params.price,
      amount: params.amount,
      reduce_only: params.reduceOnly || false,
      tif: params.tif || 'GTC',
      ...(params.takeProfit && { take_profit: { stop_price: params.takeProfit.stopPrice } }),
      ...(params.stopLoss && { stop_loss: { stop_price: params.stopLoss.stopPrice } }),
    });
  }

  async signCancelOrder(params: CancelOrderParams): Promise<SignedOperation> {
    return buildServerOp(this.evmAddress, {
      order_id: params.orderId,
      symbol: params.symbol,
    });
  }

  async signCancelAllOrders(params: CancelAllOrdersParams): Promise<SignedOperation> {
    return buildServerOp(this.evmAddress, {
      ...(params.symbol && { symbol: params.symbol }),
    });
  }

  async signStopOrder(params: StopOrderParams): Promise<SignedOperation> {
    return buildServerOp(this.evmAddress, {
      symbol: params.symbol,
      side: params.side,
      reduce_only: params.reduceOnly,
      stop_price: params.stopPrice,
      amount: params.amount,
      ...(params.limitPrice && { limit_price: params.limitPrice }),
    });
  }

  async signSetTpSl(params: SetTpSlParams): Promise<SignedOperation> {
    const result: Record<string, unknown> = {
      symbol: params.symbol,
      side: params.side,
    };
    if (params.size) result.size = params.size;
    if (params.takeProfit === null) result.take_profit = null;
    else if (params.takeProfit) result.take_profit = { stop_price: params.takeProfit.stopPrice };
    if (params.stopLoss === null) result.stop_loss = null;
    else if (params.stopLoss) result.stop_loss = { stop_price: params.stopLoss.stopPrice };
    return buildServerOp(this.evmAddress, result);
  }

  async signEditOrder(params: EditOrderParams): Promise<SignedOperation> {
    return buildServerOp(this.evmAddress, {
      order_id: params.orderId,
      symbol: params.symbol,
      price: params.price,
      amount: params.amount,
    });
  }

  // ─── Account Operations ───

  async signSetLeverage(params: SetLeverageParams): Promise<SignedOperation> {
    return buildServerOp(this.evmAddress, {
      symbol: params.symbol,
      leverage: params.leverage,
    });
  }

  async signSetMarginMode(params: SetMarginModeParams): Promise<SignedOperation> {
    // Lighter only supports cross margin
    return buildServerOp(this.evmAddress, {
      symbol: params.symbol,
      is_isolated: params.isIsolated,
    });
  }

  async signWithdraw(params: WithdrawParams): Promise<SignedOperation> {
    return buildServerOp(this.evmAddress, {
      amount: params.amount,
    });
  }

  // No signApproveBuilderCode — Lighter has zero fees, no builder code system
}
