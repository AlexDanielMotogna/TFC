'use client';

/**
 * Backward-compatibility re-export.
 * The real implementation is now in useExchangeWebSocket.ts
 *
 * All consumers importing from this file will get the exchange-agnostic versions.
 */

export {
  useExchangeWebSocket as usePacificaWebSocket,
  useExchangeWsStore as usePacificaWsStore,
} from './useExchangeWebSocket';

export type {
  Position,
  Order,
  Trade,
} from './useExchangeWebSocket';
