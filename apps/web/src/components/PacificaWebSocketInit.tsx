'use client';

/**
 * Initializes the Exchange WebSocket connection when wallet is connected.
 * This component doesn't render anything - it just manages the WebSocket lifecycle.
 *
 * Name kept as PacificaWebSocketInit for backward compat (imported in trade page).
 */

import { useExchangeWebSocket } from '@/hooks/useExchangeWebSocket';

export function PacificaWebSocketInit() {
  useExchangeWebSocket();
  return null;
}
