'use client';

import { useCallback, useEffect } from 'react';
import { useStore, useAuthStore } from '@/lib/store';
import { api, type Fight } from '@/lib/api';
import { notify } from '@/lib/notify';

// Helper to get user-friendly error messages for join failures
function getJoinErrorMessage(errorMessage: string): { title: string; message: string } {
  if (errorMessage.includes('Pacifica connection required') || errorMessage.includes('Active Pacifica connection')) {
    return {
      title: 'Connect Pacifica First',
      message: 'Go to Trade page and connect your Pacifica account to join fights'
    };
  }
  if (errorMessage.includes('already in this fight')) {
    return {
      title: 'Cannot Join Own Fight',
      message: 'Wait for another player to accept your challenge'
    };
  }
  if (errorMessage.includes('Matchup limit exceeded') || errorMessage.includes('Cannot match with this opponent')) {
    return {
      title: 'Matchup Limit Reached',
      message: 'Max 3 fights per opponent in 24h. Try a different opponent!'
    };
  }
  if (errorMessage.includes('Fight is already full')) {
    return {
      title: 'Fight Unavailable',
      message: 'Someone else joined first. Try another fight!'
    };
  }
  return {
    title: 'Join Failed',
    message: errorMessage
  };
}

export function useFights() {
  const { fights, isLoading, error, setFights, setLoading, setError } = useStore();
  const { token } = useAuthStore();

  const fetchFights = useCallback(async (status?: string) => {
    setLoading(true);
    setError(null);

    try {
      const data = await api.getFights(status);
      setFights(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch fights');
    } finally {
      setLoading(false);
    }
  }, [setFights, setLoading, setError]);

  const createFight = useCallback(
    async (params: { durationMinutes: number; stakeUsdc: number }) => {
      if (!token) {
        throw new Error('Not authenticated');
      }

      setLoading(true);
      setError(null);

      try {
        const newFight = await api.createFight(token, params);
        // Add new fight to the list
        setFights([newFight, ...fights]);
        notify('FIGHT', 'Fight Created', `Created ${params.durationMinutes}m fight with $${params.stakeUsdc} stake`, { variant: 'success' });
        return newFight;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create fight';
        // Don't setError - show toast instead (error banner is for fetch errors only)
        notify('FIGHT', 'Fight Creation Failed', message, { variant: 'error' });
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [token, fights, setFights, setLoading]
  );

  const joinFight = useCallback(
    async (fightId: string) => {
      if (!token) {
        throw new Error('Not authenticated');
      }

      setLoading(true);
      setError(null);

      try {
        const updatedFight = await api.joinFight(token, fightId);
        // Update fight in the list
        setFights(
          fights.map((f) => (f.id === fightId ? updatedFight : f))
        );
        notify('FIGHT', 'Fight Joined', `Joined ${updatedFight.durationMinutes}m fight - Good luck!`, { variant: 'success' });
        return updatedFight;
      } catch (err) {
        const rawMessage = err instanceof Error ? err.message : 'Failed to join fight';
        const { title, message } = getJoinErrorMessage(rawMessage);
        // Don't setError - show toast instead (error banner is for fetch errors only)
        notify('FIGHT', title, message, { variant: 'error' });
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [token, fights, setFights, setLoading]
  );

  const cancelFight = useCallback(
    async (fightId: string) => {
      if (!token) {
        throw new Error('Not authenticated');
      }

      setLoading(true);
      setError(null);

      try {
        await api.cancelFight(token, fightId);
        // Remove fight from the list
        setFights(fights.filter((f) => f.id !== fightId));
        notify('FIGHT', 'Fight Cancelled', 'Your fight has been cancelled', { variant: 'success' });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to cancel fight';
        // Don't setError - show toast instead (error banner is for fetch errors only)
        notify('FIGHT', 'Cancel Failed', message, { variant: 'error' });
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [token, fights, setFights, setLoading]
  );

  // Fetch fights on mount
  useEffect(() => {
    fetchFights();
  }, [fetchFights]);

  // Filter helpers (with safeguard for undefined)
  const safeFights = fights || [];
  const waitingFights = safeFights.filter((f) => f.status === 'WAITING');
  const liveFights = safeFights.filter((f) => f.status === 'LIVE');
  const finishedFights = safeFights.filter((f) => f.status === 'FINISHED');

  return {
    fights,
    waitingFights,
    liveFights,
    finishedFights,
    isLoading,
    error,
    fetchFights,
    createFight,
    joinFight,
    cancelFight,
  };
}
