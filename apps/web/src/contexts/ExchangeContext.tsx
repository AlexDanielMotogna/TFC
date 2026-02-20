'use client';

import { createContext, useContext, useMemo, useCallback } from 'react';
import { useAuthStore } from '@/lib/store';
import {
  type ExchangeType,
  type ExchangeConfig,
  EXCHANGE_CONFIGS,
  DEFAULT_EXCHANGE,
} from '@tfc/shared';

// ─────────────────────────────────────────────────────────────
// Context Types
// ─────────────────────────────────────────────────────────────

interface ExchangeContextValue {
  /** Current active exchange type */
  exchangeType: ExchangeType;
  /** Full config for the active exchange */
  exchangeConfig: ExchangeConfig;
  /** Whether the user is connected to the active exchange */
  isExchangeConnected: boolean;
  /** Switch active exchange */
  switchExchange: (type: ExchangeType) => void;
}

// ─────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────

const ExchangeContext = createContext<ExchangeContextValue | null>(null);

// ─────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────

export function ExchangeProvider({ children }: { children: React.ReactNode }) {
  const exchangeType = useAuthStore((s) => s.exchangeType ?? DEFAULT_EXCHANGE);
  const pacificaConnected = useAuthStore((s) => s.pacificaConnected);
  const setExchangeType = useAuthStore((s) => s.setExchangeType);

  const exchangeConfig = useMemo(
    () => EXCHANGE_CONFIGS[exchangeType],
    [exchangeType],
  );

  // For now, only Pacifica connection status is tracked.
  // When Hyperliquid/Lighter are added, this will check the appropriate connection.
  const isExchangeConnected = useMemo(() => {
    switch (exchangeType) {
      case 'pacifica':
        return pacificaConnected;
      case 'hyperliquid':
      case 'lighter':
        // TODO: check ethereum wallet connection when implemented
        return false;
      default:
        return false;
    }
  }, [exchangeType, pacificaConnected]);

  const switchExchange = useCallback(
    (type: ExchangeType) => {
      setExchangeType(type);
    },
    [setExchangeType],
  );

  const value = useMemo<ExchangeContextValue>(
    () => ({
      exchangeType,
      exchangeConfig,
      isExchangeConnected,
      switchExchange,
    }),
    [exchangeType, exchangeConfig, isExchangeConnected, switchExchange],
  );

  return (
    <ExchangeContext.Provider value={value}>
      {children}
    </ExchangeContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────

export function useExchangeContext(): ExchangeContextValue {
  const ctx = useContext(ExchangeContext);
  if (!ctx) {
    throw new Error('useExchangeContext must be used within <ExchangeProvider>');
  }
  return ctx;
}
