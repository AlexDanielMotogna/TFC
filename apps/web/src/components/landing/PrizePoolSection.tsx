'use client';

import Link from 'next/link';
import { usePrizePool } from '@/hooks/usePrizePool';

// Format currency for display (always 2 decimals for small amounts)
const formatCurrency = (amount: number): string => {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(2)}M`;
  } else if (amount >= 10000) {
    return `$${(amount / 1000).toFixed(1)}K`;
  }
  return `$${amount.toFixed(2)}`;
};

// Medal emojis and colors for ranks
const RANK_CONFIG = {
  1: {
    medal: '🥇',
    label: '1st Place',
    percentage: '5%',
    bgColor: 'from-amber-500/20 to-yellow-600/10',
    borderColor: 'border-amber-500/50',
    textColor: 'text-amber-400',
    glowColor: 'shadow-amber-500/20',
  },
  2: {
    medal: '🥈',
    label: '2nd Place',
    percentage: '3%',
    bgColor: 'from-slate-400/20 to-slate-500/10',
    borderColor: 'border-slate-400/50',
    textColor: 'text-slate-300',
    glowColor: 'shadow-slate-400/20',
  },
  3: {
    medal: '🥉',
    label: '3rd Place',
    percentage: '2%',
    bgColor: 'from-orange-700/20 to-amber-800/10',
    borderColor: 'border-orange-600/50',
    textColor: 'text-orange-400',
    glowColor: 'shadow-orange-500/20',
  },
};

export function PrizePoolSection() {
  const { prizePool, isLoading } = usePrizePool();

  // Loading skeleton
  if (isLoading) {
    return (
      <section className="relative py-16 lg:py-24 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="animate-pulse">
            <div className="h-12 w-64 bg-surface-800 rounded-lg mx-auto mb-4" />
            <div className="h-6 w-96 bg-surface-800 rounded-lg mx-auto mb-12" />
            <div className="grid md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-48 bg-surface-800 rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  const totalPrizePool = prizePool?.totalPrizePool || 0;
  const prizes = prizePool?.prizes || [];
  const timeRemaining = prizePool?.timeRemaining || { days: 0, hours: 0, formatted: '0d 0h' };

  return (
    <section className="relative py-16 lg:py-24 overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(249,115,22,0.08)_0%,_transparent_60%)]" />
      <div className="absolute top-1/4 right-0 w-[400px] h-[400px] bg-amber-500/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 left-0 w-[400px] h-[400px] bg-primary-500/5 rounded-full blur-3xl" />

      <div className="relative max-w-7xl mx-auto px-4 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-12 lg:mb-16">
          <h2 className="text-3xl lg:text-5xl font-bold mb-4 text-white">
            Win {formatCurrency(totalPrizePool)} This Week
          </h2>

          <p className="text-surface-400 text-lg max-w-2xl mx-auto">
            Top 3 traders on the weekly leaderboard share 10% of all platform fees.
            Trade, compete, and claim your prize.
          </p>

          {/* Timer */}
          <div className="mt-6 inline-flex items-center gap-3 px-6 py-3 bg-surface-800/50 border border-surface-700 rounded-xl">
            <svg className="w-5 h-5 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-surface-400">Week ends in</span>
            <span className="text-white font-mono font-bold text-lg">{timeRemaining.formatted}</span>
          </div>
        </div>

        {/* Prize Cards - Podium Style (2nd, 1st, 3rd) */}
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8 items-end">
          {/* 2nd Place */}
          <div className="order-1 md:order-1">
            <PrizeCard
              rank={2}
              prize={prizes.find(p => p.rank === 2)}
              totalFees={prizePool?.totalFeesCollected || 0}
            />
          </div>

          {/* 1st Place - Taller */}
          <div className="order-0 md:order-2">
            <PrizeCard
              rank={1}
              prize={prizes.find(p => p.rank === 1)}
              totalFees={prizePool?.totalFeesCollected || 0}
              featured
            />
          </div>

          {/* 3rd Place */}
          <div className="order-2 md:order-3">
            <PrizeCard
              rank={3}
              prize={prizes.find(p => p.rank === 3)}
              totalFees={prizePool?.totalFeesCollected || 0}
            />
          </div>
        </div>

        {/* Fee Breakdown */}
        <div className="mt-12 text-center">
          <div className="inline-flex flex-col sm:flex-row items-center gap-4 sm:gap-8 px-6 py-4 bg-surface-900/50 border border-surface-700 rounded-xl">
            <div>
              <p className="text-sm text-surface-500">Weekly Volume Fees</p>
              <p className="text-xl font-bold text-white">{formatCurrency(prizePool?.totalFeesCollected || 0)}</p>
            </div>
            <div className="hidden sm:block w-px h-10 bg-surface-700" />
            <div>
              <p className="text-sm text-surface-500">Prize Pool (10%)</p>
              <p className="text-xl font-bold text-gradient-orange">{formatCurrency(totalPrizePool)}</p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-10 text-center">
          <Link
            href="/leaderboard"
            className="inline-flex items-center gap-2 btn-glow-orange"
          >
            <span>View Full Leaderboard</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}

interface PrizeCardProps {
  rank: 1 | 2 | 3;
  prize?: {
    userHandle: string;
    avatarUrl: string | null;
    prizeAmount: number;
    totalPnlUsdc: number;
    wins: number;
    losses: number;
    totalFights: number;
    avgPnlPercent: number;
  };
  totalFees: number;
  featured?: boolean;
}

function PrizeCard({ rank, prize, totalFees, featured }: PrizeCardProps) {
  const config = RANK_CONFIG[rank];
  const prizeAmount = prize?.prizeAmount || (totalFees * (rank === 1 ? 0.05 : rank === 2 ? 0.03 : 0.02));

  return (
    <div
      className={`relative bg-gradient-to-b ${config.bgColor} border ${config.borderColor} rounded-2xl overflow-hidden ${featured ? 'p-6 lg:p-8' : 'p-5 lg:p-6'
        } shadow-lg ${config.glowColor}`}
    >
      {/* Rank Badge */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className={`text-${featured ? '4xl' : '3xl'}`}>{config.medal}</span>
          <div>
            <p className={`${config.textColor} font-bold ${featured ? 'text-lg' : 'text-base'}`}>
              {config.label}
            </p>
            <p className="text-surface-500 text-sm">{config.percentage} of fees</p>
          </div>
        </div>
      </div>

      {/* Prize Amount */}
      <div className={`${featured ? 'mb-6' : 'mb-4'}`}>
        <p className="text-surface-400 text-sm mb-1">Prize</p>
        <p className={`font-bold text-gradient-orange ${featured ? 'text-4xl lg:text-5xl' : 'text-2xl lg:text-3xl'}`}>
          {formatCurrency(prizeAmount)}
        </p>
      </div>

      {/* Current Leader or Placeholder */}
      {prize ? (
        <div className="border-t border-surface-700/50 pt-4">
          <p className="text-surface-500 text-xs mb-2 uppercase tracking-wide">Current Leader</p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-surface-700 overflow-hidden flex items-center justify-center">
              {prize.avatarUrl ? (
                <img src={prize.avatarUrl} alt={prize.userHandle} className="w-full h-full object-cover" />
              ) : (
                <span className="text-lg">{prize.userHandle.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold truncate">{prize.userHandle}</p>
              <div className="flex items-center gap-2 text-xs">
                <span className={prize.totalPnlUsdc >= 0 ? 'text-win-400' : 'text-loss-400'}>
                  {prize.totalPnlUsdc >= 0 ? '+' : ''}{formatCurrency(prize.totalPnlUsdc)} PnL
                </span>
                <span className="text-surface-500">•</span>
                <span className="text-surface-400">{prize.wins}W {prize.losses}L</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="border-t border-surface-700/50 pt-4">
          <p className="text-surface-500 text-xs mb-2 uppercase tracking-wide">Current Leader</p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-surface-700/50 border-2 border-dashed border-surface-600 flex items-center justify-center">
              <span className="text-surface-500 text-xl">?</span>
            </div>
            <div>
              <p className="text-surface-400 font-medium">No contender yet</p>
              <p className="text-surface-500 text-xs">Be the first to fight!</p>
            </div>
          </div>
        </div>
      )}

      {/* Decorative glow for featured */}
      {featured && (
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-40 h-40 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
      )}
    </div>
  );
}
