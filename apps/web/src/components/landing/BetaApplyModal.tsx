'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useBetaAccess } from '@/hooks';

interface BetaApplyModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAlphaFlow?: boolean;
}

export function BetaApplyModal({ isOpen, onClose, isAlphaFlow }: BetaApplyModalProps) {
  const router = useRouter();
  const { connected, publicKey } = useWallet();
  const { status, applied, isApplying, applyForBeta, hasAccess, isAlphaTester, referralCode, refetch } = useBetaAccess();
  const [betaApplied, setBetaApplied] = useState(false);

  if (!isOpen) return null;

  const walletAddress = publicKey?.toBase58() || '';
  const shortenedAddress = walletAddress
    ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`
    : '';

  const handleApply = async () => {
    const result = await applyForBeta();
    if (result?.success) {
      setBetaApplied(true);
      refetch();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      {/* Modal */}
      <div className="bg-surface-900 rounded-2xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-semibold text-sm">{isAlphaFlow ? 'Apply for Alpha Testing' : 'Join Closed Beta'}</h3>
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
          ) : isAlphaTester ? (
            // Alpha tester — approved but access not yet enabled
            <>
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full bg-primary-500/20 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h4 className="text-white font-medium mb-2">Welcome, Alpha Tester</h4>
                <p className="text-surface-400 text-sm">
                  Your account is set up and ready. Platform access will be enabled soon.
                </p>
              </div>

              {referralCode && (
                <div className="bg-surface-800 rounded-xl p-4">
                  <p className="text-xs text-surface-500 uppercase tracking-wider font-semibold mb-2">Your Referral Link</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-surface-900 text-primary-300 px-3 py-2 rounded-lg text-xs font-mono truncate">
                      www.tfc.gg?ref={referralCode}
                    </code>
                    <button
                      onClick={() => navigator.clipboard.writeText(`https://www.tfc.gg?ref=${referralCode}`)}
                      className="px-3 py-2 bg-primary-500 hover:bg-primary-400 text-white text-xs font-semibold rounded-lg transition-colors flex-shrink-0"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              )}

              <button
                onClick={onClose}
                className="w-full py-2.5 bg-surface-700 hover:bg-surface-600 text-white font-semibold rounded-lg transition-colors"
              >
                Close
              </button>
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
          ) : isAlphaFlow && (betaApplied || (applied && status === 'pending')) ? (
            // Alpha flow: beta applied — show Google Form link
            <>
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h4 className="text-white font-medium mb-2">Beta Application Submitted!</h4>
                <p className="text-surface-400 text-sm">
                  Now complete the alpha testing form below to finish your application.
                </p>
              </div>

              <a
                href="https://forms.gle/9nR9tYmf5imJG8Ck6"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 bg-orange-500 hover:bg-orange-400 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Complete Alpha Testing Form
              </a>
              <button
                onClick={() => refetch()}
                className="w-full py-3 bg-surface-700 hover:bg-surface-600 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Verify Application
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
