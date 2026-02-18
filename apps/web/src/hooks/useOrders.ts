/**
 * Trading hooks for placing and managing orders
 *
 * Exchange-agnostic: uses useSigner() to get the correct signer
 * for the active exchange (Pacifica, Hyperliquid, Lighter).
 *
 * For Pacifica: client-side signing (user signs each action with Solana wallet)
 * For Hyperliquid/Lighter: server-side signing (backend signs with delegated keys)
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSigner } from '@/hooks/useSigner';
import { useExchangeContext } from '@/contexts/ExchangeContext';
import { notify } from '@/lib/notify';
import type { NormalizedSide, NormalizedTif } from '@/lib/signing/types';

// ─── Side normalization (backward compat) ───
// Accept old Pacifica format ('bid'/'ask'), UI format ('LONG'/'SHORT'), and normalized ('BUY'/'SELL')
type AcceptedSide = NormalizedSide | 'bid' | 'ask' | 'LONG' | 'SHORT';

function normalizeSide(side: AcceptedSide): NormalizedSide {
  switch (side) {
    case 'BUY': case 'bid': case 'LONG': return 'BUY';
    case 'SELL': case 'ask': case 'SHORT': return 'SELL';
    default: return side;
  }
}

// ─── TP/SL param normalization ───
// Accept both old format { stop_price } and new format { stopPrice }
interface TpSlParam {
  stopPrice?: string;
  stop_price?: string;
  limitPrice?: string;
  limit_price?: string;
}

function normalizeTpSl(param: TpSlParam | null | undefined): { stopPrice: string; limitPrice?: string } | null | undefined {
  if (param === null) return null;
  if (param === undefined) return undefined;
  return {
    stopPrice: param.stopPrice || param.stop_price || '',
    limitPrice: param.limitPrice || param.limit_price,
  };
}

interface CreateMarketOrderParams {
  symbol: string;          // 'BTC-USD' or 'BTC' (both accepted)
  side: AcceptedSide;      // 'BUY'|'SELL' or 'bid'|'ask' or 'LONG'|'SHORT'
  amount: string;
  reduceOnly?: boolean;
  slippage_percent?: string;
  take_profit?: TpSlParam;
  stop_loss?: TpSlParam;
  fightId?: string;
  leverage?: number;
  isPreFightFlip?: boolean;
}

interface CreateLimitOrderParams {
  symbol: string;
  side: AcceptedSide;
  price: string;
  amount: string;
  reduceOnly?: boolean;
  tif?: NormalizedTif | string;
  take_profit?: TpSlParam;
  stop_loss?: TpSlParam;
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
  side: AcceptedSide;      // Position side: 'BUY'|'LONG' or 'SELL'|'SHORT'
  size: string;
  take_profit?: TpSlParam | null;
  stop_loss?: TpSlParam | null;
  fightId?: string;
}

interface SetLeverageParams {
  symbol: string;
  leverage: number;
}

interface CreateStopOrderParams {
  symbol: string;
  side: AcceptedSide;      // Position side
  stopPrice: string;
  amount: string;
  limitPrice?: string;
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
  const signer = useSigner();
  const { exchangeType } = useExchangeContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateMarketOrderParams) => {
      if (!signer) {
        throw new Error('Wallet not connected');
      }

      const side = normalizeSide(params.side);
      const takeProfit = normalizeTpSl(params.take_profit);
      const stopLoss = normalizeTpSl(params.stop_loss);

      const operation = await signer.signMarketOrder({
        symbol: params.symbol,
        side,
        amount: params.amount,
        slippagePercent: params.slippage_percent || '0.5',
        reduceOnly: params.reduceOnly,
        takeProfit: takeProfit || undefined,
        stopLoss: stopLoss || undefined,
      });

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exchange: exchangeType,
          account: operation.account,
          symbol: params.symbol,
          side,
          type: 'MARKET',
          amount: params.amount,
          reduce_only: params.reduceOnly || false,
          slippage_percent: params.slippage_percent || '0.5',
          take_profit: takeProfit ? { stop_price: takeProfit.stopPrice } : undefined,
          stop_loss: stopLoss ? { stop_price: stopLoss.stopPrice } : undefined,
          // Client-signed fields (Pacifica only)
          signature: operation.signature,
          timestamp: operation.timestamp,
          // Exchange-specific params (server-signed exchanges)
          ...operation.params,
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

      const avgPrice = data.avg_price || data.price || 'market';
      const symbolDisplay = variables.symbol.replace('-USD', '');
      notify('TRADE', 'Order Filled', `${variables.amount} ${symbolDisplay} filled at ${avgPrice}`, { variant: 'success' });
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
  const signer = useSigner();
  const { exchangeType } = useExchangeContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateLimitOrderParams) => {
      if (!signer) {
        throw new Error('Wallet not connected');
      }

      const side = normalizeSide(params.side);
      const tif = (params.tif || 'GTC') as NormalizedTif;
      const takeProfit = normalizeTpSl(params.take_profit);
      const stopLoss = normalizeTpSl(params.stop_loss);

      const operation = await signer.signLimitOrder({
        symbol: params.symbol,
        side,
        price: params.price,
        amount: params.amount,
        reduceOnly: params.reduceOnly,
        tif,
        takeProfit: takeProfit || undefined,
        stopLoss: stopLoss || undefined,
      });

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exchange: exchangeType,
          account: operation.account,
          symbol: params.symbol,
          side,
          type: 'LIMIT',
          price: params.price,
          amount: params.amount,
          reduce_only: params.reduceOnly || false,
          tif,
          take_profit: takeProfit ? { stop_price: takeProfit.stopPrice } : undefined,
          stop_loss: stopLoss ? { stop_price: stopLoss.stopPrice } : undefined,
          signature: operation.signature,
          timestamp: operation.timestamp,
          ...operation.params,
          fight_id: params.fightId,
          leverage: params.leverage,
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

      const symbolDisplay = variables.symbol.replace('-USD', '');
      notify('ORDER', 'Limit Order', `Limit order: ${variables.amount} ${symbolDisplay} at ${variables.price}`, { variant: 'success' });
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
  const signer = useSigner();
  const { exchangeType } = useExchangeContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CancelOrderParams) => {
      if (!signer) {
        throw new Error('Wallet not connected');
      }

      const operation = await signer.signCancelOrder({
        orderId: params.orderId,
        symbol: params.symbol,
      });

      const response = await fetch(
        `/api/orders/${params.orderId}?exchange=${exchangeType}&account=${operation.account}&symbol=${params.symbol}&signature=${operation.signature || ''}&timestamp=${operation.timestamp || ''}`,
        { method: 'DELETE' }
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
  const signer = useSigner();
  const { exchangeType } = useExchangeContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CancelOrderParams) => {
      if (!signer) {
        throw new Error('Wallet not connected');
      }

      const operation = await signer.signCancelOrder({
        orderId: params.orderId,
        symbol: params.symbol,
      });

      const response = await fetch('/api/orders/stop/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exchange: exchangeType,
          account: operation.account,
          symbol: params.symbol,
          order_id: params.orderId,
          signature: operation.signature,
          timestamp: operation.timestamp,
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
  const signer = useSigner();
  const { exchangeType } = useExchangeContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params?: CancelAllOrdersParams) => {
      if (!signer) {
        throw new Error('Wallet not connected');
      }

      const operation = await signer.signCancelAllOrders({
        symbol: params?.symbol,
      });

      const url = new URL('/api/orders', window.location.origin);
      url.searchParams.set('exchange', exchangeType);
      url.searchParams.set('account', operation.account);
      if (operation.signature) url.searchParams.set('signature', operation.signature);
      if (operation.timestamp) url.searchParams.set('timestamp', operation.timestamp.toString());
      if (params?.symbol) url.searchParams.set('symbol', params.symbol);

      const response = await fetch(url.toString(), { method: 'DELETE' });

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
        ? `All ${params.symbol.replace('-USD', '')} orders cancelled`
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
  const signer = useSigner();
  const { exchangeType } = useExchangeContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: SetPositionTpSlParams) => {
      if (!signer) {
        throw new Error('Wallet not connected');
      }

      const side = normalizeSide(params.side);
      const takeProfit = normalizeTpSl(params.take_profit);
      const stopLoss = normalizeTpSl(params.stop_loss);

      const operation = await signer.signSetTpSl({
        symbol: params.symbol,
        side,
        size: params.size,
        takeProfit,
        stopLoss,
      });

      const requestBody: Record<string, unknown> = {
        exchange: exchangeType,
        account: operation.account,
        signature: operation.signature,
        timestamp: operation.timestamp,
        ...operation.params,
        fight_id: params.fightId,
      };

      // Include size for partial TP/SL
      if (params.size) {
        requestBody.size = params.size;
      }

      // Include TP/SL in request body
      if (takeProfit === null) {
        requestBody.take_profit = null;
      } else if (takeProfit) {
        requestBody.take_profit = { stop_price: takeProfit.stopPrice };
        if (takeProfit.limitPrice) {
          (requestBody.take_profit as Record<string, string>).limit_price = takeProfit.limitPrice;
        }
      }

      if (stopLoss === null) {
        requestBody.stop_loss = null;
      } else if (stopLoss) {
        requestBody.stop_loss = { stop_price: stopLoss.stopPrice };
        if (stopLoss.limitPrice) {
          (requestBody.stop_loss as Record<string, string>).limit_price = stopLoss.limitPrice;
        }
      }

      const response = await fetch('/api/positions/tpsl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      const tp = normalizeTpSl(variables.take_profit);
      const sl = normalizeTpSl(variables.stop_loss);
      if (tp) {
        parts.push(`TP: $${tp.stopPrice}`);
      }
      if (sl) {
        parts.push(`SL: $${sl.stopPrice}`);
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
 *
 * For TP: uses limit order with reduce_only (price moving in your favor)
 * For SL: uses stop order (price moving against you)
 */
export function useCreateStopOrder() {
  const signer = useSigner();
  const { exchangeType } = useExchangeContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateStopOrderParams) => {
      if (!signer) {
        throw new Error('Wallet not connected');
      }

      const positionSide = normalizeSide(params.side);
      const closingSide: NormalizedSide = positionSide === 'BUY' ? 'SELL' : 'BUY';

      // For TAKE PROFIT: Use limit order with reduce_only
      if (params.type === 'TAKE_PROFIT') {
        const operation = await signer.signLimitOrder({
          symbol: params.symbol,
          side: closingSide,
          price: params.stopPrice,
          amount: params.amount,
          reduceOnly: true,
          tif: 'GTC',
        });

        const response = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            exchange: exchangeType,
            account: operation.account,
            symbol: params.symbol,
            side: closingSide,
            type: 'LIMIT',
            price: params.stopPrice,
            amount: params.amount,
            reduce_only: true,
            tif: 'GTC',
            signature: operation.signature,
            timestamp: operation.timestamp,
            ...operation.params,
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
      const operation = await signer.signStopOrder({
        symbol: params.symbol,
        side: positionSide,
        reduceOnly: true,
        stopPrice: params.stopPrice,
        amount: params.amount,
        limitPrice: params.limitPrice,
      });

      const response = await fetch('/api/orders/stop/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exchange: exchangeType,
          account: operation.account,
          signature: operation.signature,
          timestamp: operation.timestamp,
          ...operation.params,
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
      const symbolDisplay = variables.symbol.replace('-USD', '');
      notify('ORDER', `${typeLabel} Order Created`, `${symbolDisplay} ${typeLabel} (${orderType}): $${variables.stopPrice} (${variables.amount})`, { variant: 'success' });
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
  symbol: string;
  side: AcceptedSide;
  stopPrice: string;
  amount: string;
  limitPrice?: string;
  reduceOnly?: boolean;
  fightId?: string;
  leverage?: number;
}

export function useCreateStandaloneStopOrder() {
  const signer = useSigner();
  const { exchangeType } = useExchangeContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateStandaloneStopOrderParams) => {
      if (!signer) {
        throw new Error('Wallet not connected');
      }

      const side = normalizeSide(params.side);

      const operation = await signer.signStopOrder({
        symbol: params.symbol,
        side,
        reduceOnly: params.reduceOnly || false,
        stopPrice: params.stopPrice,
        amount: params.amount,
        limitPrice: params.limitPrice,
      });

      const response = await fetch('/api/orders/stop/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exchange: exchangeType,
          account: operation.account,
          signature: operation.signature,
          timestamp: operation.timestamp,
          ...operation.params,
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
      const normalizedSide = normalizeSide(variables.side);
      const sideLabel = normalizedSide === 'BUY' ? 'Long' : 'Short';
      const symbolDisplay = variables.symbol.replace('-USD', '');
      notify('ORDER', `${typeLabel} Order`, `${sideLabel} ${typeLabel}: trigger $${variables.stopPrice}${variables.limitPrice ? ` limit $${variables.limitPrice}` : ''} (${variables.amount} ${symbolDisplay})`, { variant: 'success' });
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
  const signer = useSigner();
  const { exchangeType } = useExchangeContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: SetLeverageParams) => {
      if (!signer) {
        throw new Error('Wallet not connected');
      }

      const operation = await signer.signSetLeverage({
        symbol: params.symbol,
        leverage: params.leverage,
      });

      const response = await fetch('/api/account/leverage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exchange: exchangeType,
          account: operation.account,
          signature: operation.signature,
          timestamp: operation.timestamp,
          ...operation.params,
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
      const symbolDisplay = variables.symbol.replace('-USD', '');
      notify('ORDER', 'Leverage Set', `Leverage set to ${variables.leverage}x for ${symbolDisplay}`, { variant: 'success' });
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
 */
export function useSetMarginMode() {
  const signer = useSigner();
  const { exchangeType } = useExchangeContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { symbol: string; isIsolated: boolean }) => {
      if (!signer) {
        throw new Error('Wallet not connected');
      }

      const operation = await signer.signSetMarginMode({
        symbol: params.symbol,
        isIsolated: params.isIsolated,
      });

      const response = await fetch('/api/account/margin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exchange: exchangeType,
          account: operation.account,
          signature: operation.signature,
          timestamp: operation.timestamp,
          ...operation.params,
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
      const symbolDisplay = variables.symbol.replace('-USD', '');
      const mode = variables.isIsolated ? 'Isolated' : 'Cross';
      notify('ORDER', 'Margin Mode', `${symbolDisplay} set to ${mode} margin`, { variant: 'success' });
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
  const signer = useSigner();
  const { exchangeType } = useExchangeContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: EditOrderParams) => {
      if (!signer) {
        throw new Error('Wallet not connected');
      }

      const operation = await signer.signEditOrder({
        orderId: params.orderId,
        symbol: params.symbol,
        price: params.price,
        amount: params.amount,
      });

      const response = await fetch('/api/orders/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exchange: exchangeType,
          account: operation.account,
          signature: operation.signature,
          timestamp: operation.timestamp,
          ...operation.params,
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
    exchange: string;
    account: string;
    signature?: string;
    timestamp?: number;
    expiry_window: number;
    symbol: string;
    price: string;
    amount: string;
    side: AcceptedSide;
    tif: string;
    reduce_only: boolean;
    builder_code?: string;
    client_order_id?: string;
  };
}

export interface BatchCancelAction {
  type: 'Cancel';
  data: {
    exchange: string;
    account: string;
    signature?: string;
    timestamp?: number;
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
 * Each action must be pre-signed by the caller using existing signing functions.
 */
export function useBatchOrders() {
  const { exchangeType, exchangeConfig } = useExchangeContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { actions: BatchAction[] }) => {
      if (!params.actions.length) {
        throw new Error('Batch must contain at least one action');
      }
      if (params.actions.length > exchangeConfig.maxBatchSize) {
        throw new Error(`Batch cannot exceed ${exchangeConfig.maxBatchSize} actions`);
      }

      const response = await fetch('/api/orders/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exchange: exchangeType, actions: params.actions }),
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
 * Hook to withdraw funds from exchange
 */
export function useWithdraw() {
  const signer = useSigner();
  const { exchangeType } = useExchangeContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: WithdrawParams) => {
      if (!signer) {
        throw new Error('Wallet not connected');
      }

      const operation = await signer.signWithdraw({
        amount: params.amount,
      });

      const response = await fetch('/api/account/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exchange: exchangeType,
          account: operation.account,
          amount: params.amount,
          signature: operation.signature,
          timestamp: operation.timestamp,
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
      notify('ORDER', 'Withdrawal Requested', `Withdrawal of $${variables.amount} requested`, { variant: 'success' });
    },
    onError: (error: Error) => {
      console.error('Failed to withdraw:', error);
      notify('ORDER', 'Withdrawal Failed', `Failed to withdraw: ${error.message}`, { variant: 'error' });
    },
  });
}
