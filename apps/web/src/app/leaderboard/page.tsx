'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/AppShell';
import { BetaGate } from '@/components/BetaGate';
import { LeaderboardSkeleton, LeaderboardRowSkeleton } from '@/components/Skeletons';
import { Spinner } from '@/components/Spinner';
import { api } from '@/lib/api';
import { usePrizePool } from '@/hooks/usePrizePool';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import BoltIcon from '@mui/icons-material/Bolt';

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
        <div className="container mx-auto px-2 md:px-6 py-8 animate-fadeIn">
        {/* Dashboard Header */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight text-white">Leaderboard</h1>
            </div>
            <div className="flex items-center gap-3">
              {isFetching && !isLoading && <Spinner size="xs" />}
              <div className="bg-surface-800 rounded-xl p-1 flex border border-surface-800">
                <button
                  onClick={() => setRange('weekly')}
                  className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                    range === 'weekly'
                      ? 'bg-surface-700 text-white'
                      : 'text-surface-400 hover:text-white'
                  }`}
                >
                  This Week
                </button>
                <button
                  onClick={() => setRange('all_time')}
                  className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                    range === 'all_time'
                      ? 'bg-surface-700 text-white'
                      : 'text-surface-400 hover:text-white'
                  }`}
                >
                  All Time
                </button>
              </div>
            </div>
          </div>

          {/* Stats Cards Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
            {/* Total Fighters */}
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-primary-500/10 flex items-center justify-center">
                  <span className="text-sm leading-none" style={{ color: '#5196c9' }}>⚔</span>
                </div>
                <span className="text-xs text-surface-500">Total Fighters</span>
              </div>
              <p className="text-2xl md:text-3xl font-bold text-white">{entries.length}</p>
            </div>

            {/* Weekly Fees */}
            {range === 'weekly' && (
              <div className="card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-win-500/10 flex items-center justify-center">
                    <AttachMoneyIcon sx={{ color: '#4ade80', fontSize: 18 }} />
                  </div>
                  <span className="text-xs text-surface-500">Weekly Fees</span>
                </div>
                <p className="text-2xl md:text-3xl font-bold text-white">
                  {isPrizePoolLoading ? <span className="inline-block h-8 w-16 bg-surface-700 rounded animate-pulse" /> : formatCurrency(prizePool?.totalFeesCollected || 0)}
                </p>
              </div>
            )}

            {/* Prize Pool */}
            {range === 'weekly' && (
              <div className="card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <EmojiEventsIcon sx={{ color: '#facc15', fontSize: 18 }} />
                  </div>
                  <span className="text-xs text-surface-500">Prize Pool</span>
                </div>
                <p className="text-2xl md:text-3xl font-bold text-gradient-orange">
                  {isPrizePoolLoading ? <span className="inline-block h-8 w-16 bg-surface-700 rounded animate-pulse" /> : formatCurrency(prizePool?.totalPrizePool || 0)}
                </p>
              </div>
            )}

            {/* Time Remaining / All Time Stats */}
            {range === 'weekly' ? (
              <div className="card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-accent-500/10 flex items-center justify-center">
                    <AccessTimeIcon sx={{ color: '#a78bfa', fontSize: 18 }} />
                  </div>
                  <span className="text-xs text-surface-500">Time Remaining</span>
                </div>
                <p className="text-2xl md:text-3xl font-mono font-bold text-white">
                  {isPrizePoolLoading ? <span className="inline-block h-8 w-16 bg-surface-700 rounded animate-pulse" /> : prizePool?.timeRemaining.formatted || '--'}
                </p>
              </div>
            ) : (
              <div className="card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-accent-500/10 flex items-center justify-center">
                    <BoltIcon sx={{ color: '#a78bfa', fontSize: 18 }} />
                  </div>
                  <span className="text-xs text-surface-500">Total Fights</span>
                </div>
                <p className="text-2xl md:text-3xl font-bold text-white">
                  {entries.reduce((sum, e) => sum + e.totalFights, 0)}
                </p>
              </div>
            )}
          </div>

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
            {/* Top 3 Cards */}
            {first && second && third && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
                {[
                  { entry: first, rank: 1, trophy: '#facc15', trophyBg: 'bg-amber-500/10', prize: 0.05 },
                  { entry: second, rank: 2, trophy: '#cbd5e1', trophyBg: 'bg-slate-400/10', prize: 0.03 },
                  { entry: third, rank: 3, trophy: '#d97706', trophyBg: 'bg-orange-600/10', prize: 0.02 },
                ].map(({ entry, rank, trophy, trophyBg, prize }) => {
                  const winRate = entry.totalFights > 0 ? ((entry.wins / entry.totalFights) * 100).toFixed(0) : '0';
                  return (
                    <div key={entry.userId} className="card p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`w-10 h-10 rounded-lg ${trophyBg} flex items-center justify-center`}>
                          <EmojiEventsIcon sx={{ color: trophy, fontSize: 24 }} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <Link href={`/profile/${entry.userId}`} className="text-sm font-semibold text-white hover:text-primary-400 truncate block">
                            {entry.handle}
                          </Link>
                          <p className="text-xs text-surface-500">
                            {rank === 1 ? '1st' : rank === 2 ? '2nd' : '3rd'} Place
                            {range === 'weekly' && prizePool && (
                              <span className="text-gradient-orange ml-1">
                                · {formatCurrency((prizePool.totalFeesCollected || 0) * prize)}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <p className={`text-sm sm:text-3xl font-bold mb-2 ${entry.totalPnlUsdc >= 0 ? 'text-win-400' : 'text-loss-400'}`}>
                        {entry.totalPnlUsdc >= 0 ? '+' : ''}{formatCurrency(entry.totalPnlUsdc)}
                      </p>
                      <div className="flex gap-3 text-xs text-surface-400">
                        <span>Record: {entry.wins}W {entry.losses}L</span>
                        <span>Winrate: {winRate}%</span>
                      </div>
                    </div>
                  );
                })}
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
                    <th className="py-3 px-4 text-left text-xs font-medium text-surface-200 capitalize tracking-wider">
                      Fights
                    </th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-surface-200 capitalize tracking-wider">
                      Record
                    </th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-surface-200 capitalize tracking-wider">
                      Win Rate
                    </th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-surface-200 capitalize tracking-wider">
                      Avg PnL
                    </th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-surface-200 capitalize tracking-wider">
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
                        <td className="py-4 px-4 text-surface-400">{entry.totalFights}</td>
                        <td className="py-4 px-4">
                          <span className="text-win-400">{entry.wins}</span>
                          <span className="text-surface-500 mx-1">/</span>
                          <span className="text-loss-400">{entry.losses}</span>
                          <span className="text-surface-500 mx-1">/</span>
                          <span className="text-surface-400">{entry.draws}</span>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-surface-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-primary-500 to-accent-500 rounded-full transition-all duration-500"
                                style={{ width: `${winRate}%` }}
                              />
                            </div>
                            <span className="text-sm text-surface-400 w-10">{winRate}%</span>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span
                            className={`${
                              entry.avgPnlPercent >= 0 ? 'text-win-400' : 'text-loss-400'
                            }`}
                          >
                            {entry.avgPnlPercent >= 0 ? '+' : ''}
                            {entry.avgPnlPercent.toFixed(2)}%
                          </span>
                        </td>
                        <td className="py-4 px-4">
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
