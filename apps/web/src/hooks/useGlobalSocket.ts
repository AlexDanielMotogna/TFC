'use client';

/**
 * Global WebSocket hook for persistent connection across pages
 * Manages arena events, fight updates, and real-time data
 */

import { useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { create } from 'zustand';
import { useAuthStore, useStore } from '@/lib/store';
import { queryClient } from '@/lib/queryClient';
import { toast } from 'sonner';
import type { Fight } from '@/lib/api';
import { useVideoStore } from '@/lib/stores/videoStore';
import type {
  AdminStatsPayload,
  AdminUserEventPayload,
  AdminFightUpdatePayload,
  AdminTradePayload,
  AdminJobPayload,
  AdminLeaderboardPayload,
  AdminPrizePoolPayload,
  AdminSystemHealthPayload,
} from '@tfc/shared';

const SOCKET_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3002';

// Types for arena events
interface FightUpdate {
  id: string;
  status: string;
  participantA?: { userId: string; handle: string; pnlPercent?: number };
  participantB?: { userId: string; handle: string; pnlPercent?: number };
  stakeUsdc: number;
  durationMinutes: number;
  timeRemainingMs?: number;
}

interface ArenaPnlTick {
  fights: Array<{
    fightId: string;
    participantA: { userId: string; pnlPercent: number } | null;
    participantB: { userId: string; pnlPercent: number } | null;
    leader: string | null;
    timeRemainingMs: number;
  }>;
  timestamp: number;
}

interface GlobalSocketState {
  socket: Socket | null;
  isConnected: boolean;
  activeFightsCount: number;
  lastUpdate: number;
  fights: Map<string, FightUpdate>;
  livePnl: Map<string, { participantA?: { pnlPercent: number }; participantB?: { pnlPercent: number }; timeRemainingMs: number }>;

  // Admin state
  isAdminSubscribed: boolean;
  adminStats: AdminStatsPayload | null;
  adminFights: AdminFightUpdatePayload[];
  adminTrades: AdminTradePayload[];
  adminUsers: AdminUserEventPayload[];
  adminJobs: AdminJobPayload[];
  adminLeaderboard: AdminLeaderboardPayload | null;
  adminPrizePool: AdminPrizePoolPayload | null;
  adminSystemHealth: AdminSystemHealthPayload | null;

  // Actions
  setSocket: (socket: Socket | null) => void;
  setConnected: (connected: boolean) => void;
  setActiveFightsCount: (count: number) => void;
  updateFight: (fight: FightUpdate) => void;
  removeFight: (fightId: string) => void;
  setFights: (fights: FightUpdate[]) => void;
  updateLivePnl: (data: ArenaPnlTick) => void;

  // Admin actions
  setAdminSubscribed: (subscribed: boolean) => void;
  setAdminStats: (stats: AdminStatsPayload) => void;
  addAdminFight: (fight: AdminFightUpdatePayload) => void;
  addAdminTrade: (trade: AdminTradePayload) => void;
  addAdminUser: (user: AdminUserEventPayload) => void;
  setAdminJob: (job: AdminJobPayload) => void;
  setAdminLeaderboard: (leaderboard: AdminLeaderboardPayload) => void;
  setAdminPrizePool: (prizePool: AdminPrizePoolPayload) => void;
  setAdminSystemHealth: (health: AdminSystemHealthPayload) => void;
  clearAdminState: () => void;
}

export const useGlobalSocketStore = create<GlobalSocketState>((set, get) => ({
  socket: null,
  isConnected: false,
  activeFightsCount: 0,
  lastUpdate: Date.now(),
  fights: new Map(),
  livePnl: new Map(),

  // Admin state
  isAdminSubscribed: false,
  adminStats: null,
  adminFights: [],
  adminTrades: [],
  adminUsers: [],
  adminJobs: [],
  adminLeaderboard: null,
  adminPrizePool: null,
  adminSystemHealth: null,

  setSocket: (socket) => set({ socket }),
  setConnected: (connected) => set({ isConnected: connected }),

  setActiveFightsCount: (count) => set({ activeFightsCount: count }),

  updateFight: (fight) => {
    const fights = new Map(get().fights);
    fights.set(fight.id, fight);
    const liveCount = Array.from(fights.values()).filter(f => f.status === 'LIVE').length;
    set({ fights, activeFightsCount: liveCount, lastUpdate: Date.now() });
  },

  removeFight: (fightId) => {
    const fights = new Map(get().fights);
    fights.delete(fightId);
    const livePnl = new Map(get().livePnl);
    livePnl.delete(fightId);
    const liveCount = Array.from(fights.values()).filter(f => f.status === 'LIVE').length;
    set({ fights, livePnl, activeFightsCount: liveCount, lastUpdate: Date.now() });
  },

  setFights: (fightsList) => {
    const fights = new Map<string, FightUpdate>();
    fightsList.forEach(f => fights.set(f.id, f));
    const liveCount = fightsList.filter(f => f.status === 'LIVE').length;
    set({ fights, activeFightsCount: liveCount, lastUpdate: Date.now() });
  },

  updateLivePnl: (data) => {
    const livePnl = new Map(get().livePnl);
    for (const fight of data.fights) {
      livePnl.set(fight.fightId, {
        participantA: fight.participantA ? { pnlPercent: fight.participantA.pnlPercent } : undefined,
        participantB: fight.participantB ? { pnlPercent: fight.participantB.pnlPercent } : undefined,
        timeRemainingMs: fight.timeRemainingMs,
      });
    }
    set({ livePnl, lastUpdate: Date.now() });
  },

  // Admin actions
  setAdminSubscribed: (subscribed) => set({ isAdminSubscribed: subscribed }),

  setAdminStats: (stats) => set({ adminStats: stats, lastUpdate: Date.now() }),

  addAdminFight: (fight) => {
    const adminFights = [fight, ...get().adminFights].slice(0, 50); // Keep last 50
    set({ adminFights, lastUpdate: Date.now() });
  },

  addAdminTrade: (trade) => {
    const adminTrades = [trade, ...get().adminTrades].slice(0, 100); // Keep last 100
    set({ adminTrades, lastUpdate: Date.now() });
  },

  addAdminUser: (user) => {
    const adminUsers = [user, ...get().adminUsers].slice(0, 50); // Keep last 50
    set({ adminUsers, lastUpdate: Date.now() });
  },

  setAdminJob: (job) => {
    const existing = get().adminJobs;
    const index = existing.findIndex(j => j.name === job.name);
    const adminJobs = index >= 0
      ? [...existing.slice(0, index), job, ...existing.slice(index + 1)]
      : [...existing, job];
    set({ adminJobs, lastUpdate: Date.now() });
  },

  setAdminLeaderboard: (leaderboard) => set({ adminLeaderboard: leaderboard, lastUpdate: Date.now() }),

  setAdminPrizePool: (prizePool) => set({ adminPrizePool: prizePool, lastUpdate: Date.now() }),

  setAdminSystemHealth: (health) => set({ adminSystemHealth: health, lastUpdate: Date.now() }),

  clearAdminState: () => set({
    isAdminSubscribed: false,
    adminStats: null,
    adminFights: [],
    adminTrades: [],
    adminUsers: [],
    adminJobs: [],
    adminLeaderboard: null,
    adminPrizePool: null,
    adminSystemHealth: null,
  }),
}));

// Singleton socket reference
let globalSocket: Socket | null = null;
let connectionPromise: Promise<Socket> | null = null;

function getGlobalSocket(token?: string): Promise<Socket> {
  if (globalSocket?.connected) {
    return Promise.resolve(globalSocket);
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = new Promise((resolve) => {
    console.log('[GlobalSocket] Creating new connection');

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    socket.on('connect', () => {
      console.log('[GlobalSocket] Connected');
      globalSocket = socket;
      connectionPromise = null;

      // Set socket in store first, then connected - this ensures socket is available
      // when components react to isConnected change
      useGlobalSocketStore.getState().setSocket(socket);
      useGlobalSocketStore.getState().setConnected(true);

      // Subscribe to arena events
      socket.emit('arena:subscribe');
      resolve(socket);
    });

    socket.on('disconnect', (reason) => {
      console.log('[GlobalSocket] Disconnected:', reason);
      useGlobalSocketStore.getState().setConnected(false);
      useGlobalSocketStore.getState().setSocket(null);
    });

    socket.on('connect_error', (error) => {
      console.error('[GlobalSocket] Connection error:', error.message);
      useGlobalSocketStore.getState().setConnected(false);
    });

    // Arena events - update both stores for real-time UI updates
    socket.on('arena:fight_created', (fight: Fight) => {
      console.log('[GlobalSocket] Fight created:', fight.id);
      useGlobalSocketStore.getState().updateFight(fight as FightUpdate);
      useStore.getState().addFight(fight);

      // Invalidate React Query cache to trigger UI update
      queryClient.invalidateQueries({ queryKey: ['fights', 'WAITING'] });
      queryClient.invalidateQueries({ queryKey: ['fights'] });
    });

    socket.on('arena:fight_updated', (fight: Fight) => {
      console.log('[GlobalSocket] Fight updated:', fight.id);
      useGlobalSocketStore.getState().updateFight(fight as FightUpdate);
      useStore.getState().updateFight(fight);

      // Invalidate React Query cache for the updated fight's status
      if (fight.status === 'WAITING') {
        queryClient.invalidateQueries({ queryKey: ['fights', 'WAITING'] });
      } else if (fight.status === 'LIVE') {
        queryClient.invalidateQueries({ queryKey: ['fights', 'LIVE'] });
      } else if (fight.status === 'FINISHED') {
        queryClient.invalidateQueries({ queryKey: ['fights', 'FINISHED'] });
      }
      queryClient.invalidateQueries({ queryKey: ['fights', 'my'] });
      queryClient.invalidateQueries({ queryKey: ['fights'] });
    });

    socket.on('arena:fight_started', (fight: Fight) => {
      console.log('[GlobalSocket] Fight started:', fight.id);
      useGlobalSocketStore.getState().updateFight({ ...fight, status: 'LIVE' } as FightUpdate);
      useStore.getState().updateFight({ ...fight, status: 'LIVE' });

      // Invalidate React Query cache to move fight from WAITING to LIVE
      queryClient.invalidateQueries({ queryKey: ['fights', 'WAITING'] });
      queryClient.invalidateQueries({ queryKey: ['fights', 'LIVE'] });
      queryClient.invalidateQueries({ queryKey: ['fights', 'my'] });
      queryClient.invalidateQueries({ queryKey: ['fights'] });

      // Refresh notifications (e.g. "Opponent Joined!" for the creator)
      queryClient.invalidateQueries({ queryKey: ['notifications'] });

      // Notify the creator that their fight has been accepted
      const currentUserId = useAuthStore.getState().user?.id;
      if (currentUserId && fight.creator?.id === currentUserId) {
        const opponent = fight.participants?.find(p => p.userId !== currentUserId);
        const opponentName = opponent?.user?.handle || 'Someone';
        toast.success(`${opponentName} joined your fight! Game on!`);

        // Play intro video and redirect creator to terminal
        useVideoStore.getState().startVideo();
        window.location.href = `/trade?fight=${fight.id}`;
      }
    });

    socket.on('arena:fight_ended', (fight: Fight) => {
      console.log('[GlobalSocket] Fight ended:', fight.id, 'status:', fight.status);
      // Preserve actual fight status (FINISHED, CANCELLED, or NO_CONTEST)
      useGlobalSocketStore.getState().updateFight({ ...fight } as FightUpdate);
      useStore.getState().updateFight({ ...fight });

      // Invalidate React Query cache to move fight from LIVE to FINISHED
      queryClient.invalidateQueries({ queryKey: ['fights', 'LIVE'] });
      queryClient.invalidateQueries({ queryKey: ['fights', 'FINISHED'] });
      queryClient.invalidateQueries({ queryKey: ['fights', 'my'] });
      queryClient.invalidateQueries({ queryKey: ['fights'] });

      // Refresh notifications (e.g. fight results)
      queryClient.invalidateQueries({ queryKey: ['notifications'] });

      // Toast participants that the fight has ended
      const currentUserId = useAuthStore.getState().user?.id;
      const isParticipant = fight.participants?.some(p => p.userId === currentUserId);
      if (currentUserId && isParticipant) {
        if (fight.status === 'NO_CONTEST') {
          toast('Fight declared No Contest');
        } else if (fight.isDraw) {
          toast('Fight ended in a draw!');
        } else if (fight.winnerId === currentUserId) {
          toast.success('You won the fight!');
        } else {
          toast('Fight ended. Better luck next time!');
        }
      }
    });

    socket.on('arena:fight_deleted', (data: { fightId: string }) => {
      console.log('[GlobalSocket] Fight deleted:', data.fightId);
      useGlobalSocketStore.getState().removeFight(data.fightId);
      useStore.getState().removeFight(data.fightId);

      // Invalidate React Query cache to remove deleted fight from UI
      queryClient.invalidateQueries({ queryKey: ['fights'] });
      queryClient.invalidateQueries({ queryKey: ['fights', 'my'] });
    });

    // Live PnL updates for arena cards
    socket.on('arena:pnl_tick', (data: ArenaPnlTick) => {
      useGlobalSocketStore.getState().updateLivePnl(data);
    });

    // Admin events
    socket.on('admin:subscribed', () => {
      console.log('[GlobalSocket] Admin subscribed');
      useGlobalSocketStore.getState().setAdminSubscribed(true);
    });

    socket.on('admin:error', (error: { code: string; message: string }) => {
      console.error('[GlobalSocket] Admin error:', error);
      useGlobalSocketStore.getState().setAdminSubscribed(false);
    });

    socket.on('admin:stats_update', (data: AdminStatsPayload) => {
      useGlobalSocketStore.getState().setAdminStats(data);
    });

    socket.on('admin:user_created', (data: AdminUserEventPayload) => {
      useGlobalSocketStore.getState().addAdminUser(data);
    });

    socket.on('admin:user_updated', (data: AdminUserEventPayload) => {
      useGlobalSocketStore.getState().addAdminUser(data);
    });

    socket.on('admin:fight_update', (data: AdminFightUpdatePayload) => {
      useGlobalSocketStore.getState().addAdminFight(data);
    });

    socket.on('admin:trade_new', (data: AdminTradePayload) => {
      useGlobalSocketStore.getState().addAdminTrade(data);
    });

    socket.on('admin:job_update', (data: AdminJobPayload) => {
      useGlobalSocketStore.getState().setAdminJob(data);
    });

    socket.on('admin:leaderboard', (data: AdminLeaderboardPayload) => {
      useGlobalSocketStore.getState().setAdminLeaderboard(data);
    });

    socket.on('admin:prize_pool', (data: AdminPrizePoolPayload) => {
      useGlobalSocketStore.getState().setAdminPrizePool(data);
    });

    socket.on('admin:system_health', (data: AdminSystemHealthPayload) => {
      useGlobalSocketStore.getState().setAdminSystemHealth(data);
    });
  });

  return connectionPromise;
}

/**
 * Hook for accessing global socket state and ensuring connection
 */
export function useGlobalSocket() {
  const { token } = useAuthStore();

  const { socket, isConnected, activeFightsCount, lastUpdate, fights, livePnl } = useGlobalSocketStore();

  useEffect(() => {
    // Establish connection (socket will be stored in Zustand when connected)
    getGlobalSocket(token || undefined);

    // Cleanup on unmount only disconnects if no other components are using it
    return () => {
      // Don't disconnect - keep the socket alive for other components
    };
  }, [token]);

  // Method to emit events through the global socket
  const emit = useCallback((event: string, data?: unknown) => {
    if (socket?.connected) {
      socket.emit(event, data);
    }
  }, [socket]);

  // Method to subscribe to specific events
  const on = useCallback((event: string, handler: (...args: unknown[]) => void) => {
    socket?.on(event, handler);
    return () => {
      socket?.off(event, handler);
    };
  }, [socket]);

  // Helper to get live PnL for a specific fight
  const getLivePnl = useCallback((fightId: string) => {
    return livePnl.get(fightId);
  }, [livePnl]);

  return {
    isConnected,
    activeFightsCount,
    lastUpdate,
    fights: Array.from(fights.values()),
    livePnl,
    getLivePnl,
    emit,
    on,
    socket,
  };
}

/**
 * Hook to join a specific fight room for real-time updates
 */
export function useFightRoom(fightId?: string) {
  const { socket, isConnected } = useGlobalSocket();

  useEffect(() => {
    if (!fightId || !socket || !isConnected) return;

    console.log('[FightRoom] Joining fight:', fightId);
    socket.emit('join_fight', fightId);

    return () => {
      console.log('[FightRoom] Leaving fight:', fightId);
      socket.emit('leave_fight', fightId);
    };
  }, [fightId, socket, isConnected]);
}

/**
 * Hook to subscribe to admin room for real-time admin updates
 * Only subscribes if user has ADMIN role
 */
export function useAdminSubscription() {
  const { socket, isConnected } = useGlobalSocket();
  const { user, token } = useAuthStore();
  const {
    isAdminSubscribed,
    adminStats,
    adminFights,
    adminTrades,
    adminUsers,
    adminJobs,
    adminLeaderboard,
    adminPrizePool,
    adminSystemHealth,
    clearAdminState,
  } = useGlobalSocketStore();

  useEffect(() => {
    if (!socket || !isConnected || !token || user?.role !== 'ADMIN') {
      return;
    }

    // Subscribe to admin room with token
    console.log('[AdminSocket] Subscribing to admin room');
    socket.emit('admin:subscribe', token);

    return () => {
      console.log('[AdminSocket] Unsubscribing from admin room');
      socket.emit('admin:unsubscribe');
      clearAdminState();
    };
  }, [socket, isConnected, token, user?.role, clearAdminState]);

  return {
    isConnected,
    isAdminSubscribed,
    adminStats,
    adminFights,
    adminTrades,
    adminUsers,
    adminJobs,
    adminLeaderboard,
    adminPrizePool,
    adminSystemHealth,
  };
}
