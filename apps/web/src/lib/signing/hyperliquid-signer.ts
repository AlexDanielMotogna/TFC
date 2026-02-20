/**
 * Hyperliquid Signer — Server-Side Signing (stub)
 *
 * Hyperliquid uses an "agent wallet" pattern:
 * - User signs `approveAgent` once (EIP-712, client-side) to authorize our agent wallet
 * - User signs `approveBuilderFee` once (EIP-712, client-side) for fee attribution
 * - After that, our backend signs all trades using the agent wallet's private key (ECDSA)
 *
 * This signer does NOT sign on the client — it packages normalized params
 * for the backend to sign and submit.
 *
 * Symbol mapping: 'BTC-USD' → asset index 0 (handled server-side)
 * Side mapping: BUY → { isBuy: true }, SELL → { isBuy: false }
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
  ApproveBuilderCodeParams,
} from './types';

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** Build a server-side operation (no client signature — backend signs) */
function buildServerOp(account: string, params: Record<string, unknown>): SignedOperation {
  return {
    exchangeType: 'hyperliquid',
    signingLocation: 'server',
    account,
    params,
  };
}

// ─────────────────────────────────────────────────────────────
// Hyperliquid Signer
// ─────────────────────────────────────────────────────────────

export class HyperliquidSigner implements ExchangeSigner {
  readonly exchangeType = 'hyperliquid' as const;
  readonly signingLocation = 'server' as const;

  /**
   * @param evmAddress - User's EVM wallet address (e.g., 0x...)
   */
  constructor(private evmAddress: string) {
    if (!evmAddress) {
      throw new Error('EVM wallet address required for Hyperliquid');
    }
  }

  getAccountId(): string {
    return this.evmAddress;
  }

  // ─── Trading Operations ───
  // All return params only — backend signs with agent wallet

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
    // Hyperliquid only supports cross margin — this is a no-op
    // but we keep the interface consistent
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

  // ─── Exchange-Specific Setup ───
  // These DO require client-side EVM wallet signing (one-time)
  // TODO: Implement with wagmi/viem EIP-712 signing when EVM wallet support is added

  async signApproveBuilderCode(params: ApproveBuilderCodeParams): Promise<SignedOperation> {
    // approveBuilderFee requires user's EVM wallet to sign EIP-712 (one-time)
    // This will be implemented when wagmi is integrated
    throw new Error('Hyperliquid approveBuilderFee: EVM wallet signing not yet implemented');
  }
}
