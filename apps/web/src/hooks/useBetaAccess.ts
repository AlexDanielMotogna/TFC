'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';

interface BetaAccessState {
  hasAccess: boolean;
  status: 'pending' | 'approved' | 'rejected' | null;
  applied: boolean;
  appliedAt: string | null;
  isLoading: boolean;
}

// Cache key for sessionStorage
const BETA_CACHE_KEY = 'tfc_beta_access';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CachedBetaAccess {
  walletAddress: string;
  state: Omit<BetaAccessState, 'isLoading'>;
  timestamp: number;
}

// Get cached state from sessionStorage
// Returns { state, isFresh } - state even if expired (for silent re-fetch)
function getCachedState(walletAddress: string): { state: Omit<BetaAccessState, 'isLoading'>; isFresh: boolean } | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = sessionStorage.getItem(BETA_CACHE_KEY);
    if (!cached) return null;

    const data: CachedBetaAccess = JSON.parse(cached);

    // Check if cache is for the same wallet
    if (data.walletAddress === walletAddress) {
      const isFresh = Date.now() - data.timestamp < CACHE_TTL_MS;
      return { state: data.state, isFresh };
    }
    return null;
  } catch {
    return null;
  }
}

// Save state to sessionStorage
function setCachedState(walletAddress: string, state: Omit<BetaAccessState, 'isLoading'>) {
  if (typeof window === 'undefined') return;
  try {
    const data: CachedBetaAccess = {
      walletAddress,
      state,
      timestamp: Date.now(),
    };
    sessionStorage.setItem(BETA_CACHE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage errors
  }
}

// Clear cached state from sessionStorage
function clearCachedState() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(BETA_CACHE_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function useBetaAccess() {
  const { publicKey, connected } = useWallet();
  const walletAddress = publicKey?.toBase58() || null;

  // Try to get cached state immediately to avoid loading flicker
  const cachedData = walletAddress ? getCachedState(walletAddress) : null;

  const [state, setState] = useState<BetaAccessState>(() => {
    if (cachedData) {
      // Use cached state, no loading even if stale (will re-fetch silently)
      return { ...cachedData.state, isLoading: false };
    }
    return {
      hasAccess: false,
      status: null,
      applied: false,
      appliedAt: null,
      isLoading: !!walletAddress, // Only loading if we have a wallet to check
    };
  });
  const [isApplying, setIsApplying] = useState(false);
  const lastCheckedWallet = useRef<string | null>(null);
  const hasVerifiedOnce = useRef(false);

  // Check beta access
  // force = true bypasses cache
  // silent = true doesn't show global loading (for manual refresh button)
  const checkAccess = useCallback(async (force = false, silent = false) => {
    if (!walletAddress) {
      setState({
        hasAccess: false,
        status: null,
        applied: false,
        appliedAt: null,
        isLoading: false,
      });
      hasVerifiedOnce.current = false;
      return;
    }

    // Check cache first (unless forced)
    if (!force) {
      const cached = getCachedState(walletAddress);
      if (cached) {
        // For pending status, always do a fresh check on page navigation
        // This ensures users see their approval immediately
        if (cached.state.status === 'pending') {
          // But skip if we just checked this wallet (prevent spam on same session)
          if (lastCheckedWallet.current === walletAddress) {
            setState({ ...cached.state, isLoading: false });
            return;
          }
          // Continue to fetch fresh data for pending users (silently)
          silent = true;
        } else {
          // For approved/rejected, use cached state immediately
          setState({ ...cached.state, isLoading: false });
          lastCheckedWallet.current = walletAddress;

          // If cache is fresh, we're done
          if (cached.isFresh) {
            hasVerifiedOnce.current = true;
            return;
          }

          // Cache expired - re-fetch silently in background
          silent = true;
        }
      }
    }

    // Only show global loading if not silent AND we haven't verified once already
    // This ensures first check shows loading, but re-verifications are silent
    const shouldShowLoading = !silent && !hasVerifiedOnce.current;
    if (shouldShowLoading) {
      setState(prev => ({ ...prev, isLoading: true }));
    }

    try {
      const res = await fetch(`/api/beta/check?wallet=${walletAddress}`);
      const data = await res.json();

      if (data.success) {
        const newState = {
          hasAccess: data.hasAccess,
          status: data.status,
          applied: data.applied,
          appliedAt: data.appliedAt || null,
        };
        setState({ ...newState, isLoading: false });
        setCachedState(walletAddress, newState);

        // Don't set lastCheckedWallet for pending status
        // This allows fresh check on next page navigation
        if (data.status !== 'pending') {
          lastCheckedWallet.current = walletAddress;
          hasVerifiedOnce.current = true;
        }
      } else {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    } catch (error) {
      console.error('Failed to check beta access:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [walletAddress]);

  // Apply for beta access
  const applyForBeta = useCallback(async () => {
    if (!walletAddress || isApplying) return null;

    setIsApplying(true);
    try {
      const res = await fetch('/api/beta/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress }),
      });
      const data = await res.json();

      if (data.success) {
        const newState = {
          status: data.status,
          applied: true,
          appliedAt: data.appliedAt,
          hasAccess: data.status === 'approved',
        };
        setState(prev => ({ ...prev, ...newState }));
        // Update cache with new state
        setCachedState(walletAddress, newState);
        return { success: true, message: data.message };
      }
      return { success: false, message: data.error };
    } catch (error) {
      console.error('Failed to apply for beta:', error);
      return { success: false, message: 'Failed to apply. Please try again.' };
    } finally {
      setIsApplying(false);
    }
  }, [walletAddress, isApplying]);

  // Detect wallet change while still connected (common on mobile dApp browsers)
  // When wallet changes without disconnecting, clear stale cache and force re-check
  const prevWalletRef = useRef<string | null>(null);

  useEffect(() => {
    if (connected && walletAddress) {
      if (prevWalletRef.current && prevWalletRef.current !== walletAddress) {
        // Wallet changed while connected — clear everything and force fresh check
        clearCachedState();
        lastCheckedWallet.current = null;
        hasVerifiedOnce.current = false;
        setState({
          hasAccess: false,
          status: null,
          applied: false,
          appliedAt: null,
          isLoading: true,
        });
        checkAccess(true);
      } else {
        checkAccess();
      }
      prevWalletRef.current = walletAddress;
    } else {
      // Clear cache and reset state when disconnected
      clearCachedState();
      lastCheckedWallet.current = null;
      hasVerifiedOnce.current = false;
      prevWalletRef.current = null;
      setState({
        hasAccess: false,
        status: null,
        applied: false,
        appliedAt: null,
        isLoading: false,
      });
    }
  }, [connected, walletAddress, checkAccess]);

  return {
    ...state,
    isApplying,
    applyForBeta,
    refetch: () => checkAccess(true, true), // Force fresh check, silent (no global loading)
  };
}
