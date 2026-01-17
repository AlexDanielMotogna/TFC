'use client';

/**
 * Global WebSocket hook for persistent connection across pages
 * Manages arena events, fight updates, and real-time data
 */

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { create } from 'zustand';
import { useAuthStore, useStore } from '@/lib/store';
import type { Fight } from '@/lib/api';

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
  isConnected: boolean;
  activeFightsCount: number;
  lastUpdate: number;
  fights: Map<string, FightUpdate>;
  livePnl: Map<string, { participantA?: { pnlPercent: number }; participantB?: { pnlPercent: number }; timeRemainingMs: number }>;

  // Actions
  setConnected: (connected: boolean) => void;
  setActiveFightsCount: (count: number) => void;
  updateFight: (fight: FightUpdate) => void;
  removeFight: (fightId: string) => void;
  setFights: (fights: FightUpdate[]) => void;
  updateLivePnl: (data: ArenaPnlTick) => void;
}

export const useGlobalSocketStore = create<GlobalSocketState>((set, get) => ({
  isConnected: false,
  activeFightsCount: 0,
  lastUpdate: Date.now(),
  fights: new Map(),
  livePnl: new Map(),

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
      useGlobalSocketStore.getState().setConnected(true);
      globalSocket = socket;
      connectionPromise = null;

      // Subscribe to arena events
      socket.emit('arena:subscribe');
      resolve(socket);
    });

    socket.on('disconnect', (reason) => {
      console.log('[GlobalSocket] Disconnected:', reason);
      useGlobalSocketStore.getState().setConnected(false);
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
    });

    socket.on('arena:fight_updated', (fight: Fight) => {
      console.log('[GlobalSocket] Fight updated:', fight.id);
      useGlobalSocketStore.getState().updateFight(fight as FightUpdate);
      useStore.getState().updateFight(fight);
    });

    socket.on('arena:fight_started', (fight: Fight) => {
      console.log('[GlobalSocket] Fight started:', fight.id);
      useGlobalSocketStore.getState().updateFight({ ...fight, status: 'LIVE' } as FightUpdate);
      useStore.getState().updateFight({ ...fight, status: 'LIVE' });
    });

    socket.on('arena:fight_ended', (fight: Fight) => {
      console.log('[GlobalSocket] Fight ended:', fight.id);
      useGlobalSocketStore.getState().updateFight({ ...fight, status: 'FINISHED' } as FightUpdate);
      useStore.getState().updateFight({ ...fight, status: 'FINISHED' });
    });

    socket.on('arena:fight_deleted', (data: { fightId: string }) => {
      console.log('[GlobalSocket] Fight deleted:', data.fightId);
      useGlobalSocketStore.getState().removeFight(data.fightId);
      useStore.getState().removeFight(data.fightId);
    });

    // Live PnL updates for arena cards
    socket.on('arena:pnl_tick', (data: ArenaPnlTick) => {
      useGlobalSocketStore.getState().updateLivePnl(data);
    });
  });

  return connectionPromise;
}

/**
 * Hook for accessing global socket state and ensuring connection
 */
export function useGlobalSocket() {
  const { token } = useAuthStore();
  const socketRef = useRef<Socket | null>(null);

  const { isConnected, activeFightsCount, lastUpdate, fights, livePnl } = useGlobalSocketStore();

  useEffect(() => {
    // Establish connection
    getGlobalSocket(token || undefined).then(socket => {
      socketRef.current = socket;
    });

    // Cleanup on unmount only disconnects if no other components are using it
    return () => {
      // Don't disconnect - keep the socket alive for other components
    };
  }, [token]);

  // Method to emit events through the global socket
  const emit = useCallback((event: string, data?: unknown) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    }
  }, []);

  // Method to subscribe to specific events
  const on = useCallback((event: string, handler: (...args: unknown[]) => void) => {
    socketRef.current?.on(event, handler);
    return () => {
      socketRef.current?.off(event, handler);
    };
  }, []);

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
    socket: socketRef.current,
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
