'use client';

import { ReactNode } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useBetaAccess } from '@/hooks';
import { BetaAccessDenied } from './BetaAccessDenied';
import { Spinner } from './Spinner';

interface BetaGateProps {
  children: ReactNode;
  /** Show loading spinner while checking access */
  showLoading?: boolean;
}

/**
 * Wrapper component that gates content behind beta access.
 * Shows BetaAccessDenied if the user doesn't have beta access.
 *
 * Usage:
 * <BetaGate>
 *   <YourProtectedContent />
 * </BetaGate>
 */
export function BetaGate({ children, showLoading = true }: BetaGateProps) {
  const { connected, publicKey } = useWallet();
  const { hasAccess, status, isLoading, isAlphaTester, referralCode, refetch } = useBetaAccess();

  // Wait for publicKey to be available before checking access
  // This prevents showing denied page during wallet reconnection
  const walletReady = connected && publicKey;

  // Show loading while checking access (only if wallet is ready)
  if (walletReady && isLoading && showLoading) {
    return (
      <div className="min-h-screen bg-surface-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="md" />
          <span className="text-sm text-surface-400">Checking beta access...</span>
        </div>
      </div>
    );
  }

  // If wallet is ready and doesn't have access, show denied page
  if (walletReady && !hasAccess) {
    return <BetaAccessDenied status={status} isAlphaTester={isAlphaTester} referralCode={referralCode} onRefresh={refetch} />;
  }

  // Has access, not connected, or wallet still initializing
  return <>{children}</>;
}
