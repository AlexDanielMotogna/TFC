/**
 * Hook to fetch trades executed during a fight
 */
'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/store';

export interface FightTrade {
  id: string;
  history_id: string;
  order_id: string | null;
  participantUserId: string;
  symbol: string;
  side: string; // BUY, SELL
  amount: string;
  price: string;
  fee: string;
  pnl: string | null;
  leverage: number | null;
  executedAt: string; // ISO string
  created_at: number; // Unix timestamp (milliseconds) for UI compatibility
  notional: string;
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
    refetchInterval: 3000, // Poll every 3 seconds for faster updates
    staleTime: 1000, // Low staleTime so invalidateQueries triggers immediate refetch
    retry: 1,
    retryDelay: 500,
  });

  return {
    trades: data || [],
    tradesCount: data?.length || 0,
    isLoading,
    error: error?.message || null,
    refetch,
  };
}
