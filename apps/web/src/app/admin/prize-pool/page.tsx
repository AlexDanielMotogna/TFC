'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/store';
import { AdminCard, AdminCardSkeleton, AdminBadge, TreasuryStatus } from '@/components/admin';
import { Spinner } from '@/components/Spinner';
import { Gift, DollarSign, Calendar, CheckCircle } from 'lucide-react';

interface PrizePool {
  id: string;
  weekStartDate: string;
  weekEndDate: string;
  totalFeesCollected: number;
  totalPrizePool: number;
  isFinalized: boolean;
  isDistributed: boolean;
  finalizedAt: string | null;
  distributedAt: string | null;
  prizes: Array<{
    rank: number;
    userHandle: string;
    prizeAmount: number;
    status: string;
  }>;
}

export default function AdminPrizePoolPage() {
  const { token } = useAuthStore();
  const [pools, setPools] = useState<PrizePool[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchPools() {
      if (!token) return;

      try {
        setIsLoading(true);
        // Fetch from public prize-pool API
        const response = await fetch('/api/prize-pool');
        const data = await response.json();

        if (data.success) {
          // Transform the data to match our interface
          const transformed: PrizePool[] = [];

          if (data.data.currentWeek) {
            transformed.push({
              id: data.data.currentWeek.id || 'current',
              weekStartDate: data.data.currentWeek.weekStartDate,
              weekEndDate: data.data.currentWeek.weekEndDate,
              totalFeesCollected: data.data.currentWeek.totalFeesCollected || 0,
              totalPrizePool: data.data.currentWeek.totalPrizePool || 0,
              isFinalized: data.data.currentWeek.isFinalized || false,
              isDistributed: data.data.currentWeek.isDistributed || false,
              finalizedAt: data.data.currentWeek.finalizedAt,
              distributedAt: data.data.currentWeek.distributedAt,
              prizes: data.data.currentWeek.prizes || [],
            });
          }

          if (data.data.lastWeek) {
            transformed.push({
              id: data.data.lastWeek.id || 'last',
              weekStartDate: data.data.lastWeek.weekStartDate,
              weekEndDate: data.data.lastWeek.weekEndDate,
              totalFeesCollected: data.data.lastWeek.totalFeesCollected || 0,
              totalPrizePool: data.data.lastWeek.totalPrizePool || 0,
              isFinalized: data.data.lastWeek.isFinalized || false,
              isDistributed: data.data.lastWeek.isDistributed || false,
              finalizedAt: data.data.lastWeek.finalizedAt,
              distributedAt: data.data.lastWeek.distributedAt,
              prizes: data.data.lastWeek.prizes || [],
            });
          }

          setPools(transformed);
        }
      } catch (error) {
        console.error('Failed to fetch prize pools:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchPools();
  }, [token]);

  const currentPool = pools[0];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Prize Pool</h1>
          <p className="text-surface-400 mt-1">
            Manage weekly prize pool distribution
          </p>
        </div>
        <TreasuryStatus />
      </div>

      {/* Current Week Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {isLoading ? (
          <>
            <AdminCardSkeleton />
            <AdminCardSkeleton />
            <AdminCardSkeleton />
            <AdminCardSkeleton />
          </>
        ) : currentPool ? (
          <>
            <AdminCard
              title="Current Week Pool"
              value={`$${currentPool.totalPrizePool.toFixed(2)}`}
              icon={Gift}
              variant="success"
            />
            <AdminCard
              title="Fees Collected"
              value={`$${currentPool.totalFeesCollected.toFixed(2)}`}
              icon={DollarSign}
            />
            <AdminCard
              title="Week Ends"
              value={new Date(currentPool.weekEndDate).toLocaleDateString()}
              icon={Calendar}
            />
            <AdminCard
              title="Status"
              value={
                currentPool.isDistributed
                  ? 'Distributed'
                  : currentPool.isFinalized
                  ? 'Finalized'
                  : 'Active'
              }
              icon={CheckCircle}
            />
          </>
        ) : (
          <div className="col-span-4 bg-surface-850 border border-surface-700 rounded-lg p-8 text-center">
            <p className="text-surface-400">No prize pool data available</p>
          </div>
        )}
      </div>

      {/* Prize Pool History */}
      <div className="space-y-4">
        <h2 className="text-lg font-medium text-white">Prize Pool History</h2>
        {isLoading ? (
          <div className="bg-surface-850 border border-surface-700 rounded-lg p-8 text-center">
            <Spinner size="sm" className="mx-auto" />
          </div>
        ) : pools.length > 0 ? (
          <div className="space-y-4">
            {pools.map((pool) => (
              <div
                key={pool.id}
                className="bg-surface-850 border border-surface-700 rounded-lg p-4"
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-white font-medium">
                      {new Date(pool.weekStartDate).toLocaleDateString()} -{' '}
                      {new Date(pool.weekEndDate).toLocaleDateString()}
                    </p>
                    <p className="text-sm text-surface-400">
                      Pool: ${pool.totalPrizePool.toFixed(2)} from $
                      {pool.totalFeesCollected.toFixed(2)} fees
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <AdminBadge
                      variant={pool.isFinalized ? 'success' : 'waiting'}
                    >
                      {pool.isFinalized ? 'Finalized' : 'Active'}
                    </AdminBadge>
                    {pool.isDistributed && (
                      <AdminBadge variant="success">Distributed</AdminBadge>
                    )}
                  </div>
                </div>

                {pool.prizes.length > 0 && (
                  <div className="border-t border-surface-700 pt-4 mt-4">
                    <p className="text-sm text-surface-400 mb-2">Winners:</p>
                    <div className="space-y-2">
                      {pool.prizes.map((prize) => (
                        <div
                          key={prize.rank}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="text-white">
                            #{prize.rank} - {prize.userHandle}
                          </span>
                          <span className="text-win-400">
                            ${prize.prizeAmount.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-surface-850 border border-surface-700 rounded-lg p-8 text-center">
            <p className="text-surface-400">No prize pool history</p>
          </div>
        )}
      </div>
    </div>
  );
}
