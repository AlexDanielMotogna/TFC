/**
 * Hook to fetch positions opened during a fight (excluding pre-fight positions)
 */
'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/store';

export interface FightPosition {
  symbol: string;
  side: 'LONG' | 'SHORT';
  size: string;
  entryPrice: string;
  markPrice: string;
  leverage: string;
  margin: string;
  unrealizedPnl: string;
  unrealizedPnlPercent: string;
  funding: string;
  liqPrice: string;
  isFightPosition: boolean;
  fightAmount: string;
  totalAmount: string;
  initialAmount: string;
}

interface FightPositionsResponse {
  success: boolean;
  data: FightPosition[];
}

export function useFightPositions(fightId: string | null | undefined) {
  const { token, isAuthenticated } = useAuthStore();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['fight-positions', fightId],
    queryFn: async (): Promise<FightPosition[]> => {
      if (!fightId) return [];

      const response = await fetch(`/api/fights/${fightId}/positions`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to fetch' }));
        throw new Error(error.message || 'Failed to fetch fight positions');
      }

      const result: FightPositionsResponse = await response.json();
      return result.data;
    },
    enabled: isAuthenticated && !!token && !!fightId,
    refetchInterval: 5000, // Poll every 5 seconds (increased from 2s to avoid 429 rate limits)
    staleTime: 2000, // Low staleTime so invalidateQueries triggers immediate refetch
    retry: 1,
    retryDelay: 1000,
  });

  return {
    positions: data || [],
    positionsCount: data?.length || 0,
    isLoading,
    error: error?.message || null,
    refetch,
  };
}
