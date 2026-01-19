'use client';

import { ReactNode, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth, useAccount } from '@/hooks';
import { WalletButton } from '@/components/WalletButton';
import { NotificationBell } from '@/components/NotificationBell';
import { api } from '@/lib/api';

// Wallet icon for balance
function WalletIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3" />
    </svg>
  );
}

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
  const { account } = useAccount();
  const queryClient = useQueryClient();

  // Get Pacifica balance
  const pacificaBalance = account?.accountEquity ? parseFloat(account.accountEquity) : null;

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
        <div className="w-full px-4">
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

            {/* Right side: Balance, Notifications, Wallet */}
            <div className="flex items-center gap-3">
              {/* Balance Display */}
              <div className="flex items-center gap-1.5 px-2 py-1 bg-surface-800 rounded text-sm">
                <WalletIcon className="w-4 h-4 text-surface-400" />
                <span className="text-surface-200 font-mono">
                  {pacificaBalance !== null ? `$${pacificaBalance.toFixed(2)}` : '-'}
                </span>
              </div>

              {/* Notifications Bell */}
              <NotificationBell />

              {/* Wallet Connect Button */}
              <WalletButton />
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
        <div className="w-full px-4">
          <div className="flex items-center justify-center text-xs text-surface-500">
            <span>Trading Fight Club</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
