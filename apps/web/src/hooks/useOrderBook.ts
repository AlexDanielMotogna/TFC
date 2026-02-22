'use client';

/**
 * useOrderBook — Exchange-agnostic orderbook hook
 *
 * Uses the ExchangeWsAdapter for real-time orderbook data.
 * Follows the same pattern as usePrices.
 */

import { useState, useEffect, useRef } from 'react';
import { useExchangeContext } from '@/contexts/ExchangeContext';
import { createWsAdapter } from '@/lib/ws/ws-factory';
import type { ExchangeWsAdapter, ExchangeWsCallbacks, WsOrderbookSnapshot } from '@/lib/ws/types';

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

// Valid agg_level values - powers of 10 to match Pacifica
export type AggLevel = 1 | 10 | 100 | 1000 | 10000;

export function useOrderBook(symbol: string, aggLevel: AggLevel = 1) {
  const { exchangeType } = useExchangeContext();

  const [orderBook, setOrderBook] = useState<OrderBookData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const adapterRef = useRef<ExchangeWsAdapter | null>(null);
  const callbacksRef = useRef<ExchangeWsCallbacks | null>(null);
  const currentExchangeRef = useRef(exchangeType);
  const currentSymbolRef = useRef(symbol);
  const currentAggRef = useRef(aggLevel);

  useEffect(() => {
    // Remove old callbacks if exchange changed
    if (adapterRef.current && currentExchangeRef.current !== exchangeType) {
      if (callbacksRef.current) {
        adapterRef.current.unsubscribeOrderbook(currentSymbolRef.current);
        adapterRef.current.removeCallbacks(callbacksRef.current);
      }
      adapterRef.current = null;
      callbacksRef.current = null;
    }

    // Unsubscribe from previous symbol if changed on same adapter
    if (
      adapterRef.current &&
      callbacksRef.current &&
      (currentSymbolRef.current !== symbol || currentAggRef.current !== aggLevel)
    ) {
      adapterRef.current.unsubscribeOrderbook(currentSymbolRef.current);
    }

    currentExchangeRef.current = exchangeType;
    currentSymbolRef.current = symbol;
    currentAggRef.current = aggLevel;

    // Reset state
    setOrderBook(null);
    setIsLoading(true);
    setError(null);

    const adapter = createWsAdapter(exchangeType);
    adapterRef.current = adapter;
    let hasLoggedFirstSnapshot = false;
    console.log(`[useOrderBook] Creating WS adapter for exchange=${exchangeType}, symbol=${symbol}, aggLevel=${aggLevel}`);

    const callbacks: ExchangeWsCallbacks = {
      onConnected: () => {
        console.log(`[useOrderBook] WS connected (${exchangeType}), subscribing to orderbook: ${symbol}`);
        setIsConnected(true);
        setError(null);
        adapter.subscribeOrderbook(symbol, aggLevel);
      },
      onDisconnected: () => {
        console.log(`[useOrderBook] WS disconnected (${exchangeType})`);
        setIsConnected(false);
      },
      onOrderbook: (data: WsOrderbookSnapshot) => {
        if (data.symbol === symbol) {
          if (!hasLoggedFirstSnapshot) {
            console.log(`[useOrderBook] First orderbook snapshot from ${exchangeType}: ${symbol}, bids=${data.bids.length}, asks=${data.asks.length}, bestBid=${data.bids[0]?.price}, bestAsk=${data.asks[0]?.price}`);
            hasLoggedFirstSnapshot = true;
          }
          setOrderBook({
            symbol: data.symbol,
            bids: data.bids,
            asks: data.asks,
            timestamp: data.timestamp,
          });
          setIsLoading(false);
        }
      },
      onError: (err) => {
        console.error(`[useOrderBook] WS error (${exchangeType}):`, err);
        setError(err);
      },
    };
    callbacksRef.current = callbacks;

    adapter.connect(callbacks);

    // If already connected, subscribe immediately
    if (adapter.isConnected()) {
      setIsConnected(true);
      adapter.subscribeOrderbook(symbol, aggLevel);
    }

    return () => {
      adapter.unsubscribeOrderbook(symbol);
      adapter.removeCallbacks(callbacks);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, aggLevel, exchangeType]);

  return {
    orderBook,
    isConnected,
    isLoading,
    error,
  };
}
