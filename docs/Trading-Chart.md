# Trading Chart Implementation Guide

This document explains how to implement a TradingView-style candlestick chart with real-time updates using **Lightweight Charts** library and a REST + WebSocket data architecture.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Dependencies](#dependencies)
3. [API Endpoint](#api-endpoint)
4. [Type Definitions](#type-definitions)
5. [API Client](#api-client)
6. [React Query Hook](#react-query-hook)
7. [WebSocket Real-Time Updates](#websocket-real-time-updates)
8. [Chart Component](#chart-component)
9. [Key Features Explained](#key-features-explained)
10. [Common Issues & Solutions](#common-issues--solutions)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        DATA FLOW                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. INITIAL LOAD (REST API)                                     │
│     GET /api/v1/kline?symbol=BTC&interval=15m&start_time=...    │
│              │                                                   │
│              ▼                                                   │
│     ┌─────────────────┐                                         │
│     │  useKlineData() │  ← React Query hook                     │
│     │  (caches data)  │                                         │
│     └────────┬────────┘                                         │
│              │                                                   │
│              ▼                                                   │
│     ┌─────────────────┐                                         │
│     │ allCandles state│  ← Stores all candle data               │
│     └────────┬────────┘                                         │
│              │                                                   │
│              ▼                                                   │
│     ┌─────────────────┐                                         │
│     │ Lightweight     │                                         │
│     │ Charts Library  │  → Renders candlesticks + volume        │
│     └─────────────────┘                                         │
│                                                                  │
│  2. REAL-TIME UPDATES (WebSocket)                               │
│     Subscribe to "trades" channel                                │
│              │                                                   │
│              ▼                                                   │
│     ┌─────────────────┐                                         │
│     │usePacificaTrades│  ← WebSocket hook                       │
│     └────────┬────────┘                                         │
│              │                                                   │
│              ▼                                                   │
│     Update last candle OHLC or create new candle                │
│                                                                  │
│  3. INFINITE SCROLL (REST API on demand)                        │
│     User scrolls left → Load older candles                      │
│              │                                                   │
│              ▼                                                   │
│     Prepend to allCandles state                                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Dependencies

```bash
npm install lightweight-charts @tanstack/react-query
```

**package.json:**
```json
{
  "dependencies": {
    "lightweight-charts": "^4.x.x",
    "@tanstack/react-query": "^5.x.x"
  }
}
```

---

## API Endpoint

### GET /api/v1/kline

Fetches historical candlestick (OHLCV) data.

**Query Parameters:**

| Parameter    | Type    | Required | Description                                    |
|-------------|---------|----------|------------------------------------------------|
| `symbol`    | string  | Yes      | Trading pair symbol (e.g., "BTC", "ETH")       |
| `interval`  | string  | Yes      | Candle interval                                |
| `start_time`| integer | Yes      | Start time in milliseconds                     |
| `end_time`  | integer | No       | End time in milliseconds (defaults to now)     |

**Valid intervals:** `1m`, `3m`, `5m`, `15m`, `30m`, `1h`, `2h`, `4h`, `8h`, `12h`, `1d`

**Example Request:**
```
GET /api/v1/kline?symbol=BTC&interval=15m&start_time=1700000000000&end_time=1700100000000
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "t": 1700000000000,
      "T": 1700000900000,
      "s": "BTC",
      "i": "15m",
      "o": "42000.50",
      "h": "42150.00",
      "l": "41950.25",
      "c": "42100.75",
      "v": "125.5432",
      "n": 1523
    }
  ],
  "error": null,
  "code": null
}
```

---

## Type Definitions

```typescript
// types/kline.ts

import { z } from 'zod';

/**
 * Kline (Candle) Data Schema
 */
export const klineDataSchema = z.object({
  t: z.number(),   // Candle start time (milliseconds)
  T: z.number(),   // Candle end time (milliseconds)
  s: z.string(),   // Symbol
  i: z.string(),   // Time interval
  o: z.string(),   // Open price
  c: z.string(),   // Close price
  h: z.string(),   // High price
  l: z.string(),   // Low price
  v: z.string(),   // Volume
  n: z.number(),   // Number of trades
});

export type KlineData = z.infer<typeof klineDataSchema>;

/**
 * Kline Response
 */
export const klineResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(klineDataSchema),
  error: z.null(),
  code: z.null(),
});

export type KlineResponse = z.infer<typeof klineResponseSchema>;

/**
 * Kline Query Parameters
 */
export const klineQuerySchema = z.object({
  symbol: z.string(),
  interval: z.enum(['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '8h', '12h', '1d']),
  start_time: z.number(),
  end_time: z.number().optional(),
});

export type KlineQuery = z.infer<typeof klineQuerySchema>;
```

---

## API Client

```typescript
// lib/api-client.ts

import type { KlineQuery, KlineResponse } from './types/kline';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.example.com';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Accept: '*/*',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get historical candle (kline) data
   */
  async getKlineData(params: KlineQuery): Promise<KlineResponse> {
    const searchParams = new URLSearchParams({
      symbol: params.symbol,
      interval: params.interval,
      start_time: params.start_time.toString(),
      ...(params.end_time && { end_time: params.end_time.toString() }),
    });

    return this.request<KlineResponse>(`/api/v1/kline?${searchParams.toString()}`);
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
```

---

## React Query Hook

```typescript
// hooks/use-kline-data.ts

'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { KlineQuery, KlineData } from '@/types/kline';

/**
 * Hook to fetch historical kline (candle) data
 */
export function useKlineData(params: KlineQuery | null) {
  return useQuery({
    queryKey: ['kline', params?.symbol, params?.interval, params?.start_time, params?.end_time],
    queryFn: async (): Promise<KlineData[] | null> => {
      if (!params) return null;
      const response = await apiClient.getKlineData(params);
      return response.data;
    },
    enabled: !!params,
    refetchInterval: 1000,   // Refetch every 1 second for real-time updates
    staleTime: 500,          // Consider data stale after 0.5 seconds
  });
}
```

---

## WebSocket Real-Time Updates

```typescript
// hooks/use-trades-websocket.ts

'use client';

import { useEffect, useRef } from 'react';

interface TradeData {
  u: string;   // Account address
  h: number;   // History ID
  s: string;   // Symbol
  a: string;   // Amount
  p: string;   // Price
  d: string;   // Trade side (open_long, open_short, close_long, close_short)
  tc: string;  // Trade cause
  t: number;   // Timestamp in milliseconds
  li: number;  // Last order ID
}

/**
 * Hook to subscribe to real-time trades via WebSocket
 */
export function useTradesWebSocket(
  symbol: string | null,
  callback: (trades: TradeData[]) => void
) {
  const wsRef = useRef<WebSocket | null>(null);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!symbol) return;

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'wss://api.example.com/ws';
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] Connected');

      // Subscribe to trades channel
      ws.send(JSON.stringify({
        method: 'subscribe',
        params: {
          source: 'trades',
          symbol: symbol,
        },
      }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.channel === 'trades') {
        callbackRef.current(data.data as TradeData[]);
      }
    };

    ws.onerror = (error) => {
      console.error('[WS] Error:', error);
    };

    ws.onclose = () => {
      console.log('[WS] Disconnected');
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [symbol]);
}
```

---

## Chart Component

This is the complete chart component with all features:

```typescript
// components/trading-chart.tsx

'use client';

import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import {
  createChart,
  ColorType,
  CandlestickData,
  Time,
  HistogramData,
  CandlestickSeries,
  HistogramSeries,
  IChartApi,
  ISeriesApi,
} from 'lightweight-charts';
import { useKlineData } from '@/hooks/use-kline-data';
import { useTradesWebSocket } from '@/hooks/use-trades-websocket';
import type { KlineData } from '@/types/kline';

type Interval = '1m' | '3m' | '5m' | '15m' | '30m' | '1h' | '2h' | '4h' | '8h' | '12h' | '1d';

// Map UI intervals to API intervals
const intervalMap: Record<string, Interval> = {
  '1m': '1m',
  '5m': '5m',
  '15m': '15m',
  '1H': '1h',
  '4H': '4h',
  '1D': '1d',
};

interface TradingChartProps {
  symbol: string;
  tickSize?: string;
}

// Helper: get price precision from tick_size
const getPricePrecision = (tickSize?: string): number => {
  if (tickSize) {
    const tick = parseFloat(tickSize);
    return Math.max(0, -Math.floor(Math.log10(tick)));
  }
  return 2; // default
};

export function TradingChart({ symbol, tickSize }: TradingChartProps) {
  // Refs
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  // State
  const [selectedInterval, setSelectedInterval] = useState<string>('15m');
  const [allCandles, setAllCandles] = useState<KlineData[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [oldestTimestamp, setOldestTimestamp] = useState<number>(Date.now());
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);

  // Calculate milliseconds per candle
  const intervalMs = useMemo(() => {
    const interval = intervalMap[selectedInterval] || '15m';
    const msMap: Record<Interval, number> = {
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
    return msMap[interval];
  }, [selectedInterval]);

  // Initial load parameters
  const initialParams = useMemo(() => {
    const now = Date.now();
    const interval = intervalMap[selectedInterval] || '15m';

    // How far back to load based on interval
    const daysToLoad: Record<Interval, number> = {
      '1m': 1,
      '3m': 2,
      '5m': 3,
      '15m': 30,
      '30m': 60,
      '1h': 90,
      '2h': 180,
      '4h': 365,
      '8h': 730,
      '12h': 1095,
      '1d': 1825,
    };

    const days = daysToLoad[interval];
    const startTime = now - days * 24 * 60 * 60 * 1000;

    return {
      symbol: symbol.replace('-USD', ''), // Remove suffix if present
      interval,
      start_time: startTime,
      end_time: now,
    };
  }, [symbol, selectedInterval]);

  // Fetch initial data
  const { data: initialKlineData, isLoading: isLoadingInitial } = useKlineData(initialParams);

  // Initialize candles on first load
  useEffect(() => {
    if (initialKlineData && initialKlineData.length > 0 && !hasInitiallyLoaded) {
      setAllCandles(initialKlineData);
      setOldestTimestamp(initialKlineData[0]?.t || Date.now());
      setHasInitiallyLoaded(true);
    }
  }, [initialKlineData, hasInitiallyLoaded]);

  // Reset state when symbol or interval changes
  useEffect(() => {
    setHasInitiallyLoaded(false);
    setAllCandles([]);
    setOldestTimestamp(Date.now());
  }, [selectedInterval, symbol]);

  // ========================================
  // REAL-TIME UPDATES VIA WEBSOCKET
  // ========================================
  useTradesWebSocket(symbol.replace('-USD', ''), (trades) => {
    if (trades.length === 0 || allCandles.length === 0) return;

    const latestTrade = trades[trades.length - 1];
    if (!latestTrade) return;

    const tradePrice = parseFloat(latestTrade.p);
    const tradeTime = latestTrade.t;

    setAllCandles((prev) => {
      if (prev.length === 0) return prev;

      const lastCandle = prev[prev.length - 1];
      if (!lastCandle) return prev;

      // Calculate which candle this trade belongs to
      const candleStartTime = Math.floor(tradeTime / intervalMs) * intervalMs;

      // If trade belongs to current candle, update it
      if (candleStartTime === lastCandle.t) {
        const updatedCandle: KlineData = {
          ...lastCandle,
          c: tradePrice.toString(), // Update close
          h: Math.max(parseFloat(lastCandle.h), tradePrice).toString(), // Update high
          l: Math.min(parseFloat(lastCandle.l), tradePrice).toString(), // Update low
        };
        return [...prev.slice(0, -1), updatedCandle];
      }

      // If trade is for a NEW candle, create it
      if (candleStartTime > lastCandle.t) {
        const newCandle: KlineData = {
          t: candleStartTime,
          T: candleStartTime + intervalMs,
          s: symbol.replace('-USD', ''),
          i: intervalMap[selectedInterval] || '15m',
          o: tradePrice.toString(),
          h: tradePrice.toString(),
          l: tradePrice.toString(),
          c: tradePrice.toString(),
          v: '0',
          n: 1,
        };
        return [...prev, newCandle];
      }

      return prev;
    });
  });

  // ========================================
  // CONVERT KLINE DATA TO CHART FORMAT
  // ========================================
  const { candleData, volumeData } = useMemo(() => {
    if (!allCandles || allCandles.length === 0) {
      return { candleData: [], volumeData: [] };
    }

    // Remove duplicates by timestamp and sort
    const uniqueCandles = Array.from(
      new Map(allCandles.map((candle) => [candle.t, candle])).values()
    ).sort((a, b) => a.t - b.t);

    const candles: CandlestickData<Time>[] = uniqueCandles.map((kline) => ({
      time: Math.floor(kline.t / 1000) as Time, // Convert ms to seconds
      open: parseFloat(kline.o),
      high: parseFloat(kline.h),
      low: parseFloat(kline.l),
      close: parseFloat(kline.c),
    }));

    const volumes: HistogramData<Time>[] = uniqueCandles.map((kline) => ({
      time: Math.floor(kline.t / 1000) as Time,
      value: parseFloat(kline.v),
      color: parseFloat(kline.c) >= parseFloat(kline.o)
        ? 'rgba(34, 197, 94, 0.5)'   // Green for bullish
        : 'rgba(239, 68, 68, 0.5)',  // Red for bearish
    }));

    return { candleData: candles, volumeData: volumes };
  }, [allCandles]);

  // ========================================
  // INFINITE SCROLL - LOAD MORE HISTORY
  // ========================================
  const loadMoreData = useCallback(async () => {
    if (isLoadingMore) return;

    setIsLoadingMore(true);
    try {
      const interval = intervalMap[selectedInterval] || '15m';
      const candlesToLoad = 200;
      const endTime = oldestTimestamp - intervalMs;
      const startTime = endTime - candlesToLoad * intervalMs;

      const { apiClient } = await import('@/lib/api-client');
      const response = await apiClient.getKlineData({
        symbol: symbol.replace('-USD', ''),
        interval,
        start_time: startTime,
        end_time: endTime,
      });

      if (response.success && response.data && response.data.length > 0) {
        setAllCandles((prev) => [...response.data, ...prev]);
        setOldestTimestamp(response.data[0]?.t || oldestTimestamp);
      }
    } catch (error) {
      console.error('Error loading more data:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, oldestTimestamp, selectedInterval, symbol, intervalMs]);

  // ========================================
  // CREATE CHART (ONCE)
  // ========================================
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      crosshair: {
        mode: 1,
        vertLine: { color: '#6366f1', labelBackgroundColor: '#6366f1' },
        horzLine: { color: '#6366f1', labelBackgroundColor: '#6366f1' },
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 12,
        barSpacing: 6,
        minBarSpacing: 2,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    });

    chartRef.current = chart;

    // Candlestick series
    const precision = getPricePrecision(tickSize);
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
      priceFormat: {
        type: 'price',
        precision: precision,
        minMove: Math.pow(10, -precision),
      },
    });
    candleSeriesRef.current = candlestickSeries;

    // Volume series
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.7, bottom: 0 },
    });
    volumeSeriesRef.current = volumeSeries;

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, [tickSize]);

  // ========================================
  // UPDATE CHART DATA
  // ========================================
  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current || !chartRef.current) return;
    if (candleData.length === 0) return;

    candleSeriesRef.current.setData(candleData);
    volumeSeriesRef.current.setData(volumeData);

    // Auto-scroll to latest candle
    if (hasInitiallyLoaded) {
      chartRef.current.timeScale().scrollToPosition(5, false);
    }
  }, [candleData, volumeData, hasInitiallyLoaded]);

  // ========================================
  // INFINITE SCROLL LISTENER
  // ========================================
  useEffect(() => {
    if (!chartRef.current) return;

    const chart = chartRef.current;

    const handleRangeChange = () => {
      const logicalRange = chart.timeScale().getVisibleLogicalRange();

      if (logicalRange !== null) {
        // If user scrolled near the left edge, load more
        if (logicalRange.from < 100 && !isLoadingMore) {
          loadMoreData();
        }
      }
    };

    chart.timeScale().subscribeVisibleLogicalRangeChange(handleRangeChange);

    return () => {
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleRangeChange);
    };
  }, [loadMoreData, isLoadingMore]);

  // ========================================
  // RENDER
  // ========================================
  return (
    <div className="bg-neutral-900 rounded-lg overflow-hidden">
      {/* Interval Selector */}
      <div className="flex items-center gap-1 p-3 border-b border-neutral-800">
        {['1m', '5m', '15m', '1H', '4H', '1D'].map((tf) => (
          <button
            key={tf}
            onClick={() => setSelectedInterval(tf)}
            className={`px-2 py-1 text-xs rounded ${
              tf === selectedInterval
                ? 'bg-neutral-800 text-white'
                : 'text-neutral-500 hover:text-white'
            }`}
          >
            {tf}
          </button>
        ))}

        {(isLoadingInitial || isLoadingMore) && (
          <span className="ml-auto text-xs text-neutral-500">
            {isLoadingMore ? 'Loading more...' : 'Loading...'}
          </span>
        )}
      </div>

      {/* Chart Container */}
      <div className="p-2 relative">
        <div ref={chartContainerRef} className="w-full h-[400px]" />

        {/* Loading Overlay */}
        {isLoadingInitial && (
          <div className="absolute inset-0 flex items-center justify-center bg-neutral-900/80">
            <p className="text-neutral-400">Loading chart...</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## Key Features Explained

### 1. Initial Data Load

```typescript
const initialParams = useMemo(() => {
  const now = Date.now();
  const days = daysToLoad[interval]; // e.g., 30 days for 15m
  const startTime = now - days * 24 * 60 * 60 * 1000;

  return {
    symbol,
    interval,
    start_time: startTime,
    end_time: now,
  };
}, [symbol, selectedInterval]);
```

- Calculates how much historical data to load based on interval
- Shorter intervals = less history (to avoid too many candles)
- Longer intervals = more history (for context)

### 2. Real-Time Updates

```typescript
// When a trade comes in via WebSocket:
const candleStartTime = Math.floor(tradeTime / intervalMs) * intervalMs;

if (candleStartTime === lastCandle.t) {
  // Update current candle
  updatedCandle.c = tradePrice;
  updatedCandle.h = Math.max(lastCandle.h, tradePrice);
  updatedCandle.l = Math.min(lastCandle.l, tradePrice);
} else if (candleStartTime > lastCandle.t) {
  // Create new candle
  newCandle = { o: tradePrice, h: tradePrice, l: tradePrice, c: tradePrice };
}
```

- Trades update the **close, high, low** of the current candle
- When a trade belongs to a new time period, a new candle is created

### 3. Infinite Scroll

```typescript
chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
  const range = chart.timeScale().getVisibleLogicalRange();

  if (range.from < 100) {
    // User scrolled to beginning, load more history
    loadMoreData();
  }
});
```

- Monitors user scroll position
- When near the left edge (older data), fetches more candles
- Prepends older candles to the array

### 4. Deduplication

```typescript
const uniqueCandles = Array.from(
  new Map(allCandles.map((candle) => [candle.t, candle])).values()
).sort((a, b) => a.t - b.t);
```

- Uses `Map` to deduplicate by timestamp
- Ensures no duplicate candles from API refetches or WebSocket updates

### 5. Time Conversion

```typescript
// API returns milliseconds, Lightweight Charts expects seconds
time: Math.floor(kline.t / 1000) as Time
```

- **Important:** Lightweight Charts uses UNIX seconds, not milliseconds!

---

## Common Issues & Solutions

### Issue 1: Chart shows blank/no data

**Cause:** Time format mismatch

**Solution:**
```typescript
// WRONG
time: kline.t // milliseconds

// CORRECT
time: Math.floor(kline.t / 1000) // seconds
```

### Issue 2: Candles not updating in real-time

**Cause:** WebSocket not connected or wrong channel

**Solution:**
- Check WebSocket connection status
- Ensure you're subscribed to the `trades` channel for the correct symbol

### Issue 3: Duplicate candles appearing

**Cause:** React Query refetching + state accumulation

**Solution:**
```typescript
// Deduplicate by timestamp
const uniqueCandles = Array.from(
  new Map(allCandles.map((c) => [c.t, c])).values()
);
```

### Issue 4: Chart not resizing properly

**Cause:** Container size not detected

**Solution:**
```typescript
useEffect(() => {
  const handleResize = () => {
    if (chartContainerRef.current) {
      chart.applyOptions({
        width: chartContainerRef.current.clientWidth,
        height: chartContainerRef.current.clientHeight,
      });
    }
  };

  window.addEventListener('resize', handleResize);
  handleResize(); // Call immediately

  return () => window.removeEventListener('resize', handleResize);
}, []);
```

### Issue 5: New candles not appearing

**Cause:** Candle time calculation error

**Solution:**
```typescript
// Ensure candleStartTime aligns with interval
const candleStartTime = Math.floor(tradeTime / intervalMs) * intervalMs;
```

---

## Example Usage

```tsx
// pages/trading.tsx

import { TradingChart } from '@/components/trading-chart';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

export default function TradingPage() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">BTC/USD</h1>
        <TradingChart
          symbol="BTC-USD"
          tickSize="0.01"
        />
      </div>
    </QueryClientProvider>
  );
}
```

---

## Summary

| Component | Purpose |
|-----------|---------|
| `api-client.ts` | REST API calls for kline data |
| `use-kline-data.ts` | React Query hook for caching/refetching |
| `use-trades-websocket.ts` | WebSocket subscription for real-time trades |
| `trading-chart.tsx` | Main chart component with Lightweight Charts |

**Data Flow:**
1. Initial load: REST API → React Query → Chart
2. Real-time: WebSocket trades → Update last candle
3. Scroll left: Load more history → Prepend to state
