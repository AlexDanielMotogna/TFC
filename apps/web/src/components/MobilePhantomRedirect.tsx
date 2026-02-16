'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { isMobileDevice, isInWalletBrowser, MOBILE_WALLETS, type MobileWallet } from '@/lib/mobile';

/**
 * On mobile (outside any wallet dApp browser), shows a mandatory modal
 * forcing the user to open TFC inside a wallet app.
 * The modal cannot be dismissed — the only way forward is to pick a wallet.
 */
export function MobilePhantomRedirect() {
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isMobileDevice() && !isInWalletBrowser()) {
      setShowModal(true);
    }
  }, []);

  if (!showModal) return null;

  const handleSelectWallet = (wallet: MobileWallet) => {
    const currentUrl = window.location.href;
    window.location.href = wallet.getDeepLink(currentUrl);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop — no onClick, cannot dismiss */}
      <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative bg-surface-900 rounded-t-2xl sm:rounded-2xl p-6 w-full sm:max-w-sm">
        <h2 className="text-lg font-bold text-white text-center mb-1">
          Open in Wallet App
        </h2>
        <p className="text-surface-400 text-xs text-center mb-5">
          TFC requires a wallet app to trade. Pick your wallet to continue.
        </p>

        {/* Wallet list */}
        <div className="space-y-2">
          {MOBILE_WALLETS.map((wallet) => (
            <button
              key={wallet.id}
              onClick={() => handleSelectWallet(wallet)}
              className="w-full flex items-center gap-3 px-4 py-3 bg-surface-800 hover:bg-surface-700 rounded-xl transition-colors"
            >
              <Image
                src={wallet.icon}
                alt={wallet.name}
                width={32}
                height={32}
                className="rounded-lg"
              />
              <span className="text-white font-medium text-sm">{wallet.name}</span>
              <svg className="w-4 h-4 text-surface-400 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </div>

        {/* No cancel button — mandatory */}
        <p className="text-surface-500 text-[10px] text-center mt-4">
          Don't have a wallet? Download <a href="https://phantom.app/download" className="text-orange-400 underline" target="_blank" rel="noopener noreferrer">Phantom</a> or <a href="https://solflare.com/download" className="text-orange-400 underline" target="_blank" rel="noopener noreferrer">Solflare</a>.
        </p>
      </div>
    </div>
  );
}
