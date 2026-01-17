/**
 * Hook to fetch trades executed during a fight
 */
'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/store';

export interface FightTrade {
  history_id: string;
  order_id: string | null;
  symbol: string;
  side: string; // open_long, open_short, close_long, close_short
  amount: string;
  price: string;
  fee: string;
  pnl: string;
  event_type: string;
  created_at: string;
  isFightTrade: boolean;
  fightId: string;
}

interface FightTradesResponse {
  success: boolean;
  data: FightTrade[];
}

export function useFightTrades(fightId: string | null | undefined) {
  const { token, isAuthenticated } = useAuthStore();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['fight-trades', fightId],
    queryFn: async (): Promise<FightTrade[]> => {
      if (!fightId) return [];

      const response = await fetch(`/api/fights/${fightId}/trades`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to fetch' }));
        throw new Error(error.message || 'Failed to fetch fight trades');
      }

      const result: FightTradesResponse = await response.json();
      return result.data;
    },
    enabled: isAuthenticated && !!token && !!fightId,
    refetchInterval: 10000, // Poll every 10 seconds (reduced to avoid rate limits)
    staleTime: 8000,
    retry: 1,
    retryDelay: 2000,
  });

  return {
    trades: data || [],
    tradesCount: data?.length || 0,
    isLoading,
    error: error?.message || null,
    refetch,
  };
}
