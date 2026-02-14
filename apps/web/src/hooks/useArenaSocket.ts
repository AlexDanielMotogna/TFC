'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useStore } from '@/lib/store';
import type { Fight } from '@/lib/api';

const SOCKET_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3002';

interface ArenaEvent {
  type: 'fight:created' | 'fight:updated' | 'fight:started' | 'fight:ended' | 'fight:deleted';
  fight: Fight;
}

export function useArenaSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { addFight, updateFight, removeFight } = useStore();

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Arena] Socket connected');
      setIsConnected(true);
      // Subscribe to arena updates (all fights)
      socket.emit('arena:subscribe');
    });

    socket.on('disconnect', () => {
      console.log('[Arena] Socket disconnected');
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('[Arena] Socket connection error:', error.message);
      setIsConnected(false);
    });

    // Arena events
    socket.on('arena:fight_created', (fight: Fight) => {
      console.log('[Arena] New fight created:', fight.id);
      addFight(fight);
    });

    socket.on('arena:fight_updated', (fight: Fight) => {
      console.log('[Arena] Fight updated:', fight.id, fight.status);
      updateFight(fight);
    });

    socket.on('arena:fight_started', (fight: Fight) => {
      console.log('[Arena] Fight started:', fight.id);
      updateFight(fight);
      // Creator notification + video + redirect handled by useGlobalSocket.ts
    });

    socket.on('arena:fight_ended', (fight: Fight) => {
      console.log('[Arena] Fight ended:', fight.id);
      updateFight(fight);
    });

    socket.on('arena:fight_deleted', (data: { fightId: string }) => {
      console.log('[Arena] Fight deleted:', data.fightId);
      removeFight(data.fightId);
    });

    return () => {
      socket.emit('arena:unsubscribe');
      socket.disconnect();
      socketRef.current = null;
    };
  }, [addFight, updateFight, removeFight]);

  return {
    isConnected,
  };
}
