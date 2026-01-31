'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import { getStoredReferralCode, clearStoredReferralCode } from '@/lib/hooks/useReferralTracking';
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
  const { token, user, walletAddress: storedWalletAddress, isAuthenticated, pacificaConnected, setAuth, setPacificaConnected, clearAuth, _hasHydrated } = useAuthStore();
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

      // Store auth state including Pacifica connection status AND wallet address
      setAuth(response.token, response.user, response.pacificaConnected, publicKey.toBase58());

      return response;
    } catch (error) {
      console.error('Authentication failed:', error);
      throw error;
    } finally {
      setIsAuthenticating(false);
      globalAuthInProgress = false;
    }
  }, [publicKey, signMessage, setAuth, isAuthenticating]);

  // Detect wallet account change - if user switches accounts in wallet, clear auth and re-authenticate
  useEffect(() => {
    if (!_hasHydrated) return;

    // If authenticated but wallet address changed, clear auth and trigger re-auth
    if (isAuthenticated && storedWalletAddress && currentWalletAddress && storedWalletAddress !== currentWalletAddress) {
      console.log('Wallet account changed, re-authenticating...', { stored: storedWalletAddress, current: currentWalletAddress });
      clearAuth();
      hasAttemptedAuth.current = false;
      globalHasAttempted = false;
      // The auto-login effect below will trigger re-authentication
    }
  }, [_hasHydrated, isAuthenticated, storedWalletAddress, currentWalletAddress, clearAuth]);

  // Listen to wallet provider's accountChanged event directly (wallet adapter doesn't always emit this)
  // Supports Phantom, Solflare, Backpack, and other Solana wallets
  useEffect(() => {
    if (!connected) return;

    const providers = getWalletProviders();
    if (providers.length === 0) return;

    const handleAccountChanged = (walletName: string) => (newPublicKey: PublicKey | null) => {
      const newAddress = newPublicKey?.toBase58() || null;
      console.log(`${walletName} accountChanged event:`, { newAddress, storedWalletAddress });

      // If we're authenticated and account changed, clear auth
      if (isAuthenticated && storedWalletAddress && newAddress && storedWalletAddress !== newAddress) {
        console.log(`Account changed via ${walletName} event, clearing auth...`);
        clearAuth();
        hasAttemptedAuth.current = false;
        globalHasAttempted = false;
        // Disconnect to force reconnect with new account
        disconnect();
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
  }, [connected, isAuthenticated, storedWalletAddress, clearAuth, disconnect]);

  // Auto-login when wallet connects (only after hydration and if not already authenticated)
  useEffect(() => {
    // Don't attempt auto-login until Zustand has hydrated from localStorage
    if (!_hasHydrated) return;

    // If already authenticated with the SAME wallet, don't request signature again
    if (isAuthenticated && storedWalletAddress === currentWalletAddress) {
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
  }, [_hasHydrated, connected, publicKey, signMessage, isAuthenticated, storedWalletAddress, currentWalletAddress, isAuthenticating, login]);

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
