'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import {
  AdminPagination,
  AdminBadge,
  AdminCard,
  AdminCardSkeleton,
  TreasuryStatus,
} from '@/components/admin';
import {
  DollarSign,
  Clock,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  User,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';

interface PayoutStats {
  allTime: { total: number; totalAmount: number };
  last24h: { total: number; totalAmount: number };
  last7d: { total: number; totalAmount: number };
  pending: { count: number; totalAmount: number };
  failed: { count: number };
  completed24h: { count: number; totalAmount: number };
  avgProcessingTime: number;
}

interface Payout {
  id: string;
  userId: string;
  userHandle: string;
  walletAddress: string;
  amount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  txSignature: string | null;
  createdAt: string;
  processedAt: string | null;
  processingTimeMinutes: number | null;
}

interface PayoutDetails {
  payout: Payout;
  relatedEarnings: Array<{
    id: string;
    traderId: string;
    traderHandle: string;
    tradeId: string;
    symbol: string;
    commissionAmount: number;
    commissionPercent: number;
    earnedAt: string;
  }>;
  retryInfo: {
    estimatedRetryCount: number;
    nextRetryTime: string | null;
    ageMinutes: number;
    maxRetriesReached: boolean;
    tooOldForRetry: boolean;
  };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const STATUS_BADGES = {
  pending: { label: '⏳ Pending', variant: 'default' as const },
  processing: { label: '⚙️ Processing', variant: 'warning' as const },
  completed: { label: '✅ Completed', variant: 'success' as const },
  failed: { label: '❌ Failed', variant: 'danger' as const },
};

export default function AdminReferralPayoutsPage() {
  const router = useRouter();
  const { token } = useAuthStore();
  const [stats, setStats] = useState<PayoutStats | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isLoadingPayouts, setIsLoadingPayouts] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [payoutDetails, setPayoutDetails] = useState<Record<string, PayoutDetails>>({});
  const [loadingDetails, setLoadingDetails] = useState<string | null>(null);

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const fetchStats = useCallback(async () => {
    if (!token) return;

    try {
      setIsLoadingStats(true);
      const response = await fetch('/api/admin/referrals/payouts/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      toast.error('Failed to fetch payout statistics');
    } finally {
      setIsLoadingStats(false);
    }
  }, [token]);

  const fetchPayouts = useCallback(async () => {
    if (!token) return;

    try {
      setIsLoadingPayouts(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      if (statusFilter) params.set('status', statusFilter);
      if (search) params.set('search', search);

      const response = await fetch(`/api/admin/referrals/payouts?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      if (data.success) {
        setPayouts(data.payouts);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error('Failed to fetch payouts:', error);
      toast.error('Failed to fetch payouts');
    } finally {
      setIsLoadingPayouts(false);
    }
  }, [token, pagination.page, pagination.limit, statusFilter, search]);

  const fetchPayoutDetails = useCallback(
    async (payoutId: string) => {
      if (!token || payoutDetails[payoutId]) return;

      try {
        setLoadingDetails(payoutId);
        const response = await fetch(`/api/admin/referrals/payouts/${payoutId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await response.json();
        if (data.success) {
          setPayoutDetails((prev) => ({ ...prev, [payoutId]: data.data }));
        }
      } catch (error) {
        console.error('Failed to fetch payout details:', error);
        toast.error('Failed to fetch payout details');
      } finally {
        setLoadingDetails(null);
      }
    },
    [token, payoutDetails]
  );

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchPayouts();
  }, [fetchPayouts]);

  const handleRetryPayout = async (payoutId: string) => {
    if (!token) return;

    try {
      setRetryingId(payoutId);
      const response = await fetch(`/api/admin/referrals/payouts/${payoutId}/retry`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      if (data.success) {
        toast.success(data.message);
        // Refresh the data
        fetchPayouts();
        fetchStats();
      } else {
        toast.error(data.error || 'Failed to retry payout');
      }
    } catch (error) {
      console.error('Failed to retry payout:', error);
      toast.error('Failed to retry payout');
    } finally {
      setRetryingId(null);
    }
  };

  const toggleRowExpansion = (payoutId: string) => {
    if (expandedRow === payoutId) {
      setExpandedRow(null);
    } else {
      setExpandedRow(payoutId);
      fetchPayoutDetails(payoutId);
    }
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const handlePageChange = (newPage: number) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
  };

  const handleRefresh = () => {
    fetchStats();
    fetchPayouts();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Referral Payouts</h1>
          <p className="text-surface-400 mt-1">Monitor and manage referral payout processing</p>
        </div>
        <div className="flex items-start gap-4">
          <TreasuryStatus />
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-surface-700 hover:bg-surface-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoadingStats ? (
          <>
            <AdminCardSkeleton />
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
              title="Total Payouts"
              value={stats?.allTime.total.toString() || '0'}
              subtitle={`$${stats?.allTime.totalAmount.toFixed(2) || '0.00'} total`}
              icon={DollarSign}
            />
            <AdminCard
              title="Last 24h"
              value={stats?.last24h.total.toString() || '0'}
              subtitle={`$${stats?.last24h.totalAmount.toFixed(2) || '0.00'}`}
              icon={Clock}
            />
            <AdminCard
              title="Last 7d"
              value={stats?.last7d.total.toString() || '0'}
              subtitle={`$${stats?.last7d.totalAmount.toFixed(2) || '0.00'}`}
              icon={Clock}
            />
            <AdminCard
              title="Pending"
              value={stats?.pending.count.toString() || '0'}
              subtitle={`$${stats?.pending.totalAmount.toFixed(2) || '0.00'} waiting`}
              variant="warning"
              icon={Clock}
            />
            <AdminCard
              title="Failed (24h)"
              value={stats?.failed.count.toString() || '0'}
              subtitle="Needs attention"
              variant="danger"
              icon={AlertCircle}
            />
            <AdminCard
              title="Completed (24h)"
              value={stats?.completed24h.count.toString() || '0'}
              subtitle={`$${stats?.completed24h.totalAmount.toFixed(2) || '0.00'} transferred`}
              variant="success"
              icon={CheckCircle}
            />
            <AdminCard
              title="Avg Processing Time"
              value={`${stats?.avgProcessingTime || 0}m`}
              subtitle="Last 24h average"
              icon={Clock}
            />
          </>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search by ID, wallet, tx signature..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2 bg-surface-800 border border-surface-700 rounded-lg text-white placeholder:text-surface-500 focus:outline-none focus:border-primary-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 bg-surface-800 border border-surface-700 rounded-lg text-white focus:outline-none focus:border-primary-500"
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {/* Custom Expandable Table */}
      <div className="bg-surface-850 border border-surface-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-surface-800">
                <th className="px-4 py-3 text-xs font-medium text-surface-400 uppercase tracking-wider text-left">
                  Payout ID
                </th>
                <th className="px-4 py-3 text-xs font-medium text-surface-400 uppercase tracking-wider text-left">
                  User
                </th>
                <th className="px-4 py-3 text-xs font-medium text-surface-400 uppercase tracking-wider text-right">
                  Amount
                </th>
                <th className="px-4 py-3 text-xs font-medium text-surface-400 uppercase tracking-wider text-left">
                  Status
                </th>
                <th className="px-4 py-3 text-xs font-medium text-surface-400 uppercase tracking-wider text-left">
                  Created
                </th>
                <th className="px-4 py-3 text-xs font-medium text-surface-400 uppercase tracking-wider text-left">
                  Processed
                </th>
                <th className="px-4 py-3 text-xs font-medium text-surface-400 uppercase tracking-wider text-left">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-700">
              {isLoadingPayouts ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-surface-400">
                    Loading payouts...
                  </td>
                </tr>
              ) : payouts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-surface-400">
                    No payouts found
                  </td>
                </tr>
              ) : (
                payouts.map((payout) => (
                  <>
                    <tr
                      key={payout.id}
                      className="hover:bg-surface-800 cursor-pointer transition-colors"
                      onClick={() => toggleRowExpansion(payout.id)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {expandedRow === payout.id ? (
                            <ChevronDown size={16} className="text-surface-400" />
                          ) : (
                            <ChevronRight size={16} className="text-surface-400" />
                          )}
                          <span className="font-mono text-sm text-surface-300">
                            {payout.id.slice(0, 8)}...
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(payout.id);
                            }}
                            className="p-1 hover:bg-surface-700 rounded transition-colors"
                            title="Copy full ID"
                          >
                            {copiedId === payout.id ? (
                              <Check size={14} className="text-win-400" />
                            ) : (
                              <Copy size={14} className="text-surface-400" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <div className="text-white font-medium">{payout.userHandle}</div>
                          <div className="text-xs text-surface-400 font-mono">
                            {payout.walletAddress.slice(0, 4)}...{payout.walletAddress.slice(-4)}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-white font-medium">${payout.amount.toFixed(2)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <AdminBadge variant={STATUS_BADGES[payout.status].variant}>
                          {STATUS_BADGES[payout.status].label}
                        </AdminBadge>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="text-surface-300 text-sm"
                          title={new Date(payout.createdAt).toLocaleString()}
                        >
                          {formatRelativeTime(payout.createdAt)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-surface-300 text-sm">
                          {payout.processedAt ? (
                            <span title={new Date(payout.processedAt).toLocaleString()}>
                              {formatRelativeTime(payout.processedAt)}
                              {payout.processingTimeMinutes !== null && (
                                <span className="text-xs text-surface-500 ml-1">
                                  ({payout.processingTimeMinutes}m)
                                </span>
                              )}
                            </span>
                          ) : (
                            '-'
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div
                          className="flex items-center gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {payout.status === 'failed' && (
                            <button
                              onClick={() => handleRetryPayout(payout.id)}
                              disabled={retryingId === payout.id}
                              className="p-2 hover:bg-surface-700 rounded transition-colors disabled:opacity-50"
                              title="Retry Payout"
                            >
                              <RefreshCw
                                size={16}
                                className={`text-surface-400 ${
                                  retryingId === payout.id ? 'animate-spin' : ''
                                }`}
                              />
                            </button>
                          )}
                          {payout.txSignature && (
                            <a
                              href={`https://solscan.io/tx/${payout.txSignature}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 hover:bg-surface-700 rounded transition-colors"
                              title="View on Solscan"
                            >
                              <ExternalLink size={16} className="text-surface-400" />
                            </a>
                          )}
                          <button
                            onClick={() => router.push(`/admin/users/${payout.userId}`)}
                            className="p-2 hover:bg-surface-700 rounded transition-colors"
                            title="View User"
                          >
                            <User size={16} className="text-surface-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedRow === payout.id && (
                      <tr key={`${payout.id}-expanded`}>
                        <td colSpan={7} className="bg-surface-900 px-4 py-4">
                          {loadingDetails === payout.id ? (
                            <div className="text-center text-surface-400 py-4">
                              Loading details...
                            </div>
                          ) : payoutDetails[payout.id] ? (
                            <div className="space-y-4">
                              {/* Related Earnings */}
                              <div>
                                <h4 className="text-sm font-semibold text-white mb-2">
                                  Related Earnings ({payoutDetails[payout.id].relatedEarnings.length})
                                </h4>
                                {payoutDetails[payout.id].relatedEarnings.length > 0 ? (
                                  <div className="bg-surface-800 rounded-lg overflow-hidden">
                                    <table className="w-full">
                                      <thead>
                                        <tr className="bg-surface-750">
                                          <th className="px-3 py-2 text-xs font-medium text-surface-400 text-left">
                                            Trader
                                          </th>
                                          <th className="px-3 py-2 text-xs font-medium text-surface-400 text-left">
                                            Symbol
                                          </th>
                                          <th className="px-3 py-2 text-xs font-medium text-surface-400 text-right">
                                            Commission
                                          </th>
                                          <th className="px-3 py-2 text-xs font-medium text-surface-400 text-right">
                                            Rate
                                          </th>
                                          <th className="px-3 py-2 text-xs font-medium text-surface-400 text-left">
                                            Earned
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-surface-700">
                                        {payoutDetails[payout.id].relatedEarnings.map((earning) => (
                                          <tr key={earning.id}>
                                            <td className="px-3 py-2 text-sm text-white">
                                              {earning.traderHandle}
                                            </td>
                                            <td className="px-3 py-2 text-sm text-surface-300">
                                              {earning.symbol}
                                            </td>
                                            <td className="px-3 py-2 text-sm text-white text-right">
                                              ${earning.commissionAmount.toFixed(2)}
                                            </td>
                                            <td className="px-3 py-2 text-sm text-surface-300 text-right">
                                              {earning.commissionPercent}%
                                            </td>
                                            <td className="px-3 py-2 text-sm text-surface-300">
                                              {formatRelativeTime(earning.earnedAt)}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : (
                                  <p className="text-sm text-surface-400">No related earnings found</p>
                                )}
                              </div>

                              {/* Retry Information */}
                              {payout.status === 'failed' && (
                                <div>
                                  <h4 className="text-sm font-semibold text-white mb-2">
                                    Retry Information
                                  </h4>
                                  <div className="bg-surface-800 rounded-lg p-3 space-y-2">
                                    <div className="flex justify-between text-sm">
                                      <span className="text-surface-400">Retry Attempts:</span>
                                      <span className="text-white">
                                        {payoutDetails[payout.id].retryInfo.estimatedRetryCount} / 3
                                      </span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                      <span className="text-surface-400">Payout Age:</span>
                                      <span className="text-white">
                                        {payoutDetails[payout.id].retryInfo.ageMinutes} minutes
                                      </span>
                                    </div>
                                    {payoutDetails[payout.id].retryInfo.nextRetryTime && (
                                      <div className="flex justify-between text-sm">
                                        <span className="text-surface-400">Next Retry:</span>
                                        <span className="text-white">
                                          {formatRelativeTime(
                                            payoutDetails[payout.id].retryInfo.nextRetryTime
                                          )}
                                        </span>
                                      </div>
                                    )}
                                    {payoutDetails[payout.id].retryInfo.maxRetriesReached && (
                                      <p className="text-sm text-loss-400">
                                        ⚠️ Maximum retry attempts reached. Manual intervention required.
                                      </p>
                                    )}
                                    {payoutDetails[payout.id].retryInfo.tooOldForRetry && (
                                      <p className="text-sm text-loss-400">
                                        ⚠️ Payout is older than 24 hours. Automatic retries disabled.
                                      </p>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-center text-surface-400 py-4">
                              Failed to load details
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {!isLoadingPayouts && pagination.total > pagination.limit && (
        <AdminPagination
          page={pagination.page}
          pageSize={pagination.limit}
          total={pagination.total}
          onPageChange={handlePageChange}
        />
      )}
    </div>
  );
}
