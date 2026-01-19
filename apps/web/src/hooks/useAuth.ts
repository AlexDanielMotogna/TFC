'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import bs58 from 'bs58';

const AUTH_MESSAGE = 'Sign this message to authenticate with Trading Fight Club';

// Global flag to prevent multiple simultaneous auth attempts across components
let globalAuthInProgress = false;
let globalHasAttempted = false;

export function useAuth() {
  const { publicKey, signMessage, connected, connecting, disconnect } = useWallet();
  const { token, user, isAuthenticated, pacificaConnected, setAuth, setPacificaConnected, clearAuth, _hasHydrated } = useAuthStore();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const hasAttemptedAuth = useRef(false);

  const login = useCallback(async () => {
    if (!publicKey || !signMessage) {
      throw new Error('Wallet not connected');
    }

    // Prevent multiple simultaneous auth attempts
    if (isAuthenticating || globalAuthInProgress) return;

    globalAuthInProgress = true;
    setIsAuthenticating(true);
    try {
      // Create message to sign
      const message = new TextEncoder().encode(AUTH_MESSAGE);

      // Request signature from wallet
      const signature = await signMessage(message);
      const signatureBase58 = bs58.encode(signature);

      // Send to API - will create account and auto-link Pacifica if available
      const response = await api.connectWallet(
        publicKey.toBase58(),
        signatureBase58
      );

      // Store auth state including Pacifica connection status
      setAuth(response.token, response.user, response.pacificaConnected);

      return response;
    } catch (error) {
      console.error('Authentication failed:', error);
      throw error;
    } finally {
      setIsAuthenticating(false);
      globalAuthInProgress = false;
    }
  }, [publicKey, signMessage, setAuth, isAuthenticating]);

  // Auto-login when wallet connects (only after hydration and if not already authenticated)
  useEffect(() => {
    // Don't attempt auto-login until Zustand has hydrated from localStorage
    if (!_hasHydrated) return;

    // If already authenticated (from persisted state), don't request signature again
    if (isAuthenticated) {
      hasAttemptedAuth.current = true;
      globalHasAttempted = true;
      return;
    }

    // Only attempt login if wallet is connected and we haven't tried yet (globally)
    if (connected && publicKey && signMessage && !isAuthenticating && !hasAttemptedAuth.current && !globalHasAttempted && !globalAuthInProgress) {
      hasAttemptedAuth.current = true;
      globalHasAttempted = true;
      login().catch((err) => {
        // User rejected signature or API error - that's ok
        console.log('Auto-login skipped:', err.message);
        // Reset flag on error so user can try again
        globalHasAttempted = false;
        hasAttemptedAuth.current = false;
      });
    }
  }, [_hasHydrated, connected, publicKey, signMessage, isAuthenticated, isAuthenticating, login]);

  // Reset auth attempt flag when wallet disconnects
  useEffect(() => {
    if (!connected) {
      hasAttemptedAuth.current = false;
      globalHasAttempted = false;
      globalAuthInProgress = false;
      if (isAuthenticated) {
        clearAuth();
      }
    }
  }, [connected, isAuthenticated, clearAuth]);

  const logout = useCallback(() => {
    clearAuth();
    hasAttemptedAuth.current = false;
    globalHasAttempted = false;
    globalAuthInProgress = false;
    disconnect();
  }, [clearAuth, disconnect]);

  return {
    token,
    user,
    isAuthenticated,
    pacificaConnected,
    isAuthenticating,
    isConnecting: connecting,
    isWalletConnected: connected,
    walletAddress: publicKey?.toBase58() || null,
    login,
    logout,
    setPacificaConnected,
  };
}
