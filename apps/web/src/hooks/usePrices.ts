'use client';

/**
 * usePrices — Exchange-agnostic price hook
 *
 * Uses the ExchangeWsAdapter for real-time price data.
 * Automatically connects to the correct exchange's WS based on ExchangeContext.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useExchangeContext } from '@/contexts/ExchangeContext';
import { createWsAdapter } from '@/lib/ws/ws-factory';
import type { ExchangeWsAdapter, WsPrice, WsMarket } from '@/lib/ws/types';

// Re-export types for backward compatibility
export type PriceData = WsPrice;
export type Market = WsMarket;

interface UsePricesOptions {
  symbols?: string[];
}

export function usePrices(_options: UsePricesOptions = {}) {
  const { exchangeType } = useExchangeContext();

  const [prices, setPrices] = useState<Record<string, WsPrice>>({});
  const [markets, setMarkets] = useState<WsMarket[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const adapterRef = useRef<ExchangeWsAdapter | null>(null);
  const currentExchangeRef = useRef(exchangeType);

  useEffect(() => {
    // Disconnect old adapter if exchange changed
    if (adapterRef.current && currentExchangeRef.current !== exchangeType) {
      adapterRef.current.disconnect();
      adapterRef.current = null;
      setPrices({});
      setMarkets([]);
    }

    currentExchangeRef.current = exchangeType;
    const adapter = createWsAdapter(exchangeType);
    adapterRef.current = adapter;

    adapter.connect({
      onConnected: () => {
        setIsConnected(true);
        setError(null);
      },
      onDisconnected: () => setIsConnected(false),
      onPrices: (newPrices, newMarkets) => {
        setPrices(prev => {
          const updated = { ...prev };
          newPrices.forEach(p => { updated[p.symbol] = p; });
          return updated;
        });
        // Only set markets from WS if we don't have them yet
        setMarkets(prev => {
          if (prev.length === 0 && newMarkets.length > 0) {
            return newMarkets.sort((a, b) => {
              const volA = newPrices.find(p => p.symbol === a.symbol)?.volume24h || 0;
              const volB = newPrices.find(p => p.symbol === b.symbol)?.volume24h || 0;
              return volB - volA;
            });
          }
          return prev;
        });
      },
      onError: (err) => setError(err),
    });

    // Subscribe to prices (public, no auth)
    adapter.subscribePrices();

    return () => {
      adapter.disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exchangeType]);

  const getPrice = useCallback(
    (symbol: string): WsPrice | null => {
      return prices[symbol] || null;
    },
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
