'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

export function LandingNavbar() {
  const { connected } = useWallet();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-surface-800/50 bg-surface-900/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/">
            <Image
              src="/images/logos/favicon-white-192.png"
              alt="Trade Fight Club"
              width={70}
              height={70}
              className="rounded-xl"
            />
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden lg:flex items-center gap-1">
            {/* Arena Dropdown */}
            <div className="relative dropdown-trigger">
              <button className="flex items-center gap-1.5 px-4 py-2 text-sm text-surface-300 hover:text-white transition-colors">
                Arena
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div className="dropdown-menu">
                <Link href="/lobby" className="dropdown-item">Join Fight</Link>
                <Link href="/lobby" className="dropdown-item">Create Challenge</Link>
                <Link href="/leaderboard" className="dropdown-item">Leaderboard</Link>
              </div>
            </div>

            {/* Markets Dropdown */}
            <div className="relative dropdown-trigger">
              <button className="flex items-center gap-1.5 px-4 py-2 text-sm text-surface-300 hover:text-white transition-colors">
                Markets
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div className="dropdown-menu">
                <a href="https://pacifica.fi" target="_blank" rel="noopener noreferrer" className="dropdown-item">BTC-USD</a>
                <a href="https://pacifica.fi" target="_blank" rel="noopener noreferrer" className="dropdown-item">ETH-USD</a>
                <a href="https://pacifica.fi" target="_blank" rel="noopener noreferrer" className="dropdown-item">SOL-USD</a>
                <a href="https://pacifica.fi" target="_blank" rel="noopener noreferrer" className="dropdown-item">All Markets</a>
              </div>
            </div>

            {/* Blog Link */}
            <a href="#blog" className="px-4 py-2 text-sm text-surface-300 hover:text-white transition-colors">
              Blog
            </a>

            {/* FAQ Link */}
            <a href="#faq" className="px-4 py-2 text-sm text-surface-300 hover:text-white transition-colors">
              FAQ
            </a>
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-3">
            {/* Wallet / Enter Arena */}
            {connected ? (
              <Link
                href="/lobby"
                className="btn-glow-orange text-sm px-4 py-2"
              >
                Enter Arena
              </Link>
            ) : (
              <WalletMultiButton />
            )}

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-surface-400 hover:text-white"
            >
              {mobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden py-4 border-t border-surface-800">
            <div className="flex flex-col gap-2">
              <Link href="/lobby" className="px-4 py-3 text-surface-300 hover:text-white hover:bg-surface-800 rounded-lg">
                Join Fight
              </Link>
              <Link href="/leaderboard" className="px-4 py-3 text-surface-300 hover:text-white hover:bg-surface-800 rounded-lg">
                Leaderboard
              </Link>
              <a href="https://pacifica.fi" target="_blank" rel="noopener noreferrer" className="px-4 py-3 text-surface-300 hover:text-white hover:bg-surface-800 rounded-lg">
                Markets
              </a>
              <a href="#blog" className="px-4 py-3 text-surface-300 hover:text-white hover:bg-surface-800 rounded-lg">
                Blog
              </a>
              <a href="#faq" className="px-4 py-3 text-surface-300 hover:text-white hover:bg-surface-800 rounded-lg">
                FAQ
              </a>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
