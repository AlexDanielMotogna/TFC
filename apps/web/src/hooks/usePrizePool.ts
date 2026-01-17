'use client';

import { useState, useEffect, useCallback } from 'react';
import { useGlobalSocket } from './useGlobalSocket';

interface PrizeWinner {
  rank: number;
  userId: string;
  userHandle: string;
  avatarUrl: string | null;
  prizePercentage: number;
  prizeAmount: number;
  totalPnlUsdc: number;
  totalFights: number;
  wins: number;
  losses: number;
  avgPnlPercent: number;
}

interface PrizePoolData {
  weekStartDate: string;
  weekEndDate: string;
  totalFeesCollected: number;
  totalPrizePool: number;
  prizes: PrizeWinner[];
  timeRemaining: {
    days: number;
    hours: number;
    formatted: string;
  };
  isFinalized: boolean;
  isDistributed: boolean;
}

export function usePrizePool() {
  const [prizePool, setPrizePool] = useState<PrizePoolData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { on, isConnected } = useGlobalSocket();

  // Handle WebSocket updates
  const handlePrizePoolUpdate = useCallback((...args: unknown[]) => {
    const data = args[0] as PrizePoolData;
    if (data && typeof data.totalPrizePool === 'number') {
      setPrizePool(data);
    }
  }, []);

  // Subscribe to WebSocket updates
  useEffect(() => {
    if (!isConnected) return;

    const unsubscribe = on('platform:prizePool', handlePrizePoolUpdate);
    return () => {
      unsubscribe();
    };
  }, [on, isConnected, handlePrizePoolUpdate]);

  // Initial fetch
  useEffect(() => {
    const fetchPrizePool = async () => {
      try {
        const res = await fetch('/api/prize-pool');
        const data = await res.json();

        if (data.success) {
          setPrizePool(data.data);
        } else {
          setError('Failed to load prize pool');
        }
      } catch (err) {
        console.error('Failed to fetch prize pool:', err);
        setError('Failed to load prize pool');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPrizePool();

    // Refresh every 60 seconds
    const interval = setInterval(fetchPrizePool, 60000);
    return () => clearInterval(interval);
  }, []);

  return { prizePool, isLoading, error, isConnected };
}
