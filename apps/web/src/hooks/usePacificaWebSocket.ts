'use client';

/**
 * Pacifica WebSocket hook for real-time positions, orders, and trades
 * Connects directly to Pacifica's WebSocket API for live updates
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { create } from 'zustand';
import { useQueryClient } from '@tanstack/react-query';

const PACIFICA_WS_URL = process.env.NEXT_PUBLIC_PACIFICA_WS_URL || 'wss://ws.pacifica.fi/ws';
const PING_INTERVAL = 30000; // 30 seconds
const RECONNECT_DELAY = 3000; // 3 seconds

// ─────────────────────────────────────────────────────────────
// Types for Pacifica WebSocket messages
// ─────────────────────────────────────────────────────────────

interface PacificaPositionWs {
  s: string;      // symbol
  d: string;      // side (bid/ask)
  a: string;      // amount
  p: string;      // entry price
  m: string;      // margin
  f: string;      // funding
  i: boolean;     // isolated
  l: string | null; // liquidation price
  t: number;      // timestamp
  li: number;     // nonce
}

interface PacificaOrderWs {
  i: number;      // order_id
  I: string | null; // client_order_id
  s: string;      // symbol
  d: string;      // side (bid/ask)
  p: string;      // price
  a: string;      // amount
  f: string;      // filled_amount
  c: string;      // cancelled_amount
  t: number;      // timestamp
  st: string | null; // stop_type
  ot: string;     // order_type
  sp: string | null; // stop_price
  ro: boolean;    // reduce_only
  li: number;     // nonce
}

interface PacificaTradeWs {
  h: number;      // history_id
  i: number;      // order_id
  I: string | null; // client_order_id
  u: string;      // account
  s: string;      // symbol
  p: string;      // price
  o: string;      // entry_price
  a: string;      // amount
  te: string;     // trade_effect (fulfill_maker/fulfill_taker)
  ts: string;     // trade_side (close_long, open_short, etc.)
  tc: string;     // trade_cause (normal, market_liquidation, etc.)
  f: string;      // fee
  n: string;      // pnl
  t: number;      // timestamp
  li: number;     // nonce
}

// Normalized types for application use
export interface Position {
  symbol: string;
  side: 'bid' | 'ask';
  amount: string;
  entry_price: string;
  margin: string;
  funding: string;
  isolated: boolean;
  liq_price: string | null;
  updated_at: number;
}

export interface Order {
  order_id: number;
  client_order_id: string | null;
  symbol: string;
  side: 'bid' | 'ask';
  price: string;
  initial_amount: string;
  filled_amount: string;
  cancelled_amount: string;
  order_type: string;
  stop_price: string | null;
  stop_type: string | null;
  reduce_only: boolean;
  created_at: number;
}

export interface Trade {
  history_id: number;
  order_id: number;
  client_order_id: string | null;
  symbol: string;
  price: string;
  entry_price: string;
  amount: string;
  side: string;
  fee: string;
  pnl: string;
  created_at: number;
}

// ─────────────────────────────────────────────────────────────
// Zustand store for Pacifica WebSocket state
// ─────────────────────────────────────────────────────────────

interface PacificaWsState {
  isConnected: boolean;
  positions: Position[];
  orders: Order[];
  trades: Trade[];
  lastUpdate: number;

  setConnected: (connected: boolean) => void;
  setPositions: (positions: Position[]) => void;
  updatePositions: (positions: PacificaPositionWs[]) => void;
  setOrders: (orders: Order[]) => void;
  updateOrders: (orders: PacificaOrderWs[]) => void;
  addTrades: (trades: PacificaTradeWs[]) => void;
  clearAll: () => void;
}

export const usePacificaWsStore = create<PacificaWsState>((set, get) => ({
  isConnected: false,
  positions: [],
  orders: [],
  trades: [],
  lastUpdate: Date.now(),

  setConnected: (connected) => set({ isConnected: connected }),

  setPositions: (positions) => set({ positions, lastUpdate: Date.now() }),

  updatePositions: (wsPositions) => {
    const normalized = wsPositions.map(normalizePosition);
    set({ positions: normalized, lastUpdate: Date.now() });
  },

  setOrders: (orders) => set({ orders, lastUpdate: Date.now() }),

  updateOrders: (wsOrders) => {
    // Filter out empty/cancelled orders (amount = filled + cancelled)
    const normalized = wsOrders
      .filter(o => {
        const remaining = parseFloat(o.a) - parseFloat(o.f) - parseFloat(o.c);
        return remaining > 0;
      })
      .map(normalizeOrder);
    set({ orders: normalized, lastUpdate: Date.now() });
  },

  addTrades: (wsTrades) => {
    const currentTrades = get().trades;
    const newTrades = wsTrades.map(normalizeTrade);

    // Merge and deduplicate by history_id, keeping most recent
    const tradeMap = new Map<number, Trade>();
    [...currentTrades, ...newTrades].forEach(t => tradeMap.set(t.history_id, t));

    // Sort by timestamp descending and limit to 100
    const allTrades = Array.from(tradeMap.values())
      .sort((a, b) => b.created_at - a.created_at)
      .slice(0, 100);

    set({ trades: allTrades, lastUpdate: Date.now() });
  },

  clearAll: () => set({
    positions: [],
    orders: [],
    trades: [],
    lastUpdate: Date.now()
  }),
}));

// ─────────────────────────────────────────────────────────────
// Normalization functions
// ─────────────────────────────────────────────────────────────

function normalizePosition(p: PacificaPositionWs): Position {
  return {
    symbol: p.s,
    side: p.d as 'bid' | 'ask',
    amount: p.a,
    entry_price: p.p,
    margin: p.m,
    funding: p.f,
    isolated: p.i,
    liq_price: p.l,
    updated_at: p.t,
  };
}

function normalizeOrder(o: PacificaOrderWs): Order {
  return {
    order_id: o.i,
    client_order_id: o.I,
    symbol: o.s,
    side: o.d as 'bid' | 'ask',
    price: o.p,
    initial_amount: o.a,
    filled_amount: o.f,
    cancelled_amount: o.c,
    order_type: o.ot,
    stop_price: o.sp,
    stop_type: o.st,
    reduce_only: o.ro,
    created_at: o.t,
  };
}

function normalizeTrade(t: PacificaTradeWs): Trade {
  return {
    history_id: t.h,
    order_id: t.i,
    client_order_id: t.I,
    symbol: t.s,
    price: t.p,
    entry_price: t.o,
    amount: t.a,
    side: t.ts, // e.g., 'close_long', 'open_short'
    fee: t.f,
    pnl: t.n,
    created_at: t.t,
  };
}

// ─────────────────────────────────────────────────────────────
// Hook implementation
// ─────────────────────────────────────────────────────────────

export function usePacificaWebSocket() {
  const { publicKey, connected } = useWallet();
  const wsRef = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const {
    isConnected,
    positions,
    orders,
    trades,
    setConnected,
    updatePositions,
    updateOrders,
    addTrades,
    clearAll
  } = usePacificaWsStore();

  const cleanup = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnected(false);
  }, [setConnected]);

  const subscribe = useCallback((ws: WebSocket, account: string) => {
    // Subscribe to positions
    ws.send(JSON.stringify({
      method: 'subscribe',
      params: {
        source: 'account_positions',
        account,
      },
    }));

    // Subscribe to orders
    ws.send(JSON.stringify({
      method: 'subscribe',
      params: {
        source: 'account_orders',
        account,
      },
    }));

    // Subscribe to trades
    ws.send(JSON.stringify({
      method: 'subscribe',
      params: {
        source: 'account_trades',
        account,
      },
    }));
  }, []);

  const connect = useCallback(() => {
    if (!publicKey || !connected) {
      return;
    }

    const account = publicKey.toBase58();

    cleanup();

    try {
      console.log('[PacificaWS] Connecting to', PACIFICA_WS_URL);
      const ws = new WebSocket(PACIFICA_WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[PacificaWS] Connected');
        setConnected(true);
        setError(null);
        subscribe(ws, account);

        // Start ping interval
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ method: 'ping' }));
          }
        }, PING_INTERVAL);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          // Handle pong
          if (msg.channel === 'pong') {
            return;
          }

          // Handle positions update
          if (msg.channel === 'account_positions') {
            console.log('[PacificaWS] Positions update:', msg.data?.length || 0);
            updatePositions(msg.data || []);
            // Invalidate react-query cache for positions
            queryClient.invalidateQueries({ queryKey: ['positions'] });
          }

          // Handle orders update
          if (msg.channel === 'account_orders') {
            console.log('[PacificaWS] Orders update:', msg.data?.length || 0);
            updateOrders(msg.data || []);
            // Invalidate react-query cache for orders
            queryClient.invalidateQueries({ queryKey: ['orders'] });
          }

          // Handle trades update
          if (msg.channel === 'account_trades') {
            console.log('[PacificaWS] Trades update:', msg.data?.length || 0);
            addTrades(msg.data || []);
            // Invalidate react-query cache for trade history
            queryClient.invalidateQueries({ queryKey: ['trade-history'] });
          }

          // Handle errors
          if (msg.channel === 'error') {
            console.error('[PacificaWS] Error:', msg.data);
            setError(msg.data?.message || 'WebSocket error');
          }
        } catch (err) {
          console.error('[PacificaWS] Parse error:', err);
        }
      };

      ws.onerror = (event) => {
        console.error('[PacificaWS] WebSocket error:', event);
        setError('WebSocket connection error');
      };

      ws.onclose = (event) => {
        console.log('[PacificaWS] Disconnected:', event.code, event.reason);
        setConnected(false);

        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        // Attempt reconnect if not intentional close
        if (event.code !== 1000 && connected && publicKey) {
          console.log('[PacificaWS] Scheduling reconnect...');
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, RECONNECT_DELAY);
        }
      };
    } catch (err) {
      console.error('[PacificaWS] Connection error:', err);
      setError('Failed to connect to Pacifica WebSocket');
    }
  }, [publicKey, connected, cleanup, subscribe, setConnected, updatePositions, updateOrders, addTrades, queryClient]);

  // Connect when wallet connects
  useEffect(() => {
    if (connected && publicKey) {
      connect();
    } else {
      cleanup();
      clearAll();
    }

    return () => {
      cleanup();
    };
  }, [connected, publicKey, connect, cleanup, clearAll]);

  // Force refresh method
  const refresh = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN && publicKey) {
      subscribe(wsRef.current, publicKey.toBase58());
    }
  }, [publicKey, subscribe]);

  return {
    isConnected,
    positions,
    orders,
    trades,
    error,
    refresh,
    reconnect: connect,
  };
}
