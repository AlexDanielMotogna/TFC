/**
 * Hook to manage active fight state with real-time updates
 */
'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useAuthStore, useFightStore } from '@/lib/store';
import { useSocket } from './useSocket';
import { api, type StakeInfo } from '@/lib/api';
import { notify } from '@/lib/notify';

interface FightParticipant {
  userId: string;
  user: {
    id: string;
    handle: string;
    avatarUrl: string | null;
  };
  slot: 'A' | 'B';
  finalPnlPercent: number | null;
  finalScoreUsdc: number | null;
  externalTradesDetected: boolean;
  externalTradeIds: string[];
}

interface Fight {
  id: string;
  status: 'WAITING' | 'LIVE' | 'FINISHED' | 'CANCELLED' | 'NO_CONTEST';
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
  winnerId: string | null;
  isDraw: boolean;
}

export function useFight() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const fightId = searchParams?.get('fight');
  const { user, token, _hasHydrated } = useAuthStore();
  const { currentFight } = useFightStore();

  const [fight, setFight] = useState<Fight | null>(null);
  // Start loading as true if we have a fightId, so the banner shows loading state immediately
  const [isLoading, setIsLoading] = useState(!!searchParams?.get('fight'));
  const [error, setError] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  // Track previous status to detect when fight ends
  const prevStatusRef = useRef<string | null>(null);
  // Track if we've already sent notifications for this fight (to prevent duplicates)
  const fightStartNotifiedRef = useRef<string | null>(null);
  const fightEndNotifiedRef = useRef<string | null>(null);

  // Connect to WebSocket for real-time updates
  const { isConnected } = useSocket(fightId || undefined);

  // Fetch fight data
  useEffect(() => {
    // Wait for auth store to hydrate before checking token
    if (!_hasHydrated) {
      return;
    }

    if (!fightId) {
      setFight(null);
      setIsLoading(false);
      return;
    }

    // If no token after hydration, user is not logged in - stop loading
    if (!token) {
      setFight(null);
      setIsLoading(false);
      return;
    }

    // Set loading immediately when fightId changes
    setIsLoading(true);

    const fetchFight = async () => {
      setError(null);

      try {
        const response = await fetch(`/api/fights/${fightId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        // Check if response is ok before parsing JSON
        if (!response.ok) {
          console.error(`[useFight] API error: ${response.status} ${response.statusText}`);
          setError(`Server error: ${response.status}`);
          return;
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          console.error('[useFight] Response is not JSON:', contentType);
          setError('Invalid server response');
          return;
        }

        const data = await response.json();

        if (data.success) {
          setFight(data.data);
        } else {
          setError(data.error || 'Failed to load fight');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load fight');
        console.error('Error fetching fight:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFight();

    // Refresh fight data every 5 seconds (fallback if WebSocket disconnects)
    const interval = setInterval(fetchFight, 5000);
    return () => clearInterval(interval);
  }, [fightId, token, _hasHydrated]);

  // Calculate time remaining
  useEffect(() => {
    if (!fight || fight.status !== 'LIVE' || !fight.startedAt) {
      setTimeRemaining(null);
      return;
    }

    const updateTimer = () => {
      const startTime = new Date(fight.startedAt!).getTime();
      const endTime = startTime + fight.durationMinutes * 60 * 1000;
      const now = Date.now();
      const remaining = Math.max(0, endTime - now);

      setTimeRemaining(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [fight]);

  // Redirect when fight ends (LIVE -> FINISHED/CANCELLED)
  // Only redirect if we're on the /trade page with a fight param
  useEffect(() => {
    if (!fight || !fightId || !pathname) return;

    const currentStatus = fight.status;
    const prevStatus = prevStatusRef.current;

    // Update ref for next comparison
    prevStatusRef.current = currentStatus;

    // Notify when fight starts (WAITING -> LIVE)
    if (prevStatus === 'WAITING' && currentStatus === 'LIVE' && fightStartNotifiedRef.current !== fightId) {
      fightStartNotifiedRef.current = fightId;
      notify('FIGHT', 'Fight Started!', `${fight.durationMinutes}m fight is now LIVE - Go trade!`, { variant: 'success' });
    }

    // If fight just ended (was LIVE, now is FINISHED or CANCELLED)
    // OR if user navigates to a fight that's already ended
    if (currentStatus === 'FINISHED' || currentStatus === 'CANCELLED') {
      // Notify only if the fight just ended (was LIVE) AND we haven't already notified for this fight
      if (prevStatus === 'LIVE' && fightEndNotifiedRef.current !== fightId) {
        // Mark this fight as notified to prevent duplicates
        fightEndNotifiedRef.current = fightId;

        if (currentStatus === 'FINISHED') {
          const isWinner = fight.winnerId === user?.id;
          const isDraw = fight.isDraw;
          if (isDraw) {
            notify('FIGHT', 'Fight Ended - Draw', 'The fight ended in a draw!', { variant: 'info' });
          } else if (isWinner) {
            notify('FIGHT', 'Victory!', 'Congratulations, you won the fight!', { variant: 'success' });
          } else {
            notify('FIGHT', 'Fight Ended', 'Better luck next time!', { variant: 'info' });
          }
        } else {
          notify('FIGHT', 'Fight Cancelled', 'The fight was cancelled', { variant: 'warning' });
        }
      }

      // Only auto-redirect from /trade page
      if (pathname === '/trade') {
        // Small delay to let user see the final state
        const timer = setTimeout(() => {
          // Redirect to fight results page
          router.push(`/fight/${fightId}`);
        }, prevStatus === 'LIVE' ? 2000 : 500); // Longer delay if we just watched it end

        return () => clearTimeout(timer);
      }
    }
  }, [fight, fightId, pathname, router, user?.id]);

  // Get opponent info
  const opponent = useMemo(() => {
    if (!fight?.participants || !user?.id) return null;
    return fight.participants.find(p => p.userId !== user.id) || null;
  }, [fight?.participants, user?.id]);

  const currentUserParticipant = useMemo(() => {
    if (!fight?.participants || !user?.id) return null;
    return fight.participants.find(p => p.userId === user.id) || null;
  }, [fight?.participants, user?.id]);

  // Get real-time PnL from store (updated via WebSocket)
  // myPnlPercent is the percentage (e.g., 0.095 for +9.5%)
  // myPnlUsdc is the USDC amount (e.g., $0.185)
  const { myPnlPercent, opponentPnlPercent, myPnlUsdc, opponentPnlUsdc, myTradesCount, opponentTradesCount } = useMemo(() => {
    if (!currentFight || !user?.id) {
      return { myPnlPercent: 0, opponentPnlPercent: 0, myPnlUsdc: 0, opponentPnlUsdc: 0, myTradesCount: 0, opponentTradesCount: 0 };
    }

    const { participantA, participantB } = currentFight;

    // Find which participant is the current user
    const isUserA = participantA?.userId === user.id;
    const isUserB = participantB?.userId === user.id;

    if (isUserA) {
      return {
        myPnlPercent: participantA?.pnlPercent || 0,
        opponentPnlPercent: participantB?.pnlPercent || 0,
        myPnlUsdc: participantA?.scoreUsdc || 0,
        opponentPnlUsdc: participantB?.scoreUsdc || 0,
        myTradesCount: participantA?.tradesCount || 0,
        opponentTradesCount: participantB?.tradesCount || 0,
      };
    } else if (isUserB) {
      return {
        myPnlPercent: participantB?.pnlPercent || 0,
        opponentPnlPercent: participantA?.pnlPercent || 0,
        myPnlUsdc: participantB?.scoreUsdc || 0,
        opponentPnlUsdc: participantA?.scoreUsdc || 0,
        myTradesCount: participantB?.tradesCount || 0,
        opponentTradesCount: participantA?.tradesCount || 0,
      };
    }

    return { myPnlPercent: 0, opponentPnlPercent: 0, myPnlUsdc: 0, opponentPnlUsdc: 0, myTradesCount: 0, opponentTradesCount: 0 };
  }, [currentFight, user?.id]);

  // Determine status: WINNING, LOSING, or DRAW
  const fightStatus = useMemo(() => {
    // Use small epsilon for float comparison
    const epsilon = 0.0001;
    if (Math.abs(myPnlPercent - opponentPnlPercent) < epsilon) {
      return 'DRAW';
    }
    return myPnlPercent > opponentPnlPercent ? 'WINNING' : 'LOSING';
  }, [myPnlPercent, opponentPnlPercent]);

  const isActive = fight?.status === 'LIVE';
  const isWinning = fightStatus === 'WINNING';
  const isDraw = fightStatus === 'DRAW';

  // Check if current user has external trades detected
  const externalTradesDetected = currentUserParticipant?.externalTradesDetected || false;

  // Use WebSocket data as source of truth for banner display
  // This ensures both clients see consistent PnL values calculated by the server
  // localPnl was causing inconsistencies because each client calculated differently
  const finalMyPnlPercent = myPnlPercent;
  const finalMyPnlUsdc = myPnlUsdc;

  // Fight status based on server-calculated PnL
  const finalFightStatus = (() => {
    const epsilon = 0.0001;
    if (Math.abs(finalMyPnlPercent - opponentPnlPercent) < epsilon) {
      return 'DRAW';
    }
    return finalMyPnlPercent > opponentPnlPercent ? 'WINNING' : 'LOSING';
  })();

  return {
    fight,
    fightId,
    isLoading,
    error,
    isActive,
    isConnected,
    opponent,
    currentUser: currentUserParticipant,
    // PnL as percentage (e.g., 9.5 for +9.5%)
    myPnl: finalMyPnlPercent,
    opponentPnl: opponentPnlPercent,
    // PnL in USDC (e.g., $0.185)
    myPnlUsdc: finalMyPnlUsdc,
    opponentPnlUsdc,
    myTradesCount,
    opponentTradesCount,
    isWinning: finalFightStatus === 'WINNING',
    isDraw: finalFightStatus === 'DRAW',
    fightStatus: finalFightStatus,
    timeRemaining,
    maxSize: fight?.stakeUsdc || 0,
    externalTradesDetected,
  };
}
