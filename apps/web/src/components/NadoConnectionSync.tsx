/**
 * Component to sync Nado connection status
 * Polls /api/auth/nado/me to keep linked signer approval status current
 */

'use client';

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';

const POLL_INTERVAL_MS = 5000;

export function NadoConnectionSync() {
  const token = useAuthStore((s) => s.token);
  const exchangeType = useAuthStore((s) => s.exchangeType);
  const evmWalletAddress = useAuthStore((s) => s.evmWalletAddress);
  const setNadoStatus = useAuthStore((s) => s.setNadoStatus);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Only poll when authenticated on Nado with an EVM wallet
    if (!token || exchangeType !== 'nado' || !evmWalletAddress) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (exchangeType === 'nado' && !evmWalletAddress) {
        setNadoStatus(false, false);
      }
      return;
    }

    const poll = async () => {
      try {
        const data = await api.getNadoStatus(token, evmWalletAddress ?? undefined);
        setNadoStatus(data.connected, data.agentApproved);
      } catch (error) {
        console.error('Failed to sync Nado connection:', error);
      }
    };

    poll(); // Initial fetch
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [token, exchangeType, evmWalletAddress, setNadoStatus]);

  return null;
}
