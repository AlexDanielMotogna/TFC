'use client';

import { ReactNode, useEffect, useCallback, useState, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth, useAccount } from '@/hooks';
import { useMyPrizes } from '@/hooks/useMyPrizes';
import { WalletButton } from '@/components/WalletButton';
import { NotificationBell } from '@/components/NotificationBell';
import { PrizesBanner } from '@/components/PrizesBanner';
import { WithdrawModal } from '@/components/WithdrawModal';
import { MobilePhantomRedirect } from '@/components/MobilePhantomRedirect';
import { api } from '@/lib/api';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import LeaderboardIcon from '@mui/icons-material/Leaderboard';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import GroupsIcon from '@mui/icons-material/Groups';
import PersonIcon from '@mui/icons-material/Person';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FileUploadIcon from '@mui/icons-material/FileUpload';

const PACIFICA_DEPOSIT_URL = 'https://app.pacifica.fi/trade/BTC';

// Wallet icon for balance
function WalletIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3" />
    </svg>
  );
}

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  badge?: number;
  prefetch?: () => void;
}

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const { account } = useAccount();
  const { claimablePrizes } = useMyPrizes();
  const queryClient = useQueryClient();

  // Get Pacifica balance
  const pacificaBalance = account?.accountEquity ? parseFloat(account.accountEquity) : null;

  // Wallet dropdown state
  const [showWalletDropdown, setShowWalletDropdown] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const desktopDropdownRef = useRef<HTMLDivElement>(null);
  const mobileDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const isOutsideDesktop = desktopDropdownRef.current && !desktopDropdownRef.current.contains(target);
      const isOutsideMobile = mobileDropdownRef.current && !mobileDropdownRef.current.contains(target);

      // Only close if click is outside both refs
      if (isOutsideDesktop && isOutsideMobile) {
        setShowWalletDropdown(false);
      }
    }
    if (showWalletDropdown) {
      // Use setTimeout to avoid closing immediately on the same click that opened it
      const timeoutId = setTimeout(() => {
        document.addEventListener('click', handleClickOutside);
      }, 0);
      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('click', handleClickOutside);
      };
    }
  }, [showWalletDropdown]);

  const handleDepositClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setShowWalletDropdown(false);
    window.open(PACIFICA_DEPOSIT_URL, '_blank');
  };

  const handleWithdrawClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setShowWalletDropdown(false);
    setShowWithdrawModal(true);
  };

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
    router.prefetch('/leaderboard');
    router.prefetch('/rewards');
    router.prefetch('/referrals');
  }, [router]);

  // Navigation items
  const navItems: NavItem[] = [
    { href: '/trade', label: 'Trade', icon: <ShowChartIcon sx={{ fontSize: 20 }} /> },
    { href: '/lobby', label: 'Arena', icon: <span className="text-lg leading-none">⚔</span> },
    { href: '/leaderboard', label: 'Leaderboard', icon: <LeaderboardIcon sx={{ fontSize: 20 }} />, prefetch: prefetchLeaderboard },
  ];

  // Add authenticated-only items
  const authNavItems: NavItem[] = isAuthenticated && user ? [
    {
      href: '/rewards',
      label: 'Rewards',
      icon: <EmojiEventsIcon sx={{ fontSize: 20 }} />,
      badge: claimablePrizes.length > 0 ? claimablePrizes.length : undefined,
    },
    {
      href: '/referrals',
      label: 'Referrals',
      icon: <GroupsIcon sx={{ fontSize: 20 }} />,
    },
    {
      href: `/profile/${user.id}`,
      label: 'Profile',
      icon: <PersonIcon sx={{ fontSize: 20 }} />,
      prefetch: prefetchProfile,
    },
  ] : [];

  const allNavItems = [...navItems, ...authNavItems];

  const isActive = (href: string) => pathname === href || pathname?.startsWith(`${href}/`);

  return (
    <div className="min-h-screen bg-surface-900 text-zinc-100 flex flex-col">
      {/* Header */}
      <header className="border-surface-800 bg-surface-850 sticky top-0 z-50">
        <div className="w-full px-4">
          <div className="flex items-center h-12 relative">
            {/* Logo - Left */}
            <div className="flex-shrink-0">
              <Link href="/trade">
                <Image
                  src="/images/logos/favicon-white-192.png"
                  alt="Trade Fight Club"
                  width={52}
                  height={52}
                  className="rounded-lg"
                />
              </Link>
            </div>

            {/* Navigation - Centered (hidden until 1200px) */}
            <nav className="absolute left-1/2 -translate-x-1/2 hidden min-[1200px]:flex items-center gap-1">
              {allNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative px-3 py-1.5 text-sm transition-colors rounded flex items-center gap-1.5 ${
                    isActive(item.href)
                      ? 'text-zinc-100 bg-surface-800'
                      : 'text-surface-400 hover:text-zinc-200 hover:bg-surface-800/50'
                  }`}
                  onMouseEnter={item.prefetch}
                  onFocus={item.prefetch}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-primary-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                      {item.badge}
                    </span>
                  )}
                </Link>
              ))}
            </nav>

            {/* Right side: Balance (desktop), Notifications, Wallet */}
            <div className="flex items-center gap-2 sm:gap-3 ml-auto">
              {/* Balance Display with Dropdown - hidden until 1200px, shown in bottom nav */}
              <div className="hidden min-[1200px]:block relative" ref={desktopDropdownRef}>
                <button
                  onClick={() => setShowWalletDropdown(!showWalletDropdown)}
                  className="flex items-center gap-1.5 px-2 py-1 bg-surface-800 hover:bg-surface-700 rounded text-sm transition-colors cursor-pointer"
                >
                  <WalletIcon className="w-4 h-4 text-surface-400" />
                  <span className="text-surface-200 font-mono">
                    {pacificaBalance !== null ? `$${pacificaBalance.toFixed(2)}` : '-'}
                  </span>
                </button>

                {/* Dropdown Menu */}
                {showWalletDropdown && (
                  <div className="absolute right-0 top-full mt-1 w-40 bg-surface-800 border border-surface-800 rounded-lg shadow-lg overflow-hidden z-50">
                    <button
                      onClick={handleDepositClick}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-surface-200 hover:bg-surface-700 transition-colors"
                    >
                      <FileDownloadIcon sx={{ fontSize: 18 }} className="text-win-400" />
                      Deposit
                    </button>
                    <button
                      onClick={handleWithdrawClick}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-surface-200 hover:bg-surface-700 transition-colors border-t border-surface-800"
                    >
                      <FileUploadIcon sx={{ fontSize: 18 }} className="text-primary-400" />
                      Withdraw
                    </button>
                  </div>
                )}
              </div>

              {/* Notifications Bell */}
              <NotificationBell />

              {/* Wallet Connect Button - compact on mobile/tablet */}
              <div className="wallet-compact">
                <WalletButton />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Prizes Banner - shows when there are claimable prizes */}
      {isAuthenticated && <PrizesBanner />}

      {/* Main Content - add bottom padding for bottom nav until 1200px */}
      <main className="flex-1 pb-16 min-[1200px]:pb-0">
        {children}
      </main>

      {/* Footer - hidden until 1200px */}
      <footer className="hidden min-[1200px]:block border-t border-surface-800 py-3">
        <div className="w-full px-4">
          <div className="flex items-center justify-center text-xs text-surface-500">
            <span>Trading Fight Club</span>
          </div>
        </div>
      </footer>

      {/* Bottom Navigation - visible until 1200px */}
      <nav className="max-[1199px]:flex hidden fixed bottom-0 left-0 right-0 bg-surface-850 border-t border-surface-800 z-50">
        <div className="flex items-center h-14 w-full">
          {/* Balance Display on mobile with dropdown */}
          <div className="relative" ref={mobileDropdownRef}>
            <button
              onClick={() => setShowWalletDropdown(!showWalletDropdown)}
              className="flex flex-col items-center justify-center h-14 px-3 border-r border-surface-800 hover:bg-surface-800 transition-colors"
            >
              <WalletIcon className="w-4 h-4 text-surface-400" />
              <span className="text-[10px] text-surface-200 font-mono mt-0.5">
                {pacificaBalance !== null ? `$${pacificaBalance.toFixed(2)}` : '-'}
              </span>
            </button>

            {/* Mobile Dropdown Menu - opens upward */}
            {showWalletDropdown && (
              <div className="absolute left-0 bottom-full mb-1 w-40 bg-surface-800 border border-surface-800 rounded-lg shadow-lg overflow-hidden z-50">
                <button
                  onClick={handleDepositClick}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-surface-200 hover:bg-surface-700 transition-colors"
                >
                  <FileDownloadIcon sx={{ fontSize: 18 }} className="text-win-400" />
                  Deposit
                </button>
                <button
                  onClick={handleWithdrawClick}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-surface-200 hover:bg-surface-700 transition-colors border-t border-surface-800"
                >
                  <FileUploadIcon sx={{ fontSize: 18 }} className="text-primary-400" />
                  Withdraw
                </button>
              </div>
            )}
          </div>

          {/* Nav Items */}
          {allNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                isActive(item.href)
                  ? 'text-primary-400'
                  : 'text-surface-400'
              }`}
            >
              {item.icon}
              <span className="text-[10px] mt-0.5 hidden sm:block">{item.label}</span>
              {item.badge && (
                <span className="absolute top-1 right-1/4 min-w-[16px] h-[16px] px-1 bg-primary-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {item.badge}
                </span>
              )}
            </Link>
          ))}
        </div>
      </nav>

      {/* Withdraw Modal */}
      <WithdrawModal
        isOpen={showWithdrawModal}
        onClose={() => setShowWithdrawModal(false)}
        availableBalance={pacificaBalance}
      />

      {/* Mobile Phantom Redirect - prompts mobile users to open in Phantom dApp browser */}
      <MobilePhantomRedirect />
    </div>
  );
}
