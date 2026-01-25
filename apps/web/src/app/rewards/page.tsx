'use client';

import { useEffect } from 'react';
import { useMyPrizes } from '@/hooks/useMyPrizes';
import { ClaimPrizeButton } from '@/components/ClaimPrizeButton';
import { AppShell } from '@/components/AppShell';
import { BetaGate } from '@/components/BetaGate';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';

export default function RewardsPage() {
  const {
    prizes,
    isLoading,
    error,
    claimingPrizeId,
    claimPrize,
    claimablePrizes,
    totalClaimable,
    totalClaimed,
  } = useMyPrizes();

  // Set page title
  useEffect(() => {
    document.title = 'Rewards - Trading Fight Club';
  }, []);

  return (
    <BetaGate>
      <AppShell>
        <div className="container mx-auto px-4 md:px-6 py-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <EmojiEventsIcon sx={{ color: '#f97316', fontSize: 28 }} />
            <div>
              <h1 className="font-display text-xl sm:text-2xl font-bold text-white">Rewards</h1>
              <p className="text-surface-400 text-xs sm:text-sm">Claim your weekly prizes</p>
            </div>
          </div>

          {/* Total Claimed - compact badge */}
          {totalClaimed > 0 && (
            <div className="flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 bg-win-500/10 border border-win-500/30 rounded-lg">
              <span className="text-[10px] sm:text-xs text-win-400 uppercase tracking-wider">Claimed</span>
              <span className="text-sm sm:text-base font-bold text-win-400">${totalClaimed.toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* Claimable prizes banner */}
        {claimablePrizes.length > 0 && (
          <div className="mb-6 p-3 sm:p-4 bg-gradient-to-r from-primary-500/10 to-amber-500/10 border border-primary-500/30 rounded-xl flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3">
              <WorkspacePremiumIcon sx={{ color: '#facc15', fontSize: 20 }} />
              <span className="text-white text-sm sm:text-base font-medium">
                {claimablePrizes.length} prize{claimablePrizes.length > 1 ? 's' : ''} to claim
              </span>
            </div>
            <span className="text-primary-400 font-bold text-base sm:text-lg">${totalClaimable.toFixed(2)}</span>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="card p-8">
            <div className="animate-pulse space-y-4">
              <div className="h-24 bg-surface-800 rounded-xl" />
              <div className="h-24 bg-surface-800 rounded-xl" />
              <div className="h-24 bg-surface-800 rounded-xl" />
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="card p-8 text-center">
            <p className="text-loss-400 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="text-primary-400 hover:text-primary-300"
            >
              Try again
            </button>
          </div>
        )}

        {/* No prizes */}
        {!isLoading && !error && prizes.length === 0 && (
          <div className="card p-12 text-center">
            <EmojiEventsIcon sx={{ color: '#52525b', fontSize: 64, marginBottom: 16 }} />
            <h3 className="text-lg font-semibold text-surface-300 mb-2">No prizes yet</h3>
            <p className="text-surface-500 mb-6">
              Win fights to earn weekly prizes! Top 3 traders each week share the prize pool.
            </p>
            <a href="/lobby" className="btn-primary inline-block">
              Start Fighting
            </a>
          </div>
        )}

        {/* Prize list */}
        {!isLoading && !error && prizes.length > 0 && (
          <div className="space-y-4">
            {prizes.map((prize) => (
              <ClaimPrizeButton
                key={prize.id}
                prize={prize}
                onClaim={claimPrize}
                isClaiming={claimingPrizeId === prize.id}
              />
            ))}
          </div>
        )}

        {/* Prize pool info */}
        <div className="mt-8 sm:mt-12 card p-4 sm:p-6">
          <h2 className="font-display text-xs sm:text-sm font-semibold uppercase tracking-wide text-surface-300 mb-3 sm:mb-4">
            How Weekly Prizes Work
          </h2>
          <div className="flex flex-wrap gap-3 sm:gap-6 text-xs sm:text-sm">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-[10px] sm:text-xs">1</span>
              <span className="text-surface-300">5%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-slate-400/20 flex items-center justify-center text-slate-300 font-bold text-[10px] sm:text-xs">2</span>
              <span className="text-surface-300">3%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-400 font-bold text-[10px] sm:text-xs">3</span>
              <span className="text-surface-300">2%</span>
            </div>
            <span className="text-surface-500 text-[10px] sm:text-xs">of weekly fees</span>
          </div>
          <p className="mt-3 text-[10px] sm:text-xs text-surface-500">
            Rankings based on PnL. Finalized Sundays at midnight UTC.
          </p>
        </div>
      </div>
      </AppShell>
    </BetaGate>
  );
}
