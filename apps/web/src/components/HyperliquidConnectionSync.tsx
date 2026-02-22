/**
 * Component to sync Hyperliquid connection status
 * Polls /api/auth/hyperliquid/me to keep agent approval status current
 */

'use client';

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';

const POLL_INTERVAL_MS = 5000;

export function HyperliquidConnectionSync() {
  const token = useAuthStore((s) => s.token);
  const exchangeType = useAuthStore((s) => s.exchangeType);
  const evmWalletAddress = useAuthStore((s) => s.evmWalletAddress);
  const setHyperliquidStatus = useAuthStore((s) => s.setHyperliquidStatus);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Only poll when authenticated on Hyperliquid with an EVM wallet
    if (!token || exchangeType !== 'hyperliquid' || !evmWalletAddress) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      // Clear stale HL status when conditions aren't met
      if (exchangeType === 'hyperliquid' && !evmWalletAddress) {
        setHyperliquidStatus(false, false);
      }
      return;
    }

    const poll = async () => {
      try {
        // Send the current EVM address so the backend can auto-sync
        // if the stored address is wrong (e.g. Solana address from auth)
        const data = await api.getHyperliquidStatus(token, evmWalletAddress ?? undefined);
        setHyperliquidStatus(data.connected, data.agentApproved);
      } catch (error) {
        console.error('Failed to sync Hyperliquid connection:', error);
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
  }, [token, exchangeType, evmWalletAddress, setHyperliquidStatus]);

  return null;
}
