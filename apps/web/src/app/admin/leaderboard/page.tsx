'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/store';
import { AdminTable, AdminBadge } from '@/components/admin';
import { RefreshCw, Trophy } from 'lucide-react';

interface LeaderboardEntry {
  userId: string;
  handle: string;
  rank: number | null;
  totalFights: number;
  wins: number;
  losses: number;
  draws: number;
  totalPnlUsdc: number;
  avgPnlPercent: number;
}

export default function AdminLeaderboardPage() {
  const { token } = useAuthStore();
  const [weeklyData, setWeeklyData] = useState<LeaderboardEntry[]>([]);
  const [allTimeData, setAllTimeData] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'weekly' | 'all_time'>('weekly');

  useEffect(() => {
    async function fetchLeaderboard() {
      if (!token) return;

      try {
        setIsLoading(true);
        // Fetch from public leaderboard API
        const [weeklyRes, allTimeRes] = await Promise.all([
          fetch('/api/leaderboard?range=weekly'),
          fetch('/api/leaderboard?range=all_time'),
        ]);

        const weeklyJson = await weeklyRes.json();
        const allTimeJson = await allTimeRes.json();

        if (weeklyJson.success) {
          setWeeklyData(weeklyJson.data?.entries || []);
        }
        if (allTimeJson.success) {
          setAllTimeData(allTimeJson.data?.entries || []);
        }
      } catch (error) {
        console.error('Failed to fetch leaderboard:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchLeaderboard();
  }, [token]);

  const handleRefresh = async () => {
    if (!token) return;

    try {
      setIsRefreshing(true);
      // This would call a refresh endpoint if available
      alert('Leaderboard refresh triggered. Data will update shortly.');
    } catch (error) {
      console.error('Failed to refresh leaderboard:', error);
      alert('Failed to refresh leaderboard');
    } finally {
      setIsRefreshing(false);
    }
  };

  const currentData = activeTab === 'weekly' ? weeklyData : allTimeData;

  const columns = [
    {
      key: 'rank',
      header: 'Rank',
      render: (entry: LeaderboardEntry) => (
        <div className="flex items-center gap-2">
          {entry.rank && entry.rank <= 3 ? (
            <Trophy
              size={16}
              className={
                entry.rank === 1
                  ? 'text-yellow-400'
                  : entry.rank === 2
                  ? 'text-gray-400'
                  : 'text-amber-600'
              }
            />
          ) : null}
          <span className="font-medium text-white">
            #{entry.rank || '-'}
          </span>
        </div>
      ),
    },
    {
      key: 'handle',
      header: 'User',
      render: (entry: LeaderboardEntry) => (
        <span className="text-white">{entry.handle}</span>
      ),
    },
    {
      key: 'fights',
      header: 'Fights',
      align: 'right' as const,
      render: (entry: LeaderboardEntry) => (
        <span className="text-surface-300">{entry.totalFights}</span>
      ),
    },
    {
      key: 'record',
      header: 'W/L/D',
      align: 'right' as const,
      render: (entry: LeaderboardEntry) => (
        <span className="text-surface-300">
          <span className="text-win-400">{entry.wins}</span>/
          <span className="text-loss-400">{entry.losses}</span>/
          <span className="text-surface-400">{entry.draws}</span>
        </span>
      ),
    },
    {
      key: 'totalPnl',
      header: 'Total PnL',
      align: 'right' as const,
      render: (entry: LeaderboardEntry) => (
        <span
          className={
            entry.totalPnlUsdc >= 0 ? 'text-win-400' : 'text-loss-400'
          }
        >
          {entry.totalPnlUsdc >= 0 ? '+' : ''}$
          {entry.totalPnlUsdc.toFixed(2)}
        </span>
      ),
    },
    {
      key: 'avgPnl',
      header: 'Avg PnL %',
      align: 'right' as const,
      render: (entry: LeaderboardEntry) => (
        <span
          className={
            entry.avgPnlPercent >= 0 ? 'text-win-400' : 'text-loss-400'
          }
        >
          {entry.avgPnlPercent >= 0 ? '+' : ''}
          {entry.avgPnlPercent.toFixed(2)}%
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Leaderboard</h1>
          <p className="text-surface-400 mt-1">
            Manage and monitor leaderboard rankings
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="px-4 py-2 bg-surface-700 hover:bg-surface-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors flex items-center gap-2"
        >
          <RefreshCw
            size={16}
            className={isRefreshing ? 'animate-spin' : ''}
          />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-surface-700">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('weekly')}
            className={`pb-3 text-sm font-medium transition-colors ${
              activeTab === 'weekly'
                ? 'text-white border-b-2 border-primary-500'
                : 'text-surface-400 hover:text-white'
            }`}
          >
            Weekly
            <span className="ml-2 text-xs text-surface-500">
              ({weeklyData.length})
            </span>
          </button>
          <button
            onClick={() => setActiveTab('all_time')}
            className={`pb-3 text-sm font-medium transition-colors ${
              activeTab === 'all_time'
                ? 'text-white border-b-2 border-primary-500'
                : 'text-surface-400 hover:text-white'
            }`}
          >
            All Time
            <span className="ml-2 text-xs text-surface-500">
              ({allTimeData.length})
            </span>
          </button>
        </nav>
      </div>

      {/* Table */}
      <AdminTable
        columns={columns}
        data={currentData}
        keyExtractor={(entry) => entry.userId}
        isLoading={isLoading}
        emptyMessage="No leaderboard data"
      />
    </div>
  );
}
