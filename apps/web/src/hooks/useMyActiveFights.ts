/**
 * Hook to fetch active fights for the current user
 */
'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/store';

interface FightParticipant {
  userId: string;
  user: {
    id: string;
    handle: string;
    avatarUrl: string | null;
  };
  slot: 'A' | 'B';
}

interface Fight {
  id: string;
  status: 'WAITING' | 'LIVE' | 'FINISHED' | 'CANCELLED';
  durationMinutes: number;
  stakeUsdc: number;
  creator: {
    id: string;
    handle: string;
    avatarUrl: string | null;
  };
  participants: FightParticipant[];
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
}

interface MyActiveFightsResponse {
  success: boolean;
  data: Fight[];
}

export function useMyActiveFights() {
  const { token, isAuthenticated } = useAuthStore();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['my-active-fights'],
    queryFn: async (): Promise<Fight[]> => {
      const response = await fetch('/api/fights/my-active', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch active fights');
      }

      const result: MyActiveFightsResponse = await response.json();
      return result.data;
    },
    enabled: isAuthenticated && !!token,
    refetchInterval: 10000, // Refresh every 10 seconds
    staleTime: 5000,
  });

  return {
    activeFights: data || [],
    activeFightsCount: data?.length || 0,
    isLoading,
    error: error?.message || null,
    refetch,
  };
}
