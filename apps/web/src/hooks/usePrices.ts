'use client';

/**
 * usePrices — Exchange-agnostic price hook (Zustand-backed)
 *
 * Uses the ExchangeWsAdapter for real-time price data.
 * Prices are stored in the global usePriceStore (Zustand) so that
 * consumers can use fine-grained selectors and avoid unnecessary re-renders.
 *
 * Two hooks are provided:
 *
 * 1. `usePriceConnection()` — manages WS lifecycle only. Does NOT subscribe to
 *    price state, so it never causes re-renders. Call this once in a top-level
 *    component (e.g., TradePageContent) to ensure prices are flowing.
 *
 * 2. `usePrices()` — backward-compatible wrapper that manages WS lifecycle AND
 *    subscribes to the full prices/markets state. Use this in components that
 *    need the full price map (e.g., CryptoTickers, HeroSection).
 *
 * For granular subscriptions, use `usePrice(symbol)` from `@/lib/store` instead.
 */

import { useEffect, useCallback, useRef } from 'react';
import { useExchangeContext } from '@/contexts/ExchangeContext';
import { createWsAdapter } from '@/lib/ws/ws-factory';
import { usePriceStore } from '@/lib/store';
import type { ExchangeWsAdapter, ExchangeWsCallbacks, WsPrice, WsMarket } from '@/lib/ws/types';

// Re-export types for backward compatibility
export type PriceData = WsPrice;
export type Market = WsMarket;

interface UsePricesOptions {
  symbols?: string[];
}

/**
 * Manages WebSocket price connection lifecycle.
 * Writes prices into usePriceStore but does NOT subscribe to the store,
 * so this hook never causes re-renders on price ticks.
 *
 * Call this once in a top-level component to ensure prices are flowing.
 * Then use `usePrice(symbol)` or `usePriceStore` selectors for reads.
 */
export function usePriceConnection() {
  const { exchangeType } = useExchangeContext();

  const adapterRef = useRef<ExchangeWsAdapter | null>(null);
  const callbacksRef = useRef<ExchangeWsCallbacks | null>(null);
  const currentExchangeRef = useRef(exchangeType);

  useEffect(() => {
    const { updatePrices, setMarkets, setConnected, setError, clearPrices } =
      usePriceStore.getState();

    // Remove old callbacks if exchange changed
    const exchangeChanged = currentExchangeRef.current !== exchangeType;
    if (adapterRef.current && exchangeChanged) {
      if (callbacksRef.current) {
        adapterRef.current.removeCallbacks(callbacksRef.current);
      }
      adapterRef.current = null;
      callbacksRef.current = null;
      clearPrices();
    }

    currentExchangeRef.current = exchangeType;
    // Track whether this effect's adapter has sent its first markets batch
    let marketsReceived = false;
    const adapter = createWsAdapter(exchangeType);
    adapterRef.current = adapter;

    const callbacks: ExchangeWsCallbacks = {
      onConnected: () => {
        setConnected(true);
        setError(null);
      },
      onDisconnected: () => setConnected(false),
      onPrices: (newPrices, newMarkets) => {
        // Write prices into the Zustand store (with change detection)
        updatePrices(newPrices);

        // Set markets on first batch from new adapter (after exchange switch or initial load)
        if (!marketsReceived && newMarkets.length > 0) {
          marketsReceived = true;
          setMarkets(
            [...newMarkets].sort((a, b) => {
              const volA = newPrices.find((p) => p.symbol === a.symbol)?.volume24h || 0;
              const volB = newPrices.find((p) => p.symbol === b.symbol)?.volume24h || 0;
              return volB - volA;
            })
          );
        }
      },
      onError: (err) => setError(err),
    };
    callbacksRef.current = callbacks;

    // Register callbacks (merged with any existing ones from other hooks)
    adapter.connect(callbacks);

    // Subscribe to prices (public, no auth)
    adapter.subscribePrices();

    return () => {
      // Only remove our callbacks -- don't kill the shared connection
      adapter.removeCallbacks(callbacks);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exchangeType]);
}

/**
 * Full backward-compatible price hook.
 * Manages WS lifecycle AND subscribes to prices/markets state.
 *
 * Use this in components that need the full price map (CryptoTickers, HeroSection).
 * For performance-sensitive components, prefer `usePriceConnection()` +
 * `usePrice(symbol)` / `usePriceStore` selectors.
 */
export function usePrices(_options: UsePricesOptions = {}) {
  // Manage WS lifecycle
  usePriceConnection();

  // Subscribe to the full Zustand store state (backward-compat)
  const prices = usePriceStore((s) => s.prices);
  const markets = usePriceStore((s) => s.markets);
  const isConnected = usePriceStore((s) => s.isConnected);
  const error = usePriceStore((s) => s.error);

  const getPrice = useCallback(
    (symbol: string): WsPrice | null => {
      // Read directly from the store to get the latest value
      return usePriceStore.getState().prices[symbol] || null;
    },
    // Depend on prices so that useMemo/useCallback consumers that list
    // getPrice as a dependency will re-evaluate when any price updates.
    // This preserves backward-compat with existing code like:
    //   useMemo(() => ..., [getPrice])
    [prices]
  );

  const formatPrice = useCallback((price: number): string => {
    if (price >= 1000) {
      return price.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    } else if (price >= 1) {
      return price.toFixed(4);
    } else {
      return price.toFixed(6);
    }
  }, []);

  return {
    prices,
    markets,
    isConnected,
    error,
    getPrice,
    formatPrice,
  };
}
