'use client';

import { useEffect, useState } from 'react';
import { isMobileDevice, isPhantomBrowser, getPhantomDeepLink } from '@/lib/mobile';
import Image from 'next/image';

const STORAGE_KEY = 'tfc-phantom-redirect-dismissed';

/**
 * Modal component that prompts mobile users to open TFC inside Phantom's dApp browser
 * for a better trading experience (instant signatures, no app switching)
 */
export function MobilePhantomRedirect() {
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    // Only run on client
    if (typeof window === 'undefined') return;

    // Check if user previously dismissed the modal
    const dismissed = sessionStorage.getItem(STORAGE_KEY);
    if (dismissed) return;

    // Only show on mobile devices that are NOT in Phantom's browser
    const shouldShow = isMobileDevice() && !isPhantomBrowser();

    if (shouldShow) {
      // Small delay to avoid flash during initial load
      const timer = setTimeout(() => setShowModal(true), 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismiss = () => {
    sessionStorage.setItem(STORAGE_KEY, 'true');
    setShowModal(false);
  };

  const handleOpenInPhantom = () => {
    const currentUrl = window.location.href;
    const phantomLink = getPhantomDeepLink(currentUrl);
    window.location.href = phantomLink;
  };

  if (!showModal) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={handleDismiss}
      />

      {/* Modal */}
      <div className="relative bg-surface-900 border border-surface-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 text-surface-400 hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Phantom Logo */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-700 rounded-2xl flex items-center justify-center">
            <svg className="w-10 h-10 text-white" viewBox="0 0 128 128" fill="currentColor">
              <path d="M64 0C28.7 0 0 28.7 0 64s28.7 64 64 64 64-28.7 64-64S99.3 0 64 0zm32.3 72.3c-1.5 18.1-15.8 32.4-33.9 33.9-1 .1-2 .1-3 .1-19.3 0-35-15.7-35-35 0-1 0-2 .1-3C25.9 50 40.2 35.7 58.3 34.2c1-.1 2-.1 3-.1 19.3 0 35 15.7 35 35 0 1 0 2-.1 3 .1.1.1.1.1.2z"/>
            </svg>
          </div>
        </div>

        {/* Title */}
        <h2 className="text-xl font-display font-bold text-white text-center mb-2">
          Better on Phantom
        </h2>

        {/* Description */}
        <p className="text-surface-300 text-sm text-center mb-6">
          Open Trading Fight Club inside Phantom Wallet for instant transactions and the best mobile trading experience.
        </p>

        {/* Benefits */}
        <div className="space-y-2 mb-6">
          <div className="flex items-center gap-3 text-sm">
            <div className="w-5 h-5 rounded-full bg-win-500/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-3 h-3 text-win-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <span className="text-surface-200">Instant transaction signing</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="w-5 h-5 rounded-full bg-win-500/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-3 h-3 text-win-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <span className="text-surface-200">No app switching needed</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="w-5 h-5 rounded-full bg-win-500/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-3 h-3 text-win-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <span className="text-surface-200">Seamless wallet connection</span>
          </div>
        </div>

        {/* Buttons */}
        <div className="space-y-3">
          <button
            onClick={handleOpenInPhantom}
            className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 128 128" fill="currentColor">
              <path d="M64 0C28.7 0 0 28.7 0 64s28.7 64 64 64 64-28.7 64-64S99.3 0 64 0zm32.3 72.3c-1.5 18.1-15.8 32.4-33.9 33.9-1 .1-2 .1-3 .1-19.3 0-35-15.7-35-35 0-1 0-2 .1-3C25.9 50 40.2 35.7 58.3 34.2c1-.1 2-.1 3-.1 19.3 0 35 15.7 35 35 0 1 0 2-.1 3 .1.1.1.1.1.2z"/>
            </svg>
            Open in Phantom
          </button>

          <button
            onClick={handleDismiss}
            className="w-full py-2.5 px-4 text-surface-400 hover:text-surface-200 text-sm transition-colors"
          >
            Continue in browser
          </button>
        </div>

        {/* Footer note */}
        <p className="text-[10px] text-surface-500 text-center mt-4">
          Don't have Phantom? <a href="https://phantom.app/download" target="_blank" rel="noopener noreferrer" className="text-primary-400 hover:text-primary-300">Download it here</a>
        </p>
      </div>
    </div>
  );
}
