'use client';

import Image from 'next/image';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import Link from 'next/link';

export function Header() {
  return (
    <header className="border-b border-white/10 bg-slate-900/50 backdrop-blur-sm">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/">
          <Image
            src="/images/logos/favicon-white-192.png"
            alt="Trade Fight Club"
            width={48}
            height={48}
            className="rounded-xl"
          />
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          <Link href="/" className="text-gray-300 hover:text-white transition-colors">
            Fights
          </Link>
          <Link href="/leaderboard" className="text-gray-300 hover:text-white transition-colors">
            Leaderboard
          </Link>
          <Link href="/profile" className="text-gray-300 hover:text-white transition-colors">
            Profile
          </Link>
        </nav>

        <div className="flex items-center gap-4">
          <WalletMultiButton />
        </div>
      </div>
    </header>
  );
}
