'use client';

/**
 * useCandles — Exchange-agnostic candle/chart hook
 *
 * Historical: fetches from /api/chart/candles with exchange param
 * Real-time: uses ExchangeWsAdapter for live candle updates
 * Follows the same pattern as usePrices.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useExchangeContext } from '@/contexts/ExchangeContext';
import { createWsAdapter } from '@/lib/ws/ws-factory';
import type { ExchangeWsAdapter, ExchangeWsCallbacks, WsCandle } from '@/lib/ws/types';

// Chart API is served by Next.js on the same server (relative URL)
const CHART_API_BASE = '';

export interface CandleData {
  time: number;      // Unix timestamp in seconds (for lightweight-charts)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

type CandleInterval = '1m' | '3m' | '5m' | '15m' | '30m' | '1h' | '2h' | '4h' | '8h' | '12h' | '1d';

// Get interval in milliseconds for calculating historical range
const intervalToMs = (interval: CandleInterval): number => {
  const map: Record<CandleInterval, number> = {
    '1m': 60 * 1000,
    '3m': 3 * 60 * 1000,
    '5m': 5 * 60 * 1000,
    '15m': 15 * 60 * 1000,
    '30m': 30 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '2h': 2 * 60 * 60 * 1000,
    '4h': 4 * 60 * 60 * 1000,
    '8h': 8 * 60 * 60 * 1000,
    '12h': 12 * 60 * 60 * 1000,
    '1d': 24 * 60 * 60 * 1000,
  };
  return map[interval];
};

// How many days of history to load initially based on interval
const getInitialDays = (interval: CandleInterval): number => {
  const daysMap: Record<CandleInterval, number> = {
    '1m': 1,
    '3m': 2,
    '5m': 3,
    '15m': 14,
    '30m': 30,
    '1h': 60,
    '2h': 90,
    '4h': 180,
    '8h': 365,
    '12h': 365,
    '1d': 730,
  };
  return daysMap[interval];
};

// Response from our aggregated chart data API
interface ChartApiResponse {
  success: boolean;
  data: Array<{
    t: number;   // timestamp ms
    o: number;   // open (already parsed as number)
    h: number;   // high
    l: number;   // low
    c: number;   // close
    v: number;   // volume
  }>;
  meta?: {
    symbol: string;
    interval: string;
    startTime: number;
    endTime: number;
    count: number;
  };
}

// Parse aggregated API response to CandleData (numbers already parsed)
const parseChartApiData = (data: ChartApiResponse['data']): CandleData[] => {
  return data.map(c => ({
    time: Math.floor(c.t / 1000), // Convert to seconds for lightweight-charts
    open: c.o,
    high: c.h,
    low: c.l,
    close: c.c,
    volume: c.v,
  }));
};

export function useCandles(symbol: string, interval: CandleInterval = '5m') {
  const { exchangeType } = useExchangeContext();

  const [candles, setCandles] = useState<CandleData[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [oldestTimestamp, setOldestTimestamp] = useState<number>(Date.now());

  // Keep refs for loadMoreHistory to access current values
  const currentSymbolRef = useRef(symbol);
  const currentIntervalRef = useRef(interval);
  const currentExchangeRef = useRef(exchangeType);
  const oldestTimestampRef = useRef(oldestTimestamp);
  const adapterRef = useRef<ExchangeWsAdapter | null>(null);
  const callbacksRef = useRef<ExchangeWsCallbacks | null>(null);

  // Update refs when values change
  useEffect(() => {
    currentSymbolRef.current = symbol;
    currentIntervalRef.current = interval;
    currentExchangeRef.current = exchangeType;
  }, [symbol, interval, exchangeType]);

  useEffect(() => {
    oldestTimestampRef.current = oldestTimestamp;
  }, [oldestTimestamp]);

  // Load more history (for infinite scroll) - uses aggregated API
  const loadMoreHistory = useCallback(async () => {
    if (isLoadingMore || isLoading) return;

    const sym = currentSymbolRef.current;
    const int = currentIntervalRef.current;
    const exch = currentExchangeRef.current;
    const intMs = intervalToMs(int);

    // Calculate time range for older candles
    const candlesToLoad = 200;
    const endTime = oldestTimestampRef.current - intMs;
    const startTime = endTime - (candlesToLoad * intMs);

    try {
      setIsLoadingMore(true);
      const response = await fetch(
        `${CHART_API_BASE}/api/chart/candles?symbol=${sym}&interval=${int}&start=${startTime}&end=${endTime}&exchange=${exch}`
      );

      // Check if symbol changed during fetch
      if (currentSymbolRef.current !== sym || currentIntervalRef.current !== int || currentExchangeRef.current !== exch) {
        setIsLoadingMore(false);
        return;
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch more candles: ${response.status}`);
      }

      const data: ChartApiResponse = await response.json();

      // Check again after parsing
      if (currentSymbolRef.current !== sym || currentIntervalRef.current !== int || currentExchangeRef.current !== exch) {
        setIsLoadingMore(false);
        return;
      }

      if (data.success && data.data && data.data.length > 0) {
        const olderCandles = parseChartApiData(data.data);

        setCandles(prev => {
          // Merge older candles with existing ones
          const merged = [...olderCandles, ...prev];
          // Sort by time
          merged.sort((a, b) => a.time - b.time);
          return merged;
        });

        setOldestTimestamp(data.data[0]?.t || startTime);
      }
    } catch (err) {
      console.error('Failed to load more history:', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, isLoading]);

  // Initial load: fetch historical data and connect WebSocket adapter
  useEffect(() => {
    let isCancelled = false;

    // Remove old callbacks if exchange changed
    if (adapterRef.current && callbacksRef.current) {
      adapterRef.current.unsubscribeCandles(currentSymbolRef.current, currentIntervalRef.current);
      adapterRef.current.removeCallbacks(callbacksRef.current);
      adapterRef.current = null;
      callbacksRef.current = null;
    }

    // Reset state for new symbol/interval/exchange
    setCandles([]);
    setOldestTimestamp(Date.now());
    setIsLoading(true);
    setIsConnected(false);
    setError(null);

    // Fetch historical data from aggregated API with exchange param
    const fetchHistoricalCandles = async () => {
      const now = Date.now();
      const days = getInitialDays(interval);
      const startTime = now - (days * 24 * 60 * 60 * 1000);

      try {
        const response = await fetch(
          `${CHART_API_BASE}/api/chart/candles?symbol=${symbol}&interval=${interval}&start=${startTime}&end=${now}&exchange=${exchangeType}`
        );

        if (isCancelled) return;

        if (!response.ok) {
          throw new Error(`Failed to fetch candles: ${response.status}`);
        }

        const data: ChartApiResponse = await response.json();

        if (isCancelled) return;

        if (data.success && data.data && data.data.length > 0) {
          const historicalCandles = parseChartApiData(data.data);
          historicalCandles.sort((a, b) => a.time - b.time);

          setCandles(historicalCandles);
          setOldestTimestamp(data.data[0]?.t || startTime);
          setError(null);
        }
      } catch (err) {
        console.error('Failed to fetch historical candles:', err);
        if (!isCancelled) {
          setError('Failed to load historical data');
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchHistoricalCandles();

    // Connect WS adapter for real-time candle updates
    const adapter = createWsAdapter(exchangeType);
    adapterRef.current = adapter;

    const callbacks: ExchangeWsCallbacks = {
      onConnected: () => {
        setIsConnected(true);
        setError(null);
        adapter.subscribeCandles(symbol, interval);
      },
      onDisconnected: () => setIsConnected(false),
      onCandle: (data: WsCandle) => {
        if (data.symbol !== symbol || data.interval !== interval) return;

        const candle: CandleData = {
          time: data.time,
          open: data.open,
          high: data.high,
          low: data.low,
          close: data.close,
          volume: data.volume,
        };

        setCandles(prev => {
          if (prev.length === 0) return [candle];

          const lastCandle = prev[prev.length - 1];

          // If this candle updates the last one (same time)
          if (lastCandle && candle.time === lastCandle.time) {
            return [...prev.slice(0, -1), candle];
          }

          // If this is a new candle (newer than last)
          if (lastCandle && candle.time > lastCandle.time) {
            return [...prev, candle];
          }

          // Otherwise find and update existing candle
          const existingIndex = prev.findIndex(c => c.time === candle.time);
          if (existingIndex !== -1) {
            const updated = [...prev];
            updated[existingIndex] = candle;
            return updated;
          }

          return prev;
        });
      },
      onError: (err) => setError(err),
    };
    callbacksRef.current = callbacks;

    adapter.connect(callbacks);

    // If already connected, subscribe immediately
    if (adapter.isConnected()) {
      setIsConnected(true);
      adapter.subscribeCandles(symbol, interval);
    }

    return () => {
      isCancelled = true;
      adapter.unsubscribeCandles(symbol, interval);
      adapter.removeCallbacks(callbacks);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, interval, exchangeType]);

  return {
    candles,
    isConnected,
    isLoading,
    isLoadingMore,
    loadMoreHistory,
    error,
  };
}
