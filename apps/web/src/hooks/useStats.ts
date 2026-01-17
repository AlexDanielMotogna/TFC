'use client';

import { useState, useEffect, useCallback } from 'react';
import { useGlobalSocket } from './useGlobalSocket';

interface PlatformStats {
  tradingVolume: number;
  fightVolume: number;
  fightsCompleted: number;
  totalFees: number;
  activeUsers: number;
  totalTrades: number;
}

export function useStats() {
  const [stats, setStats] = useState<PlatformStats>({
    tradingVolume: 0,
    fightVolume: 0,
    fightsCompleted: 0,
    totalFees: 0,
    activeUsers: 0,
    totalTrades: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { on, isConnected } = useGlobalSocket();

  // Handle WebSocket updates
  const handleStatsUpdate = useCallback((...args: unknown[]) => {
    const data = args[0] as PlatformStats;
    if (data && typeof data.tradingVolume === 'number') {
      setStats(data);
    }
  }, []);

  // Subscribe to WebSocket updates
  useEffect(() => {
    if (!isConnected) return;

    const unsubscribe = on('platform:stats', handleStatsUpdate);
    return () => {
      unsubscribe();
    };
  }, [on, isConnected, handleStatsUpdate]);

  // Initial fetch
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/stats');
        const data = await res.json();

        if (data.success) {
          setStats(data.data);
        } else {
          setError('Failed to load stats');
        }
      } catch (err) {
        console.error('Failed to fetch stats:', err);
        setError('Failed to load stats');
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  return { stats, isLoading, error, isConnected };
}
