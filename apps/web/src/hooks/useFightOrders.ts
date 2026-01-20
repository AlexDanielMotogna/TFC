/**
 * Hook to fetch open orders placed during a fight
 * Transforms API response to match OpenOrder format for compatibility with trade page
 */
'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/store';
import type { OpenOrder } from '@/lib/api';

interface ApiFightOrder {
  order_id: number;
  client_order_id: string;
  symbol: string;
  side: string; // 'bid' | 'ask'
  price: string;
  initial_amount: string;
  amount: string;
  filled_amount: string;
  cancelled_amount: string;
  order_type: string;
  stop_price: string | null;
  reduce_only: boolean;
  created_at: number;
  updated_at: number;
  isFightOrder: boolean;
  fightId: string;
}

interface FightOrdersResponse {
  success: boolean;
  data: ApiFightOrder[];
}

/**
 * Transform API fight order to OpenOrder format for trade page compatibility
 */
function transformToOpenOrder(order: ApiFightOrder): OpenOrder {
  return {
    id: order.order_id.toString(),
    symbol: order.symbol,
    side: order.side === 'bid' ? 'LONG' : 'SHORT',
    type: order.order_type?.toUpperCase() || 'LIMIT',
    size: order.initial_amount || order.amount,
    price: order.price,
    filled: order.filled_amount || '0',
    status: 'open',
    reduceOnly: order.reduce_only || false,
    stopPrice: order.stop_price || null,
    createdAt: order.created_at,
  };
}

export function useFightOrders(fightId: string | null | undefined) {
  const { token, isAuthenticated } = useAuthStore();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['fight-orders', fightId],
    queryFn: async (): Promise<OpenOrder[]> => {
      if (!fightId) return [];

      const response = await fetch(`/api/fights/${fightId}/orders`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to fetch' }));
        throw new Error(error.message || 'Failed to fetch fight orders');
      }

      const result: FightOrdersResponse = await response.json();
      // Transform to OpenOrder format
      return (result.data || []).map(transformToOpenOrder);
    },
    enabled: isAuthenticated && !!token && !!fightId,
    refetchInterval: 10000, // Poll every 10 seconds
    staleTime: 5000,
    retry: 1,
    retryDelay: 2000,
  });

  return {
    orders: data || [],
    ordersCount: data?.length || 0,
    isLoading,
    error: error?.message || null,
    refetch,
  };
}
