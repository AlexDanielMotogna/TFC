'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMyPrizes } from '@/hooks/useMyPrizes';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import CloseIcon from '@mui/icons-material/Close';
import { useState, useEffect } from 'react';

const DISMISS_KEY = 'prizes-banner-dismissed';

export function PrizesBanner() {
  const pathname = usePathname();
  const { claimablePrizes, totalClaimable, isLoading } = useMyPrizes();
  const [isDismissed, setIsDismissed] = useState(true); // Start dismissed to avoid flash

  // Check localStorage on mount
  useEffect(() => {
    const dismissed = sessionStorage.getItem(DISMISS_KEY);
    setIsDismissed(dismissed === 'true');
  }, []);

  // Don't show if loading, no prizes, on rewards page, or dismissed
  if (isLoading || claimablePrizes.length === 0 || pathname === '/rewards' || isDismissed) {
    return null;
  }

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, 'true');
    setIsDismissed(true);
  };

  return (
    <div className="bg-gradient-to-r from-primary-600/90 to-amber-500/90 text-white">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between py-2">
          <Link
            href="/rewards"
            className="flex items-center gap-3 flex-1 hover:opacity-90 transition-opacity"
          >
            <EmojiEventsIcon sx={{ fontSize: 20 }} />
            <span className="text-sm font-medium">
              You have {claimablePrizes.length} prize{claimablePrizes.length > 1 ? 's' : ''} to claim!
            </span>
            <span className="text-sm font-bold">
              ${totalClaimable.toFixed(2)} USDC
            </span>
            <span className="text-xs opacity-75 hidden sm:inline">
              Click to claim &rarr;
            </span>
          </Link>
          <button
            onClick={handleDismiss}
            className="p-1 hover:bg-white/20 rounded transition-colors ml-2"
            aria-label="Dismiss"
          >
            <CloseIcon sx={{ fontSize: 18 }} />
          </button>
        </div>
      </div>
    </div>
  );
}
