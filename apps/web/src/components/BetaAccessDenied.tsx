'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { BetaApplyModal } from './landing/BetaApplyModal';

interface BetaAccessDeniedProps {
  status?: 'approved' | 'pending' | 'rejected' | null;
  onRefresh?: () => Promise<void> | void;
}

export function BetaAccessDenied({ status, onRefresh }: BetaAccessDeniedProps) {
  const { connected, publicKey } = useWallet();
  const [showModal, setShowModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Handle manual refresh
  const handleRefresh = useCallback(async () => {
    if (!onRefresh || isRefreshing) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefresh, isRefreshing]);

  // Auto-refresh every 30 seconds when status is pending
  useEffect(() => {
    if (status !== 'pending' || !onRefresh) return;

    const interval = setInterval(() => {
      onRefresh();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [status, onRefresh]);

  const walletAddress = publicKey?.toBase58() || '';
  const shortenedAddress = walletAddress
    ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`
    : '';

  return (
    <div className="min-h-screen bg-surface-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        {/* Logo */}
        <Link href="/" className="inline-block mb-8">
          <Image
            src="/images/logos/favicon-white-192.png"
            alt="Trade Fight Club"
            width={64}
            height={64}
            className="rounded-xl mx-auto"
          />
        </Link>

        {/* Icon */}
        <div className="w-20 h-20 rounded-full bg-orange-500/20 flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-white mb-2">
          Beta Access Required
        </h1>

        {/* Status Message */}
        {!connected ? (
          <>
            <p className="text-surface-400 mb-6">
              Connect your wallet to check your beta access status
            </p>
            <div className="flex justify-center mb-6">
              <WalletMultiButton />
            </div>
          </>
        ) : status === 'pending' ? (
          <>
            <p className="text-surface-400 mb-2">
              Your application for <span className="text-primary-400 font-mono">{shortenedAddress}</span> is being reviewed.
            </p>
            <p className="text-surface-500 text-sm mb-4">
              We're approving access in batches. Check back soon!
            </p>
            {onRefresh && (
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="w-full max-w-xs py-3 bg-surface-700 hover:bg-surface-600 text-white font-semibold rounded-lg transition-colors mb-4 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mx-auto"
              >
                {isRefreshing ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Checking...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Check Access
                  </>
                )}
              </button>
            )}
          </>
        ) : status === 'rejected' ? (
          <>
            <p className="text-surface-400 mb-6">
              Unfortunately, your wallet <span className="text-primary-400 font-mono">{shortenedAddress}</span> was not approved for beta access.
            </p>
          </>
        ) : (
          // Not applied yet
          <>
            <p className="text-surface-400 mb-6">
              Trade Fight Club is currently in closed beta. Apply now to get early access!
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="w-full max-w-xs py-3 bg-orange-500 hover:bg-orange-400 text-white font-semibold rounded-lg transition-colors mb-4"
            >
              Apply for Beta Access
            </button>
          </>
        )}

        {/* Beta Apply Modal */}
        <BetaApplyModal isOpen={showModal} onClose={() => setShowModal(false)} />

        {/* Back to Home */}
        <div className="mt-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-surface-400 hover:text-white transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
