'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/store';
import { AdminCard, AdminCardSkeleton } from '@/components/admin';
import { TrendingUp, DollarSign, BarChart } from 'lucide-react';

interface TradeStats {
  totalTrades: number;
  totalVolume: number;
  totalFees: number;
  volume24h: number;
  volume7d: number;
  topSymbols: Array<{ symbol: string; count: number; volume: number }>;
}

export default function AdminTradesPage() {
  const { token } = useAuthStore();
  const [stats, setStats] = useState<TradeStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      if (!token) return;

      try {
        setIsLoading(true);
        // Use the existing stats API for now
        const response = await fetch('/api/admin/stats', {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await response.json();
        if (data.success) {
          setStats({
            totalTrades: data.data.totalTrades || 0,
            totalVolume: data.data.tradingVolumeAll || 0,
            totalFees: data.data.totalFees || 0,
            volume24h: data.data.tradingVolume24h || 0,
            volume7d: 0, // Would need separate API
            topSymbols: [], // Would need separate API
          });
        }
      } catch (error) {
        console.error('Failed to fetch trade stats:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchStats();
  }, [token]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Trade Analytics</h1>
        <p className="text-surface-400 mt-1">Platform trading statistics</p>
      </div>

      {/* Stats Cards */}
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
              value={stats?.totalTrades.toLocaleString() || '0'}
              icon={TrendingUp}
            />
            <AdminCard
              title="Total Volume"
              value={`$${(stats?.totalVolume || 0).toLocaleString(undefined, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}`}
              icon={BarChart}
            />
            <AdminCard
              title="Volume (24h)"
              value={`$${(stats?.volume24h || 0).toLocaleString(undefined, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}`}
              icon={TrendingUp}
            />
            <AdminCard
              title="Total Fees"
              value={`$${(stats?.totalFees || 0).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`}
              icon={DollarSign}
              variant="success"
            />
          </>
        )}
      </div>

      {/* Placeholder for trade log */}
      <div className="bg-surface-850 border border-surface-700 rounded-lg p-8 text-center">
        <p className="text-surface-400">
          Detailed trade log and analytics coming soon.
        </p>
        <p className="text-surface-500 text-sm mt-2">
          This will include searchable trade history, symbol analytics, and user
          trade breakdowns.
        </p>
      </div>
    </div>
  );
}
