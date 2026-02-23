/**
 * Trading hooks for placing and managing orders
 *
 * Exchange-aware: branches on signingScheme:
 * - ed25519 (Pacifica): client-side signing with Solana wallet
 * - ecdsa/zk (Hyperliquid, Lighter): server-side signing (just send params + JWT)
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useWallet } from '@solana/wallet-adapter-react';
import { useConfig as useWagmiConfig } from 'wagmi';
import { toast } from 'sonner';
import { useExchangeContext } from '@/contexts/ExchangeContext';
import { useAuthStore } from '@/lib/store';
import { createSignedMarketOrder, createSignedLimitOrder, createSignedCancelOrder, createSignedCancelStopOrder, createSignedCancelAllOrders, createSignedSetPositionTpsl, createSignedStopOrder, createSignedUpdateLeverage, createSignedUpdateMarginMode, createSignedWithdraw, createSignedEditOrder } from '@/lib/pacifica/signing';
import { notify } from '@/lib/notify';
import { IS_HL_TESTNET } from '@/lib/hyperliquid/transfers';

const BUILDER_CODE = process.env.NEXT_PUBLIC_PACIFICA_BUILDER_CODE || 'TradeClubTest';

/** Helper to check if current exchange uses client-side signing */
function isClientSigned(signingScheme: string): boolean {
  return signingScheme === 'ed25519';
}

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
  fightId?: string;
  leverage?: number;
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
  fightId?: string; // Optional: track TP/SL as fight order
}

interface SetLeverageParams {
  symbol: string;
  leverage: number;
}

interface CreateStopOrderParams {
  symbol: string;
  side: 'LONG' | 'SHORT'; // Position side (order will be opposite to close)
  stopPrice: string;
  amount: string; // Partial amount in token units
  limitPrice?: string; // Optional limit price for stop-limit orders
  type: 'TAKE_PROFIT' | 'STOP_LOSS';
  fightId?: string;
}

interface EditOrderParams {
  orderId: number;
  symbol: string;
  price: string;
  amount: string;
}

/**
 * Hook to create market orders
 */
export function useCreateMarketOrder() {
  const wallet = useWallet();
  const queryClient = useQueryClient();
  const { exchangeType, exchangeConfig } = useExchangeContext();
  const token = useAuthStore(s => s.token);

  return useMutation({
    mutationFn: async (params: CreateMarketOrderParams) => {
      const clientSigned = isClientSigned(exchangeConfig.signingScheme);

      let account: string;
      let signature: string | undefined;
      let timestamp: number | undefined;

      if (clientSigned) {
        // Pacifica: client-side signing
        if (!wallet.connected || !wallet.publicKey) {
          throw new Error('Wallet not connected');
        }
        account = wallet.publicKey.toBase58();

        const slippagePercent = params.slippage_percent || '0.5';
        const builderCode = params.builder_code || BUILDER_CODE;

        const signed = await createSignedMarketOrder(wallet, {
          symbol: params.symbol,
          side: params.side,
          amount: params.amount,
          slippage_percent: slippagePercent,
          reduce_only: params.reduceOnly || false,
          builder_code: builderCode,
          take_profit: params.take_profit,
          stop_loss: params.stop_loss,
        });
        signature = signed.signature;
        timestamp = signed.timestamp;
      } else {
        // Server-side signing (HL, Lighter): use wallet address from store
        const storeAddress = useAuthStore.getState().evmWalletAddress;
        if (!storeAddress) throw new Error('EVM wallet not connected');
        account = storeAddress;
      }

      const slippagePercent = params.slippage_percent || '0.5';
      const builderCode = params.builder_code || BUILDER_CODE;

      // Send to backend
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && !clientSigned ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          exchange: exchangeType,
          account,
          symbol: params.symbol,
          side: params.side,
          type: 'MARKET',
          amount: params.amount,
          reduce_only: params.reduceOnly || false,
          slippage_percent: slippagePercent,
          builder_code: exchangeConfig.hasBuilderCode ? builderCode : undefined,
          take_profit: params.take_profit,
          stop_loss: params.stop_loss,
          signature,
          timestamp,
          fight_id: params.fightId,
          leverage: params.leverage,
          is_pre_fight_flip: params.isPreFightFlip,
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

      if (variables.take_profit || variables.stop_loss) {
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['orders'] });
        }, 1000);
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['orders'] });
        }, 2500);
      }

      if (variables.fightId) {
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['fight-positions', variables.fightId] });
          queryClient.invalidateQueries({ queryKey: ['fight-trades', variables.fightId] });
          queryClient.invalidateQueries({ queryKey: ['fight-orders', variables.fightId] });
          queryClient.invalidateQueries({ queryKey: ['stake-info'] });
        }, 1000);

        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['fight-positions', variables.fightId] });
          queryClient.invalidateQueries({ queryKey: ['fight-trades', variables.fightId] });
          queryClient.invalidateQueries({ queryKey: ['fight-orders', variables.fightId] });
          queryClient.invalidateQueries({ queryKey: ['stake-info'] });
        }, 3000);
      }

      if (data?.status === 'resting') {
        notify('TRADE', 'Order Placed', `${variables.amount} ${variables.symbol} order resting`, { variant: 'success' });
      } else {
        const avgPrice = data?.avg_price || data?.price || 'market';
        notify('TRADE', 'Order Filled', `${variables.amount} ${variables.symbol} filled at ${avgPrice}`, { variant: 'success' });
      }
    },
    onError: (error: Error) => {
      console.error('Failed to create market order:', error);
      // Auto-reset builder fee flag if HL rejects due to missing approval
      if (error.message.includes('Builder fee has not been approved')) {
        useAuthStore.getState().setHyperliquidStatus(true, true, false);
      }
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
  const { exchangeType, exchangeConfig } = useExchangeContext();
  const token = useAuthStore(s => s.token);

  return useMutation({
    mutationFn: async (params: CreateLimitOrderParams) => {
      const clientSigned = isClientSigned(exchangeConfig.signingScheme);

      let account: string;
      let signature: string | undefined;
      let timestamp: number | undefined;

      if (clientSigned) {
        if (!wallet.connected || !wallet.publicKey) {
          throw new Error('Wallet not connected');
        }
        account = wallet.publicKey.toBase58();

        const builderCode = params.builder_code || BUILDER_CODE;
        const tif = params.tif || 'GTC';

        const signed = await createSignedLimitOrder(wallet, {
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
        signature = signed.signature;
        timestamp = signed.timestamp;
      } else {
        const storeAddress = useAuthStore.getState().evmWalletAddress;
        if (!storeAddress) throw new Error('EVM wallet not connected');
        account = storeAddress;
      }

      const builderCode = params.builder_code || BUILDER_CODE;

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && !clientSigned ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          exchange: exchangeType,
          account,
          symbol: params.symbol,
          side: params.side,
          type: 'LIMIT',
          price: params.price,
          amount: params.amount,
          reduce_only: params.reduceOnly || false,
          post_only: params.postOnly || false,
          tif: params.tif || 'GTC',
          builder_code: exchangeConfig.hasBuilderCode ? builderCode : undefined,
          take_profit: params.take_profit,
          stop_loss: params.stop_loss,
          fight_id: params.fightId,
          leverage: params.leverage,
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

      if (variables.take_profit || variables.stop_loss) {
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['orders'] });
        }, 1000);
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['orders'] });
        }, 2500);
      }

      notify('ORDER', 'Limit Order', `Limit order: ${variables.amount} ${variables.symbol} at ${variables.price}`, { variant: 'success' });
    },
    onError: (error: Error) => {
      console.error('Failed to create limit order:', error);
      if (error.message.includes('Builder fee has not been approved')) {
        useAuthStore.getState().setHyperliquidStatus(true, true, false);
      }
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
  const { exchangeType, exchangeConfig } = useExchangeContext();
  const token = useAuthStore(s => s.token);

  return useMutation({
    mutationFn: async (params: CancelOrderParams) => {
      const clientSigned = isClientSigned(exchangeConfig.signingScheme);

      let account: string;
      let signature: string | undefined;
      let timestamp: number | undefined;

      if (clientSigned) {
        if (!wallet.connected || !wallet.publicKey) {
          throw new Error('Wallet not connected');
        }
        account = wallet.publicKey.toBase58();

        const signed = await createSignedCancelOrder(wallet, {
          order_id: params.orderId,
          symbol: params.symbol.replace('-USD', ''),
        });
        signature = signed.signature;
        timestamp = signed.timestamp;
      } else {
        const storeAddress = useAuthStore.getState().evmWalletAddress;
        if (!storeAddress) throw new Error('EVM wallet not connected');
        account = storeAddress;
      }

      const url = new URL(`/api/orders/${params.orderId}`, window.location.origin);
      url.searchParams.set('exchange', exchangeType);
      url.searchParams.set('account', account);
      url.searchParams.set('symbol', params.symbol.replace('-USD', ''));
      if (signature) url.searchParams.set('signature', signature);
      if (timestamp) url.searchParams.set('timestamp', timestamp.toString());

      const response = await fetch(url.toString(), {
        method: 'DELETE',
        headers: {
          ...(token && !clientSigned ? { Authorization: `Bearer ${token}` } : {}),
        },
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
  const { exchangeType, exchangeConfig } = useExchangeContext();
  const token = useAuthStore(s => s.token);

  return useMutation({
    mutationFn: async (params: CancelOrderParams) => {
      const clientSigned = isClientSigned(exchangeConfig.signingScheme);

      let account: string;
      let signature: string | undefined;
      let timestamp: number | undefined;

      if (clientSigned) {
        if (!wallet.connected || !wallet.publicKey) {
          throw new Error('Wallet not connected');
        }
        account = wallet.publicKey.toBase58();

        const signed = await createSignedCancelStopOrder(wallet, {
          order_id: params.orderId,
          symbol: params.symbol.replace('-USD', ''),
        });
        signature = signed.signature;
        timestamp = signed.timestamp;
      } else {
        const storeAddress = useAuthStore.getState().evmWalletAddress;
        if (!storeAddress) throw new Error('EVM wallet not connected');
        account = storeAddress;
      }

      const response = await fetch('/api/orders/stop/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && !clientSigned ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          exchange: exchangeType,
          account,
          symbol: params.symbol.replace('-USD', ''),
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

      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['orders'] });
        queryClient.invalidateQueries({ queryKey: ['positions'] });
      }, 500);

      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['orders'] });
      }, 1500);

      notify('ORDER', 'Order Cancelled', `Order #${variables.orderId} cancelled`, { variant: 'success' });
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
  const { exchangeType, exchangeConfig } = useExchangeContext();
  const token = useAuthStore(s => s.token);

  return useMutation({
    mutationFn: async (params?: CancelAllOrdersParams) => {
      const clientSigned = isClientSigned(exchangeConfig.signingScheme);

      let account: string;
      let signature: string | undefined;
      let timestamp: number | undefined;

      if (clientSigned) {
        if (!wallet.connected || !wallet.publicKey) {
          throw new Error('Wallet not connected');
        }
        account = wallet.publicKey.toBase58();

        const signed = await createSignedCancelAllOrders(wallet, {
          all_symbols: !params?.symbol,
          exclude_reduce_only: false,
          symbol: params?.symbol?.replace('-USD', ''),
        });
        signature = signed.signature;
        timestamp = signed.timestamp;
      } else {
        const storeAddress = useAuthStore.getState().evmWalletAddress;
        if (!storeAddress) throw new Error('EVM wallet not connected');
        account = storeAddress;
      }

      const url = new URL('/api/orders', window.location.origin);
      url.searchParams.set('exchange', exchangeType);
      url.searchParams.set('account', account);
      if (signature) url.searchParams.set('signature', signature);
      if (timestamp) url.searchParams.set('timestamp', timestamp.toString());
      if (params?.symbol) url.searchParams.set('symbol', params.symbol.replace('-USD', ''));

      const response = await fetch(url.toString(), {
        method: 'DELETE',
        headers: {
          ...(token && !clientSigned ? { Authorization: `Bearer ${token}` } : {}),
        },
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
  const { exchangeType, exchangeConfig } = useExchangeContext();
  const token = useAuthStore(s => s.token);

  return useMutation({
    mutationFn: async (params: SetPositionTpSlParams) => {
      const clientSigned = isClientSigned(exchangeConfig.signingScheme);

      // Convert LONG/SHORT to closing order side (opposite of position)
      const side = params.side === 'LONG' ? 'ask' : 'bid';

      let account: string;
      let signature: string | undefined;
      let timestamp: number | undefined;

      if (clientSigned) {
        if (!wallet.connected || !wallet.publicKey) {
          throw new Error('Wallet not connected');
        }
        account = wallet.publicKey.toBase58();

        const signParams: {
          symbol: string;
          side: 'bid' | 'ask';
          take_profit?: { stop_price: string; limit_price?: string } | null;
          stop_loss?: { stop_price: string; limit_price?: string } | null;
        } = {
          symbol: params.symbol.replace('-USD', ''),
          side,
        };

        if (params.take_profit === null) {
          signParams.take_profit = null;
        } else if (params.take_profit) {
          signParams.take_profit = { stop_price: params.take_profit.stop_price };
          if (params.take_profit.limit_price) {
            signParams.take_profit.limit_price = params.take_profit.limit_price;
          }
        }

        if (params.stop_loss === null) {
          signParams.stop_loss = null;
        } else if (params.stop_loss) {
          signParams.stop_loss = { stop_price: params.stop_loss.stop_price };
          if (params.stop_loss.limit_price) {
            signParams.stop_loss.limit_price = params.stop_loss.limit_price;
          }
        }

        const signed = await createSignedSetPositionTpsl(wallet, signParams);
        signature = signed.signature;
        timestamp = signed.timestamp;
      } else {
        const storeAddress = useAuthStore.getState().evmWalletAddress;
        if (!storeAddress) throw new Error('EVM wallet not connected');
        account = storeAddress;
      }

      // Build request body
      const requestBody: Record<string, any> = {
        exchange: exchangeType,
        account,
        symbol: params.symbol.replace('-USD', ''),
        side,
        signature,
        timestamp,
        fight_id: params.fightId,
      };

      if (params.size) requestBody.size = params.size;

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

      const response = await fetch('/api/positions/tpsl', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && !clientSigned ? { Authorization: `Bearer ${token}` } : {}),
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
      queryClient.refetchQueries({ queryKey: ['orders'], type: 'active' });
      queryClient.refetchQueries({ queryKey: ['positions'], type: 'active' });

      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: ['orders'], type: 'active' });
      }, 300);

      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: ['orders'], type: 'active' });
      }, 800);

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
 * Hook to create partial TP/SL orders
 */
export function useCreateStopOrder() {
  const wallet = useWallet();
  const queryClient = useQueryClient();
  const { exchangeType, exchangeConfig } = useExchangeContext();
  const token = useAuthStore(s => s.token);

  return useMutation({
    mutationFn: async (params: CreateStopOrderParams) => {
      const clientSigned = isClientSigned(exchangeConfig.signingScheme);

      let account: string;

      if (clientSigned) {
        if (!wallet.connected || !wallet.publicKey) {
          throw new Error('Wallet not connected');
        }
        account = wallet.publicKey.toBase58();
      } else {
        const storeAddress = useAuthStore.getState().evmWalletAddress;
        if (!storeAddress) throw new Error('EVM wallet not connected');
        account = storeAddress;
      }

      const symbol = params.symbol.replace('-USD', '');
      const closingSide: 'bid' | 'ask' = params.side === 'LONG' ? 'ask' : 'bid';

      // For TAKE PROFIT: Use limit order with reduce_only
      if (params.type === 'TAKE_PROFIT') {
        let signature: string | undefined;
        let timestamp: number | undefined;

        if (clientSigned) {
          const limitParams = {
            symbol,
            side: closingSide,
            price: params.stopPrice,
            amount: params.amount,
            reduce_only: true,
            tif: 'GTC' as const,
          };
          const signed = await createSignedLimitOrder(wallet, limitParams);
          signature = signed.signature;
          timestamp = signed.timestamp;
        }

        const response = await fetch('/api/orders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && !clientSigned ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            exchange: exchangeType,
            account,
            symbol,
            side: closingSide,
            type: 'LIMIT',
            price: params.stopPrice,
            amount: params.amount,
            reduce_only: true,
            tif: 'GTC',
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
      }

      // For STOP LOSS: Use stop order
      const stopOrderParams = {
        symbol,
        side: closingSide as 'bid' | 'ask',
        reduce_only: true,
        stop_order: {
          stop_price: params.stopPrice,
          amount: params.amount,
          ...(params.limitPrice && { limit_price: params.limitPrice }),
        },
      };

      let signature: string | undefined;
      let timestamp: number | undefined;

      if (clientSigned) {
        const signed = await createSignedStopOrder(wallet, stopOrderParams);
        signature = signed.signature;
        timestamp = signed.timestamp;
      }

      const response = await fetch('/api/orders/stop/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && !clientSigned ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          exchange: exchangeType,
          account,
          ...stopOrderParams,
          signature,
          timestamp,
          fight_id: params.fightId,
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
      queryClient.refetchQueries({ queryKey: ['orders'], type: 'active' });
      queryClient.refetchQueries({ queryKey: ['positions'], type: 'active' });

      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: ['orders'], type: 'active' });
      }, 300);

      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: ['orders'], type: 'active' });
      }, 800);

      const typeLabel = variables.type === 'TAKE_PROFIT' ? 'TP' : 'SL';
      const orderType = variables.type === 'TAKE_PROFIT' ? 'Limit' : 'Stop';
      notify('ORDER', `${typeLabel} Order Created`, `${variables.symbol} ${typeLabel} (${orderType}): $${variables.stopPrice} (${variables.amount})`, { variant: 'success' });
    },
    onError: (error: Error) => {
      console.error('Failed to create partial TP/SL:', error);
      notify('ORDER', 'Order Failed', `Failed to create order: ${error.message}`, { variant: 'error' });
    },
  });
}

/**
 * Hook to create standalone stop orders from the order form
 */
interface CreateStandaloneStopOrderParams {
  symbol: string;          // 'BTC-USD'
  side: 'bid' | 'ask';    // bid=LONG, ask=SHORT
  stopPrice: string;       // trigger price
  amount: string;          // token amount (string)
  limitPrice?: string;     // for stop-limit only
  reduceOnly?: boolean;    // default false
  fightId?: string;
  leverage?: number;
}

export function useCreateStandaloneStopOrder() {
  const wallet = useWallet();
  const queryClient = useQueryClient();
  const { exchangeType, exchangeConfig } = useExchangeContext();
  const token = useAuthStore(s => s.token);

  return useMutation({
    mutationFn: async (params: CreateStandaloneStopOrderParams) => {
      const clientSigned = isClientSigned(exchangeConfig.signingScheme);

      let account: string;

      if (clientSigned) {
        if (!wallet.connected || !wallet.publicKey) {
          throw new Error('Wallet not connected');
        }
        account = wallet.publicKey.toBase58();
      } else {
        const storeAddress = useAuthStore.getState().evmWalletAddress;
        if (!storeAddress) throw new Error('EVM wallet not connected');
        account = storeAddress;
      }

      const symbol = params.symbol.replace('-USD', '');

      const stopOrderParams = {
        symbol,
        side: params.side,
        reduce_only: params.reduceOnly || false,
        stop_order: {
          stop_price: params.stopPrice,
          amount: params.amount,
          ...(params.limitPrice && { limit_price: params.limitPrice }),
        },
      };

      let signature: string | undefined;
      let timestamp: number | undefined;

      if (clientSigned) {
        const signed = await createSignedStopOrder(wallet, stopOrderParams);
        signature = signed.signature;
        timestamp = signed.timestamp;
      }

      const response = await fetch('/api/orders/stop/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && !clientSigned ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          exchange: exchangeType,
          account,
          ...stopOrderParams,
          signature,
          timestamp,
          fight_id: params.fightId,
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
      queryClient.invalidateQueries({ queryKey: ['account'] });

      if (variables.fightId) {
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['fight-orders', variables.fightId] });
          queryClient.invalidateQueries({ queryKey: ['stake-info'] });
        }, 1000);
      }

      const typeLabel = variables.limitPrice ? 'Stop Limit' : 'Stop Market';
      const sideLabel = variables.side === 'bid' ? 'Long' : 'Short';
      notify('ORDER', `${typeLabel} Order`, `${sideLabel} ${typeLabel}: trigger $${variables.stopPrice}${variables.limitPrice ? ` limit $${variables.limitPrice}` : ''} (${variables.amount} ${variables.symbol.replace('-USD', '')})`, { variant: 'success' });
    },
    onError: (error: Error) => {
      console.error('Failed to create stop order:', error);
      notify('ORDER', 'Stop Order Failed', `Stop order failed: ${error.message}`, { variant: 'error' });
    },
  });
}

/**
 * Hook to set leverage for a trading pair
 */
export function useSetLeverage() {
  const wallet = useWallet();
  const queryClient = useQueryClient();
  const { exchangeType, exchangeConfig } = useExchangeContext();
  const token = useAuthStore(s => s.token);

  return useMutation({
    mutationFn: async (params: SetLeverageParams) => {
      const clientSigned = isClientSigned(exchangeConfig.signingScheme);

      let account: string;
      let signature: string | undefined;
      let timestamp: number | undefined;

      if (clientSigned) {
        if (!wallet.connected || !wallet.publicKey) {
          throw new Error('Wallet not connected');
        }
        account = wallet.publicKey.toBase58();
        const symbol = params.symbol.replace('-USD', '');

        const signed = await createSignedUpdateLeverage(wallet, {
          symbol,
          leverage: params.leverage.toString(),
        });
        signature = signed.signature;
        timestamp = signed.timestamp;
      } else {
        const storeAddress = useAuthStore.getState().evmWalletAddress;
        if (!storeAddress) throw new Error('EVM wallet not connected');
        account = storeAddress;
      }

      const symbol = params.symbol.replace('-USD', '');

      const response = await fetch('/api/account/leverage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && !clientSigned ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          exchange: exchangeType,
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
      if (error.message.includes('InvalidLeverage')) {
        notify('ORDER', 'Leverage Failed', 'Cannot decrease leverage while position is open', { variant: 'error' });
      } else {
        notify('ORDER', 'Leverage Failed', `Failed to set leverage: ${error.message}`, { variant: 'error' });
      }
    },
  });
}

/**
 * Hook to set margin mode (cross/isolated) for a trading pair
 * Pacifica-only — Hyperliquid doesn't support margin mode switching
 */
export function useSetMarginMode() {
  const wallet = useWallet();
  const queryClient = useQueryClient();
  const { exchangeType, exchangeConfig } = useExchangeContext();
  const token = useAuthStore(s => s.token);

  return useMutation({
    mutationFn: async (params: { symbol: string; isIsolated: boolean }) => {
      const clientSigned = isClientSigned(exchangeConfig.signingScheme);

      let account: string;
      let signature: string | undefined;
      let timestamp: number | undefined;

      if (clientSigned) {
        if (!wallet.connected || !wallet.publicKey) {
          throw new Error('Wallet not connected');
        }
        account = wallet.publicKey.toBase58();
        const symbol = params.symbol.replace('-USD', '');

        const signed = await createSignedUpdateMarginMode(wallet, {
          symbol,
          is_isolated: params.isIsolated,
        });
        signature = signed.signature;
        timestamp = signed.timestamp;
      } else {
        const storeAddress = useAuthStore.getState().evmWalletAddress;
        if (!storeAddress) throw new Error('EVM wallet not connected');
        account = storeAddress;
      }

      const symbol = params.symbol.replace('-USD', '');

      const response = await fetch('/api/account/margin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && !clientSigned ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          exchange: exchangeType,
          account,
          symbol,
          is_isolated: params.isIsolated,
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
      const mode = variables.isIsolated ? 'Isolated' : 'Cross';
      notify('ORDER', 'Margin Mode', `${symbol} set to ${mode} margin`, { variant: 'success' });
    },
    onError: (error: Error) => {
      console.error('Failed to set margin mode:', error);
      if (error.message.includes('open position') || error.message.includes('OpenPosition')) {
        notify('ORDER', 'Margin Mode Failed', 'Close position first to change margin mode', { variant: 'error' });
      } else {
        notify('ORDER', 'Margin Mode Failed', `Failed to set margin mode: ${error.message}`, { variant: 'error' });
      }
    },
  });
}

/**
 * Hook to edit an existing limit order (modify price and/or size)
 */
export function useEditOrder() {
  const wallet = useWallet();
  const queryClient = useQueryClient();
  const { exchangeType, exchangeConfig } = useExchangeContext();
  const token = useAuthStore(s => s.token);

  return useMutation({
    mutationFn: async (params: EditOrderParams) => {
      const clientSigned = isClientSigned(exchangeConfig.signingScheme);

      let account: string;
      let signature: string | undefined;
      let timestamp: number | undefined;

      if (clientSigned) {
        if (!wallet.connected || !wallet.publicKey) {
          throw new Error('Wallet not connected');
        }
        account = wallet.publicKey.toBase58();
        const symbol = params.symbol.replace('-USD', '');

        const signed = await createSignedEditOrder(wallet, {
          symbol,
          price: params.price,
          amount: params.amount,
          order_id: params.orderId,
        });
        signature = signed.signature;
        timestamp = signed.timestamp;
      } else {
        const storeAddress = useAuthStore.getState().evmWalletAddress;
        if (!storeAddress) throw new Error('EVM wallet not connected');
        account = storeAddress;
      }

      const symbol = params.symbol.replace('-USD', '');

      const response = await fetch('/api/orders/edit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && !clientSigned ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          exchange: exchangeType,
          account,
          symbol,
          price: params.price,
          amount: params.amount,
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

      notify('ORDER', 'Order Edited', `Order price updated to $${variables.price}`, { variant: 'success' });
    },
    onError: (error: Error) => {
      console.error('Failed to edit order:', error);
      notify('ORDER', 'Edit Failed', `Failed to edit order: ${error.message}`, { variant: 'error' });
    },
  });
}

// ─── Batch Orders Types ───

export interface BatchCreateAction {
  type: 'Create';
  data: {
    account: string;
    signature: string;
    timestamp: number;
    expiry_window: number;
    symbol: string;
    price: string;
    amount: string;
    side: 'bid' | 'ask';
    tif: string;
    reduce_only: boolean;
    builder_code?: string;
    client_order_id?: string;
  };
}

export interface BatchCancelAction {
  type: 'Cancel';
  data: {
    account: string;
    signature: string;
    timestamp: number;
    expiry_window: number;
    symbol: string;
    order_id: number;
  };
}

export type BatchAction = BatchCreateAction | BatchCancelAction;

interface BatchActionResult {
  success: boolean;
  order_id?: number;
  error?: string | null;
}

interface BatchOrdersResponse {
  results: BatchActionResult[];
}

/**
 * Hook to execute a batch of order actions atomically.
 * Pacifica-only (pre-signed actions).
 */
export function useBatchOrders() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { actions: BatchAction[] }) => {
      if (!params.actions.length) {
        throw new Error('Batch must contain at least one action');
      }
      if (params.actions.length > 10) {
        throw new Error('Batch cannot exceed 10 actions');
      }

      const response = await fetch('/api/orders/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actions: params.actions }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      return result.data as BatchOrdersResponse;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      queryClient.invalidateQueries({ queryKey: ['account'] });

      const successes = data.results.filter((r) => r.success).length;
      const failures = data.results.filter((r) => !r.success).length;

      if (failures === 0) {
        notify('ORDER', 'Batch Complete', `${successes} action${successes > 1 ? 's' : ''} executed`, { variant: 'success' });
      } else {
        notify('ORDER', 'Batch Partial', `${successes} succeeded, ${failures} failed`, { variant: 'warning' });
      }
    },
    onError: (error: Error) => {
      console.error('Failed to execute batch orders:', error);
      notify('ORDER', 'Batch Failed', `Batch failed: ${error.message}`, { variant: 'error' });
    },
  });
}

interface WithdrawParams {
  amount: string;
}

/**
 * Hook to withdraw funds
 * Exchange-aware: Pacifica uses Solana signing + backend proxy,
 * Hyperliquid uses EIP-712 client-side signing → direct POST to HL API.
 */
export function useWithdraw() {
  const wallet = useWallet();
  const queryClient = useQueryClient();
  const { exchangeType } = useExchangeContext();
  const wagmiConfig = useWagmiConfig();

  return useMutation({
    mutationFn: async (params: WithdrawParams) => {
      if (exchangeType === 'hyperliquid') {
        // Hyperliquid: EIP-712 signing with main EVM wallet → direct to HL API
        // Agent wallet CANNOT sign withdrawals — must use main wallet
        const { switchChain, getWalletClient } = await import('@wagmi/core');
        const { IS_HL_TESTNET, getHlChainId, buildWithdraw3TypedData, splitSignature, postHyperliquidExchange } = await import('@/lib/hyperliquid/transfers');

        const evmAddress = useAuthStore.getState().evmWalletAddress;
        if (!evmAddress) throw new Error('EVM wallet not connected');

        const requiredChainId = getHlChainId();

        // Switch wallet to the correct Arbitrum chain for signing
        // This will prompt the user in their wallet if they're on the wrong chain
        await switchChain(wagmiConfig, { chainId: requiredChainId });

        const client = await getWalletClient(wagmiConfig, { chainId: requiredChainId });

        // Build EIP-712 typed data
        const { domain, types, primaryType, message, nonce } = buildWithdraw3TypedData(
          params.amount,
          evmAddress,
        );

        // Sign with main wallet
        const signature = await client.signTypedData({
          domain,
          types,
          primaryType,
          message,
          account: evmAddress as `0x${string}`,
        });

        // Split signature for HL API format
        const sig = splitSignature(signature);

        // POST directly to HL exchange endpoint
        const result = await postHyperliquidExchange(
          {
            type: 'withdraw3',
            hyperliquidChain: IS_HL_TESTNET ? 'Testnet' : 'Mainnet',
            signatureChainId: `0x${requiredChainId.toString(16)}`,
            destination: evmAddress,
            amount: params.amount,
            time: nonce,
          },
          nonce,
          sig,
        );

        return result;
      }

      // Pacifica: Solana wallet signing → backend proxy
      if (!wallet.connected || !wallet.publicKey) {
        throw new Error('Wallet not connected');
      }

      const account = wallet.publicKey.toBase58();

      const { signature, timestamp } = await createSignedWithdraw(wallet, {
        amount: params.amount,
      });

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
      queryClient.invalidateQueries({ queryKey: ['account'] });
      queryClient.invalidateQueries({ queryKey: ['pacifica-account'] });
      if (exchangeType === 'hyperliquid') {
        const hlApp = IS_HL_TESTNET ? 'https://app.hyperliquid-testnet.xyz' : 'https://app.hyperliquid.xyz';
        toast.success(`Withdrawal of $${variables.amount} USDC submitted. ~5 min to arrive on Arbitrum.`, {
          duration: 8000,
          action: {
            label: 'View on Hyperliquid',
            onClick: () => window.open(hlApp, '_blank'),
          },
        });
      } else {
        notify('ORDER', 'Withdrawal Requested', `Withdrawal of $${variables.amount} requested`, { variant: 'success' });
      }
    },
    onError: (error: Error) => {
      console.error('Failed to withdraw:', error);
      notify('ORDER', 'Withdrawal Failed', `Failed to withdraw: ${error.message}`, { variant: 'error' });
    },
  });
}

// ─────────────────────────────────────────────────────────────
// Deposit Hook (Hyperliquid only — Pacifica uses external link)
// ─────────────────────────────────────────────────────────────

export type DepositStep = 'idle' | 'switching' | 'approving' | 'depositing' | 'confirming' | 'done';

interface DepositParams {
  amount: string;
}

/**
 * Hook for in-app Hyperliquid deposits via Arbitrum bridge.
 * Flow: switch chain → approve USDC → deposit to bridge → confirm.
 */
export function useDeposit() {
  const queryClient = useQueryClient();
  const wagmiConfig = useWagmiConfig();

  return useMutation({
    mutationFn: async (params: DepositParams) => {
      const { readContract, writeContract, waitForTransactionReceipt, switchChain } = await import('@wagmi/core');
      const { getHlContracts, ERC20_APPROVE_ABI, BRIDGE_DEPOSIT_ABI, parseUsdcAmount } = await import('@/lib/hyperliquid/transfers');

      const evmAddress = useAuthStore.getState().evmWalletAddress;
      if (!evmAddress) throw new Error('EVM wallet not connected');

      const contracts = getHlContracts();
      const amountRaw = parseUsdcAmount(params.amount);

      // Step 1: Ensure on correct Arbitrum chain
      try {
        await switchChain(wagmiConfig, { chainId: contracts.chainId });
      } catch {
        // Already on correct chain, or user rejected — subsequent calls will throw if wrong chain
      }

      // Step 2: Check USDC allowance
      const allowance = await readContract(wagmiConfig, {
        address: contracts.usdc,
        abi: ERC20_APPROVE_ABI,
        functionName: 'allowance',
        args: [evmAddress as `0x${string}`, contracts.bridge],
      }) as bigint;

      // Step 3: Approve if needed
      if (allowance < amountRaw) {
        const approveTxHash = await writeContract(wagmiConfig, {
          address: contracts.usdc,
          abi: ERC20_APPROVE_ABI,
          functionName: 'approve',
          args: [contracts.bridge, amountRaw],
        });

        await waitForTransactionReceipt(wagmiConfig, { hash: approveTxHash });
      }

      // Step 4: Deposit to bridge
      const depositTxHash = await writeContract(wagmiConfig, {
        address: contracts.bridge,
        abi: BRIDGE_DEPOSIT_ABI,
        functionName: 'sendUsd',
        args: [evmAddress as `0x${string}`, amountRaw],
      });

      // Step 5: Wait for confirmation
      const receipt = await waitForTransactionReceipt(wagmiConfig, { hash: depositTxHash });

      return { txHash: depositTxHash, receipt };
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['account'] });
      // Show toast with explorer link
      const explorerBase = IS_HL_TESTNET ? 'https://sepolia.arbiscan.io' : 'https://arbiscan.io';
      const txUrl = `${explorerBase}/tx/${data.txHash}`;
      toast.success(`$${variables.amount} USDC deposited. Funds arrive in ~1 minute.`, {
        duration: 8000,
        action: {
          label: 'View on Arbiscan',
          onClick: () => window.open(txUrl, '_blank'),
        },
      });
    },
    onError: (error: Error) => {
      console.error('Failed to deposit:', error);
      if (error.message.includes('User rejected') || error.message.includes('rejected')) {
        notify('ORDER', 'Deposit Cancelled', 'Transaction rejected by wallet', { variant: 'error' });
      } else {
        notify('ORDER', 'Deposit Failed', `Failed to deposit: ${error.message}`, { variant: 'error' });
      }
    },
  });
}
