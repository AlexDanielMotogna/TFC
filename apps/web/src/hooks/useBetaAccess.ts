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
function getCachedState(walletAddress: string): Omit<BetaAccessState, 'isLoading'> | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = sessionStorage.getItem(BETA_CACHE_KEY);
    if (!cached) return null;

    const data: CachedBetaAccess = JSON.parse(cached);

    // Check if cache is for the same wallet and not expired
    if (data.walletAddress === walletAddress && Date.now() - data.timestamp < CACHE_TTL_MS) {
      return data.state;
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

export function useBetaAccess() {
  const { publicKey, connected } = useWallet();
  const walletAddress = publicKey?.toBase58() || null;

  // Try to get cached state immediately to avoid loading flicker
  const cachedState = walletAddress ? getCachedState(walletAddress) : null;

  const [state, setState] = useState<BetaAccessState>(() => {
    if (cachedState) {
      return { ...cachedState, isLoading: false };
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

  // Check beta access (force = true bypasses cache)
  const checkAccess = useCallback(async (force = false) => {
    if (!walletAddress) {
      setState({
        hasAccess: false,
        status: null,
        applied: false,
        appliedAt: null,
        isLoading: false,
      });
      return;
    }

    // Check cache first (unless forced)
    if (!force) {
      const cached = getCachedState(walletAddress);
      if (cached) {
        // Don't use cache for pending status - always check fresh
        // This ensures users see their approval immediately
        if (cached.status === 'pending') {
          // But skip if we just checked this wallet (prevent spam on same session)
          if (lastCheckedWallet.current === walletAddress) {
            setState({ ...cached, isLoading: false });
            return;
          }
        } else {
          // For approved/rejected, use cache normally
          setState({ ...cached, isLoading: false });
          lastCheckedWallet.current = walletAddress;
          return;
        }
      }
    }

    setState(prev => ({ ...prev, isLoading: true }));

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

  // Check access on wallet connect
  useEffect(() => {
    if (connected && walletAddress) {
      checkAccess();
    } else {
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
    refetch: () => checkAccess(true), // Force fresh check, bypassing cache
  };
}
