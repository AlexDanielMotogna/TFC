'use client';

import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useBetaAccess } from '@/hooks';

interface BetaApplyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BetaApplyModal({ isOpen, onClose }: BetaApplyModalProps) {
  const router = useRouter();
  const { connected, publicKey } = useWallet();
  const { status, applied, isApplying, applyForBeta, hasAccess, refetch } = useBetaAccess();

  if (!isOpen) return null;

  const walletAddress = publicKey?.toBase58() || '';
  const shortenedAddress = walletAddress
    ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`
    : '';

  const handleApply = async () => {
    const result = await applyForBeta();
    if (result?.success && result.message?.includes('already have beta access')) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      {/* Modal */}
      <div className="bg-surface-900 rounded-2xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-semibold text-sm">Join Closed Beta</h3>
          <button
            onClick={onClose}
            className="text-surface-500 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4">
          {!connected ? (
            // Not connected state
            <>
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full bg-orange-500/20 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h4 className="text-white font-medium mb-2">Connect Your Wallet</h4>
                <p className="text-surface-400 text-sm mb-4">
                  Connect your Solana wallet to apply for beta access
                </p>
              </div>
              <div className="flex justify-center">
                <WalletMultiButton />
              </div>
            </>
          ) : hasAccess ? (
            // Already has access
            <>
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h4 className="text-white font-medium mb-2">You Have Beta Access!</h4>
                <p className="text-surface-400 text-sm">
                  Your wallet <span className="text-white font-mono">{shortenedAddress}</span> has been approved for the closed beta.
                </p>
              </div>
              <button
                onClick={() => { onClose(); router.push('/trade'); }}
                className="w-full py-2.5 bg-orange-500 hover:bg-orange-400 text-white font-semibold rounded-lg transition-colors"
              >
                Start Trading
              </button>
            </>
          ) : applied && status === 'pending' ? (
            // Already applied, pending
            <>
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full bg-surface-800 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h4 className="text-white font-medium mb-2">Application Pending</h4>
                <p className="text-surface-400 text-sm">
                  Your application for <span className="text-white font-mono">{shortenedAddress}</span> is being reviewed. We'll notify you when you're approved.
                </p>
              </div>

              {/* Fast-track CTA */}
              <div className="bg-surface-800 rounded-xl p-3 text-center">
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

              <button
                onClick={() => refetch()}
                className="w-full py-3 bg-orange-500 hover:bg-orange-400 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Check Access
              </button>
              <button
                onClick={onClose}
                className="w-full py-3 bg-surface-700 hover:bg-surface-600 text-white font-semibold rounded-lg transition-colors"
              >
                Close
              </button>
            </>
          ) : (
            // New application
            <>
              <div className="text-center py-2">
                <p className="text-surface-400 text-sm mb-4">
                  Apply with your connected wallet to get early access to Trade Fight Club
                </p>
              </div>

              {/* Wallet Info */}
              <div className="bg-surface-800 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <span className="text-surface-400 text-sm">Wallet</span>
                  <span className="text-white font-mono text-sm">{shortenedAddress}</span>
                </div>
              </div>

              {/* Info */}
              <div className="bg-surface-800 rounded-xl p-3 text-xs text-surface-400 space-y-1">
                <p>• Your wallet address will be added to our waitlist</p>
                <p>• We'll approve access in batches during the beta period</p>
                <p>• Speed up your access by engaging with our X post below</p>
              </div>

              {/* Fast-track CTA */}
              <div className="bg-surface-800 rounded-xl p-3 text-center">
                <p className="text-surface-300 text-xs mb-2">
                  Comment with your Solana wallet, like & retweet to fast-track your access:
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

              {/* Apply Button */}
              <button
                onClick={handleApply}
                disabled={isApplying}
                className="w-full py-3 bg-orange-500 hover:bg-orange-400 disabled:bg-surface-700 disabled:text-surface-500 text-white font-semibold rounded-lg transition-colors disabled:cursor-not-allowed"
              >
                {isApplying ? 'Applying...' : 'Apply for Beta Access'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
