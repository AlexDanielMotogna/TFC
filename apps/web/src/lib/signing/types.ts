/**
 * Exchange-agnostic signing types
 *
 * Abstracts the signing layer so trading hooks don't care which exchange
 * they're interacting with. Two signing patterns are supported:
 *
 * 1. Client-side (Pacifica): User's wallet signs every action in the browser
 * 2. Server-side (Hyperliquid, Lighter): Backend signs with stored delegated keys
 */

import type { ExchangeType } from '@tfc/shared';

// ─────────────────────────────────────────────────────────────
// Core Types
// ─────────────────────────────────────────────────────────────

export type SigningLocation = 'client' | 'server';

/** Normalized side — hooks always use this, signer converts to exchange format */
export type NormalizedSide = 'BUY' | 'SELL';

/** Normalized order type */
export type NormalizedOrderType = 'MARKET' | 'LIMIT' | 'STOP_MARKET' | 'STOP_LIMIT';

/** Normalized TIF */
export type NormalizedTif = 'GTC' | 'IOC' | 'ALO' | 'TOB' | 'POST_ONLY';

/**
 * Result of a signing operation.
 *
 * - For client-side signers (Pacifica): includes `signature` + `timestamp`
 * - For server-side signers (HL, Lighter): includes `params` only —
 *   the backend will sign using the stored delegated key
 */
export interface SignedOperation {
  exchangeType: ExchangeType;
  signingLocation: SigningLocation;

  /** Client-signed: wallet signature (base58 for Pacifica) */
  signature?: string;
  /** Client-signed: signing timestamp */
  timestamp?: number;

  /** The account identifier on the exchange */
  account: string;

  /** Order params to send to backend (exchange-specific format after conversion) */
  params: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────
// Order Parameter Types (Normalized — what hooks pass in)
// ─────────────────────────────────────────────────────────────

export interface MarketOrderParams {
  symbol: string;          // 'BTC-USD' (normalized, signer converts to exchange format)
  side: NormalizedSide;
  amount: string;          // Token amount as string
  slippagePercent?: string;
  reduceOnly?: boolean;
  takeProfit?: { stopPrice: string };
  stopLoss?: { stopPrice: string };
}

export interface LimitOrderParams {
  symbol: string;
  side: NormalizedSide;
  price: string;
  amount: string;
  reduceOnly?: boolean;
  tif?: NormalizedTif;
  takeProfit?: { stopPrice: string };
  stopLoss?: { stopPrice: string };
}

export interface CancelOrderParams {
  orderId: number;
  symbol: string;
}

export interface CancelAllOrdersParams {
  symbol?: string;
}

export interface StopOrderParams {
  symbol: string;
  side: NormalizedSide;     // Position side (signer figures out closing side)
  reduceOnly: boolean;
  stopPrice: string;
  amount: string;
  limitPrice?: string;      // For stop-limit orders
}

export interface SetTpSlParams {
  symbol: string;
  side: NormalizedSide;     // Position side
  size?: string;            // Optional partial size
  takeProfit?: { stopPrice: string; limitPrice?: string } | null;  // null = remove
  stopLoss?: { stopPrice: string; limitPrice?: string } | null;    // null = remove
}

export interface SetLeverageParams {
  symbol: string;
  leverage: number;
}

export interface SetMarginModeParams {
  symbol: string;
  isIsolated: boolean;
}

export interface EditOrderParams {
  orderId: number;
  symbol: string;
  price: string;
  amount: string;
}

export interface WithdrawParams {
  amount: string;
}

export interface ApproveBuilderCodeParams {
  builderCode: string;
  maxFeeRate: string;
}

// ─────────────────────────────────────────────────────────────
// ExchangeSigner Interface
// ─────────────────────────────────────────────────────────────

/**
 * Exchange-agnostic signer interface.
 *
 * Each exchange implements this interface. Hooks call these methods
 * without knowing which exchange they're signing for.
 *
 * - PacificaSigner: signs client-side with Solana wallet
 * - HyperliquidSigner: packages params for server-side signing (agent wallet)
 * - LighterSigner: packages params for server-side signing (API key)
 */
export interface ExchangeSigner {
  readonly exchangeType: ExchangeType;
  readonly signingLocation: SigningLocation;

  /** Returns the user's account identifier on this exchange */
  getAccountId(): string;

  // ─── Trading Operations ───

  signMarketOrder(params: MarketOrderParams): Promise<SignedOperation>;
  signLimitOrder(params: LimitOrderParams): Promise<SignedOperation>;
  signCancelOrder(params: CancelOrderParams): Promise<SignedOperation>;
  signCancelAllOrders(params: CancelAllOrdersParams): Promise<SignedOperation>;
  signStopOrder(params: StopOrderParams): Promise<SignedOperation>;
  signSetTpSl(params: SetTpSlParams): Promise<SignedOperation>;
  signEditOrder(params: EditOrderParams): Promise<SignedOperation>;

  // ─── Account Operations ───

  signSetLeverage(params: SetLeverageParams): Promise<SignedOperation>;
  signSetMarginMode(params: SetMarginModeParams): Promise<SignedOperation>;
  signWithdraw(params: WithdrawParams): Promise<SignedOperation>;

  // ─── Exchange-Specific Setup (optional) ───

  /** Pacifica & Hyperliquid: approve builder code for fee attribution */
  signApproveBuilderCode?(params: ApproveBuilderCodeParams): Promise<SignedOperation>;
}
