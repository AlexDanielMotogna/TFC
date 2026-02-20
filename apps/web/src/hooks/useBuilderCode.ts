/**
 * Hook for managing Pacifica Builder Code approval
 *
 * Users must approve the TradeFightClub builder code before
 * they can place orders through our platform.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWallet } from '@solana/wallet-adapter-react';
import { useSigner } from '@/hooks/useSigner';
import { useExchangeContext } from '@/contexts/ExchangeContext';
import { toast } from 'sonner';

const BUILDER_CODE = process.env.NEXT_PUBLIC_PACIFICA_BUILDER_CODE || 'TradeClub';

interface BuilderCodeStatus {
  approved: boolean;
  builderCode: string;
  approval?: {
    builder_code: string;
    description: string;
    max_fee_rate: string;
    updated_at: number;
  } | null;
}

/**
 * Check if the current user has approved the builder code
 */
export function useBuilderCodeStatus() {
  const { publicKey, connected } = useWallet();

  return useQuery<BuilderCodeStatus>({
    queryKey: ['builder-code', publicKey?.toBase58()],
    queryFn: async () => {
      if (!publicKey) {
        throw new Error('Wallet not connected');
      }

      const account = publicKey.toBase58();
      const response = await fetch(`/api/builder-code?account=${account}`);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      return result.data;
    },
    enabled: connected && !!publicKey,
    staleTime: 60000, // Cache for 1 minute
    refetchInterval: false, // Don't poll - only refetch on demand
  });
}

/**
 * Approve the builder code for trading
 */
export function useApproveBuilderCode() {
  const signer = useSigner();
  const { exchangeType } = useExchangeContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (maxFeeRate: string = '0.0005') => {
      if (!signer || !signer.signApproveBuilderCode) {
        throw new Error('Wallet not connected or exchange does not support builder codes');
      }

      const operation = await signer.signApproveBuilderCode({
        builderCode: BUILDER_CODE,
        maxFeeRate: maxFeeRate,
      });

      // Send to backend proxy
      const response = await fetch('/api/builder-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          exchange: exchangeType,
          account: operation.account,
          signature: operation.signature,
          timestamp: operation.timestamp,
          max_fee_rate: maxFeeRate,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      return result.data;
    },
    onSuccess: () => {
      // Invalidate builder code status to refetch
      queryClient.invalidateQueries({ queryKey: ['builder-code'] });
      toast.success('Trading authorization approved');
    },
    onError: (error: Error) => {
      console.error('Failed to approve builder code:', error);
      toast.error(`Authorization failed: ${error.message}`);
    },
  });
}

/**
 * Get the builder code value
 */
export function getBuilderCode() {
  return BUILDER_CODE;
}
