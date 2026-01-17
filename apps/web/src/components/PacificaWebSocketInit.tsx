'use client';

/**
 * Initializes the Pacifica WebSocket connection when wallet is connected
 * This component doesn't render anything - it just manages the WebSocket lifecycle
 */

import { usePacificaWebSocket } from '@/hooks/usePacificaWebSocket';

export function PacificaWebSocketInit() {
  // This hook handles all the WebSocket connection logic
  // It automatically connects when wallet is connected and disconnects when wallet disconnects
  usePacificaWebSocket();

  return null;
}
