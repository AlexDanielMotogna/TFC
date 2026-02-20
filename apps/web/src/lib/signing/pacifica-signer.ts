/**
 * Pacifica Signer — Client-Side Signing
 *
 * Wraps the existing `lib/pacifica/signing.ts` functions.
 * Converts normalized params (BUY/SELL, BTC-USD) to Pacifica format (bid/ask, BTC).
 *
 * Signing happens in the browser — user's Solana wallet signs every action.
 */

import type { WalletContextState } from '@solana/wallet-adapter-react';
import {
  createSignedMarketOrder,
  createSignedLimitOrder,
  createSignedCancelOrder,
  createSignedCancelStopOrder,
  createSignedCancelAllOrders,
  createSignedSetPositionTpsl,
  createSignedStopOrder,
  createSignedUpdateLeverage,
  createSignedUpdateMarginMode,
  createSignedEditOrder,
  createSignedWithdraw,
  createSignedApproveBuilderCode,
} from '@/lib/pacifica/signing';
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
  NormalizedSide,
} from './types';

const BUILDER_CODE = process.env.NEXT_PUBLIC_PACIFICA_BUILDER_CODE || 'TradeClub';

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** Convert normalized symbol to Pacifica format: 'BTC-USD' → 'BTC' */
function toPacificaSymbol(symbol: string): string {
  return symbol.replace('-USD', '');
}

/** Convert normalized side to Pacifica side: BUY → bid, SELL → ask */
function toPacificaSide(side: NormalizedSide): 'bid' | 'ask' {
  return side === 'BUY' ? 'bid' : 'ask';
}

/** Convert normalized position side to closing side (opposite) */
function toClosingSide(positionSide: NormalizedSide): 'bid' | 'ask' {
  return positionSide === 'BUY' ? 'ask' : 'bid';
}

/** Build a client-signed operation result */
function buildSignedOp(
  account: string,
  signature: string,
  timestamp: number,
  params: Record<string, unknown>,
): SignedOperation {
  return {
    exchangeType: 'pacifica',
    signingLocation: 'client',
    signature,
    timestamp,
    account,
    params,
  };
}

// ─────────────────────────────────────────────────────────────
// Pacifica Signer
// ─────────────────────────────────────────────────────────────

export class PacificaSigner implements ExchangeSigner {
  readonly exchangeType = 'pacifica' as const;
  readonly signingLocation = 'client' as const;

  constructor(private wallet: WalletContextState) {
    if (!wallet.connected || !wallet.publicKey) {
      throw new Error('Solana wallet not connected');
    }
  }

  getAccountId(): string {
    return this.wallet.publicKey!.toBase58();
  }

  async signMarketOrder(params: MarketOrderParams): Promise<SignedOperation> {
    const account = this.getAccountId();
    const symbol = toPacificaSymbol(params.symbol);
    const side = toPacificaSide(params.side);
    const slippagePercent = params.slippagePercent || '0.5';

    const signingParams: Record<string, unknown> = {
      symbol,
      side,
      amount: params.amount,
      slippage_percent: slippagePercent,
      reduce_only: params.reduceOnly || false,
      builder_code: BUILDER_CODE,
    };

    if (params.takeProfit) {
      signingParams.take_profit = { stop_price: params.takeProfit.stopPrice };
    }
    if (params.stopLoss) {
      signingParams.stop_loss = { stop_price: params.stopLoss.stopPrice };
    }

    const { signature, timestamp } = await createSignedMarketOrder(this.wallet, {
      symbol,
      side,
      amount: params.amount,
      slippage_percent: slippagePercent,
      reduce_only: params.reduceOnly || false,
      builder_code: BUILDER_CODE,
      take_profit: params.takeProfit ? { stop_price: params.takeProfit.stopPrice } : undefined,
      stop_loss: params.stopLoss ? { stop_price: params.stopLoss.stopPrice } : undefined,
    });

    return buildSignedOp(account, signature, timestamp, signingParams);
  }

  async signLimitOrder(params: LimitOrderParams): Promise<SignedOperation> {
    const account = this.getAccountId();
    const symbol = toPacificaSymbol(params.symbol);
    const side = toPacificaSide(params.side);
    const tif = params.tif || 'GTC';

    const signingParams: Record<string, unknown> = {
      symbol,
      side,
      price: params.price,
      amount: params.amount,
      reduce_only: params.reduceOnly || false,
      tif,
      builder_code: BUILDER_CODE,
    };

    if (params.takeProfit) {
      signingParams.take_profit = { stop_price: params.takeProfit.stopPrice };
    }
    if (params.stopLoss) {
      signingParams.stop_loss = { stop_price: params.stopLoss.stopPrice };
    }

    const { signature, timestamp } = await createSignedLimitOrder(this.wallet, {
      symbol,
      side,
      price: params.price,
      amount: params.amount,
      reduce_only: params.reduceOnly || false,
      tif,
      builder_code: BUILDER_CODE,
      take_profit: params.takeProfit ? { stop_price: params.takeProfit.stopPrice } : undefined,
      stop_loss: params.stopLoss ? { stop_price: params.stopLoss.stopPrice } : undefined,
    });

    return buildSignedOp(account, signature, timestamp, signingParams);
  }

  async signCancelOrder(params: CancelOrderParams): Promise<SignedOperation> {
    const account = this.getAccountId();
    const symbol = toPacificaSymbol(params.symbol);

    const { signature, timestamp } = await createSignedCancelOrder(this.wallet, {
      order_id: params.orderId,
      symbol,
    });

    return buildSignedOp(account, signature, timestamp, {
      order_id: params.orderId,
      symbol,
    });
  }

  async signCancelAllOrders(params: CancelAllOrdersParams): Promise<SignedOperation> {
    const account = this.getAccountId();
    const symbol = params.symbol ? toPacificaSymbol(params.symbol) : undefined;

    const { signature, timestamp } = await createSignedCancelAllOrders(this.wallet, {
      all_symbols: !symbol,
      exclude_reduce_only: false,
      symbol,
    });

    return buildSignedOp(account, signature, timestamp, {
      all_symbols: !symbol,
      exclude_reduce_only: false,
      ...(symbol && { symbol }),
    });
  }

  async signStopOrder(params: StopOrderParams): Promise<SignedOperation> {
    const account = this.getAccountId();
    const symbol = toPacificaSymbol(params.symbol);
    // For stop orders that close positions, convert position side to closing side
    const closingSide = toClosingSide(params.side);

    const stopOrderParams = {
      symbol,
      side: closingSide,
      reduce_only: params.reduceOnly,
      stop_order: {
        stop_price: params.stopPrice,
        amount: params.amount,
        ...(params.limitPrice && { limit_price: params.limitPrice }),
      },
    };

    const { signature, timestamp } = await createSignedStopOrder(this.wallet, stopOrderParams);

    return buildSignedOp(account, signature, timestamp, stopOrderParams);
  }

  async signSetTpSl(params: SetTpSlParams): Promise<SignedOperation> {
    const account = this.getAccountId();
    const symbol = toPacificaSymbol(params.symbol);
    const closingSide = toClosingSide(params.side);

    const signParams: {
      symbol: string;
      side: 'bid' | 'ask';
      take_profit?: { stop_price: string; limit_price?: string } | null;
      stop_loss?: { stop_price: string; limit_price?: string } | null;
    } = { symbol, side: closingSide };

    if (params.takeProfit === null) {
      signParams.take_profit = null;
    } else if (params.takeProfit) {
      signParams.take_profit = { stop_price: params.takeProfit.stopPrice };
      if (params.takeProfit.limitPrice) {
        signParams.take_profit.limit_price = params.takeProfit.limitPrice;
      }
    }

    if (params.stopLoss === null) {
      signParams.stop_loss = null;
    } else if (params.stopLoss) {
      signParams.stop_loss = { stop_price: params.stopLoss.stopPrice };
      if (params.stopLoss.limitPrice) {
        signParams.stop_loss.limit_price = params.stopLoss.limitPrice;
      }
    }

    const { signature, timestamp } = await createSignedSetPositionTpsl(this.wallet, signParams);

    return buildSignedOp(account, signature, timestamp, {
      ...signParams,
      ...(params.size && { size: params.size }),
    });
  }

  async signSetLeverage(params: SetLeverageParams): Promise<SignedOperation> {
    const account = this.getAccountId();
    const symbol = toPacificaSymbol(params.symbol);

    const { signature, timestamp } = await createSignedUpdateLeverage(this.wallet, {
      symbol,
      leverage: params.leverage.toString(),
    });

    return buildSignedOp(account, signature, timestamp, {
      symbol,
      leverage: params.leverage.toString(),
    });
  }

  async signSetMarginMode(params: SetMarginModeParams): Promise<SignedOperation> {
    const account = this.getAccountId();
    const symbol = toPacificaSymbol(params.symbol);

    const { signature, timestamp } = await createSignedUpdateMarginMode(this.wallet, {
      symbol,
      is_isolated: params.isIsolated,
    });

    return buildSignedOp(account, signature, timestamp, {
      symbol,
      is_isolated: params.isIsolated,
    });
  }

  async signEditOrder(params: EditOrderParams): Promise<SignedOperation> {
    const account = this.getAccountId();
    const symbol = toPacificaSymbol(params.symbol);

    const { signature, timestamp } = await createSignedEditOrder(this.wallet, {
      symbol,
      price: params.price,
      amount: params.amount,
      order_id: params.orderId,
    });

    return buildSignedOp(account, signature, timestamp, {
      symbol,
      price: params.price,
      amount: params.amount,
      order_id: params.orderId,
    });
  }

  async signWithdraw(params: WithdrawParams): Promise<SignedOperation> {
    const account = this.getAccountId();

    const { signature, timestamp } = await createSignedWithdraw(this.wallet, {
      amount: params.amount,
    });

    return buildSignedOp(account, signature, timestamp, {
      amount: params.amount,
    });
  }

  async signApproveBuilderCode(params: ApproveBuilderCodeParams): Promise<SignedOperation> {
    const account = this.getAccountId();

    const { signature, timestamp } = await createSignedApproveBuilderCode(this.wallet, {
      builder_code: params.builderCode,
      max_fee_rate: params.maxFeeRate,
    });

    return buildSignedOp(account, signature, timestamp, {
      builder_code: params.builderCode,
      max_fee_rate: params.maxFeeRate,
    });
  }
}
