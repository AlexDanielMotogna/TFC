'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { AdminCard, AdminBadge, getRoleVariant, getFightStatusVariant } from '@/components/admin';
import { ArrowLeft, User, Link2, Trophy, TrendingUp, Shield, Ban, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';

type UserStatus = 'ACTIVE' | 'BANNED' | 'DELETED';

interface UserDetail {
  id: string;
  handle: string;
  walletAddress: string | null;
  avatarUrl: string | null;
  role: 'USER' | 'ADMIN';
  status: UserStatus;
  bannedAt: string | null;
  bannedReason: string | null;
  deletedAt: string | null;
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
  const [showBanModal, setShowBanModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [banReason, setBanReason] = useState('');
  const [deleteType, setDeleteType] = useState<'soft' | 'hard'>('soft');

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

  const handleBan = async () => {
    if (!token || !user) return;

    try {
      setIsUpdating(true);
      const response = await fetch(`/api/admin/users/${id}/ban`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: banReason || undefined }),
      });

      const data = await response.json();
      if (data.success) {
        setUser((prev) =>
          prev
            ? {
                ...prev,
                status: 'BANNED' as UserStatus,
                bannedAt: data.bannedAt,
                bannedReason: banReason || null,
              }
            : null
        );
        toast.success('User banned successfully');
        setShowBanModal(false);
        setBanReason('');
      } else {
        toast.error(data.error || 'Failed to ban user');
      }
    } catch (error) {
      console.error('Failed to ban user:', error);
      toast.error('Failed to ban user');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUnban = async () => {
    if (!token || !user) return;

    try {
      setIsUpdating(true);
      const response = await fetch(`/api/admin/users/${id}/unban`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setUser((prev) =>
          prev
            ? {
                ...prev,
                status: 'ACTIVE' as UserStatus,
                bannedAt: null,
                bannedReason: null,
              }
            : null
        );
        toast.success('User unbanned successfully');
      } else {
        toast.error(data.error || 'Failed to unban user');
      }
    } catch (error) {
      console.error('Failed to unban user:', error);
      toast.error('Failed to unban user');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!token || !user) return;

    try {
      setIsUpdating(true);
      const url = deleteType === 'hard' ? `/api/admin/users/${id}?hard=true` : `/api/admin/users/${id}`;
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        toast.success(deleteType === 'hard' ? 'User permanently deleted' : 'User account deleted');
        setShowDeleteModal(false);
        router.push('/admin/users');
      } else {
        toast.error(data.error || 'Failed to delete user');
      }
    } catch (error) {
      console.error('Failed to delete user:', error);
      toast.error('Failed to delete user');
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusVariant = (status: UserStatus): 'success' | 'danger' | 'default' => {
    switch (status) {
      case 'ACTIVE':
        return 'success';
      case 'BANNED':
      case 'DELETED':
        return 'danger';
      default:
        return 'default';
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
            <AdminBadge variant={getStatusVariant(user.status)}>{user.status}</AdminBadge>
          </div>
          <p className="text-sm text-surface-400 font-mono mt-1">
            {user.walletAddress || 'No wallet connected'}
          </p>
          {user.bannedAt && (
            <p className="text-sm text-loss-400 mt-1">
              Banned on {new Date(user.bannedAt).toLocaleDateString()}
              {user.bannedReason && ` - ${user.bannedReason}`}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {/* Role buttons */}
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

          {/* Ban/Unban buttons (only for non-admin users) */}
          {user.role !== 'ADMIN' && user.status !== 'DELETED' && (
            <>
              {user.status === 'BANNED' ? (
                <button
                  onClick={handleUnban}
                  disabled={isUpdating}
                  className="px-4 py-2 bg-win-500/20 hover:bg-win-500/30 text-win-400 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  <Ban size={16} />
                  Unban
                </button>
              ) : (
                <button
                  onClick={() => setShowBanModal(true)}
                  disabled={isUpdating}
                  className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  <Ban size={16} />
                  Ban
                </button>
              )}
            </>
          )}

          {/* Delete button (only for non-admin users) */}
          {user.role !== 'ADMIN' && user.status !== 'DELETED' && (
            <button
              onClick={() => setShowDeleteModal(true)}
              disabled={isUpdating}
              className="px-4 py-2 bg-loss-500/20 hover:bg-loss-500/30 text-loss-400 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              <Trash2 size={16} />
              Delete
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

      {/* Ban Modal */}
      {showBanModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-surface-850 border border-surface-700 rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Ban User</h3>
              <button
                onClick={() => setShowBanModal(false)}
                className="p-1 hover:bg-surface-700 rounded transition-colors"
              >
                <X size={20} className="text-surface-400" />
              </button>
            </div>
            <p className="text-surface-400 text-sm mb-4">
              Are you sure you want to ban <span className="text-white font-medium">@{user.handle}</span>?
              This will prevent them from logging in and cancel all active fights.
            </p>
            <div className="mb-4">
              <label className="block text-sm text-surface-400 mb-2">
                Ban Reason (optional)
              </label>
              <textarea
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="Enter reason for ban..."
                className="w-full px-3 py-2 bg-surface-800 border border-surface-700 rounded-lg text-white text-sm placeholder:text-surface-500 focus:outline-none focus:border-surface-500 resize-none"
                rows={3}
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowBanModal(false)}
                className="px-4 py-2 bg-surface-700 hover:bg-surface-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBan}
                disabled={isUpdating}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {isUpdating ? 'Banning...' : 'Ban User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-surface-850 border border-surface-700 rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Delete User</h3>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="p-1 hover:bg-surface-700 rounded transition-colors"
              >
                <X size={20} className="text-surface-400" />
              </button>
            </div>
            <p className="text-surface-400 text-sm mb-4">
              Are you sure you want to delete <span className="text-white font-medium">@{user.handle}</span>?
            </p>
            <div className="mb-4 space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="deleteType"
                  checked={deleteType === 'soft'}
                  onChange={() => setDeleteType('soft')}
                  className="mt-1"
                />
                <div>
                  <p className="text-white text-sm font-medium">Soft Delete</p>
                  <p className="text-surface-400 text-xs">
                    Mark account as deleted. Data preserved for audit trail.
                  </p>
                </div>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="deleteType"
                  checked={deleteType === 'hard'}
                  onChange={() => setDeleteType('hard')}
                  className="mt-1"
                />
                <div>
                  <p className="text-white text-sm font-medium">Hard Delete (GDPR)</p>
                  <p className="text-surface-400 text-xs">
                    Permanently remove all user data. Cannot be undone.
                  </p>
                </div>
              </label>
            </div>
            {deleteType === 'hard' && (
              <div className="mb-4 p-3 bg-loss-500/10 border border-loss-500/30 rounded-lg">
                <p className="text-loss-400 text-sm">
                  Warning: This action is irreversible. All user data including fights, trades, and referrals will be permanently deleted.
                </p>
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 bg-surface-700 hover:bg-surface-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isUpdating}
                className="px-4 py-2 bg-loss-500 hover:bg-loss-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {isUpdating ? 'Deleting...' : deleteType === 'hard' ? 'Permanently Delete' : 'Delete User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
