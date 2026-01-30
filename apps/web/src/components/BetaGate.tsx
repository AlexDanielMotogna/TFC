'use client';

import { ReactNode } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useBetaAccess } from '@/hooks';
import { BetaAccessDenied } from './BetaAccessDenied';

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
  const { connected } = useWallet();
  const { hasAccess, status, isLoading, refetch } = useBetaAccess();

  // Show loading while checking access (only if connected)
  if (connected && isLoading && showLoading) {
    return (
      <div className="min-h-screen bg-surface-900 flex items-center justify-center">
        <div className="text-center">
          <div className="spinner mx-auto mb-4" />
          <p className="text-surface-400">Checking beta access...</p>
        </div>
      </div>
    );
  }

  // If connected and doesn't have access, show denied page
  if (connected && !hasAccess) {
    return <BetaAccessDenied status={status} onRefresh={refetch} />;
  }

  // Has access or not connected (wallet modal will handle connection)
  return <>{children}</>;
}
