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
import { useAuthStore } from '@/lib/store';
import { createWsAdapter } from '@/lib/ws/ws-factory';
import type { ExchangeWsAdapter, ExchangeWsCallbacks, WsPosition, WsOrder, WsTrade, WsAccountLeverage } from '@/lib/ws/types';

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
  leverageMap: Record<string, number>; // symbol → account leverage (from WS)
  lastUpdate: number;

  setConnected: (connected: boolean) => void;
  setPositions: (positions: WsPosition[]) => void;
  setOrders: (orders: WsOrder[]) => void;
  addTrades: (trades: WsTrade[]) => void;
  updateLeverage: (data: WsAccountLeverage) => void;
  clearAll: () => void;
}

export const useExchangeWsStore = create<ExchangeWsState>((set, get) => ({
  isConnected: false,
  positions: [],
  orders: [],
  trades: [],
  leverageMap: {},
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

  updateLeverage: (data) => {
    const current = get().leverageMap;
    set({ leverageMap: { ...current, [data.symbol]: data.leverage }, lastUpdate: Date.now() });
  },

  clearAll: () => set({
    positions: [],
    orders: [],
    trades: [],
    leverageMap: {},
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
  const evmWalletAddress = useAuthStore((s) => s.evmWalletAddress);
  const adapterRef = useRef<ExchangeWsAdapter | null>(null);
  const callbacksRef = useRef<ExchangeWsCallbacks | null>(null);
  const currentExchangeRef = useRef(exchangeType);

  const {
    isConnected,
    positions,
    orders,
    trades,
    leverageMap,
    setConnected,
    setPositions,
    setOrders,
    addTrades,
    updateLeverage,
    clearAll,
  } = useExchangeWsStore();

  // Create/switch adapter when exchange type changes
  useEffect(() => {
    // Remove old callbacks if exchange changed
    if (adapterRef.current && currentExchangeRef.current !== exchangeType) {
      if (callbacksRef.current) {
        adapterRef.current.removeCallbacks(callbacksRef.current);
      }
      adapterRef.current = null;
      callbacksRef.current = null;
      clearAll();
    }

    currentExchangeRef.current = exchangeType;
    const adapter = createWsAdapter(exchangeType);
    adapterRef.current = adapter;

    // Connect with callbacks that feed into the Zustand store
    const callbacks: ExchangeWsCallbacks = {
      onConnected: () => setConnected(true),
      onDisconnected: () => setConnected(false),
      onPositions: (pos) => setPositions(pos),
      onOrders: (ord) => setOrders(ord),
      onTrades: (trd) => addTrades(trd),
      onAccountLeverage: (lev) => updateLeverage(lev),
      onError: (err) => console.error(`[ExchangeWS:${exchangeType}] Error:`, err),
    };
    callbacksRef.current = callbacks;

    adapter.connect(callbacks);

    return () => {
      // Only remove our callbacks — don't kill the shared connection
      adapter.removeCallbacks(callbacks);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exchangeType]);

  // Subscribe/unsubscribe account when wallet connects/disconnects
  // Uses Solana publicKey for Pacifica, EVM address for Hyperliquid
  useEffect(() => {
    const adapter = adapterRef.current;
    if (!adapter) return;

    let accountId: string | null = null;
    if (exchangeType === 'pacifica') {
      accountId = walletConnected && publicKey ? publicKey.toBase58() : null;
    } else if (exchangeType === 'hyperliquid') {
      accountId = evmWalletAddress || null;
    }

    if (accountId) {
      adapter.subscribeAccount(accountId);
    } else {
      adapter.unsubscribeAccount();
      clearAll();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletConnected, publicKey?.toBase58(), evmWalletAddress, exchangeType]);

  // Force refresh method
  const refresh = useCallback(() => {
    adapterRef.current?.refresh();
  }, []);

  const reconnect = useCallback(() => {
    const adapter = adapterRef.current;
    if (!adapter) return;
    // Full disconnect and reconnect — all hooks will re-register via their effects
    adapter.disconnect();
    const callbacks: ExchangeWsCallbacks = {
      onConnected: () => setConnected(true),
      onDisconnected: () => setConnected(false),
      onPositions: (pos) => setPositions(pos),
      onOrders: (ord) => setOrders(ord),
      onTrades: (trd) => addTrades(trd),
      onAccountLeverage: (lev) => updateLeverage(lev),
      onError: (err) => console.error(`[ExchangeWS] Error:`, err),
    };
    callbacksRef.current = callbacks;
    adapter.connect(callbacks);

    let accountId: string | null = null;
    if (exchangeType === 'pacifica') {
      accountId = publicKey && walletConnected ? publicKey.toBase58() : null;
    } else if (exchangeType === 'hyperliquid') {
      accountId = evmWalletAddress || null;
    }
    if (accountId) {
      adapter.subscribeAccount(accountId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicKey, walletConnected, evmWalletAddress, exchangeType]);

  return {
    isConnected,
    positions,
    orders,
    trades,
    leverageMap,
    error: null as string | null,
    refresh,
    reconnect,
  };
}

// Backward-compat alias
export const usePacificaWebSocket = useExchangeWebSocket;
