/**
 * Hook to fetch stake limit info for users in active fights
 * Combines initial REST API fetch with real-time websocket updates
 */
'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useWallet } from '@solana/wallet-adapter-react';
import { useSearchParams } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { api, type StakeInfo } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

const SOCKET_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3002';

interface StakeInfoPayload {
  fightId: string;
  userId: string;
  stake: number;
  currentExposure: number;
  maxExposureUsed: number;
  available: number;
}

/**
 * Hook to get stake limit information for the current user
 * Returns stake, current exposure, and available capital when in a fight
 *
 * If fightId is provided via URL params (?fight=...), uses that specific fight
 * Otherwise returns info for any active fight
 *
 * Receives real-time updates via websocket when trades are executed
 */
export function useStakeInfo() {
  const { publicKey, connected } = useWallet();
  const searchParams = useSearchParams();
  const fightId = searchParams?.get('fight') || undefined;
  const { token } = useAuthStore();
  const queryClient = useQueryClient();

  // State for real-time updates
  const [realtimeData, setRealtimeData] = useState<StakeInfoPayload | null>(null);

  // Initial fetch via REST API
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['stake-info', publicKey?.toBase58(), fightId],
    queryFn: async () => {
      if (!publicKey) {
        return {
          inFight: false,
          stake: null,
          currentExposure: null,
          available: null,
        } as StakeInfo;
      }

      const account = publicKey.toBase58();
      return api.getStakeInfo(account, fightId);
    },
    enabled: connected && !!publicKey,
    refetchInterval: 30000, // Reduced polling since we have websocket updates
    staleTime: 20000,
    retry: 1,
    retryDelay: 3000,
  });

  // Subscribe to websocket for real-time stake info updates
  useEffect(() => {
    if (!fightId || !connected) return;

    console.log('[StakeInfo] Connecting to websocket for stake updates');

    const socket: Socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      console.log('[StakeInfo] Connected to websocket');
      // Join fight room to receive stake updates
      socket.emit('join_fight', fightId);
    });

    socket.on('STAKE_INFO', (payload: StakeInfoPayload) => {
      console.log('[StakeInfo] Received real-time update:', payload);
      // Get current user ID from auth store
      const currentUserId = useAuthStore.getState().user?.id;
      // Only update if this is for the current fight AND current user
      // This prevents showing opponent's stake info
      if (payload.fightId === fightId && payload.userId === currentUserId) {
        setRealtimeData(payload);
        // Also invalidate the query cache so next refetch gets fresh data
        queryClient.invalidateQueries({ queryKey: ['stake-info'] });
      } else {
        console.log('[StakeInfo] Ignoring update for different user:', payload.userId, 'current:', currentUserId);
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('[StakeInfo] Disconnected:', reason);
    });

    return () => {
      console.log('[StakeInfo] Cleaning up websocket connection');
      socket.emit('leave_fight', fightId);
      socket.disconnect();
      setRealtimeData(null);
    };
  }, [fightId, connected, token, queryClient]);

  // Note: We no longer clear realtimeData when REST data updates
  // The websocket updates should take priority and persist until component unmounts
  // This was causing Bug: capital not updating after trades
  // Old behavior cleared realtimeData when REST refetch triggered, losing websocket updates

  // Merge REST data with real-time updates (real-time takes priority)
  const mergedData = realtimeData
    ? {
        inFight: true,
        fightId: realtimeData.fightId,
        stake: realtimeData.stake,
        currentExposure: realtimeData.currentExposure,
        maxExposureUsed: realtimeData.maxExposureUsed,
        available: realtimeData.available,
      }
    : data;

  return {
    stakeInfo: mergedData || null,
    inFight: mergedData?.inFight || false,
    fightId: mergedData?.fightId || null,
    stake: mergedData?.stake || null,
    currentExposure: mergedData?.currentExposure || null,
    maxExposureUsed: mergedData?.maxExposureUsed || null,
    available: mergedData?.available || null,
    isLoading,
    error: error?.message || null,
    refetch,
  };
}
