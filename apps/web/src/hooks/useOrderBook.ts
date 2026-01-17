'use client';

import { useState, useEffect } from 'react';

const PACIFICA_WS_URL = 'wss://ws.pacifica.fi/ws';

export interface OrderBookLevel {
  price: number;
  size: number;
  orders: number;
}

export interface OrderBookData {
  symbol: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  timestamp: number;
}

interface PacificaBookLevel {
  p: string; // price
  a: string; // amount
  n: number; // number of orders
}

interface PacificaBookMessage {
  channel: 'book';
  data: {
    s: string;           // symbol
    l: [PacificaBookLevel[], PacificaBookLevel[]]; // [bids, asks]
    t: number;           // timestamp
  };
}

// Map our symbol format (BTC-USD) to Pacifica format (BTC)
const symbolToPacifica = (symbol: string): string => {
  if (symbol === 'KPEPE-USD') return '1000PEPE';
  return symbol.replace('-USD', '');
};

// Valid agg_level values per docs: 1, 2, 5, 10, 100, 1000
export type AggLevel = 1 | 2 | 5 | 10 | 100 | 1000;

export function useOrderBook(symbol: string, aggLevel: AggLevel = 1) {
  const [orderBook, setOrderBook] = useState<OrderBookData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const pacificaSymbol = symbolToPacifica(symbol);

    let ws: WebSocket | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let isCancelled = false;

    // Reset state for new symbol/aggLevel
    setOrderBook(null);
    setIsLoading(true);
    setIsConnected(false);
    setError(null);

    const connectWebSocket = () => {
      if (isCancelled) return;

      try {
        ws = new WebSocket(PACIFICA_WS_URL);

        ws.onopen = () => {
          if (isCancelled) {
            ws?.close();
            return;
          }

          setIsConnected(true);
          setError(null);

          // Subscribe to orderbook stream with aggregation level
          // Per docs: agg_level is a multiplier of tick_size
          ws?.send(JSON.stringify({
            method: 'subscribe',
            params: {
              source: 'book',
              symbol: pacificaSymbol,
              agg_level: aggLevel
            }
          }));
        };

        ws.onmessage = (event) => {
          if (isCancelled) return;

          try {
            const message: PacificaBookMessage = JSON.parse(event.data);

            if (message.channel === 'book' && message.data) {
              // Verify the message is for the correct symbol
              if (message.data.s !== pacificaSymbol) return;

              const [bidsRaw, asksRaw] = message.data.l;

              const bids: OrderBookLevel[] = bidsRaw.map((level) => ({
                price: parseFloat(level.p),
                size: parseFloat(level.a),
                orders: level.n,
              }));

              const asks: OrderBookLevel[] = asksRaw.map((level) => ({
                price: parseFloat(level.p),
                size: parseFloat(level.a),
                orders: level.n,
              }));

              setOrderBook({
                symbol: symbol,
                bids,
                asks,
                timestamp: message.data.t,
              });
              setIsLoading(false);
            }
          } catch (err) {
            // Silently ignore parse errors
          }
        };

        ws.onerror = () => {
          if (!isCancelled) {
            setError('Connection error');
            setIsConnected(false);
          }
        };

        ws.onclose = () => {
          if (!isCancelled) {
            setIsConnected(false);
            // Reconnect after 3 seconds
            reconnectTimeout = setTimeout(() => {
              if (!isCancelled) {
                connectWebSocket();
              }
            }, 3000);
          }
        };
      } catch (err) {
        if (!isCancelled) {
          setError('Failed to connect');
          setIsLoading(false);
        }
      }
    };

    connectWebSocket();

    return () => {
      isCancelled = true;
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (ws) {
        // Unsubscribe before closing per docs
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            method: 'unsubscribe',
            params: {
              source: 'book',
              symbol: pacificaSymbol,
              agg_level: aggLevel
            }
          }));
        }
        ws.close();
      }
    };
  }, [symbol, aggLevel]);

  return {
    orderBook,
    isConnected,
    isLoading,
    error,
  };
}
