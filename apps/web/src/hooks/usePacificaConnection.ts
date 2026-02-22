/**
 * Hook to sync Pacifica connection status
 * Polls the backend to check if user has an active Pacifica connection.
 * Passes the current trading wallet address so the backend can re-link
 * if the user switches to a different Solana wallet.
 */

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/store';

export function usePacificaConnection() {
  const { token, isAuthenticated, pacificaConnected, setPacificaConnected, tradingWalletAddress } = useAuthStore();

  // Query Pacifica connection status, passing the current trading wallet
  const { data } = useQuery({
    queryKey: ['pacifica-connection', token, tradingWalletAddress],
    queryFn: async () => {
      if (!token) return null;

      const params = tradingWalletAddress
        ? `?tradingWallet=${encodeURIComponent(tradingWalletAddress)}`
        : '';
      const response = await fetch(`/api/auth/pacifica/me${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch Pacifica connection status');
      }

      const json = await response.json();
      // withAuth wraps response in { success, data }, unwrap it
      return json.data ?? json;
    },
    enabled: isAuthenticated && !!token,
    refetchInterval: 10000, // Poll every 10 seconds
    refetchOnMount: 'always', // Always fetch fresh data on mount (important for iOS dApp browsers)
    refetchOnWindowFocus: true, // Re-fetch when app returns to foreground
    staleTime: 5000,
  });

  // Sync Pacifica connection status with Zustand store
  useEffect(() => {
    if (data?.connected !== undefined && data.connected !== pacificaConnected) {
      console.log('Syncing Pacifica connection status:', data.connected);
      setPacificaConnected(data.connected);
    }
  }, [data, pacificaConnected, setPacificaConnected]);

  return {
    pacificaConnected: data?.connected || false,
    pacificaAddress: data?.pacificaAddress || null,
    connectedAt: data?.connectedAt || null,
    isLoading: !data && isAuthenticated,
  };
}
