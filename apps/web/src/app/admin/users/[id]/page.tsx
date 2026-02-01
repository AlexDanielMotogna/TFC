'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { AdminCard, AdminBadge, getRoleVariant, getFightStatusVariant } from '@/components/admin';
import { ArrowLeft, User, Link2, Trophy, TrendingUp, Shield } from 'lucide-react';

interface UserDetail {
  id: string;
  handle: string;
  walletAddress: string | null;
  avatarUrl: string | null;
  role: 'USER' | 'ADMIN';
  referralCode: string | null;
  createdAt: string;
  updatedAt: string;
  pacificaConnection: {
    accountAddress: string;
    isActive: boolean;
    builderCodeApproved: boolean;
    connectedAt: string;
  } | null;
  stats: {
    fightsCount: number;
    tradesCount: number;
    createdFightsCount: number;
    referralsCount: number;
    totalFees: number;
    totalPnl: number;
  };
  leaderboard: {
    weekly: { rank: number | null; wins: number; losses: number; totalPnlUsdc: number } | null;
    allTime: { rank: number | null; wins: number; losses: number; totalPnlUsdc: number } | null;
  };
  recentFights: Array<{
    fightId: string;
    status: string;
    slot: string;
    stakeUsdc: number;
    durationMinutes: number;
    finalPnlPercent: number | null;
    isWinner: boolean;
    isDraw: boolean;
    opponent: { id: string; handle: string } | null;
    joinedAt: string;
    startedAt: string | null;
    endedAt: string | null;
  }>;
}

export default function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { token } = useAuthStore();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    async function fetchUser() {
      if (!token) return;

      try {
        setIsLoading(true);
        const response = await fetch(`/api/admin/users/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await response.json();
        if (data.success) {
          setUser(data.data);
        }
      } catch (error) {
        console.error('Failed to fetch user:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchUser();
  }, [token, id]);

  const handleRoleChange = async (newRole: 'USER' | 'ADMIN') => {
    if (!token || !user) return;

    try {
      setIsUpdating(true);
      const response = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: newRole }),
      });

      const data = await response.json();
      if (data.success) {
        setUser((prev) => (prev ? { ...prev, role: newRole } : null));
      } else {
        alert(data.error || 'Failed to update role');
      }
    } catch (error) {
      console.error('Failed to update role:', error);
      alert('Failed to update role');
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-surface-400">User not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-surface-800 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} className="text-surface-400" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-white">{user.handle}</h1>
            <AdminBadge variant={getRoleVariant(user.role)}>{user.role}</AdminBadge>
          </div>
          <p className="text-sm text-surface-400 font-mono mt-1">
            {user.walletAddress || 'No wallet connected'}
          </p>
        </div>
        <div className="flex gap-2">
          {user.role === 'USER' ? (
            <button
              onClick={() => handleRoleChange('ADMIN')}
              disabled={isUpdating}
              className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {isUpdating ? 'Updating...' : 'Promote to Admin'}
            </button>
          ) : (
            <button
              onClick={() => handleRoleChange('USER')}
              disabled={isUpdating}
              className="px-4 py-2 bg-surface-700 hover:bg-surface-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {isUpdating ? 'Updating...' : 'Demote to User'}
            </button>
          )}
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminCard
          title="Total Fights"
          value={user.stats.fightsCount}
          icon={Trophy}
        />
        <AdminCard
          title="Total Trades"
          value={user.stats.tradesCount}
          icon={TrendingUp}
        />
        <AdminCard
          title="Total PnL"
          value={`$${user.stats.totalPnl.toFixed(2)}`}
          variant={user.stats.totalPnl >= 0 ? 'success' : 'danger'}
        />
        <AdminCard
          title="Total Fees Paid"
          value={`$${user.stats.totalFees.toFixed(2)}`}
        />
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Info */}
        <div className="bg-surface-850 border border-surface-700 rounded-lg p-4">
          <h3 className="font-medium text-white mb-4 flex items-center gap-2">
            <User size={18} />
            User Information
          </h3>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-surface-400">ID</dt>
              <dd className="text-white font-mono text-xs">{user.id}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-surface-400">Handle</dt>
              <dd className="text-white">{user.handle}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-surface-400">Referral Code</dt>
              <dd className="text-white font-mono">{user.referralCode || '-'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-surface-400">Referrals Made</dt>
              <dd className="text-white">{user.stats.referralsCount}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-surface-400">Created</dt>
              <dd className="text-white">
                {new Date(user.createdAt).toLocaleDateString()}
              </dd>
            </div>
          </dl>
        </div>

        {/* Pacifica Connection */}
        <div className="bg-surface-850 border border-surface-700 rounded-lg p-4">
          <h3 className="font-medium text-white mb-4 flex items-center gap-2">
            <Link2 size={18} />
            Pacifica Connection
          </h3>
          {user.pacificaConnection ? (
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-surface-400">Status</dt>
                <dd>
                  <AdminBadge
                    variant={user.pacificaConnection.isActive ? 'success' : 'default'}
                  >
                    {user.pacificaConnection.isActive ? 'Active' : 'Inactive'}
                  </AdminBadge>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-surface-400">Account</dt>
                <dd className="text-white font-mono text-xs">
                  {user.pacificaConnection.accountAddress.slice(0, 8)}...
                  {user.pacificaConnection.accountAddress.slice(-6)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-surface-400">Builder Code</dt>
                <dd>
                  <AdminBadge
                    variant={
                      user.pacificaConnection.builderCodeApproved ? 'success' : 'warning'
                    }
                  >
                    {user.pacificaConnection.builderCodeApproved
                      ? 'Approved'
                      : 'Pending'}
                  </AdminBadge>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-surface-400">Connected</dt>
                <dd className="text-white">
                  {new Date(user.pacificaConnection.connectedAt).toLocaleDateString()}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-surface-500 text-sm">Not connected to Pacifica</p>
          )}
        </div>

        {/* Leaderboard Rankings */}
        <div className="bg-surface-850 border border-surface-700 rounded-lg p-4">
          <h3 className="font-medium text-white mb-4 flex items-center gap-2">
            <Trophy size={18} />
            Leaderboard Rankings
          </h3>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-surface-500 uppercase tracking-wider mb-2">
                Weekly
              </p>
              {user.leaderboard.weekly ? (
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-surface-400">Rank</dt>
                    <dd className="text-white font-medium">
                      #{user.leaderboard.weekly.rank || 'Unranked'}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-surface-400">W/L</dt>
                    <dd className="text-white">
                      {user.leaderboard.weekly.wins}/{user.leaderboard.weekly.losses}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-surface-400">PnL</dt>
                    <dd
                      className={
                        user.leaderboard.weekly.totalPnlUsdc >= 0
                          ? 'text-win-400'
                          : 'text-loss-400'
                      }
                    >
                      ${user.leaderboard.weekly.totalPnlUsdc.toFixed(2)}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="text-surface-500 text-sm">No weekly data</p>
              )}
            </div>
            <div>
              <p className="text-xs text-surface-500 uppercase tracking-wider mb-2">
                All Time
              </p>
              {user.leaderboard.allTime ? (
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-surface-400">Rank</dt>
                    <dd className="text-white font-medium">
                      #{user.leaderboard.allTime.rank || 'Unranked'}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-surface-400">W/L</dt>
                    <dd className="text-white">
                      {user.leaderboard.allTime.wins}/{user.leaderboard.allTime.losses}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-surface-400">PnL</dt>
                    <dd
                      className={
                        user.leaderboard.allTime.totalPnlUsdc >= 0
                          ? 'text-win-400'
                          : 'text-loss-400'
                      }
                    >
                      ${user.leaderboard.allTime.totalPnlUsdc.toFixed(2)}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="text-surface-500 text-sm">No all-time data</p>
              )}
            </div>
          </div>
        </div>

        {/* Security Info */}
        <div className="bg-surface-850 border border-surface-700 rounded-lg p-4">
          <h3 className="font-medium text-white mb-4 flex items-center gap-2">
            <Shield size={18} />
            Security
          </h3>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-surface-400">Role</dt>
              <dd>
                <AdminBadge variant={getRoleVariant(user.role)}>{user.role}</AdminBadge>
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-surface-400">Fights Created</dt>
              <dd className="text-white">{user.stats.createdFightsCount}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-surface-400">Last Updated</dt>
              <dd className="text-white">
                {new Date(user.updatedAt).toLocaleDateString()}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Recent Fights */}
      <div className="bg-surface-850 border border-surface-700 rounded-lg p-4">
        <h3 className="font-medium text-white mb-4">Recent Fights</h3>
        {user.recentFights.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-surface-400 border-b border-surface-700">
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Opponent</th>
                  <th className="pb-2 font-medium text-right">Stake</th>
                  <th className="pb-2 font-medium text-right">Duration</th>
                  <th className="pb-2 font-medium text-right">PnL %</th>
                  <th className="pb-2 font-medium text-center">Result</th>
                  <th className="pb-2 font-medium text-right">Date</th>
                </tr>
              </thead>
              <tbody>
                {user.recentFights.map((fight) => (
                  <tr
                    key={fight.fightId}
                    className="border-b border-surface-700/50 hover:bg-surface-800/30 cursor-pointer"
                    onClick={() => router.push(`/admin/fights/${fight.fightId}`)}
                  >
                    <td className="py-2">
                      <AdminBadge
                        variant={getFightStatusVariant(fight.status)}
                        pulse={fight.status === 'LIVE'}
                      >
                        {fight.status}
                      </AdminBadge>
                    </td>
                    <td className="py-2 text-white">
                      {fight.opponent?.handle || 'Waiting...'}
                    </td>
                    <td className="py-2 text-right text-surface-300">
                      ${fight.stakeUsdc}
                    </td>
                    <td className="py-2 text-right text-surface-300">
                      {fight.durationMinutes}m
                    </td>
                    <td className="py-2 text-right">
                      {fight.finalPnlPercent !== null ? (
                        <span
                          className={
                            fight.finalPnlPercent >= 0
                              ? 'text-win-400'
                              : 'text-loss-400'
                          }
                        >
                          {fight.finalPnlPercent >= 0 ? '+' : ''}
                          {fight.finalPnlPercent.toFixed(2)}%
                        </span>
                      ) : (
                        <span className="text-surface-500">-</span>
                      )}
                    </td>
                    <td className="py-2 text-center">
                      {fight.status === 'FINISHED' ? (
                        fight.isDraw ? (
                          <span className="text-surface-400">Draw</span>
                        ) : fight.isWinner ? (
                          <span className="text-win-400">Won</span>
                        ) : (
                          <span className="text-loss-400">Lost</span>
                        )
                      ) : (
                        <span className="text-surface-500">-</span>
                      )}
                    </td>
                    <td className="py-2 text-right text-surface-400">
                      {new Date(fight.joinedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-surface-500 text-sm">No fights yet</p>
        )}
      </div>
    </div>
  );
}
