'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useAuthStore } from '@/lib/store';
import { Shield } from 'lucide-react';

export function LandingNavbar() {
  const { connected } = useWallet();
  const { user } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isAdmin = user?.role === 'ADMIN';

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
            <a href="#home" className="px-4 py-2 text-sm text-surface-300 hover:text-white transition-colors">
              Home
            </a>
            <a href="#how-it-works" className="px-4 py-2 text-sm text-surface-300 hover:text-white transition-colors">
              How it Works
            </a>
            <a href="#prizes" className="px-4 py-2 text-sm text-surface-300 hover:text-white transition-colors">
              Prizes
            </a>
            <a href="#demo" className="px-4 py-2 text-sm text-surface-300 hover:text-white transition-colors">
              Demo
            </a>
            <a href="#markets" className="px-4 py-2 text-sm text-surface-300 hover:text-white transition-colors">
              Markets
            </a>
            <a href="#referrals" className="px-4 py-2 text-sm text-surface-300 hover:text-white transition-colors">
              Referrals
            </a>
            <a href="#faq" className="px-4 py-2 text-sm text-surface-300 hover:text-white transition-colors">
              FAQ
            </a>
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-3">
            {/* Admin Button (only for admins) */}
            {connected && isAdmin && (
              <Link
                href="/admin"
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-400 bg-primary-500/10 hover:bg-primary-500/20 border border-primary-500/20 rounded-lg transition-colors"
              >
                <Shield size={16} />
                <span className="hidden sm:inline">Admin</span>
              </Link>
            )}

            {/* Wallet / Enter Arena */}
            {connected ? (
              <Link
                href="/trade"
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
              {/* Admin Link (only for admins) */}
              {connected && isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 px-4 py-3 text-primary-400 bg-primary-500/10 border border-primary-500/20 hover:bg-primary-500/20 rounded-lg"
                >
                  <Shield size={18} />
                  Admin Panel
                </Link>
              )}

              <a href="#home" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 text-surface-300 hover:text-white hover:bg-surface-800 rounded-lg">
                Home
              </a>
              <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 text-surface-300 hover:text-white hover:bg-surface-800 rounded-lg">
                How it Works
              </a>
              <a href="#prizes" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 text-surface-300 hover:text-white hover:bg-surface-800 rounded-lg">
                Prizes
              </a>
              <a href="#demo" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 text-surface-300 hover:text-white hover:bg-surface-800 rounded-lg">
                Demo
              </a>
              <a href="#markets" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 text-surface-300 hover:text-white hover:bg-surface-800 rounded-lg">
                Markets
              </a>
              <a href="#referrals" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 text-surface-300 hover:text-white hover:bg-surface-800 rounded-lg">
                Referrals
              </a>
              <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="px-4 py-3 text-surface-300 hover:text-white hover:bg-surface-800 rounded-lg">
                FAQ
              </a>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
