/**
 * Pacifica wallet signing utilities
 *
 * All trading operations require wallet signatures for authentication.
 * This module provides functions to sign operations with connected Solana wallets.
 *
 * IMPORTANT: Pacifica requires a specific signing format:
 * {
 *   "timestamp": <ms>,
 *   "expiry_window": 5000,
 *   "type": "<operation_type>",
 *   "data": { ...operation_data }
 * }
 *
 * The message must be compacted (no spaces) and keys must be sorted recursively.
 */

import type { WalletContextState } from '@solana/wallet-adapter-react';
import bs58 from 'bs58';

interface SignedOperation {
  signature: string;
  timestamp: number;
}

/**
 * Recursively sort object keys for deterministic JSON serialization
 */
function sortKeysRecursive(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sortKeysRecursive);
  }

  return Object.keys(obj)
    .sort()
    .reduce((sorted: any, key: string) => {
      sorted[key] = sortKeysRecursive(obj[key]);
      return sorted;
    }, {});
}

/**
 * Sign a Pacifica operation with the connected wallet
 *
 * Uses Pacifica's required format:
 * {
 *   "data": { ...operation_data },
 *   "expiry_window": 5000,
 *   "timestamp": <ms>,
 *   "type": "<operation_type>"
 * }
 */
async function signPacificaOperation(
  wallet: WalletContextState,
  operationType: string,
  data: Record<string, any>
): Promise<SignedOperation> {
  if (!wallet.connected || !wallet.publicKey || !wallet.signMessage) {
    throw new Error('Wallet not connected');
  }

  const timestamp = Date.now();
  const expiryWindow = 5000; // 5 seconds

  // Build operation data in Pacifica's required format
  const operationData = {
    timestamp,
    expiry_window: expiryWindow,
    type: operationType,
    data: data,
  };

  // Sort keys recursively for deterministic serialization
  const sortedData = sortKeysRecursive(operationData);

  // Convert to compact JSON string (no spaces)
  const message = JSON.stringify(sortedData);

  // Debug: log the message being signed
  console.log('Pacifica signing - message to sign:', message);

  // Sign with wallet
  const messageBytes = new TextEncoder().encode(message);
  const signatureBytes = await wallet.signMessage(messageBytes);

  // Convert signature to base58
  const signature = bs58.encode(signatureBytes);

  return {
    signature,
    timestamp,
  };
}

/**
 * Sign a market order
 *
 * NOTE: account is NOT included in signed data - only in the final request
 * NOTE: take_profit and stop_loss ARE included in signed data if provided
 */
export async function createSignedMarketOrder(
  wallet: WalletContextState,
  params: {
    symbol: string;
    side: 'bid' | 'ask';
    amount: string;
    slippage_percent: string;
    reduce_only: boolean;
    builder_code?: string;
    take_profit?: { stop_price: string };
    stop_loss?: { stop_price: string };
  }
): Promise<SignedOperation> {
  // Build clean params object, only including defined values
  const cleanParams: Record<string, any> = {
    symbol: params.symbol,
    side: params.side,
    amount: params.amount,
    slippage_percent: params.slippage_percent,
    reduce_only: params.reduce_only,
  };

  if (params.builder_code) {
    cleanParams.builder_code = params.builder_code;
  }
  if (params.take_profit) {
    cleanParams.take_profit = params.take_profit;
  }
  if (params.stop_loss) {
    cleanParams.stop_loss = params.stop_loss;
  }

  // account is NOT included in signed data per Pacifica docs
  return signPacificaOperation(wallet, 'create_market_order', cleanParams);
}

/**
 * Sign a limit order
 *
 * NOTE: account is NOT included in signed data - only in the final request
 */
export async function createSignedLimitOrder(
  wallet: WalletContextState,
  params: {
    symbol: string;
    side: 'bid' | 'ask';
    price: string;
    amount: string;
    reduce_only: boolean;
    tif: string;
    builder_code?: string;
  }
): Promise<SignedOperation> {
  // Build clean params object matching Pacifica API requirements
  // Note: post_only is NOT a valid parameter for Pacifica limit orders
  const cleanParams: Record<string, any> = {
    symbol: params.symbol,
    side: params.side,
    price: params.price,
    amount: params.amount,
    reduce_only: params.reduce_only,
    tif: params.tif,
  };

  if (params.builder_code) {
    cleanParams.builder_code = params.builder_code;
  }

  // account is NOT included in signed data per Pacifica docs
  return signPacificaOperation(wallet, 'create_order', cleanParams);
}

/**
 * Sign an order cancellation
 * NOTE: account is NOT included in signed data
 * NOTE: symbol IS included in signed data per Pacifica API requirements
 */
export async function createSignedCancelOrder(
  wallet: WalletContextState,
  params: {
    order_id: number;
    symbol: string;
  }
): Promise<SignedOperation> {
  return signPacificaOperation(wallet, 'cancel_order', params);
}

/**
 * Sign cancel stop order (TP/SL orders)
 * NOTE: account is NOT included in signed data
 * NOTE: symbol IS included in signed data per Pacifica API requirements
 */
export async function createSignedCancelStopOrder(
  wallet: WalletContextState,
  params: {
    order_id: number;
    symbol: string;
  }
): Promise<SignedOperation> {
  return signPacificaOperation(wallet, 'cancel_stop_order', params);
}

/**
 * Sign cancel all orders
 * NOTE: account is NOT included in signed data
 */
export async function createSignedCancelAllOrders(
  wallet: WalletContextState,
  params: {
    all_symbols: boolean;
    exclude_reduce_only: boolean;
    symbol?: string;
  }
): Promise<SignedOperation> {
  // Filter out undefined values
  const cleanParams: Record<string, any> = {
    all_symbols: params.all_symbols,
    exclude_reduce_only: params.exclude_reduce_only,
  };

  if (params.symbol) {
    cleanParams.symbol = params.symbol;
  }

  return signPacificaOperation(wallet, 'cancel_all_orders', cleanParams);
}

/**
 * Sign leverage update
 * NOTE: account is NOT included in signed data
 */
export async function createSignedUpdateLeverage(
  wallet: WalletContextState,
  params: {
    symbol: string;
    leverage: string;
  }
): Promise<SignedOperation> {
  return signPacificaOperation(wallet, 'update_leverage', params);
}

/**
 * Sign TP/SL update
 * NOTE: account is NOT included in signed data (same as market orders)
 * NOTE: null values are used to remove TP/SL
 */
export async function createSignedSetPositionTpsl(
  wallet: WalletContextState,
  params: {
    symbol: string;
    side: 'bid' | 'ask';
    take_profit?: { stop_price: string; limit_price?: string } | null;
    stop_loss?: { stop_price: string; limit_price?: string } | null;
  }
): Promise<SignedOperation> {
  // Build params - account is NOT in signed data (same as other operations)
  // null = remove, undefined = don't include
  const cleanParams: Record<string, any> = {
    symbol: params.symbol,
    side: params.side,
  };

  // Include null explicitly to remove, include object to set, skip if undefined
  if (params.take_profit === null) {
    cleanParams.take_profit = null;
  } else if (params.take_profit) {
    cleanParams.take_profit = params.take_profit;
  }

  if (params.stop_loss === null) {
    cleanParams.stop_loss = null;
  } else if (params.stop_loss) {
    cleanParams.stop_loss = params.stop_loss;
  }

  return signPacificaOperation(wallet, 'set_position_tpsl', cleanParams);
}

/**
 * Sign builder code approval
 * Required before placing orders through the TradeFightClub builder program
 *
 * NOTE: For builder code approval, account is NOT included in signed data
 */
export async function createSignedApproveBuilderCode(
  wallet: WalletContextState,
  params: {
    builder_code: string;
    max_fee_rate: string;
  }
): Promise<SignedOperation> {
  // Builder code approval does NOT include account in signed data
  return signPacificaOperation(wallet, 'approve_builder_code', params);
}

/**
 * Sign builder code revocation
 */
export async function createSignedRevokeBuilderCode(
  wallet: WalletContextState,
  params: {
    builder_code: string;
  }
): Promise<SignedOperation> {
  return signPacificaOperation(wallet, 'revoke_builder_code', params);
}
