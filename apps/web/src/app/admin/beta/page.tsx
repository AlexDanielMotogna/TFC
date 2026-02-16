'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/lib/store';
import { AdminTable, AdminPagination, AdminBadge } from '@/components/admin';
import { Search, Check, X, Users, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface BetaApplication {
  id: string;
  walletAddress: string;
  status: 'pending' | 'approved' | 'rejected';
  ipAddress: string | null;
  country: string | null;
  isp: string | null;
  userAgent: string | null;
  multiIpFlag: boolean;
  deviceMatchFlag: boolean;
  ipAccountCount: number;
  appliedAt: string;
  approvedAt: string | null;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface Counts {
  pending: number;
  approved: number;
  rejected: number;
  flagged: number;
  total: number;
}

function getBetaStatusVariant(
  status: string
): 'success' | 'warning' | 'danger' | 'default' {
  switch (status) {
    case 'approved':
      return 'success';
    case 'pending':
      return 'warning';
    case 'rejected':
      return 'danger';
    default:
      return 'default';
  }
}

export default function AdminBetaPage() {
  const { token } = useAuthStore();
  const [applications, setApplications] = useState<BetaApplication[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 25,
    total: 0,
    totalPages: 0,
  });
  const [counts, setCounts] = useState<Counts>({
    pending: 0,
    approved: 0,
    rejected: 0,
    flagged: 0,
    total: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [ipFilter, setIpFilter] = useState<string>('');
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [selectedWallets, setSelectedWallets] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchApplications = useCallback(async () => {
    if (!token) return;

    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        pageSize: pagination.pageSize.toString(),
      });

      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (ipFilter) params.set('ip', ipFilter);
      if (flaggedOnly) params.set('flagged', 'true');

      const response = await fetch(`/api/admin/beta?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      if (data.success) {
        setApplications(data.data?.applications || []);
        setPagination(data.data?.pagination || pagination);
        setCounts(data.data?.counts || counts);
      }
    } catch (error) {
      console.error('Failed to fetch beta applications:', error);
    } finally {
      setIsLoading(false);
    }
  }, [token, pagination.page, pagination.pageSize, search, statusFilter, ipFilter, flaggedOnly]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination((p) => ({ ...p, page: 1 }));
  };

  const updateStatus = async (walletAddress: string, status: 'approved' | 'rejected') => {
    if (!token) return;

    try {
      const response = await fetch(`/api/admin/beta/${walletAddress}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success(`Application ${status}`);
        fetchApplications();
      } else {
        toast.error(data.error || 'Failed to update status');
      }
    } catch (error) {
      console.error('Failed to update status:', error);
      toast.error('Failed to update status');
    }
  };

  const handleBulkAction = async (status: 'approved' | 'rejected') => {
    if (!token || selectedWallets.size === 0) return;

    try {
      setIsProcessing(true);
      const response = await fetch('/api/admin/beta', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          walletAddresses: Array.from(selectedWallets),
          status,
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success(`${data.data?.count || selectedWallets.size} applications ${status}`);
        setSelectedWallets(new Set());
        fetchApplications();
      } else {
        toast.error(data.error || 'Bulk action failed');
      }
    } catch (error) {
      console.error('Bulk action failed:', error);
      toast.error('Bulk action failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedWallets.size === applications.length) {
      setSelectedWallets(new Set());
    } else {
      setSelectedWallets(new Set(applications.map((a) => a.walletAddress)));
    }
  };

  const toggleSelect = (walletAddress: string) => {
    const newSelected = new Set(selectedWallets);
    if (newSelected.has(walletAddress)) {
      newSelected.delete(walletAddress);
    } else {
      newSelected.add(walletAddress);
    }
    setSelectedWallets(newSelected);
  };

  const columns = [
    {
      key: 'select',
      header: (
        <input
          type="checkbox"
          checked={selectedWallets.size === applications.length && applications.length > 0}
          onChange={toggleSelectAll}
          className="rounded border-surface-600 bg-surface-800 text-primary-500 focus:ring-primary-500"
        />
      ),
      render: (app: BetaApplication) => (
        <input
          type="checkbox"
          checked={selectedWallets.has(app.walletAddress)}
          onChange={() => toggleSelect(app.walletAddress)}
          onClick={(e) => e.stopPropagation()}
          className="rounded border-surface-600 bg-surface-800 text-primary-500 focus:ring-primary-500"
        />
      ),
    },
    {
      key: 'walletAddress',
      header: 'Wallet Address',
      render: (app: BetaApplication) => (
        <span className="font-mono text-sm text-white">{app.walletAddress}</span>
      ),
    },
    {
      key: 'ipAddress',
      header: 'IP Address',
      render: (app: BetaApplication) => (
        <div className="flex items-center gap-1.5" title={app.userAgent || undefined}>
          {(app.multiIpFlag || app.deviceMatchFlag) && (
            <span title={app.deviceMatchFlag ? 'Device match (same IP + UA)' : 'Multiple wallets from same IP'}>
              <AlertTriangle
                size={14}
                className={`flex-shrink-0 ${app.deviceMatchFlag ? 'text-loss-400' : 'text-warning'}`}
              />
            </span>
          )}
          {app.ipAddress ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIpFilter(app.ipAddress!);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              className="font-mono text-sm text-primary-400 hover:text-primary-300 hover:underline"
            >
              {app.ipAddress}
            </button>
          ) : (
            <span className="text-surface-500 text-sm">-</span>
          )}
          {app.ipAccountCount > 1 && (
            <span className="text-xs bg-warning/20 text-warning px-1.5 py-0.5 rounded-full font-medium">
              {app.ipAccountCount}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'country',
      header: 'Country',
      render: (app: BetaApplication) => (
        <span className="text-surface-400 text-sm">{app.country || '-'}</span>
      ),
    },
    {
      key: 'isp',
      header: 'ISP',
      render: (app: BetaApplication) => (
        <span className="text-surface-400 text-sm truncate max-w-[150px] block" title={app.isp || undefined}>
          {app.isp || '-'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (app: BetaApplication) => (
        <AdminBadge variant={getBetaStatusVariant(app.status)}>
          {app.status.toUpperCase()}
        </AdminBadge>
      ),
    },
    {
      key: 'appliedAt',
      header: 'Applied',
      render: (app: BetaApplication) => (
        <span className="text-surface-400 text-sm">
          {new Date(app.appliedAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'approvedAt',
      header: 'Approved',
      render: (app: BetaApplication) => (
        <span className="text-surface-400 text-sm">
          {app.approvedAt ? new Date(app.approvedAt).toLocaleDateString() : '-'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (app: BetaApplication) => (
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          {app.status !== 'approved' && (
            <button
              onClick={() => updateStatus(app.walletAddress, 'approved')}
              className="p-1.5 bg-win-500/20 hover:bg-win-500/30 text-win-400 rounded transition-colors"
              title="Approve"
            >
              <Check size={14} />
            </button>
          )}
          {app.status !== 'rejected' && (
            <button
              onClick={() => updateStatus(app.walletAddress, 'rejected')}
              className="p-1.5 bg-loss-500/20 hover:bg-loss-500/30 text-loss-400 rounded transition-colors"
              title="Reject"
            >
              <X size={14} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Beta Access</h1>
        <p className="text-surface-400 mt-1">Manage beta whitelist applications</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-surface-850 border border-surface-700 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-surface-700 rounded-lg">
              <Users size={20} className="text-surface-400" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">{counts.total}</p>
              <p className="text-sm text-surface-400">Total</p>
            </div>
          </div>
        </div>
        <div className="bg-surface-850 border border-surface-700 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-warning/20 rounded-lg">
              <Users size={20} className="text-warning" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">{counts.pending}</p>
              <p className="text-sm text-surface-400">Pending</p>
            </div>
          </div>
        </div>
        <div className="bg-surface-850 border border-surface-700 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-win-500/20 rounded-lg">
              <Check size={20} className="text-win-400" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">{counts.approved}</p>
              <p className="text-sm text-surface-400">Approved</p>
            </div>
          </div>
        </div>
        <div className="bg-surface-850 border border-surface-700 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-loss-500/20 rounded-lg">
              <X size={20} className="text-loss-400" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">{counts.rejected}</p>
              <p className="text-sm text-surface-400">Rejected</p>
            </div>
          </div>
        </div>
        <div
          className={`bg-surface-850 border rounded-lg p-4 cursor-pointer transition-colors ${
            flaggedOnly ? 'border-warning' : 'border-surface-700 hover:border-surface-600'
          }`}
          onClick={() => {
            setFlaggedOnly(!flaggedOnly);
            setPagination((p) => ({ ...p, page: 1 }));
          }}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-warning/20 rounded-lg">
              <AlertTriangle size={20} className="text-warning" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">{counts.flagged}</p>
              <p className="text-sm text-surface-400">Flagged</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <form onSubmit={handleSearch} className="flex-1 min-w-[200px] max-w-md">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500"
            />
            <input
              type="text"
              placeholder="Search by wallet address..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-surface-850 border border-surface-700 rounded-lg text-sm text-white placeholder:text-surface-500 focus:outline-none focus:border-surface-500"
            />
          </div>
        </form>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPagination((p) => ({ ...p, page: 1 }));
          }}
          className="px-3 py-2 bg-surface-850 border border-surface-700 rounded-lg text-sm text-white focus:outline-none focus:border-surface-500"
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>

        <button
          onClick={() => {
            setFlaggedOnly(!flaggedOnly);
            setPagination((p) => ({ ...p, page: 1 }));
          }}
          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            flaggedOnly
              ? 'bg-warning/20 text-warning border border-warning/30'
              : 'bg-surface-850 border border-surface-700 text-surface-400 hover:text-white'
          }`}
        >
          <AlertTriangle size={14} className="inline mr-1.5 -mt-0.5" />
          Flagged Only
        </button>

        {ipFilter && (
          <div className="flex items-center gap-2 px-3 py-2 bg-primary-500/10 border border-primary-500/30 rounded-lg">
            <span className="text-sm text-primary-400">
              IP: <span className="font-mono">{ipFilter}</span>
            </span>
            <button
              onClick={() => {
                setIpFilter('');
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              className="text-primary-400 hover:text-white"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Bulk Actions */}
        {selectedWallets.size > 0 && (
          <div className="flex gap-2 ml-auto">
            <span className="text-sm text-surface-400 self-center">
              {selectedWallets.size} selected
            </span>
            <button
              onClick={() => handleBulkAction('approved')}
              disabled={isProcessing}
              className="px-4 py-2 bg-win-500/20 hover:bg-win-500/30 text-win-400 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
            >
              Approve All
            </button>
            <button
              onClick={() => handleBulkAction('rejected')}
              disabled={isProcessing}
              className="px-4 py-2 bg-loss-500/20 hover:bg-loss-500/30 text-loss-400 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
            >
              Reject All
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <AdminTable
        columns={columns}
        data={applications}
        keyExtractor={(app) => app.id}
        isLoading={isLoading}
        emptyMessage="No beta applications found"
      />

      {/* Pagination */}
      <AdminPagination
        page={pagination.page}
        pageSize={pagination.pageSize}
        total={pagination.total}
        onPageChange={(page) => setPagination((p) => ({ ...p, page }))}
      />
    </div>
  );
}
