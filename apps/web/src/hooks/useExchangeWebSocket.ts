'use client';

/**
 * Exchange-agnostic WebSocket hook for real-time positions, orders, and trades.
 *
 * Uses the ExchangeWsAdapter abstraction — automatically connects to the
 * correct exchange based on ExchangeContext.
 *
 * Zustand store is exchange-agnostic: same Position/Order/Trade types
 * regardless of which exchange is active.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { create } from 'zustand';
import { useExchangeContext } from '@/contexts/ExchangeContext';
import { createWsAdapter } from '@/lib/ws/ws-factory';
import type { ExchangeWsAdapter, WsPosition, WsOrder, WsTrade } from '@/lib/ws/types';

// Re-export types for backward compatibility
export type Position = WsPosition;
export type Order = WsOrder;
export type Trade = WsTrade;

// ─────────────────────────────────────────────────────────────
// Zustand store for WebSocket state (exchange-agnostic)
// ─────────────────────────────────────────────────────────────

interface ExchangeWsState {
  isConnected: boolean;
  positions: WsPosition[];
  orders: WsOrder[];
  trades: WsTrade[];
  lastUpdate: number;

  setConnected: (connected: boolean) => void;
  setPositions: (positions: WsPosition[]) => void;
  setOrders: (orders: WsOrder[]) => void;
  addTrades: (trades: WsTrade[]) => void;
  clearAll: () => void;
}

export const useExchangeWsStore = create<ExchangeWsState>((set, get) => ({
  isConnected: false,
  positions: [],
  orders: [],
  trades: [],
  lastUpdate: Date.now(),

  setConnected: (connected) => set({ isConnected: connected }),

  setPositions: (positions) => set({ positions, lastUpdate: Date.now() }),

  setOrders: (orders) => set({ orders, lastUpdate: Date.now() }),

  addTrades: (newTrades) => {
    const currentTrades = get().trades;
    // Merge and deduplicate by history_id
    const tradeMap = new Map<number, WsTrade>();
    [...currentTrades, ...newTrades].forEach(t => tradeMap.set(t.history_id, t));
    const allTrades = Array.from(tradeMap.values())
      .sort((a, b) => b.created_at - a.created_at)
      .slice(0, 100);
    set({ trades: allTrades, lastUpdate: Date.now() });
  },

  clearAll: () => set({
    positions: [],
    orders: [],
    trades: [],
    lastUpdate: Date.now(),
  }),
}));

// Backward-compat alias
export const usePacificaWsStore = useExchangeWsStore;

// ─────────────────────────────────────────────────────────────
// Hook implementation
// ─────────────────────────────────────────────────────────────

export function useExchangeWebSocket() {
  const { exchangeType } = useExchangeContext();
  const { publicKey, connected: walletConnected } = useWallet();
  const adapterRef = useRef<ExchangeWsAdapter | null>(null);
  const currentExchangeRef = useRef(exchangeType);

  const {
    isConnected,
    positions,
    orders,
    trades,
    setConnected,
    setPositions,
    setOrders,
    addTrades,
    clearAll,
  } = useExchangeWsStore();

  // Create/switch adapter when exchange type changes
  useEffect(() => {
    // Disconnect old adapter if exchange changed
    if (adapterRef.current && currentExchangeRef.current !== exchangeType) {
      adapterRef.current.disconnect();
      adapterRef.current = null;
      clearAll();
    }

    currentExchangeRef.current = exchangeType;
    const adapter = createWsAdapter(exchangeType);
    adapterRef.current = adapter;

    // Connect with callbacks that feed into the Zustand store
    adapter.connect({
      onConnected: () => setConnected(true),
      onDisconnected: () => setConnected(false),
      onPositions: (pos) => setPositions(pos),
      onOrders: (ord) => setOrders(ord),
      onTrades: (trd) => addTrades(trd),
      onError: (err) => console.error(`[ExchangeWS:${exchangeType}] Error:`, err),
    });

    return () => {
      adapter.disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exchangeType]);

  // Subscribe/unsubscribe account when wallet connects/disconnects
  useEffect(() => {
    const adapter = adapterRef.current;
    if (!adapter) return;

    if (walletConnected && publicKey) {
      const account = publicKey.toBase58();
      adapter.subscribeAccount(account);
    } else {
      adapter.unsubscribeAccount();
      clearAll();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletConnected, publicKey?.toBase58()]);

  // Force refresh method
  const refresh = useCallback(() => {
    adapterRef.current?.refresh();
  }, []);

  const reconnect = useCallback(() => {
    const adapter = adapterRef.current;
    if (!adapter) return;
    adapter.disconnect();
    adapter.connect({
      onConnected: () => setConnected(true),
      onDisconnected: () => setConnected(false),
      onPositions: (pos) => setPositions(pos),
      onOrders: (ord) => setOrders(ord),
      onTrades: (trd) => addTrades(trd),
      onError: (err) => console.error(`[ExchangeWS] Error:`, err),
    });
    if (publicKey && walletConnected) {
      adapter.subscribeAccount(publicKey.toBase58());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicKey, walletConnected]);

  return {
    isConnected,
    positions,
    orders,
    trades,
    error: null as string | null,
    refresh,
    reconnect,
  };
}

// Backward-compat alias
export const usePacificaWebSocket = useExchangeWebSocket;
