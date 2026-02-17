'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { BetaApplyModal } from './landing/BetaApplyModal';

interface BetaAccessDeniedProps {
  status?: 'approved' | 'pending' | 'rejected' | null;
  isAlphaTester?: boolean;
  referralCode?: string | null;
  onRefresh?: () => Promise<void> | void;
}

export function BetaAccessDenied({ status, isAlphaTester, referralCode, onRefresh }: BetaAccessDeniedProps) {
  const { connected, publicKey } = useWallet();
  const [showModal, setShowModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);

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

        {/* Alpha Tester View */}
        {isAlphaTester && connected ? (
          <>
            {/* Alpha badge */}
            <div className="w-20 h-20 rounded-full bg-primary-500/20 flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>

            <h1 className="text-2xl font-bold text-white mb-2">
              Welcome, Alpha Tester
            </h1>

            <p className="text-surface-400 mb-2">
              Your account is set up and ready. Platform access will be enabled soon.
            </p>
            <p className="text-surface-500 text-sm mb-6">
              In the meantime, share your referral link to start building your network.
            </p>

            {/* Referral code section */}
            {referralCode && (
              <div className="bg-surface-800 rounded-xl p-5 mb-6 max-w-sm mx-auto text-left">
                <p className="text-xs text-surface-500 uppercase tracking-wider font-semibold mb-2">Your Referral Link</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-surface-900 text-primary-300 px-3 py-2 rounded-lg text-sm font-mono truncate">
                    www.tfc.gg?ref={referralCode}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`https://www.tfc.gg?ref=${referralCode}`);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="px-3 py-2 bg-primary-500 hover:bg-primary-400 text-white text-sm font-semibold rounded-lg transition-colors flex-shrink-0"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <p className="text-[11px] text-surface-600 mt-2">
                  Earn 34% commission on referred traders&apos; fees
                </p>
              </div>
            )}

            {/* Social links */}
            <div className="flex items-center justify-center gap-4 mb-4">
              <a
                href="https://x.com/T_F_C_official"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-surface-800 hover:bg-surface-700 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4 text-surface-300" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                <span className="text-sm text-surface-300">Follow on X</span>
              </a>
              <a
                href="https://discord.gg/rfHK5k9B"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-surface-800 hover:bg-surface-700 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4 text-surface-300" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.947 2.418-2.157 2.418z" />
                </svg>
                <span className="text-sm text-surface-300">Join Discord</span>
              </a>
            </div>

            {onRefresh && (
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="w-full max-w-xs py-2.5 bg-surface-800 hover:bg-surface-700 text-surface-300 text-sm rounded-lg transition-colors mb-4 disabled:opacity-50 flex items-center justify-center gap-2 mx-auto"
              >
                {isRefreshing ? 'Checking...' : 'Check Access'}
              </button>
            )}
          </>
        ) : (
        <>
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
              Your application for <span className="text-white font-mono">{shortenedAddress}</span> is being reviewed.
            </p>
            <p className="text-surface-500 text-sm mb-4">
              We're approving access in batches. Check back soon!
            </p>

            {/* Fast-track CTA */}
            <div className="bg-surface-800 rounded-xl p-4 mb-4 max-w-xs mx-auto">
              <p className="text-surface-300 text-xs mb-2">
                Want to speed up your access? Comment with your Solana wallet, like & retweet our post:
              </p>
              <a
                href="https://x.com/T_F_C_official/status/2020309380374085942"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-surface-300 hover:text-white text-xs font-semibold transition-colors"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                Go to post on X
              </a>
            </div>

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
              Unfortunately, your wallet <span className="text-white font-mono">{shortenedAddress}</span> was not approved for beta access.
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

            {/* Fast-track CTA */}
            <div className="bg-surface-800 rounded-xl p-4 mb-4 max-w-xs mx-auto">
              <p className="text-surface-300 text-xs mb-2">
                Speed up your access! Comment with your Solana wallet, like & retweet:
              </p>
              <a
                href="https://x.com/T_F_C_official/status/2020309380374085942"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-surface-300 hover:text-white text-xs font-semibold transition-colors"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                Go to post on X
              </a>
            </div>
          </>
        )}
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
