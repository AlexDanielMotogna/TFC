'use client';

import { useState } from 'react';
import Image from 'next/image';
import { MOBILE_WALLETS, type MobileWallet } from '@/lib/mobile';

/**
 * Mobile wallet selector modal.
 * Shows a list of supported wallets — tapping one opens TFC inside that wallet's dApp browser.
 */
export function MobileWalletSelector({ onClose }: { onClose: () => void }) {
  const handleSelectWallet = (wallet: MobileWallet) => {
    const currentUrl = window.location.href;
    window.location.href = wallet.getDeepLink(currentUrl);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal - bottom sheet on mobile */}
      <div className="relative bg-surface-900 border border-surface-700 rounded-t-2xl sm:rounded-2xl p-5 w-full sm:max-w-sm shadow-2xl">
        <h2 className="text-lg font-display font-bold text-white text-center mb-1">
          Connect Wallet
        </h2>
        <p className="text-surface-400 text-xs text-center mb-4">
          Open TFC inside your wallet app
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

        {/* Cancel */}
        <button
          onClick={onClose}
          className="w-full mt-3 py-2.5 text-surface-400 hover:text-surface-200 text-sm transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
