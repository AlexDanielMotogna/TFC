'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

const PACIFICA_API_BASE = 'https://api.pacifica.fi';
const PACIFICA_WS_URL = 'wss://ws.pacifica.fi/ws';

export interface CandleData {
  time: number;      // Unix timestamp in seconds (for lightweight-charts)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

type CandleInterval = '1m' | '3m' | '5m' | '15m' | '30m' | '1h' | '2h' | '4h' | '8h' | '12h' | '1d';

// Map our symbol format (BTC-USD) to Pacifica format (BTC)
const symbolToPacifica = (symbol: string): string => {
  if (symbol === 'KPEPE-USD') return '1000PEPE';
  return symbol.replace('-USD', '');
};

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

interface PacificaKlineResponse {
  success: boolean;
  data: Array<{
    t: number;   // open time ms
    T: number;   // close time ms
    s: string;   // symbol
    i: string;   // interval
    o: string;   // open
    c: string;   // close
    h: string;   // high
    l: string;   // low
    v: string;   // volume
    n: number;   // number of trades
  }>;
  error: string | null;
}

interface PacificaCandleMessage {
  channel: 'candle';  // Use 'candle' for last traded price (matches Pacifica UI)
  data: {
    t: number;   // start time ms
    T: number;   // end time ms
    s: string;   // symbol
    i: string;   // interval
    o: string;   // open
    c: string;   // close
    h: string;   // high
    l: string;   // low
    v: string;   // volume
    n: number;   // number of trades
  };
}

// Parse API response to CandleData
const parseKlineData = (data: PacificaKlineResponse['data']): CandleData[] => {
  return data.map(c => ({
    time: Math.floor(c.t / 1000), // Convert to seconds for lightweight-charts
    open: parseFloat(c.o),
    high: parseFloat(c.h),
    low: parseFloat(c.l),
    close: parseFloat(c.c),
    volume: parseFloat(c.v),
  }));
};

export function useCandles(symbol: string, interval: CandleInterval = '5m') {
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [oldestTimestamp, setOldestTimestamp] = useState<number>(Date.now());

  // Keep refs for loadMoreHistory to access current values
  const currentSymbolRef = useRef(symbol);
  const currentIntervalRef = useRef(interval);
  const oldestTimestampRef = useRef(oldestTimestamp);

  // Update refs when values change
  useEffect(() => {
    currentSymbolRef.current = symbol;
    currentIntervalRef.current = interval;
  }, [symbol, interval]);

  useEffect(() => {
    oldestTimestampRef.current = oldestTimestamp;
  }, [oldestTimestamp]);

  // Load more history (for infinite scroll)
  const loadMoreHistory = useCallback(async () => {
    if (isLoadingMore || isLoading) return;

    const sym = currentSymbolRef.current;
    const int = currentIntervalRef.current;
    const pacificaSymbol = symbolToPacifica(sym);
    const intMs = intervalToMs(int);

    // Calculate time range for older candles
    const candlesToLoad = 200;
    const endTime = oldestTimestampRef.current - intMs;
    const startTime = endTime - (candlesToLoad * intMs);

    try {
      setIsLoadingMore(true);
      const response = await fetch(
        `${PACIFICA_API_BASE}/api/v1/kline?symbol=${pacificaSymbol}&interval=${int}&start_time=${startTime}&end_time=${endTime}`
      );

      // Check if symbol changed during fetch
      if (currentSymbolRef.current !== sym || currentIntervalRef.current !== int) {
        setIsLoadingMore(false);
        return;
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch more candles: ${response.status}`);
      }

      const data: PacificaKlineResponse = await response.json();

      // Check again after parsing
      if (currentSymbolRef.current !== sym || currentIntervalRef.current !== int) {
        setIsLoadingMore(false);
        return;
      }

      if (data.success && data.data && data.data.length > 0) {
        const olderCandles = parseKlineData(data.data);

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

  // Initial load: fetch historical data and connect WebSocket
  useEffect(() => {
    const pacificaSymbol = symbolToPacifica(symbol);

    let ws: WebSocket | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let isCancelled = false;

    // Reset state for new symbol/interval
    setCandles([]);
    setOldestTimestamp(Date.now());
    setIsLoading(true);
    setIsConnected(false);
    setError(null);

    // Fetch historical data
    const fetchHistoricalCandles = async () => {
      const now = Date.now();
      const days = getInitialDays(interval);
      const startTime = now - (days * 24 * 60 * 60 * 1000);

      try {
        const response = await fetch(
          `${PACIFICA_API_BASE}/api/v1/kline?symbol=${pacificaSymbol}&interval=${interval}&start_time=${startTime}&end_time=${now}`
        );

        if (isCancelled) return;

        if (!response.ok) {
          throw new Error(`Failed to fetch candles: ${response.status}`);
        }

        const data: PacificaKlineResponse = await response.json();

        if (isCancelled) return;

        if (data.success && data.data && data.data.length > 0) {
          const historicalCandles = parseKlineData(data.data);
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

    // Connect WebSocket
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

          // Subscribe to candles (last traded price - same as Pacifica UI)
          ws?.send(JSON.stringify({
            method: 'subscribe',
            params: {
              source: 'candle',
              symbol: pacificaSymbol,
              interval: interval
            }
          }));
        };

        ws.onmessage = (event) => {
          if (isCancelled) return;

          try {
            const message: PacificaCandleMessage = JSON.parse(event.data);

            if (message.channel === 'candle' && message.data) {
              // Verify the message is for the correct symbol and interval
              if (message.data.s !== pacificaSymbol || message.data.i !== interval) {
                return;
              }

              const candle: CandleData = {
                time: Math.floor(message.data.t / 1000), // Convert to seconds
                open: parseFloat(message.data.o),
                high: parseFloat(message.data.h),
                low: parseFloat(message.data.l),
                close: parseFloat(message.data.c),
                volume: parseFloat(message.data.v),
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
        ws.close();
      }
    };
  }, [symbol, interval]);

  return {
    candles,
    isConnected,
    isLoading,
    isLoadingMore,
    loadMoreHistory,
    error,
  };
}
