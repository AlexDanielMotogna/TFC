/**
 * Hook to fetch order history for a fight
 */
'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/store';

export interface FightOrderHistoryEntry {
  order_id: string | null;
  symbol: string;
  side: string; // 'bid' | 'ask'
  order_type: string;
  amount: string;
  filled_amount: string;
  initial_price: string | null;
  average_filled_price: string | null;
  stop_price: string | null;
  order_status: string; // 'open' | 'filled' | 'partially_filled' | 'cancelled'
  created_at: string;
  isFightOrder: boolean;
  fightId: string;
  actionType: string;
}

interface FightOrderHistoryResponse {
  success: boolean;
  data: FightOrderHistoryEntry[];
}

export function useFightOrderHistory(fightId: string | null | undefined) {
  const { token, isAuthenticated } = useAuthStore();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['fight-order-history', fightId],
    queryFn: async (): Promise<FightOrderHistoryEntry[]> => {
      if (!fightId) return [];

      const response = await fetch(`/api/fights/${fightId}/order-history`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to fetch' }));
        throw new Error(error.message || 'Failed to fetch fight order history');
      }

      const result: FightOrderHistoryResponse = await response.json();
      return result.data;
    },
    enabled: isAuthenticated && !!token && !!fightId,
    refetchInterval: 15000, // Poll every 15 seconds
    staleTime: 10000,
    retry: 1,
    retryDelay: 2000,
  });

  return {
    orderHistory: data || [],
    orderCount: data?.length || 0,
    isLoading,
    error: error?.message || null,
    refetch,
  };
}
