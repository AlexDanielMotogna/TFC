'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/AppShell';
import { BetaGate } from '@/components/BetaGate';
import { LeaderboardSkeleton, LeaderboardRowSkeleton } from '@/components/Skeletons';
import { api } from '@/lib/api';
import { usePrizePool } from '@/hooks/usePrizePool';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';

// Format currency for display
const formatCurrency = (amount: number): string => {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(2)}M`;
  } else if (amount >= 10000) {
    return `$${(amount / 1000).toFixed(1)}K`;
  }
  return `$${amount.toFixed(2)}`;
};

interface LeaderboardEntry {
  userId: string;
  rank: number;
  handle: string;
  totalFights: number;
  wins: number;
  losses: number;
  draws: number;
  totalPnlUsdc: number;
  avgPnlPercent: number;
}

type LeaderboardRange = 'weekly' | 'all_time';
const VALID_RANGES: LeaderboardRange[] = ['weekly', 'all_time'];

export default function LeaderboardPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Read initial range from URL or default to 'weekly'
  const getRangeFromUrl = useCallback((): LeaderboardRange => {
    const rangeParam = searchParams?.get('range');
    if (rangeParam && VALID_RANGES.includes(rangeParam as LeaderboardRange)) {
      return rangeParam as LeaderboardRange;
    }
    return 'weekly';
  }, [searchParams]);

  const [range, setRangeState] = useState<LeaderboardRange>(getRangeFromUrl);

  // Update URL when range changes
  const setRange = useCallback((newRange: LeaderboardRange) => {
    setRangeState(newRange);
    const params = new URLSearchParams(searchParams?.toString() || '');
    if (newRange === 'weekly') {
      params.delete('range'); // Default range, no need to show in URL
    } else {
      params.set('range', newRange);
    }
    const newUrl = params.toString() ? `/leaderboard?${params.toString()}` : '/leaderboard';
    router.replace(newUrl, { scroll: false });
  }, [router, searchParams]);

  // Sync range state when URL changes (e.g., browser back/forward)
  useEffect(() => {
    const rangeFromUrl = getRangeFromUrl();
    if (rangeFromUrl !== range) {
      setRangeState(rangeFromUrl);
    }
  }, [searchParams, getRangeFromUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // Set page title
  useEffect(() => {
    document.title = 'Leaderboard - Trading Fight Club';
  }, []);

  // Use React Query for better caching and loading states
  const { data: entries = [], isLoading, isFetching } = useQuery({
    queryKey: ['leaderboard', range],
    queryFn: () => api.getLeaderboard(range),
    staleTime: 30000, // 30 seconds
  });

  // Prize pool data (for weekly view)
  const { prizePool, isLoading: isPrizePoolLoading } = usePrizePool();

  const getRankDisplay = (rank: number) => {
    if (rank === 1) return { icon: <WorkspacePremiumIcon sx={{ color: '#facc15', fontSize: 24 }} />, color: 'text-yellow-400', bg: 'bg-yellow-400/10' };
    if (rank === 2) return { icon: <WorkspacePremiumIcon sx={{ color: '#cbd5e1', fontSize: 24 }} />, color: 'text-gray-300', bg: 'bg-gray-300/10' };
    if (rank === 3) return { icon: <WorkspacePremiumIcon sx={{ color: '#d97706', fontSize: 24 }} />, color: 'text-amber-600', bg: 'bg-amber-600/10' };
    return { icon: `#${rank}`, color: 'text-surface-400', bg: '' };
  };

  // Get actual top 3 for podium (entries are sorted by rank, so first 3 are top 3)
  const podiumEntries = entries.slice(0, 3);
  const first = podiumEntries[0];
  const second = podiumEntries[1];
  const third = podiumEntries[2];

  return (
    <BetaGate>
      <AppShell>
        <div className="container mx-auto px-4 md:px-6 py-8 animate-fadeIn">
        {/* Page Header */}
        <div className="mb-6">
          {/* Title */}
          <div className="text-center mb-4">
            <h1 className="font-display text-3xl md:text-4xl font-bold mb-2 tracking-tight">
              <span className="text-white">TOP </span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-accent-400">
                FIGHTERS
              </span>
            </h1>
            <p className="text-surface-400 text-sm">
              Rankings based on total PnL performance
            </p>
          </div>

          {/* Prize Pool Badge (Weekly only) - Below title, responsive */}
          {range === 'weekly' && (isPrizePoolLoading || prizePool) && (
            <div className="flex justify-center">
              <div className="inline-flex flex-wrap justify-center items-center gap-4 sm:gap-5 px-4 sm:px-5 py-2.5 sm:py-3 bg-surface-900/50 border border-surface-800 rounded-xl">
                {isPrizePoolLoading ? (
                  <>
                    <div className="text-center">
                      <p className="text-[10px] sm:text-xs text-surface-500 mb-0.5">Weekly Fees</p>
                      <div className="h-5 sm:h-6 w-16 bg-surface-700 rounded animate-pulse" />
                    </div>
                    <div className="w-px h-6 sm:h-8 bg-surface-700" />
                    <div className="text-center">
                      <p className="text-[10px] sm:text-xs text-surface-500 mb-0.5">Prize Pool</p>
                      <div className="h-5 sm:h-6 w-16 bg-surface-700 rounded animate-pulse" />
                    </div>
                    <div className="w-px h-6 sm:h-8 bg-surface-700" />
                    <div className="text-center">
                      <p className="text-[10px] sm:text-xs text-surface-500 mb-0.5">Ends in</p>
                      <div className="h-4 sm:h-5 w-12 bg-surface-700 rounded animate-pulse" />
                    </div>
                  </>
                ) : prizePool && (
                  <>
                    <div className="text-center">
                      <p className="text-[10px] sm:text-xs text-surface-500 mb-0.5">Weekly Fees</p>
                      <p className="text-sm sm:text-base font-bold text-white">{formatCurrency(prizePool.totalFeesCollected)}</p>
                    </div>
                    <div className="w-px h-6 sm:h-8 bg-surface-700" />
                    <div className="text-center">
                      <p className="text-[10px] sm:text-xs text-surface-500 mb-0.5">Prize Pool</p>
                      <p className="text-sm sm:text-base font-bold text-gradient-orange">{formatCurrency(prizePool.totalPrizePool)}</p>
                    </div>
                    <div className="w-px h-6 sm:h-8 bg-surface-700" />
                    <div className="text-center">
                      <p className="text-[10px] sm:text-xs text-surface-500 mb-0.5">Ends in</p>
                      <p className="text-sm sm:text-base font-mono font-bold text-white">{prizePool.timeRemaining.formatted}</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Range Toggle */}
        <div className="flex justify-center mb-6">
          <div className="bg-surface-800 rounded-xl p-1.5 flex border border-surface-800">
            <button
              onClick={() => setRange('weekly')}
              className={`px-6 py-2.5 rounded-lg font-semibold transition-all ${
                range === 'weekly'
                  ? 'bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-glow-sm'
                  : 'text-surface-400 hover:text-white'
              }`}
            >
              This Week
            </button>
            <button
              onClick={() => setRange('all_time')}
              className={`px-6 py-2.5 rounded-lg font-semibold transition-all ${
                range === 'all_time'
                  ? 'bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-glow-sm'
                  : 'text-surface-400 hover:text-white'
              }`}
            >
              All Time
            </button>
          </div>

          {/* Loading indicator for background refetch */}
          {isFetching && !isLoading && (
            <div className="ml-3 flex items-center">
              <div className="w-4 h-4 rounded-full border-2 border-surface-600 border-t-primary-500 animate-spin" />
            </div>
          )}
        </div>

        {/* Content */}
        {isLoading ? (
          <LeaderboardSkeleton />
        ) : entries.length === 0 ? (
          <div className="card text-center py-16 animate-fadeIn">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-800 flex items-center justify-center">
              <EmojiEventsIcon sx={{ fontSize: 32, color: '#6b7280' }} />
            </div>
            <p className="text-surface-400">No rankings available yet</p>
            <Link href="/trade" className="text-primary-400 hover:text-primary-300 mt-2 inline-block">
              Start fighting to get ranked →
            </Link>
          </div>
        ) : (
          <div className="animate-fadeIn">
            {/* Top 3 Podium - Card design like landing page but smaller (Weekly only) */}
            {range === 'weekly' && first && second && third && (
              <div className="hidden md:grid grid-cols-3 gap-3 mb-6 max-w-3xl mx-auto items-end">
                {/* 2nd Place */}
                <div className="bg-gradient-to-b from-slate-400/20 to-slate-500/10 border border-slate-400/50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-full bg-slate-400/30 flex items-center justify-center">
                      <span className="text-slate-300 text-xs font-bold">2</span>
                    </div>
                    <div>
                      <p className="text-slate-300 font-semibold text-sm">2nd Place</p>
                      <p className="text-surface-500 text-xs">3% of fees</p>
                    </div>
                  </div>
                  <div className="mb-3">
                    <p className="text-surface-500 text-xs mb-0.5">Prize</p>
                    <p className="font-bold text-gradient-orange text-xl">
                      {formatCurrency((prizePool?.totalFeesCollected || 0) * 0.03)}
                    </p>
                  </div>
                  <div className="border-t border-surface-800/50 pt-3">
                    <p className="text-surface-500 text-[10px] mb-1.5 uppercase tracking-wide">Current Leader</p>
                    <div className="flex items-center gap-2">
                      <div className="avatar w-8 h-8 text-xs">{second.handle[0]?.toUpperCase() || '?'}</div>
                      <div className="flex-1 min-w-0">
                        <Link href={`/profile/${second.userId}`} className="text-white text-sm font-medium truncate block hover:text-primary-400">
                          {second.handle}
                        </Link>
                        <div className="flex items-center gap-1.5 text-[10px]">
                          <span className={second.totalPnlUsdc >= 0 ? 'text-win-400' : 'text-loss-400'}>
                            {second.totalPnlUsdc >= 0 ? '+' : ''}{formatCurrency(second.totalPnlUsdc)} PnL
                          </span>
                          <span className="text-surface-500">•</span>
                          <span className="text-surface-400">{second.wins}W {second.losses}L</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 1st Place - Featured */}
                <div className="bg-gradient-to-b from-amber-500/20 to-yellow-600/10 border border-amber-500/50 rounded-xl p-5 shadow-lg shadow-amber-500/10">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full bg-amber-500/30 flex items-center justify-center">
                      <span className="text-amber-400 text-sm font-bold">1</span>
                    </div>
                    <div>
                      <p className="text-amber-400 font-bold">1st Place</p>
                      <p className="text-surface-500 text-xs">5% of fees</p>
                    </div>
                  </div>
                  <div className="mb-4">
                    <p className="text-surface-500 text-xs mb-0.5">Prize</p>
                    <p className="font-bold text-gradient-orange text-2xl">
                      {formatCurrency((prizePool?.totalFeesCollected || 0) * 0.05)}
                    </p>
                  </div>
                  <div className="border-t border-surface-800/50 pt-3">
                    <p className="text-surface-500 text-[10px] mb-1.5 uppercase tracking-wide">Current Leader</p>
                    <div className="flex items-center gap-2">
                      <div className="avatar w-9 h-9 text-sm">{first.handle[0]?.toUpperCase() || '?'}</div>
                      <div className="flex-1 min-w-0">
                        <Link href={`/profile/${first.userId}`} className="text-white font-semibold truncate block hover:text-primary-400">
                          {first.handle}
                        </Link>
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className={first.totalPnlUsdc >= 0 ? 'text-win-400' : 'text-loss-400'}>
                            {first.totalPnlUsdc >= 0 ? '+' : ''}{formatCurrency(first.totalPnlUsdc)} PnL
                          </span>
                          <span className="text-surface-500">•</span>
                          <span className="text-surface-400">{first.wins}W {first.losses}L</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3rd Place */}
                <div className="bg-gradient-to-b from-orange-700/20 to-amber-800/10 border border-orange-600/50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-full bg-orange-600/30 flex items-center justify-center">
                      <span className="text-orange-400 text-xs font-bold">3</span>
                    </div>
                    <div>
                      <p className="text-orange-400 font-semibold text-sm">3rd Place</p>
                      <p className="text-surface-500 text-xs">2% of fees</p>
                    </div>
                  </div>
                  <div className="mb-3">
                    <p className="text-surface-500 text-xs mb-0.5">Prize</p>
                    <p className="font-bold text-gradient-orange text-xl">
                      {formatCurrency((prizePool?.totalFeesCollected || 0) * 0.02)}
                    </p>
                  </div>
                  <div className="border-t border-surface-800/50 pt-3">
                    <p className="text-surface-500 text-[10px] mb-1.5 uppercase tracking-wide">Current Leader</p>
                    <div className="flex items-center gap-2">
                      <div className="avatar w-8 h-8 text-xs">{third.handle[0]?.toUpperCase() || '?'}</div>
                      <div className="flex-1 min-w-0">
                        <Link href={`/profile/${third.userId}`} className="text-white text-sm font-medium truncate block hover:text-primary-400">
                          {third.handle}
                        </Link>
                        <div className="flex items-center gap-1.5 text-[10px]">
                          <span className={third.totalPnlUsdc >= 0 ? 'text-win-400' : 'text-loss-400'}>
                            {third.totalPnlUsdc >= 0 ? '+' : ''}{formatCurrency(third.totalPnlUsdc)} PnL
                          </span>
                          <span className="text-surface-500">•</span>
                          <span className="text-surface-400">{third.wins}W {third.losses}L</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Leaderboard Table */}
            <div className="card overflow-x-auto">
              <table className="table-premium w-full min-w-[600px]">
                <thead>
                  <tr className="border-b border-surface-800 bg-surface-850">
                    <th className="py-3 px-4 text-left text-xs font-medium text-surface-200 capitalize tracking-wider w-20">
                      Rank
                    </th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-surface-200 capitalize tracking-wider">
                      Fighter
                    </th>
                    <th className="py-3 px-4 text-center text-xs font-medium text-surface-200 capitalize tracking-wider">
                      Fights
                    </th>
                    <th className="py-3 px-4 text-center text-xs font-medium text-surface-200 capitalize tracking-wider">
                      Record
                    </th>
                    <th className="py-3 px-4 text-center text-xs font-medium text-surface-200 capitalize tracking-wider">
                      Win Rate
                    </th>
                    <th className="py-3 px-4 text-right text-xs font-medium text-surface-200 capitalize tracking-wider">
                      Avg PnL
                    </th>
                    <th className="py-3 px-4 text-right text-xs font-medium text-surface-200 capitalize tracking-wider">
                      Total PnL
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-700/50">
                  {entries.map((entry, index) => {
                    const winRate =
                      entry.totalFights > 0
                        ? ((entry.wins / entry.totalFights) * 100).toFixed(0)
                        : '0';
                    const rankDisplay = getRankDisplay(entry.rank);

                    return (
                      <tr
                        key={entry.userId}
                        className="hover:bg-surface-800/50 transition-colors animate-fadeIn"
                        style={{ animationDelay: `${index * 0.05}s` }}
                      >
                        <td className="py-4 px-4">
                          <span
                            className={`inline-flex items-center justify-center w-10 h-10 rounded-lg font-bold ${rankDisplay.bg} ${rankDisplay.color}`}
                          >
                            {rankDisplay.icon}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <Link
                            href={`/profile/${entry.userId}`}
                            className="flex items-center gap-3 hover:text-primary-400 transition-colors"
                          >
                            <div className="avatar w-10 h-10 text-sm">
                              {entry.handle[0]?.toUpperCase() || '?'}
                            </div>
                            <span className="font-medium">{entry.handle}</span>
                          </Link>
                        </td>
                        <td className="py-4 px-4 text-center text-surface-400">{entry.totalFights}</td>
                        <td className="py-4 px-4 text-center">
                          <span className="text-win-400">{entry.wins}</span>
                          <span className="text-surface-500 mx-1">/</span>
                          <span className="text-loss-400">{entry.losses}</span>
                          <span className="text-surface-500 mx-1">/</span>
                          <span className="text-surface-400">{entry.draws}</span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-16 h-1.5 bg-surface-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-primary-500 to-accent-500 rounded-full transition-all duration-500"
                                style={{ width: `${winRate}%` }}
                              />
                            </div>
                            <span className="text-sm text-surface-400 w-10">{winRate}%</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <span
                            className={`${
                              entry.avgPnlPercent >= 0 ? 'text-win-400' : 'text-loss-400'
                            }`}
                          >
                            {entry.avgPnlPercent >= 0 ? '+' : ''}
                            {entry.avgPnlPercent.toFixed(2)}%
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <span
                            className={`${
                              entry.totalPnlUsdc >= 0 ? 'pnl-positive' : 'pnl-negative'
                            }`}
                          >
                            {entry.totalPnlUsdc >= 0 ? '+' : '-'}$
                            {Math.abs(entry.totalPnlUsdc).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      </AppShell>
    </BetaGate>
  );
}
