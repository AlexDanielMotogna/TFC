/**
 * useAiBias Hook
 * Frontend hook for AI Trading Signal analysis.
 * Calls /api/ai/bias with auth token and manages loading/error/result state.
 */

'use client';

import { useState, useCallback, useRef } from 'react';
import { useAuthStore } from '@/lib/store';
import type { AiSignalResponse, RiskProfile, OpenPosition } from '@/lib/ai/types/AiBias.types';

interface AiBiasState {
  data: AiSignalResponse | null;
  isLoading: boolean;
  error: string | null;
}

export function useAiBias() {
  const [state, setState] = useState<AiBiasState>({
    data: null,
    isLoading: false,
    error: null,
  });

  // Track active request to prevent race conditions
  const abortRef = useRef<AbortController | null>(null);

  const analyze = useCallback(async (symbol: string, riskProfile: RiskProfile, openPositions?: OpenPosition[]) => {
    const token = useAuthStore.getState().token;
    if (!token) {
      setState({ data: null, isLoading: false, error: 'Please connect your wallet first' });
      return;
    }

    // Cancel any in-flight request
    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch('/api/ai/bias', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ symbol, riskProfile, openPositions }),
        signal: controller.signal,
      });

      const json = await response.json();

      // Don't update state if this request was aborted
      if (controller.signal.aborted) return;

      if (!response.ok || !json.success) {
        const errorMsg = json.error || `Analysis failed (${response.status})`;

        // Special handling for rate limiting
        if (response.status === 429) {
          const retryAfter = json.retryAfter || 30;
          setState({
            data: null,
            isLoading: false,
            error: `Rate limited. Try again in ${retryAfter}s`,
          });
          return;
        }

        setState({ data: null, isLoading: false, error: errorMsg });
        return;
      }

      setState({ data: json.data, isLoading: false, error: null });
    } catch (err) {
      if (controller.signal.aborted) return;
      setState({
        data: null,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to analyze market',
      });
    }
  }, []);

  const clear = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setState({ data: null, isLoading: false, error: null });
  }, []);

  return {
    ...state,
    analyze,
    clear,
    isExpired: state.data ? Date.now() > state.data.expiresAt : false,
  };
}
