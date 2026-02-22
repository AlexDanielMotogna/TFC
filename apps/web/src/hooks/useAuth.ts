'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import { getStoredReferralCode, clearStoredReferralCode } from '@/lib/hooks/useReferralTracking';
import { queryClient } from '@/lib/queryClient';
import bs58 from 'bs58';
import { PublicKey } from '@solana/web3.js';

const AUTH_MESSAGE = 'Sign this message to authenticate with Trading Fight Club';

// Global flag to prevent multiple simultaneous auth attempts across components
let globalAuthInProgress = false;
let globalHasAttempted = false;

// Type for wallet provider events
interface WalletProvider {
  publicKey: PublicKey | null;
  on: (event: string, callback: (publicKey: PublicKey | null) => void) => void;
  off?: (event: string, callback: (publicKey: PublicKey | null) => void) => void;
  removeListener?: (event: string, callback: (publicKey: PublicKey | null) => void) => void;
}

// Extended window type for wallet providers
interface WindowWithWallets extends Window {
  phantom?: { solana?: WalletProvider };
  solflare?: WalletProvider;
  solana?: WalletProvider; // Generic Solana provider (backpack, etc.)
}

// Get all available wallet providers
function getWalletProviders(): { name: string; provider: WalletProvider }[] {
  if (typeof window === 'undefined') return [];

  const win = window as WindowWithWallets;
  const providers: { name: string; provider: WalletProvider }[] = [];

  // Phantom
  if (win.phantom?.solana) {
    providers.push({ name: 'Phantom', provider: win.phantom.solana });
  }

  // Solflare
  if (win.solflare) {
    providers.push({ name: 'Solflare', provider: win.solflare });
  }

  // Generic Solana provider (Backpack, etc.) - only if not already added
  if (win.solana && !providers.some(p => p.provider === win.solana)) {
    providers.push({ name: 'Solana', provider: win.solana });
  }

  return providers;
}

// Helper to remove event listener (handles both off and removeListener)
function removeProviderListener(
  provider: WalletProvider,
  event: string,
  callback: (publicKey: PublicKey | null) => void
) {
  if (provider.off) {
    provider.off(event, callback);
  } else if (provider.removeListener) {
    provider.removeListener(event, callback);
  }
}

export function useAuth() {
  const { publicKey, signMessage, connected, connecting, disconnect, wallet } = useWallet();
  const {
    token, user, walletAddress: storedWalletAddress,
    isAuthenticated, pacificaConnected, pacificaFailReason, exchangeType,
    solanaWalletConnected, tradingWalletAddress,
    setAuth, setPacificaConnected, setSolanaWalletConnected, setTradingWalletAddress,
    disconnectTradingWallet, clearSolanaAuth, clearAuth, _hasHydrated,
  } = useAuthStore();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const hasAttemptedAuth = useRef(false);
  const currentWalletAddress = publicKey?.toBase58() || null;

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

      // Get referral code from localStorage (if user came via referral link)
      const referralCode = getStoredReferralCode() || undefined;

      // Send to API - will create account and auto-link Pacifica if available
      const response = await api.connectWallet(
        publicKey.toBase58(),
        signatureBase58,
        referralCode
      );

      // Clear referral code after successful registration
      if (referralCode) {
        clearStoredReferralCode();
      }

      // Store auth state including Pacifica connection status, wallet address, and fail reason
      setAuth(response.token, response.user, response.pacificaConnected, publicKey.toBase58(), response.pacificaFailReason);

      // Also sync the trading wallet address
      setSolanaWalletConnected(true);
      setTradingWalletAddress(publicKey.toBase58());

      return response;
    } catch (error) {
      console.error('Authentication failed:', error);
      throw error;
    } finally {
      setIsAuthenticating(false);
      globalAuthInProgress = false;
    }
  }, [publicKey, signMessage, setAuth, setSolanaWalletConnected, setTradingWalletAddress, isAuthenticating]);

  // Sync live wallet adapter state to store and handle wallet switches
  // When wallet changes: update trading wallet, invalidate Pacifica connection to re-link
  // When wallet disconnects: mark trading wallet as disconnected (but KEEP JWT/auth)
  useEffect(() => {
    if (!_hasHydrated) return;

    setSolanaWalletConnected(connected);

    if (connected && currentWalletAddress) {
      // Wallet is connected — update trading wallet address
      const previousTradingWallet = tradingWalletAddress;
      setTradingWalletAddress(currentWalletAddress);

      // If trading wallet changed, invalidate Pacifica to re-link with new wallet
      if (previousTradingWallet && previousTradingWallet !== currentWalletAddress) {
        console.log('Trading wallet changed, re-linking Pacifica...', {
          previous: previousTradingWallet,
          current: currentWalletAddress,
        });
        // Clear stale data for the old wallet and re-fetch for the new one
        queryClient.invalidateQueries({ queryKey: ['pacifica-connection'] });
        queryClient.invalidateQueries({ queryKey: ['positions'] });
        queryClient.invalidateQueries({ queryKey: ['account'] });
        queryClient.invalidateQueries({ queryKey: ['orders'] });
        queryClient.invalidateQueries({ queryKey: ['trade-history'] });
        queryClient.invalidateQueries({ queryKey: ['account-settings'] });
      }
    } else if (!connected) {
      // Wallet disconnected — keep JWT alive, just mark trading wallet as disconnected
      hasAttemptedAuth.current = false;
      globalHasAttempted = false;
      globalAuthInProgress = false;
      disconnectTradingWallet();
    }
  }, [_hasHydrated, connected, currentWalletAddress, tradingWalletAddress,
      setSolanaWalletConnected, setTradingWalletAddress, disconnectTradingWallet]);

  // Listen to wallet provider's accountChanged event directly (wallet adapter doesn't always emit this)
  // Supports Phantom, Solflare, Backpack, and other Solana wallets
  // On account change: just update trading wallet (don't kill auth)
  useEffect(() => {
    if (!connected) return;

    const providers = getWalletProviders();
    if (providers.length === 0) return;

    const handleAccountChanged = (walletName: string) => (newPublicKey: PublicKey | null) => {
      const newAddress = newPublicKey?.toBase58() || null;
      console.log(`${walletName} accountChanged event:`, { newAddress, tradingWalletAddress });

      if (newAddress) {
        // Wallet switched to a different account — update trading wallet
        if (newAddress !== tradingWalletAddress) {
          console.log(`Trading wallet changed via ${walletName} event`);
          setTradingWalletAddress(newAddress);
          queryClient.invalidateQueries({ queryKey: ['pacifica-connection'] });
          queryClient.invalidateQueries({ queryKey: ['positions'] });
          queryClient.invalidateQueries({ queryKey: ['account'] });
          queryClient.invalidateQueries({ queryKey: ['orders'] });
          queryClient.invalidateQueries({ queryKey: ['trade-history'] });
          queryClient.invalidateQueries({ queryKey: ['account-settings'] });
        }
      } else {
        // Wallet disconnected via provider event
        disconnectTradingWallet();
      }
    };

    // Store callbacks for cleanup
    const callbacks = providers.map(({ name, provider }) => {
      const callback = handleAccountChanged(name);
      provider.on('accountChanged', callback);
      return { provider, callback };
    });

    return () => {
      callbacks.forEach(({ provider, callback }) => {
        removeProviderListener(provider, 'accountChanged', callback);
      });
    };
  }, [connected, tradingWalletAddress, setTradingWalletAddress, disconnectTradingWallet]);

  // Auto-login when wallet connects (only after hydration and if not already authenticated)
  useEffect(() => {
    // Don't attempt auto-login until Zustand has hydrated from localStorage
    if (!_hasHydrated) return;

    // Skip Solana auto-login when user is on Hyperliquid exchange
    if (exchangeType === 'hyperliquid') return;

    // Already authenticated — just sync trading wallet, no re-auth needed
    if (isAuthenticated && connected && currentWalletAddress) {
      hasAttemptedAuth.current = true;
      globalHasAttempted = true;
      setSolanaWalletConnected(true);
      setTradingWalletAddress(currentWalletAddress);
      // Force Pacifica status re-check for the current trading wallet
      queryClient.invalidateQueries({ queryKey: ['pacifica-connection'] });
      return;
    }

    // Not authenticated — attempt login (first wallet connection)
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
  }, [_hasHydrated, connected, publicKey, signMessage, isAuthenticated, currentWalletAddress, isAuthenticating, login, exchangeType, setSolanaWalletConnected, setTradingWalletAddress]);

  // Detect wallet changes when app regains focus (handles mobile wallet switching)
  // On mobile (Phantom dApp browser, Android), users can switch wallets while the app is in background.
  // The accountChanged event doesn't always fire, so we check on visibility/focus.
  useEffect(() => {
    if (!_hasHydrated || !isAuthenticated) return;

    const checkWalletChanged = () => {
      // Check if the injected provider's publicKey differs from our trading wallet
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const phantom = (window as any).phantom?.solana;
      const currentKey = phantom?.publicKey?.toBase58?.() || publicKey?.toBase58() || null;

      if (currentKey && tradingWalletAddress && currentKey !== tradingWalletAddress) {
        console.log('Trading wallet changed on focus/visibility:', { stored: tradingWalletAddress, current: currentKey });
        setTradingWalletAddress(currentKey);
        queryClient.invalidateQueries({ queryKey: ['pacifica-connection'] });
        queryClient.invalidateQueries({ queryKey: ['positions'] });
        queryClient.invalidateQueries({ queryKey: ['account'] });
        queryClient.invalidateQueries({ queryKey: ['orders'] });
        queryClient.invalidateQueries({ queryKey: ['trade-history'] });
        queryClient.invalidateQueries({ queryKey: ['account-settings'] });
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Small delay to let wallet adapter update its state
        setTimeout(checkWalletChanged, 300);
      }
    };

    const handleFocus = () => {
      setTimeout(checkWalletChanged, 300);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [_hasHydrated, isAuthenticated, tradingWalletAddress, publicKey, setTradingWalletAddress]);

  // Explicit logout — full session reset + wallet disconnect
  const logout = useCallback(() => {
    clearAuth();
    // Clear React Query cache to remove stale user data
    queryClient.clear();
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
    pacificaFailReason,
    isAuthenticating,
    isConnecting: connecting,
    isWalletConnected: connected,
    solanaWalletConnected,
    walletAddress: publicKey?.toBase58() || null,
    tradingWalletAddress,
    login,
    logout,
    setPacificaConnected,
  };
}
