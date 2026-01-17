'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/AppShell';
import { LeaderboardSkeleton, LeaderboardRowSkeleton } from '@/components/Skeletons';
import { api } from '@/lib/api';

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

export default function LeaderboardPage() {
  const [range, setRange] = useState<LeaderboardRange>('weekly');

  // Use React Query for better caching and loading states
  const { data: entries = [], isLoading, isFetching } = useQuery({
    queryKey: ['leaderboard', range],
    queryFn: () => api.getLeaderboard(range),
    staleTime: 30000, // 30 seconds
  });

  const getRankDisplay = (rank: number) => {
    if (rank === 1) return { icon: '🥇', color: 'text-yellow-400', bg: 'bg-yellow-400/10' };
    if (rank === 2) return { icon: '🥈', color: 'text-gray-300', bg: 'bg-gray-300/10' };
    if (rank === 3) return { icon: '🥉', color: 'text-amber-600', bg: 'bg-amber-600/10' };
    return { icon: `#${rank}`, color: 'text-surface-400', bg: '' };
  };

  return (
    <AppShell>
      <div className="container mx-auto px-4 md:px-6 py-8 animate-fadeIn">
        {/* Page Header */}
        <div className="text-center mb-10">
          <h1 className="font-display text-4xl md:text-5xl font-bold mb-4 tracking-tight">
            <span className="text-white">TOP </span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-accent-400">
              FIGHTERS
            </span>
          </h1>
          <p className="text-surface-400 max-w-xl mx-auto">
            The elite traders dominating the arena. Rankings based on total PnL performance.
          </p>
        </div>

        {/* Range Toggle */}
        <div className="flex justify-center mb-8">
          <div className="bg-surface-800 rounded-xl p-1.5 flex border border-surface-700">
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
              <span className="text-3xl opacity-50">🏆</span>
            </div>
            <p className="text-surface-400">No rankings available yet</p>
            <Link href="/lobby" className="text-primary-400 hover:text-primary-300 mt-2 inline-block">
              Start fighting to get ranked →
            </Link>
          </div>
        ) : (
          <div className="animate-fadeIn">
            {/* Top 3 Podium (Desktop) */}
            {entries.length >= 3 && (
              <div className="hidden md:grid grid-cols-3 gap-4 mb-8 max-w-3xl mx-auto">
                {/* 2nd Place */}
                <div className="card p-6 text-center mt-8 animate-slideUp" style={{ animationDelay: '0.1s' }}>
                  <div className="relative inline-block mb-4">
                    <div className="avatar w-20 h-20 text-2xl mx-auto">
                      {entries[1]?.handle[0]?.toUpperCase() || '?'}
                    </div>
                    <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-2xl">🥈</span>
                  </div>
                  <Link
                    href={`/profile/${entries[1]?.userId}`}
                    className="font-semibold text-white hover:text-primary-400 transition-colors"
                  >
                    {entries[1]?.handle}
                  </Link>
                  <p
                    className={`font-mono text-xl font-bold mt-2 ${
                      (entries[1]?.totalPnlUsdc ?? 0) >= 0 ? 'pnl-positive' : 'pnl-negative'
                    }`}
                  >
                    {(entries[1]?.totalPnlUsdc ?? 0) >= 0 ? '+' : ''}$
                    {Math.abs(entries[1]?.totalPnlUsdc ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-sm text-surface-400 mt-1">
                    {entries[1]?.wins}W / {entries[1]?.losses}L
                  </p>
                </div>

                {/* 1st Place */}
                <div className="card p-6 text-center relative glow-border animate-slideUp">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="text-3xl">👑</span>
                  </div>
                  <div className="relative inline-block mb-4 mt-4">
                    <div className="p-1 rounded-full bg-gradient-to-r from-yellow-400 to-amber-500">
                      <div className="avatar w-24 h-24 text-3xl bg-surface-850">
                        {entries[0]?.handle[0]?.toUpperCase() || '?'}
                      </div>
                    </div>
                    <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-3xl">🥇</span>
                  </div>
                  <Link
                    href={`/profile/${entries[0]?.userId}`}
                    className="font-display font-bold text-xl text-white hover:text-primary-400 transition-colors"
                  >
                    {entries[0]?.handle}
                  </Link>
                  <p
                    className={`font-mono text-2xl font-bold mt-2 ${
                      (entries[0]?.totalPnlUsdc ?? 0) >= 0 ? 'pnl-positive' : 'pnl-negative'
                    }`}
                  >
                    {(entries[0]?.totalPnlUsdc ?? 0) >= 0 ? '+' : ''}$
                    {Math.abs(entries[0]?.totalPnlUsdc ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-sm text-surface-400 mt-1">
                    {entries[0]?.wins}W / {entries[0]?.losses}L
                  </p>
                </div>

                {/* 3rd Place */}
                <div className="card p-6 text-center mt-12 animate-slideUp" style={{ animationDelay: '0.2s' }}>
                  <div className="relative inline-block mb-4">
                    <div className="avatar w-18 h-18 text-xl mx-auto">
                      {entries[2]?.handle[0]?.toUpperCase() || '?'}
                    </div>
                    <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-2xl">🥉</span>
                  </div>
                  <Link
                    href={`/profile/${entries[2]?.userId}`}
                    className="font-semibold text-white hover:text-primary-400 transition-colors"
                  >
                    {entries[2]?.handle}
                  </Link>
                  <p
                    className={`font-mono text-lg font-bold mt-2 ${
                      (entries[2]?.totalPnlUsdc ?? 0) >= 0 ? 'pnl-positive' : 'pnl-negative'
                    }`}
                  >
                    {(entries[2]?.totalPnlUsdc ?? 0) >= 0 ? '+' : ''}$
                    {Math.abs(entries[2]?.totalPnlUsdc ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-sm text-surface-400 mt-1">
                    {entries[2]?.wins}W / {entries[2]?.losses}L
                  </p>
                </div>
              </div>
            )}

            {/* Leaderboard Table */}
            <div className="card overflow-hidden">
              <table className="table-premium w-full">
                <thead>
                  <tr className="border-b border-surface-700 bg-surface-850">
                    <th className="py-3 px-4 text-left text-xs font-medium text-surface-400 uppercase tracking-wider w-20">
                      Rank
                    </th>
                    <th className="py-3 px-4 text-left text-xs font-medium text-surface-400 uppercase tracking-wider">
                      Fighter
                    </th>
                    <th className="py-3 px-4 text-center text-xs font-medium text-surface-400 uppercase tracking-wider">
                      Fights
                    </th>
                    <th className="py-3 px-4 text-center text-xs font-medium text-surface-400 uppercase tracking-wider">
                      Record
                    </th>
                    <th className="py-3 px-4 text-center text-xs font-medium text-surface-400 uppercase tracking-wider">
                      Win Rate
                    </th>
                    <th className="py-3 px-4 text-right text-xs font-medium text-surface-400 uppercase tracking-wider">
                      Avg PnL
                    </th>
                    <th className="py-3 px-4 text-right text-xs font-medium text-surface-400 uppercase tracking-wider">
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
                            className={`font-mono ${
                              entry.avgPnlPercent >= 0 ? 'text-win-400' : 'text-loss-400'
                            }`}
                          >
                            {entry.avgPnlPercent >= 0 ? '+' : ''}
                            {entry.avgPnlPercent.toFixed(2)}%
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <span
                            className={`font-mono font-semibold ${
                              entry.totalPnlUsdc >= 0 ? 'pnl-positive' : 'pnl-negative'
                            }`}
                          >
                            {entry.totalPnlUsdc >= 0 ? '+' : ''}$
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
  );
}
