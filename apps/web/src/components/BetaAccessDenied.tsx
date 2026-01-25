'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { BetaApplyModal } from './landing/BetaApplyModal';

interface BetaAccessDeniedProps {
  status?: 'approved' | 'pending' | 'rejected' | null;
}

export function BetaAccessDenied({ status }: BetaAccessDeniedProps) {
  const { connected, publicKey } = useWallet();
  const [showModal, setShowModal] = useState(false);

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
            <p className="text-surface-500 text-sm mb-6">
              We're approving access in batches. Check back soon!
            </p>
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
