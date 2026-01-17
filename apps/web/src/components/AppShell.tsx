'use client';

import { ReactNode, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks';
import { api } from '@/lib/api';

interface NavLinkProps {
  href: string;
  children: ReactNode;
  prefetch?: () => void;
}

function NavLink({ href, children, prefetch }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname?.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={`px-3 py-1.5 text-sm transition-colors rounded ${
        isActive
          ? 'text-zinc-100 bg-surface-800'
          : 'text-surface-400 hover:text-zinc-200 hover:bg-surface-800/50'
      }`}
      onMouseEnter={prefetch}
      onFocus={prefetch}
    >
      {children}
    </Link>
  );
}

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { connected } = useWallet();
  const { isAuthenticated, user } = useAuth();
  const queryClient = useQueryClient();

  const prefetchLeaderboard = useCallback(() => {
    queryClient.prefetchQuery({
      queryKey: ['leaderboard', 'weekly'],
      queryFn: () => api.getLeaderboard('weekly'),
      staleTime: 30000,
    });
  }, [queryClient]);

  const prefetchProfile = useCallback(() => {
    if (user?.id) {
      queryClient.prefetchQuery({
        queryKey: ['profile', user.id],
        queryFn: () => api.getUserProfile(user.id),
        staleTime: 30000,
      });
    }
  }, [queryClient, user?.id]);

  useEffect(() => {
    router.prefetch('/trade');
    router.prefetch('/lobby');
    router.prefetch('/leaderboard');
  }, [router]);

  return (
    <div className="min-h-screen bg-surface-900 text-zinc-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-surface-700 bg-surface-850 sticky top-0 z-50">
        <div className="max-w-screen-2xl mx-auto px-4">
          <div className="flex items-center justify-between h-12">
            {/* Logo */}
            <Link href="/lobby">
              <Image
                src="/images/landing/TFC-Logo.png"
                alt="Trade Fight Club"
                width={36}
                height={36}
                className="rounded-lg"
              />
            </Link>

            {/* Navigation */}
            <nav className="flex items-center gap-1">
              <NavLink href="/trade">Trade</NavLink>
              <NavLink href="/lobby">Arena</NavLink>
              <NavLink href="/leaderboard" prefetch={prefetchLeaderboard}>
                Leaderboard
              </NavLink>
              {isAuthenticated && user && (
                <NavLink href={`/profile/${user.id}`} prefetch={prefetchProfile}>
                  Profile
                </NavLink>
              )}
            </nav>

            {/* Wallet */}
            <div className="flex items-center">
              <WalletMultiButton />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-surface-800 py-3">
        <div className="max-w-screen-2xl mx-auto px-4">
          <div className="flex items-center justify-between text-xs text-surface-500">
            <span>Trading Fight Club</span>
            <div className="flex items-center gap-4">
              <a href="https://pacifica.fi" target="_blank" rel="noopener noreferrer" className="hover:text-surface-400 transition-colors">
                Built on Pacifica
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
