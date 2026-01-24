'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { notify } from '@/lib/notify';

export interface UserPrize {
  id: string;
  rank: number;
  amount: number;
  status: 'PENDING' | 'EARNED' | 'DISTRIBUTED';
  txSignature: string | null;
  distributedAt: string | null;
  weekStartDate: string;
  weekEndDate: string;
  canClaim: boolean;
}

interface TreasuryInfo {
  address: string;
  availableForClaims: number;
}

interface ClaimResult {
  success: boolean;
  prizeId?: string;
  amount?: number;
  txSignature?: string;
  explorerUrl?: string;
  error?: string;
  code?: string;
}

export function useMyPrizes() {
  const [prizes, setPrizes] = useState<UserPrize[]>([]);
  const [treasury, setTreasury] = useState<TreasuryInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claimingPrizeId, setClaimingPrizeId] = useState<string | null>(null);

  const { isAuthenticated, token } = useAuth();

  // Fetch user's prizes
  const fetchPrizes = useCallback(async () => {
    if (!isAuthenticated || !token) {
      setPrizes([]);
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      const res = await fetch('/api/prize/claim', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await res.json();

      if (data.success) {
        setPrizes(data.data.prizes);
        setTreasury(data.data.treasury);
      } else {
        setError(data.error || 'Failed to load prizes');
      }
    } catch (err) {
      console.error('Failed to fetch prizes:', err);
      setError('Failed to load prizes');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, token]);

  // Initial fetch
  useEffect(() => {
    fetchPrizes();
  }, [fetchPrizes]);

  // Claim a prize
  const claimPrize = useCallback(async (prizeId: string): Promise<ClaimResult> => {
    if (!token) {
      return { success: false, error: 'Not authenticated' };
    }

    setClaimingPrizeId(prizeId);

    try {
      const res = await fetch('/api/prize/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ prizeId }),
      });

      const data = await res.json();

      if (data.success) {
        // Show success toast
        notify(
          'SYSTEM',
          'Prize Claimed!',
          `Successfully claimed $${data.data.amount?.toFixed(2)} USDC!`,
          { variant: 'success', persist: false }
        );
        // Refresh prizes list after successful claim
        await fetchPrizes();
        return {
          success: true,
          prizeId: data.data.prizeId,
          amount: data.data.amount,
          txSignature: data.data.txSignature,
          explorerUrl: data.data.explorerUrl,
        };
      } else {
        // Show error toast
        notify(
          'SYSTEM',
          'Claim Failed',
          data.error || 'Failed to claim prize',
          { variant: 'error', persist: false }
        );
        return {
          success: false,
          error: data.error,
          code: data.code,
        };
      }
    } catch (err) {
      console.error('Failed to claim prize:', err);
      return {
        success: false,
        error: 'Failed to claim prize. Please try again.',
      };
    } finally {
      setClaimingPrizeId(null);
    }
  }, [token, fetchPrizes]);

  // Computed values
  const claimablePrizes = prizes.filter(p => p.canClaim);
  const claimedPrizes = prizes.filter(p => p.status === 'DISTRIBUTED');
  const pendingPrizes = prizes.filter(p => p.status === 'PENDING');
  const totalClaimable = claimablePrizes.reduce((sum, p) => sum + p.amount, 0);
  const totalClaimed = claimedPrizes.reduce((sum, p) => sum + p.amount, 0);

  return {
    prizes,
    treasury,
    isLoading,
    error,
    claimingPrizeId,
    claimPrize,
    refetch: fetchPrizes,
    // Computed
    claimablePrizes,
    claimedPrizes,
    pendingPrizes,
    totalClaimable,
    totalClaimed,
  };
}
