/**
 * Component to sync Pacifica connection status
 * This runs in the background to keep the connection status up to date
 */

'use client';

import { usePacificaConnection } from '@/hooks';
import { useEffect } from 'react';

export function PacificaConnectionSync() {
  const { pacificaConnected, isLoading } = usePacificaConnection();

  useEffect(() => {
    if (!isLoading) {
      console.log('Pacifica connection status:', pacificaConnected ? 'connected' : 'not connected');
    }
  }, [pacificaConnected, isLoading]);

  // This component doesn't render anything, it just syncs state
  return null;
}
