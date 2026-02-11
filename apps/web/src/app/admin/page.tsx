'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/store';
import { AdminCard, AdminCardSkeleton } from '@/components/admin';
import { useAdminSubscription } from '@/hooks/useGlobalSocket';
import {
  Users,
  Link2,
  Swords,
  TrendingUp,
  DollarSign,
  Activity,
  Wifi,
  WifiOff,
} from 'lucide-react';

interface AdminStats {
  totalUsers: number;
  activeUsers7d: number;
  pacificaConnected: number;
  fightsByStatus: Record<string, number>;
  totalTrades: number;
  totalFees: number;
  tradingVolume24h: number;
  tradingVolumeAll: number;
}

export default function AdminDashboardPage() {
  const { token } = useAuthStore();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to admin real-time updates
  const { isConnected, isAdminSubscribed, adminStats } = useAdminSubscription();

  useEffect(() => {
    async function fetchStats() {
      if (!token) return;

      try {
        setIsLoading(true);
        const response = await fetch('/api/admin/stats', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch stats');
        }

        const data = await response.json();
        if (data.success) {
          setStats(data.data);
        } else {
          throw new Error(data.error || 'Failed to fetch stats');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    }

    fetchStats();
  }, [token]);

  // Use live stats if available, otherwise fall back to fetched stats
  const displayStats = adminStats
    ? {
        totalUsers: adminStats.totalUsers,
        activeUsers7d: stats?.activeUsers7d || 0,
        pacificaConnected: stats?.pacificaConnected || 0,
        fightsByStatus: adminStats.fightsByStatus,
        totalTrades: adminStats.totalTrades,
        totalFees: adminStats.totalFees,
        tradingVolume24h: stats?.tradingVolume24h || 0,
        tradingVolumeAll: adminStats.totalVolume,
      }
    : stats;

  if (error) {
    return (
      <div className="p-4 bg-loss-500/10 border border-loss-500/30 rounded-lg">
        <p className="text-loss-400">{error}</p>
      </div>
    );
  }

  const totalFights = displayStats
    ? Object.values(displayStats.fightsByStatus).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
          <p className="text-surface-400 mt-1">Overview of platform statistics</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {isConnected && isAdminSubscribed ? (
            <>
              <Wifi size={16} className="text-win-400" />
              <span className="text-win-400">Live</span>
            </>
          ) : (
            <>
              <WifiOff size={16} className="text-surface-500" />
              <span className="text-surface-500">Connecting...</span>
            </>
          )}
        </div>
      </div>

      {/* Users Section */}
      <div>
        <h2 className="text-sm font-medium text-surface-400 uppercase tracking-wider mb-3">
          Users
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            <>
              <AdminCardSkeleton />
              <AdminCardSkeleton />
              <AdminCardSkeleton />
            </>
          ) : (
            <>
              <AdminCard
                title="Total Users"
                value={displayStats?.totalUsers.toLocaleString() || '0'}
                icon={Users}
              />
              <AdminCard
                title="Active Users (7d)"
                value={displayStats?.activeUsers7d.toLocaleString() || '0'}
                icon={Activity}
              />
              <AdminCard
                title="Pacifica Connected"
                value={displayStats?.pacificaConnected.toLocaleString() || '0'}
                icon={Link2}
              />
            </>
          )}
        </div>
      </div>

      {/* Trading Section */}
      <div>
        <h2 className="text-sm font-medium text-surface-400 uppercase tracking-wider mb-3">
          Trading
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {isLoading ? (
            <>
              <AdminCardSkeleton />
              <AdminCardSkeleton />
              <AdminCardSkeleton />
              <AdminCardSkeleton />
            </>
          ) : (
            <>
              <AdminCard
                title="Total Trades"
                value={displayStats?.totalTrades.toLocaleString() || '0'}
                icon={TrendingUp}
              />
              <AdminCard
                title="Total Fees"
                value={`$${(displayStats?.totalFees || 0).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`}
                icon={DollarSign}
                variant="success"
              />
              <AdminCard
                title="Volume (24h)"
                value={`$${(displayStats?.tradingVolume24h || 0).toLocaleString(undefined, {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}`}
                icon={TrendingUp}
              />
              <AdminCard
                title="Volume (All Time)"
                value={`$${(displayStats?.tradingVolumeAll || 0).toLocaleString(undefined, {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}`}
                icon={TrendingUp}
              />
            </>
          )}
        </div>
      </div>

      {/* Fights Section */}
      <div>
        <h2 className="text-sm font-medium text-surface-400 uppercase tracking-wider mb-3">
          Fights
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          {isLoading ? (
            <>
              <AdminCardSkeleton />
              <AdminCardSkeleton />
              <AdminCardSkeleton />
              <AdminCardSkeleton />
              <AdminCardSkeleton />
              <AdminCardSkeleton />
            </>
          ) : (
            <>
              <AdminCard
                title="Total Fights"
                value={totalFights.toLocaleString()}
                icon={Swords}
              />
              <AdminCard
                title="Live"
                value={displayStats?.fightsByStatus?.LIVE?.toString() || '0'}
                variant="danger"
              />
              <AdminCard
                title="Waiting"
                value={displayStats?.fightsByStatus?.WAITING?.toString() || '0'}
                variant="warning"
              />
              <AdminCard
                title="Finished"
                value={displayStats?.fightsByStatus?.FINISHED?.toString() || '0'}
              />
              <AdminCard
                title="No Contest"
                value={
                  ((displayStats?.fightsByStatus as Record<string, number>)?.NO_CONTEST || 0).toString()
                }
                variant="danger"
              />
              <AdminCard
                title="Cancelled"
                value={(displayStats?.fightsByStatus?.CANCELLED || 0).toString()}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
