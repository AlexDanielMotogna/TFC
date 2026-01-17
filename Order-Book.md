# Order Book Implementation Guide

This document explains how to implement a real-time Order Book component with depth visualization, aggregation levels, and buy/sell pressure indicators.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Dependencies](#dependencies)
3. [API Endpoint](#api-endpoint)
4. [Type Definitions](#type-definitions)
5. [API Client](#api-client)
6. [React Query Hook](#react-query-hook)
7. [WebSocket Hook](#websocket-hook)
8. [Order Book Component](#order-book-component)
9. [Key Features Explained](#key-features-explained)
10. [WebSocket Message Format](#websocket-message-format)
11. [Common Issues & Solutions](#common-issues--solutions)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    ORDER BOOK DATA FLOW                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. INITIAL LOAD (REST API)                                     │
│     GET /api/v1/book?symbol=BTC&agg_level=10                    │
│              │                                                   │
│              ▼                                                   │
│     ┌─────────────────┐                                         │
│     │  useOrderBook() │  ← React Query hook (200ms polling)     │
│     │  (caches data)  │                                         │
│     └────────┬────────┘                                         │
│              │                                                   │
│              ▼                                                   │
│     ┌─────────────────┐                                         │
│     │ OrderBook       │                                         │
│     │ Component       │  → Renders bids/asks with depth bars    │
│     └─────────────────┘                                         │
│                                                                  │
│  2. REAL-TIME UPDATES (WebSocket)                               │
│     Subscribe to "book" channel with agg_level                   │
│              │                                                   │
│              ▼                                                   │
│     ┌────────────────────┐                                      │
│     │useOrderBookWebSocket│  ← WebSocket hook                   │
│     └────────┬───────────┘                                      │
│              │                                                   │
│              ▼                                                   │
│     Update TanStack Query cache directly                        │
│     (no state management needed)                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Dependencies

```bash
npm install @tanstack/react-query
```

**package.json:**
```json
{
  "dependencies": {
    "@tanstack/react-query": "^5.x.x"
  }
}
```

---

## API Endpoint

### GET /api/v1/book

Fetches current order book (bid/ask levels) for a trading pair.

**Query Parameters:**

| Parameter   | Type    | Required | Description                              |
|-------------|---------|----------|------------------------------------------|
| `symbol`    | string  | Yes      | Trading pair symbol (e.g., "BTC", "SOL") |
| `agg_level` | integer | No       | Price aggregation level (default: 1)     |

**Valid agg_level values:** `1`, `2`, `5`, `10`, `100`, `1000`

> **Note:** `agg_level` is a **multiplier of tick_size**. For SOL with tick_size=0.01:
> - `agg_level=1` → 0.01 (1 cent)
> - `agg_level=10` → 0.10 (10 cents)
> - `agg_level=100` → 1.00 (1 dollar)

**Example Request:**
```
GET /api/v1/book?symbol=BTC&agg_level=10
```

**Response:**
```json
{
  "success": true,
  "data": {
    "s": "BTC",
    "l": [
      [
        { "p": "106504", "a": "0.26203", "n": 1 },
        { "p": "106498", "a": "0.29281", "n": 1 }
      ],
      [
        { "p": "106559", "a": "0.26802", "n": 1 },
        { "p": "106564", "a": "0.3002", "n": 1 }
      ]
    ],
    "t": 1751370536325
  },
  "error": null,
  "code": null
}
```

**Response Fields:**

| Field | Type   | Description                                    |
|-------|--------|------------------------------------------------|
| `s`   | string | Symbol                                         |
| `l`   | array  | Two arrays: `l[0]` = bids, `l[1]` = asks      |
| `t`   | number | Timestamp in milliseconds                      |
| `p`   | string | Price level                                    |
| `a`   | string | Total amount at price level                    |
| `n`   | number | Number of orders at level                      |

---

## Type Definitions

```typescript
// types/orderbook.ts

import { z } from 'zod';

/**
 * Order Book Level Schema
 */
export const orderBookLevelSchema = z.object({
  p: z.string(), // price
  a: z.string(), // amount
  n: z.number(), // number of orders
});

export type OrderBookLevel = z.infer<typeof orderBookLevelSchema>;

/**
 * Order Book Data Schema (REST API)
 */
export const orderBookDataSchema = z.object({
  s: z.string(), // symbol
  l: z.tuple([
    z.array(orderBookLevelSchema), // bids (index 0)
    z.array(orderBookLevelSchema), // asks (index 1)
  ]),
  t: z.number(), // timestamp
});

export type OrderBookData = z.infer<typeof orderBookDataSchema>;

/**
 * Order Book Response
 */
export const orderBookResponseSchema = z.object({
  success: z.boolean(),
  data: orderBookDataSchema,
  error: z.null(),
  code: z.null(),
});

export type OrderBookResponse = z.infer<typeof orderBookResponseSchema>;

/**
 * WebSocket Order Book Data (same structure, no symbol field)
 */
export const wsOrderBookDataSchema = z.object({
  l: z.tuple([
    z.array(orderBookLevelSchema), // bids
    z.array(orderBookLevelSchema), // asks
  ]),
  t: z.number(), // timestamp
});

export type WsOrderBookData = z.infer<typeof wsOrderBookDataSchema>;
```

---

## API Client

```typescript
// lib/api-client.ts

import type { OrderBookResponse } from '@/types/orderbook';

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
   * Get orderbook for a specific symbol
   * @param symbol - Trading pair symbol (e.g., "BTC")
   * @param aggLevel - Aggregation level for price grouping (default: 1)
   */
  async getOrderBook(symbol: string, aggLevel: number = 1): Promise<OrderBookResponse> {
    const params = new URLSearchParams({
      symbol,
      agg_level: aggLevel.toString(),
    });

    return this.request<OrderBookResponse>(`/api/v1/book?${params.toString()}`);
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
```

---

## React Query Hook

```typescript
// hooks/use-order-book.ts

'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

/**
 * Hook to fetch order book for a symbol
 * Uses fast polling as fallback when WebSocket is not available
 */
export function useOrderBook(symbol: string | null, aggLevel: number = 1) {
  return useQuery({
    queryKey: ['orderbook', symbol, aggLevel],
    queryFn: async () => {
      if (!symbol) throw new Error('Symbol is required');
      const response = await apiClient.getOrderBook(symbol, aggLevel);
      return response.data;
    },
    enabled: !!symbol,
    refetchInterval: 200,  // Fast polling (200ms) - order book needs to be responsive
    staleTime: 100,        // Consider data stale after 100ms
  });
}
```

---

## WebSocket Hook

```typescript
// hooks/use-orderbook-websocket.ts

'use client';

import { useEffect, useRef } from 'react';
import type { WsOrderBookData } from '@/types/orderbook';

/**
 * Hook to subscribe to real-time order book updates via WebSocket
 */
export function useOrderBookWebSocket(
  symbol: string | null,
  callback: (orderbook: WsOrderBookData) => void,
  aggLevel: number = 1
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
      console.log('[WS OrderBook] Connected');

      // Subscribe to book channel with aggregation level
      ws.send(JSON.stringify({
        method: 'subscribe',
        params: {
          source: 'book',
          symbol: symbol,
          agg_level: aggLevel,
        },
      }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.channel === 'book') {
        callbackRef.current(data.data as WsOrderBookData);
      }
    };

    ws.onerror = (error) => {
      console.error('[WS OrderBook] Error:', error);
    };

    ws.onclose = () => {
      console.log('[WS OrderBook] Disconnected');
    };

    return () => {
      // Unsubscribe before closing
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          method: 'unsubscribe',
          params: {
            source: 'book',
            symbol: symbol,
            agg_level: aggLevel,
          },
        }));
      }
      ws.close();
      wsRef.current = null;
    };
  }, [symbol, aggLevel]); // Re-subscribe when aggLevel changes
}
```

---

## Order Book Component

```typescript
// components/order-book.tsx

'use client';

import { useMemo, useState } from 'react';
import { useOrderBook } from '@/hooks/use-order-book';
import { useOrderBookWebSocket } from '@/hooks/use-orderbook-websocket';
import { useQueryClient } from '@tanstack/react-query';

interface OrderBookProps {
  symbol: string;        // e.g., "SOL", "ETH", "BTC"
  tickSize?: string;     // e.g., "0.01" from market info
  markPrice?: number;    // Current mark price
}

// Helper: format price with dynamic decimals based on tick_size
const formatPrice = (price: number, tickSize?: string): string => {
  if (tickSize) {
    const tick = parseFloat(tickSize);
    const decimals = Math.max(0, -Math.floor(Math.log10(tick)));
    return price.toFixed(decimals);
  }
  // Fallback
  if (price >= 10000) return price.toFixed(0);
  if (price >= 1000) return price.toFixed(1);
  if (price >= 1) return price.toFixed(2);
  return price.toFixed(4);
};

// Helper: format size
const formatSize = (size: number): string => {
  if (size >= 1000) return size.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (size >= 1) return size.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return size.toLocaleString(undefined, { maximumFractionDigits: 4 });
};

export function OrderBook({ symbol, tickSize, markPrice }: OrderBookProps) {
  const queryClient = useQueryClient();
  const [aggLevel, setAggLevel] = useState<number>(10);
  const [displayMode, setDisplayMode] = useState<'USD' | 'TOKEN'>('TOKEN');

  // Fetch initial data via REST API
  const { data: orderBookData, isLoading } = useOrderBook(symbol, aggLevel);

  // Subscribe to real-time updates via WebSocket
  useOrderBookWebSocket(
    symbol,
    (updatedOrderBook) => {
      // Update TanStack Query cache directly with WebSocket data
      queryClient.setQueryData(['orderbook', symbol, aggLevel], updatedOrderBook);
    },
    aggLevel
  );

  // Process order book data
  const { asks, bids, maxTotal, spread, buyPercentage } = useMemo(() => {
    if (!orderBookData) {
      return { asks: [], bids: [], maxTotal: 0, spread: 0, buyPercentage: 50 };
    }

    // Parse bids (l[0]) and asks (l[1])
    const bids = orderBookData.l[0]?.map((bid) => ({
      price: parseFloat(bid.p),
      size: parseFloat(bid.a),
      total: 0,
    })) ?? [];

    const asks = orderBookData.l[1]?.map((ask) => ({
      price: parseFloat(ask.p),
      size: parseFloat(ask.a),
      total: 0,
    })) ?? [];

    // Calculate cumulative totals for bids (best bid first)
    let bidTotal = 0;
    bids.forEach((bid) => {
      bidTotal += bid.size;
      bid.total = bidTotal;
    });

    // Calculate cumulative totals for asks (best ask first)
    let askTotal = 0;
    asks.forEach((ask) => {
      askTotal += ask.size;
      ask.total = askTotal;
    });

    const maxTotal = Math.max(askTotal, bidTotal);

    // Calculate spread
    const bestAsk = asks.length > 0 ? asks[0]!.price : 0;
    const bestBid = bids.length > 0 ? bids[0]!.price : 0;
    const midPrice = markPrice || (bestAsk + bestBid) / 2;
    const spreadValue = bestAsk - bestBid;
    const spreadPercent = midPrice > 0 ? (spreadValue / midPrice) * 100 : 0;

    // Calculate buy/sell pressure
    const totalVolume = bidTotal + askTotal;
    const buyPercentage = totalVolume > 0 ? (bidTotal / totalVolume) * 100 : 50;

    return { asks, bids, maxTotal, spread: spreadPercent, buyPercentage };
  }, [orderBookData, markPrice]);

  // Aggregation level options
  const aggLevelOptions = useMemo(() => {
    const tick = tickSize ? parseFloat(tickSize) : 0.01;
    const multipliers = [1, 10, 100, 1000];

    return multipliers.map((mult) => {
      const value = mult * tick;
      let label: string;
      if (value >= 1) {
        label = value.toFixed(Math.max(0, 2 - Math.floor(Math.log10(value))));
      } else {
        const decimals = Math.max(0, -Math.floor(Math.log10(value)));
        label = value.toFixed(decimals);
      }
      label = label.replace(/\.?0+$/, '');
      return { value: mult, label };
    });
  }, [tickSize]);

  if (isLoading) {
    return <div className="text-center py-4 text-neutral-500">Loading order book...</div>;
  }

  return (
    <div className="bg-neutral-900 rounded-lg p-3" style={{ height: '500px' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-neutral-200">Order Book</span>

          {/* Aggregation Level Selector */}
          <select
            value={aggLevel}
            onChange={(e) => setAggLevel(Number(e.target.value))}
            className="bg-neutral-800 text-xs text-neutral-300 rounded px-2 py-1 border border-neutral-700"
          >
            {aggLevelOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Display Mode Toggle */}
        <div className="flex gap-1">
          <button
            onClick={() => setDisplayMode('USD')}
            className={`px-2 py-1 text-xs rounded ${
              displayMode === 'USD' ? 'bg-neutral-700 text-white' : 'text-neutral-500'
            }`}
          >
            USD
          </button>
          <button
            onClick={() => setDisplayMode('TOKEN')}
            className={`px-2 py-1 text-xs rounded ${
              displayMode === 'TOKEN' ? 'bg-neutral-700 text-white' : 'text-neutral-500'
            }`}
          >
            {symbol}
          </button>
        </div>
      </div>

      {/* Column Headers */}
      <div className="grid grid-cols-3 gap-2 text-xs text-neutral-500 pb-1 border-b border-neutral-800">
        <span>Price (USD)</span>
        <span className="text-right">Size</span>
        <span className="text-right">Total</span>
      </div>

      {/* Asks (Sells) - Reversed to show highest price at top */}
      <div className="py-1">
        {asks
          .slice(0, 8)
          .reverse()
          .map((ask, i) => {
            const sizeDisplay = displayMode === 'USD' ? ask.size * ask.price : ask.size;
            const totalDisplay = displayMode === 'USD' ? ask.total * ask.price : ask.total;
            const depthPercent = maxTotal > 0 ? (ask.total / maxTotal) * 100 : 0;

            return (
              <div key={`ask-${i}`} className="grid grid-cols-3 gap-2 py-0.5 relative">
                {/* Depth Bar (background) */}
                <div
                  className="absolute inset-0 bg-red-500/10"
                  style={{ width: `${depthPercent}%`, right: 0, left: 'auto' }}
                />
                {/* Price */}
                <span className="text-red-400 relative z-10 text-xs">
                  {formatPrice(ask.price, tickSize)}
                </span>
                {/* Size */}
                <span className="text-right text-neutral-300 relative z-10 text-xs">
                  {formatSize(sizeDisplay)}
                </span>
                {/* Total */}
                <span className="text-right text-neutral-500 relative z-10 text-xs">
                  {formatSize(totalDisplay)}
                </span>
              </div>
            );
          })}
      </div>

      {/* Spread / Mid Price */}
      <div className="py-1 border-y border-neutral-800">
        <div className="flex items-center justify-between text-xs">
          <span className="text-neutral-500">Spread</span>
          <span className="text-green-400 font-semibold font-mono">
            {markPrice ? formatPrice(markPrice, tickSize) : '-'}
          </span>
          <span className="text-neutral-400 font-mono">{spread.toFixed(4)}%</span>
        </div>
      </div>

      {/* Bids (Buys) */}
      <div className="py-1">
        {bids.slice(0, 8).map((bid, i) => {
          const sizeDisplay = displayMode === 'USD' ? bid.size * bid.price : bid.size;
          const totalDisplay = displayMode === 'USD' ? bid.total * bid.price : bid.total;
          const depthPercent = maxTotal > 0 ? (bid.total / maxTotal) * 100 : 0;

          return (
            <div key={`bid-${i}`} className="grid grid-cols-3 gap-2 py-0.5 relative">
              {/* Depth Bar (background) */}
              <div
                className="absolute inset-0 bg-green-500/10"
                style={{ width: `${depthPercent}%`, right: 0, left: 'auto' }}
              />
              {/* Price */}
              <span className="text-green-400 relative z-10 text-xs">
                {formatPrice(bid.price, tickSize)}
              </span>
              {/* Size */}
              <span className="text-right text-neutral-300 relative z-10 text-xs">
                {formatSize(sizeDisplay)}
              </span>
              {/* Total */}
              <span className="text-right text-neutral-500 relative z-10 text-xs">
                {formatSize(totalDisplay)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Buy/Sell Pressure Bar */}
      <div className="mt-2 pt-2 border-t border-neutral-800">
        <div className="flex items-center justify-between text-[10px] mb-1">
          <span className="text-green-400">B {buyPercentage.toFixed(1)}%</span>
          <span className="text-red-400">S {(100 - buyPercentage).toFixed(1)}%</span>
        </div>
        <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden flex">
          <div
            className="bg-green-500 transition-all duration-300"
            style={{ width: `${buyPercentage}%` }}
          />
          <div
            className="bg-red-500 transition-all duration-300"
            style={{ width: `${100 - buyPercentage}%` }}
          />
        </div>
      </div>
    </div>
  );
}
```

---

## Key Features Explained

### 1. Aggregation Levels

```typescript
// agg_level is a MULTIPLIER of tick_size
// For SOL: tick_size = 0.01
//   agg_level=1   → 0.01 (1 cent precision)
//   agg_level=10  → 0.10 (10 cents)
//   agg_level=100 → 1.00 (1 dollar)

const aggLevelOptions = useMemo(() => {
  const tick = parseFloat(tickSize);
  const multipliers = [1, 10, 100, 1000];

  return multipliers.map((mult) => ({
    value: mult,
    label: (mult * tick).toString(),
  }));
}, [tickSize]);
```

Aggregation groups orders at nearby price levels, reducing noise and making the order book easier to read.

### 2. Cumulative Totals (Depth)

```typescript
// Calculate cumulative totals for depth visualization
let bidTotal = 0;
bids.forEach((bid) => {
  bidTotal += bid.size;
  bid.total = bidTotal;  // Running total
});
```

The depth bar shows how much liquidity exists at each price level cumulatively.

### 3. Depth Bar Visualization

```typescript
// Width of depth bar is proportional to cumulative total
const depthPercent = (bid.total / maxTotal) * 100;

<div
  className="absolute inset-0 bg-green-500/10"
  style={{ width: `${depthPercent}%`, right: 0, left: 'auto' }}
/>
```

- Bars grow from **right to left**
- Green for bids (buys), red for asks (sells)
- Max width = 100% when at maximum cumulative volume

### 4. WebSocket Cache Update Pattern

```typescript
// Instead of managing state, update React Query cache directly
useOrderBookWebSocket(
  symbol,
  (updatedOrderBook) => {
    queryClient.setQueryData(['orderbook', symbol, aggLevel], updatedOrderBook);
  },
  aggLevel
);
```

This pattern:
- Avoids duplicate state management
- Lets React Query handle re-renders automatically
- WebSocket data seamlessly replaces REST API data

### 5. Buy/Sell Pressure Indicator

```typescript
const totalVolume = bidTotal + askTotal;
const buyPercentage = (bidTotal / totalVolume) * 100;

// Visual bar showing market sentiment
<div className="h-1.5 flex">
  <div style={{ width: `${buyPercentage}%` }} className="bg-green-500" />
  <div style={{ width: `${100 - buyPercentage}%` }} className="bg-red-500" />
</div>
```

Shows the ratio of total bid volume vs ask volume at a glance.

### 6. Display Mode (USD vs Token)

```typescript
// Toggle between showing size in USD or token units
const sizeDisplay = displayMode === 'USD' ? bid.size * bid.price : bid.size;
const totalDisplay = displayMode === 'USD' ? bid.total * bid.price : bid.total;
```

---

## WebSocket Message Format

### Subscribe

```json
{
  "method": "subscribe",
  "params": {
    "source": "book",
    "symbol": "BTC",
    "agg_level": 10
  }
}
```

### Unsubscribe

```json
{
  "method": "unsubscribe",
  "params": {
    "source": "book",
    "symbol": "BTC",
    "agg_level": 10
  }
}
```

### Stream Response

```json
{
  "channel": "book",
  "data": {
    "l": [
      [
        { "p": "106504", "a": "0.26203", "n": 1 },
        { "p": "106498", "a": "0.29281", "n": 1 }
      ],
      [
        { "p": "106559", "a": "0.26802", "n": 1 },
        { "p": "106564", "a": "0.3002", "n": 1 }
      ]
    ],
    "t": 1751370536325
  }
}
```

**Note:** WebSocket updates arrive approximately every 100ms.

---

## Common Issues & Solutions

### Issue 1: Order book flickers or resets

**Cause:** WebSocket reconnecting or aggLevel changing

**Solution:** Ensure proper cleanup when aggLevel changes:
```typescript
useEffect(() => {
  // ... subscribe logic

  return () => {
    // Unsubscribe from OLD aggLevel before subscribing to new
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        method: 'unsubscribe',
        params: { source: 'book', symbol, agg_level: aggLevel },
      }));
    }
    ws.close();
  };
}, [symbol, aggLevel]);
```

### Issue 2: Asks/Bids in wrong order

**Cause:** Bids should be sorted descending (best bid first), asks ascending (best ask first)

**Solution:**
```typescript
// l[0] = bids (already sorted: best bid first = highest price)
// l[1] = asks (already sorted: best ask first = lowest price)

// For display, REVERSE asks so highest ask is at top of the asks section
asks.slice(0, 8).reverse()
```

### Issue 3: Depth bars not proportional

**Cause:** Using individual size instead of cumulative total

**Solution:**
```typescript
// WRONG: uses individual size
const depthPercent = (bid.size / maxSize) * 100;

// CORRECT: uses cumulative total
const depthPercent = (bid.total / maxTotal) * 100;
```

### Issue 4: Price precision issues

**Cause:** Not using tick_size for formatting

**Solution:**
```typescript
const formatPrice = (price: number, tickSize?: string): string => {
  if (tickSize) {
    const tick = parseFloat(tickSize);
    const decimals = Math.max(0, -Math.floor(Math.log10(tick)));
    return price.toFixed(decimals);
  }
  return price.toFixed(2); // fallback
};
```

### Issue 5: WebSocket not reconnecting

**Cause:** No reconnection logic

**Solution:** Add reconnection with exponential backoff:
```typescript
const reconnectAttempts = useRef(0);
const maxReconnectAttempts = 5;

ws.onclose = () => {
  if (reconnectAttempts.current < maxReconnectAttempts) {
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
    setTimeout(() => {
      reconnectAttempts.current++;
      // Reconnect logic here
    }, delay);
  }
};
```

---

## Example Usage

```tsx
// pages/trading.tsx

import { OrderBook } from '@/components/order-book';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

export default function TradingPage() {
  const symbol = 'BTC';
  const tickSize = '1';      // From GET /api/v1/info
  const markPrice = 106500;  // From price data

  return (
    <QueryClientProvider client={queryClient}>
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">BTC/USD</h1>
        <OrderBook
          symbol={symbol}
          tickSize={tickSize}
          markPrice={markPrice}
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
| `api-client.ts` | REST API call for order book (`getOrderBook`) |
| `use-order-book.ts` | React Query hook with fast polling (200ms) |
| `use-orderbook-websocket.ts` | WebSocket subscription for real-time updates |
| `order-book.tsx` | Visual component with depth bars and pressure indicator |

**Key Concepts:**
- `l[0]` = bids (buy orders), `l[1]` = asks (sell orders)
- `agg_level` = multiplier of `tick_size` for price grouping
- Depth bars use **cumulative totals**, not individual sizes
- WebSocket updates directly to React Query cache
- Reverse asks for display (highest price at top)

**Data Flow:**
1. Initial load: REST API → React Query → Component
2. Real-time: WebSocket → Update Query cache → Auto re-render
3. Change aggLevel: Unsubscribe old → Subscribe new → Fresh data
