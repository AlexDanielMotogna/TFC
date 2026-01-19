/**
 * Trading hooks for placing and managing orders
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useWallet } from '@solana/wallet-adapter-react';
import { createSignedMarketOrder, createSignedLimitOrder, createSignedCancelOrder, createSignedCancelStopOrder, createSignedCancelAllOrders, createSignedSetPositionTpsl, createSignedUpdateLeverage, createSignedWithdraw } from '@/lib/pacifica/signing';
import { notify } from '@/lib/notify';

const BUILDER_CODE = process.env.NEXT_PUBLIC_PACIFICA_BUILDER_CODE || 'TradeClub';

interface CreateMarketOrderParams {
  symbol: string;
  side: 'bid' | 'ask'; // bid = LONG, ask = SHORT
  amount: string;
  reduceOnly?: boolean;
  slippage_percent?: string;
  builder_code?: string;
  take_profit?: { stop_price: string };
  stop_loss?: { stop_price: string };
  fightId?: string; // Optional: specific fight to apply this trade to
  leverage?: number; // Leverage used for this trade (stored in FightTrade for accurate ROI calculation)
  isPreFightFlip?: boolean; // When true, this is a flip of a pre-fight position (don't record as fight trade)
}

interface CreateLimitOrderParams {
  symbol: string;
  side: 'bid' | 'ask';
  price: string;
  amount: string;
  reduceOnly?: boolean;
  postOnly?: boolean;
  tif?: 'GTC' | 'IOC' | 'ALO' | 'TOB';
  builder_code?: string;
  take_profit?: { stop_price: string };
  stop_loss?: { stop_price: string };
}

interface CancelOrderParams {
  orderId: number;
  symbol: string;
}

interface CancelAllOrdersParams {
  symbol?: string;
}

interface SetPositionTpSlParams {
  symbol: string;
  side: 'LONG' | 'SHORT';
  size: string; // Size in token units (e.g., "0.00123" for BTC)
  take_profit?: { stop_price: string; limit_price?: string } | null; // null to remove
  stop_loss?: { stop_price: string; limit_price?: string } | null; // null to remove
}

interface SetLeverageParams {
  symbol: string;
  leverage: number;
}

/**
 * Hook to create market orders
 */
export function useCreateMarketOrder() {
  const wallet = useWallet();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateMarketOrderParams) => {
      if (!wallet.connected || !wallet.publicKey) {
        throw new Error('Wallet not connected');
      }

      const account = wallet.publicKey.toBase58();

      const slippagePercent = params.slippage_percent || '0.5';
      const builderCode = params.builder_code || BUILDER_CODE;

      // Sign the operation with wallet - must include builder_code and TP/SL in signed data
      const { signature, timestamp } = await createSignedMarketOrder(wallet, {
        symbol: params.symbol,
        side: params.side,
        amount: params.amount,
        slippage_percent: slippagePercent,
        reduce_only: params.reduceOnly || false,
        builder_code: builderCode,
        take_profit: params.take_profit,
        stop_loss: params.stop_loss,
      });

      // Send to backend proxy
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          account,
          symbol: params.symbol,
          side: params.side,
          type: 'MARKET',
          amount: params.amount,
          reduce_only: params.reduceOnly || false,
          slippage_percent: slippagePercent,
          builder_code: builderCode,
          take_profit: params.take_profit,
          stop_loss: params.stop_loss,
          signature,
          timestamp,
          fight_id: params.fightId, // Pass specific fight for stake validation
          leverage: params.leverage, // Leverage for FightTrade ROI calculation
          is_pre_fight_flip: params.isPreFightFlip, // Skip recording if flipping pre-fight position
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      return result.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['account'] });

      // Invalidate fight-related queries if in a fight
      if (variables.fightId) {
        // Invalidate immediately
        queryClient.invalidateQueries({ queryKey: ['fight-positions', variables.fightId] });
        queryClient.invalidateQueries({ queryKey: ['fight-trades', variables.fightId] });
        queryClient.invalidateQueries({ queryKey: ['stake-info'] });

        // Also invalidate after a delay to catch the recorded FightTrade
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['fight-positions', variables.fightId] });
          queryClient.invalidateQueries({ queryKey: ['fight-trades', variables.fightId] });
        }, 2000);

        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['fight-positions', variables.fightId] });
          queryClient.invalidateQueries({ queryKey: ['fight-trades', variables.fightId] });
        }, 4000);
      }

      // Format like Pacifica: "0.00082 BTC filled at 93300"
      const avgPrice = data.avg_price || data.price || 'market';
      notify('TRADE', 'Order Filled', `${variables.amount} ${variables.symbol} filled at ${avgPrice}`, { variant: 'success' });
    },
    onError: (error: Error) => {
      console.error('Failed to create market order:', error);
      notify('TRADE', 'Order Failed', `Order failed: ${error.message}`, { variant: 'error' });
    },
  });
}

/**
 * Hook to create limit orders
 */
export function useCreateLimitOrder() {
  const wallet = useWallet();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateLimitOrderParams) => {
      if (!wallet.connected || !wallet.publicKey) {
        throw new Error('Wallet not connected');
      }

      const account = wallet.publicKey.toBase58();

      const builderCode = params.builder_code || BUILDER_CODE;

      // Sign the operation with wallet - must include builder_code, tif, and TP/SL in signed data
      // Note: post_only is NOT a valid Pacifica parameter for limit orders
      const tif = params.tif || 'GTC';
      const { signature, timestamp } = await createSignedLimitOrder(wallet, {
        symbol: params.symbol,
        side: params.side,
        price: params.price,
        amount: params.amount,
        reduce_only: params.reduceOnly || false,
        builder_code: builderCode,
        tif,
        take_profit: params.take_profit,
        stop_loss: params.stop_loss,
      });

      // Send to backend proxy
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          account,
          symbol: params.symbol,
          side: params.side,
          type: 'LIMIT',
          price: params.price,
          amount: params.amount,
          reduce_only: params.reduceOnly || false,
          post_only: params.postOnly || false,
          tif: params.tif || 'GTC',
          builder_code: builderCode,
          take_profit: params.take_profit,
          stop_loss: params.stop_loss,
          signature,
          timestamp,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      return result.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });

      // Format: "Limit order: 0.001 BTC at 93000"
      notify('ORDER', 'Limit Order', `Limit order: ${variables.amount} ${variables.symbol} at ${variables.price}`, { variant: 'success' });
    },
    onError: (error: Error) => {
      console.error('Failed to create limit order:', error);
      notify('ORDER', 'Limit Order Failed', `Limit order failed: ${error.message}`, { variant: 'error' });
    },
  });
}

/**
 * Hook to cancel a specific order
 */
export function useCancelOrder() {
  const wallet = useWallet();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CancelOrderParams) => {
      if (!wallet.connected || !wallet.publicKey) {
        throw new Error('Wallet not connected');
      }

      const account = wallet.publicKey.toBase58();

      // Sign the cancellation with wallet - symbol must be included in signed data
      const { signature, timestamp } = await createSignedCancelOrder(wallet, {
        order_id: params.orderId,
        symbol: params.symbol,
      });

      // Send to backend proxy
      const response = await fetch(
        `/api/orders/${params.orderId}?account=${account}&symbol=${params.symbol}&signature=${signature}&timestamp=${timestamp}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      return result.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });

      notify('ORDER', 'Order Cancelled', `Order #${variables.orderId} cancelled`, { variant: 'success' });
    },
    onError: (error: Error) => {
      console.error('Failed to cancel order:', error);
      notify('ORDER', 'Cancel Failed', `Cancel failed: ${error.message}`, { variant: 'error' });
    },
  });
}

/**
 * Hook to cancel a stop order (TP/SL)
 */
export function useCancelStopOrder() {
  const wallet = useWallet();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CancelOrderParams) => {
      if (!wallet.connected || !wallet.publicKey) {
        throw new Error('Wallet not connected');
      }

      const account = wallet.publicKey.toBase58();

      // Sign the cancellation with wallet - use cancel_stop_order type
      const { signature, timestamp } = await createSignedCancelStopOrder(wallet, {
        order_id: params.orderId,
        symbol: params.symbol,
      });

      // Send to backend proxy for stop order cancellation
      const response = await fetch('/api/orders/stop/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          account,
          symbol: params.symbol,
          order_id: params.orderId,
          signature,
          timestamp,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      return result.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['positions'] });

      notify('ORDER', 'TP/SL Cancelled', `TP/SL order cancelled`, { variant: 'success' });
    },
    onError: (error: Error) => {
      console.error('Failed to cancel stop order:', error);
      notify('ORDER', 'Cancel Failed', `Cancel failed: ${error.message}`, { variant: 'error' });
    },
  });
}

/**
 * Hook to cancel all orders
 */
export function useCancelAllOrders() {
  const wallet = useWallet();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params?: CancelAllOrdersParams) => {
      if (!wallet.connected || !wallet.publicKey) {
        throw new Error('Wallet not connected');
      }

      const account = wallet.publicKey.toBase58();

      // Sign the cancellation with wallet
      const { signature, timestamp } = await createSignedCancelAllOrders(wallet, {
        all_symbols: !params?.symbol,
        exclude_reduce_only: false,
        symbol: params?.symbol,
      });

      // Send to backend proxy
      const url = new URL('/api/orders', window.location.origin);
      url.searchParams.set('account', account);
      url.searchParams.set('signature', signature);
      url.searchParams.set('timestamp', timestamp.toString());
      if (params?.symbol) {
        url.searchParams.set('symbol', params.symbol);
      }

      const response = await fetch(url.toString(), {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      return result.data;
    },
    onSuccess: (_, params) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });

      const msg = params?.symbol
        ? `All ${params.symbol} orders cancelled`
        : 'All orders cancelled';
      notify('ORDER', 'Orders Cancelled', msg, { variant: 'success' });
    },
    onError: (error: Error) => {
      console.error('Failed to cancel orders:', error);
      notify('ORDER', 'Cancel Failed', `Failed to cancel orders: ${error.message}`, { variant: 'error' });
    },
  });
}

/**
 * Hook to set TP/SL on existing position
 */
export function useSetPositionTpSl() {
  const wallet = useWallet();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: SetPositionTpSlParams) => {
      if (!wallet.connected || !wallet.publicKey) {
        throw new Error('Wallet not connected');
      }

      const account = wallet.publicKey.toBase58();

      // Convert LONG/SHORT to CLOSING order side (opposite of position)
      // TP/SL orders close the position, so they need the opposite side:
      // - LONG position → need to SELL (ask) to close
      // - SHORT position → need to BUY (bid) to close
      const side = params.side === 'LONG' ? 'ask' : 'bid';

      // Build params for signing - account is NOT in signed data (same as market orders)
      // NOTE: size is NOT included for full position TP/SL (per Pacifica API)
      const signParams: {
        symbol: string;
        side: 'bid' | 'ask';
        size?: string;
        take_profit?: { stop_price: string; limit_price?: string } | null;
        stop_loss?: { stop_price: string; limit_price?: string } | null;
      } = {
        symbol: params.symbol.replace('-USD', ''),
        side,
      };
      // Size is only for partial TP/SL - omit for full position

      // Handle take_profit: null means remove, undefined means don't change, object means set
      if (params.take_profit === null) {
        signParams.take_profit = null; // Explicitly null to remove
      } else if (params.take_profit) {
        signParams.take_profit = { stop_price: params.take_profit.stop_price };
        if (params.take_profit.limit_price) {
          signParams.take_profit.limit_price = params.take_profit.limit_price;
        }
      }

      // Handle stop_loss: null means remove, undefined means don't change, object means set
      if (params.stop_loss === null) {
        signParams.stop_loss = null; // Explicitly null to remove
      } else if (params.stop_loss) {
        signParams.stop_loss = { stop_price: params.stop_loss.stop_price };
        if (params.stop_loss.limit_price) {
          signParams.stop_loss.limit_price = params.stop_loss.limit_price;
        }
      }

      // Sign the operation
      console.log('TP/SL signParams:', JSON.stringify(signParams, null, 2));
      const { signature, timestamp } = await createSignedSetPositionTpsl(wallet, signParams);
      console.log('TP/SL signed with timestamp:', timestamp);

      // Build request body - must match exactly what was signed
      // NOTE: builder_code is NOT a valid field for TP/SL endpoint per Pacifica docs
      // NOTE: size is NOT included for full position TP/SL (per Pacifica API)
      const requestBody: Record<string, any> = {
        account,
        symbol: params.symbol.replace('-USD', ''),
        side,
        signature,
        timestamp,
      };

      // Use the same take_profit/stop_loss structure as what was signed
      // null = remove, undefined = don't include, object = set
      if (params.take_profit === null) {
        requestBody.take_profit = null;
      } else if (params.take_profit) {
        requestBody.take_profit = { stop_price: params.take_profit.stop_price };
        if (params.take_profit.limit_price) {
          requestBody.take_profit.limit_price = params.take_profit.limit_price;
        }
      }

      if (params.stop_loss === null) {
        requestBody.stop_loss = null;
      } else if (params.stop_loss) {
        requestBody.stop_loss = { stop_price: params.stop_loss.stop_price };
        if (params.stop_loss.limit_price) {
          requestBody.stop_loss.limit_price = params.stop_loss.limit_price;
        }
      }

      // Send to backend proxy
      const response = await fetch('/api/positions/tpsl', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      return result.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      queryClient.invalidateQueries({ queryKey: ['account'] });

      const parts = [];
      if (variables.take_profit) {
        parts.push(`TP: $${variables.take_profit.stop_price}`);
      }
      if (variables.stop_loss) {
        parts.push(`SL: $${variables.stop_loss.stop_price}`);
      }
      notify('ORDER', 'TP/SL Set', `${variables.symbol} ${parts.join(', ')} set`, { variant: 'success' });
    },
    onError: (error: Error) => {
      console.error('Failed to set TP/SL:', error);
      notify('ORDER', 'TP/SL Failed', `Failed to set TP/SL: ${error.message}`, { variant: 'error' });
    },
  });
}

/**
 * Hook to set leverage for a trading pair
 */
export function useSetLeverage() {
  const wallet = useWallet();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: SetLeverageParams) => {
      if (!wallet.connected || !wallet.publicKey) {
        throw new Error('Wallet not connected');
      }

      const account = wallet.publicKey.toBase58();
      const symbol = params.symbol.replace('-USD', '');

      // Sign the operation
      const { signature, timestamp } = await createSignedUpdateLeverage(wallet, {
        symbol,
        leverage: params.leverage.toString(),
      });

      // Send to backend proxy
      const response = await fetch('/api/account/leverage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account,
          symbol,
          leverage: params.leverage.toString(),
          signature,
          timestamp,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['account-settings'] });
      const symbol = variables.symbol.replace('-USD', '');
      notify('ORDER', 'Leverage Set', `Leverage set to ${variables.leverage}x for ${symbol}`, { variant: 'success' });
    },
    onError: (error: Error) => {
      console.error('Failed to set leverage:', error);
      // Provide friendlier error messages for common cases
      if (error.message.includes('InvalidLeverage')) {
        notify('ORDER', 'Leverage Failed', 'Cannot decrease leverage while position is open', { variant: 'error' });
      } else {
        notify('ORDER', 'Leverage Failed', `Failed to set leverage: ${error.message}`, { variant: 'error' });
      }
    },
  });
}

interface WithdrawParams {
  amount: string;
}

/**
 * Hook to withdraw funds from Pacifica
 */
export function useWithdraw() {
  const wallet = useWallet();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: WithdrawParams) => {
      if (!wallet.connected || !wallet.publicKey) {
        throw new Error('Wallet not connected');
      }

      const account = wallet.publicKey.toBase58();

      // Sign the operation
      const { signature, timestamp } = await createSignedWithdraw(wallet, {
        amount: params.amount,
      });

      // Send to backend proxy
      const response = await fetch('/api/account/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account,
          amount: params.amount,
          signature,
          timestamp,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      // Refresh account data after withdrawal
      queryClient.invalidateQueries({ queryKey: ['account'] });
      queryClient.invalidateQueries({ queryKey: ['pacifica-account'] });
      notify('ORDER', 'Withdrawal Requested', `Withdrawal of $${variables.amount} requested`, { variant: 'success' });
    },
    onError: (error: Error) => {
      console.error('Failed to withdraw:', error);
      notify('ORDER', 'Withdrawal Failed', `Failed to withdraw: ${error.message}`, { variant: 'error' });
    },
  });
}
