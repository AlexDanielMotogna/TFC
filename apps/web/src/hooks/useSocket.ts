'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore, useFightStore } from '@/lib/store';

const SOCKET_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3002';

// WebSocket event names (matching @tfc/shared WS_EVENTS)
const WS_EVENTS = {
  PNL_TICK: 'PNL_TICK',
  FIGHT_STARTED: 'FIGHT_STARTED',
  FIGHT_FINISHED: 'FIGHT_FINISHED',
  TRADE_EVENT: 'TRADE_EVENT',
  LEAD_CHANGED: 'LEAD_CHANGED',
  FIGHT_STATE: 'FIGHT_STATE',
} as const;

interface ParticipantScore {
  userId: string;
  handle?: string;
  pnlPercent: number;
  scoreUsdc: number;
  tradesCount: number;
}

interface PnlTickPayload {
  fightId: string;
  timestamp: number;
  participantA: ParticipantScore | null;
  participantB: ParticipantScore | null;
  leader: string | null;
  timeRemainingMs: number;
}

interface FightFinishedPayload {
  fightId: string;
  winnerId: string | null;
  isDraw: boolean;
  finalScores: {
    participantA: ParticipantScore | null;
    participantB: ParticipantScore | null;
  };
}

interface FightStartedPayload {
  fightId: string;
  startedAt: Date;
  endsAt: Date;
  participantA: { userId: string; handle: string } | null;
  participantB: { userId: string; handle: string } | null;
}

interface TradeEventPayload {
  fightId: string;
  userId: string;
  symbol: string;
  side: string;
  amount: string;
  price: string;
  timestamp: number;
}

export function useSocket(fightId?: string) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { token } = useAuthStore();
  const { setCurrentFight, clearCurrentFight } = useFightStore();

  // Connect to socket
  useEffect(() => {
    if (!fightId) return;

    console.log('[FightSocket] Connecting to fight room:', fightId);

    const socket = io(SOCKET_URL, {
      auth: { token },
      query: { fightId },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[FightSocket] Connected');
      setIsConnected(true);
      // Join fight room (backend expects just fightId string, not object)
      socket.emit('join_fight', fightId);
    });

    socket.on('disconnect', (reason) => {
      console.log('[FightSocket] Disconnected:', reason);
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('[FightSocket] Connection error:', error.message);
      setIsConnected(false);
    });

    // Real-time PnL tick (emitted every second by fight-engine)
    socket.on(WS_EVENTS.PNL_TICK, (data: PnlTickPayload) => {
      console.log('[FightSocket] PNL_TICK:', data);

      if (data.participantA && data.participantB) {
        setCurrentFight({
          id: fightId,
          participantA: {
            userId: data.participantA.userId,
            handle: data.participantA.handle || '',
            pnlPercent: data.participantA.pnlPercent,
            scoreUsdc: data.participantA.scoreUsdc,
            tradesCount: data.participantA.tradesCount,
          },
          participantB: {
            userId: data.participantB.userId,
            handle: data.participantB.handle || '',
            pnlPercent: data.participantB.pnlPercent,
            scoreUsdc: data.participantB.scoreUsdc,
            tradesCount: data.participantB.tradesCount,
          },
          leader: data.leader,
          timeRemaining: data.timeRemainingMs,
        });
      }
    });

    // Fight started
    socket.on(WS_EVENTS.FIGHT_STARTED, (data: FightStartedPayload) => {
      console.log('[FightSocket] Fight started:', data);
    });

    // Fight ended
    socket.on(WS_EVENTS.FIGHT_FINISHED, (data: FightFinishedPayload) => {
      console.log('[FightSocket] Fight finished:', data);
      // Clear the current fight state - page will refetch final data
    });

    // Trade event (someone executed a trade)
    socket.on(WS_EVENTS.TRADE_EVENT, (data: TradeEventPayload) => {
      console.log('[FightSocket] Trade executed:', data);
    });

    // Lead changed
    socket.on(WS_EVENTS.LEAD_CHANGED, (data: { fightId: string; newLeader: string | null }) => {
      console.log('[FightSocket] Lead changed:', data);
    });

    // Legacy event name support (fight:score_update)
    socket.on('fight:score_update', (data: {
      participantA: ParticipantScore;
      participantB: ParticipantScore;
      timeRemaining: number;
    }) => {
      console.log('[FightSocket] Legacy score_update:', data);

      setCurrentFight({
        id: fightId,
        participantA: data.participantA as any,
        participantB: data.participantB as any,
        leader:
          data.participantA.pnlPercent === data.participantB.pnlPercent
            ? null
            : data.participantA.pnlPercent > data.participantB.pnlPercent
              ? data.participantA.userId
              : data.participantB.userId,
        timeRemaining: data.timeRemaining,
      });
    });

    return () => {
      console.log('[FightSocket] Disconnecting from fight room:', fightId);
      socket.emit('leave_fight', fightId);
      socket.disconnect();
      socketRef.current = null;
      clearCurrentFight();
    };
  }, [fightId, token, setCurrentFight, clearCurrentFight]);

  // Send trade to server
  const sendTrade = useCallback(
    (trade: { symbol: string; side: 'BUY' | 'SELL'; size: number; leverage: number }) => {
      if (socketRef.current && isConnected) {
        socketRef.current.emit('fight:trade', { fightId, ...trade });
      }
    },
    [fightId, isConnected]
  );

  return {
    isConnected,
    sendTrade,
  };
}
