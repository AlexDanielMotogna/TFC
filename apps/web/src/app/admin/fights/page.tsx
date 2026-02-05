'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { AdminTable, AdminPagination, AdminBadge, getFightStatusVariant } from '@/components/admin';
import { useAdminSubscription } from '@/hooks/useGlobalSocket';
import { Clock, Wifi, WifiOff, Copy, Check, Shield } from 'lucide-react';
import Link from 'next/link';

interface Fight {
  id: string;
  status: string;
  creator: { id: string; handle: string };
  durationMinutes: number;
  stakeUsdc: number;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
  winnerId: string | null;
  isDraw: boolean;
  participants: Array<{
    userId: string;
    handle: string;
    slot: string;
    finalPnlPercent: number | null;
    externalTradesDetected: boolean;
  }>;
  tradesCount: number;
  violationsCount: number;
  timeRemaining: number | null;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export default function AdminFightsPage() {
  const router = useRouter();
  const { token } = useAuthStore();
  const [fights, setFights] = useState<Fight[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 25,
    total: 0,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Subscribe to admin real-time updates
  const { isConnected, isAdminSubscribed, adminFights } = useAdminSubscription();

  const fetchFights = useCallback(async () => {
    if (!token) return;

    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        pageSize: pagination.pageSize.toString(),
      });

      if (statusFilter) params.set('status', statusFilter);

      const response = await fetch(`/api/admin/fights?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      if (data.success) {
        setFights(data.data);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error('Failed to fetch fights:', error);
    } finally {
      setIsLoading(false);
    }
  }, [token, pagination.page, pagination.pageSize, statusFilter]);

  useEffect(() => {
    fetchFights();
  }, [fetchFights]);

  // Handle real-time fight updates - update existing fights in list
  useEffect(() => {
    if (adminFights.length === 0) return;

    const latestUpdate = adminFights[0];
    if (!latestUpdate) return;

    setFights((currentFights) => {
      const updatedFightId = latestUpdate.fight.id;
      const existingIndex = currentFights.findIndex((f) => f.id === updatedFightId);

      const existing = currentFights[existingIndex];
      if (existingIndex >= 0 && existing) {
        // Update existing fight - preserve existing properties and update status fields
        const updated = [...currentFights];
        updated[existingIndex] = {
          ...existing,
          status: latestUpdate.fight.status,
          winnerId: latestUpdate.fight.winnerId ?? existing.winnerId,
          isDraw: latestUpdate.fight.isDraw ?? existing.isDraw,
          startedAt: latestUpdate.fight.startedAt ?? existing.startedAt,
          endedAt: latestUpdate.fight.endedAt ?? existing.endedAt,
        };
        return updated;
      }

      // For new fights, just refetch the list to get complete data
      // We could optimistically add, but better to have complete data
      return currentFights;
    });
  }, [adminFights]);

  const formatTimeRemaining = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const columns = [
    {
      key: 'fightId',
      header: 'Fight ID',
      render: (fight: Fight) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <span className="font-mono text-sm text-surface-300">
            {fight.id.slice(0, 8)}...
          </span>
          <button
            onClick={() => copyToClipboard(fight.id)}
            className="p-1 hover:bg-surface-700 rounded transition-colors"
            title="Copy full ID"
          >
            {copiedId === fight.id ? (
              <Check size={14} className="text-win-400" />
            ) : (
              <Copy size={14} className="text-surface-400 hover:text-white" />
            )}
          </button>
          <Link
            href={`/admin/anti-cheat?search=${fight.id}`}
            className="p-1 hover:bg-surface-700 rounded transition-colors"
            title="View in Anti-Cheat"
          >
            <Shield size={14} className="text-surface-400 hover:text-primary-400" />
          </Link>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (fight: Fight) => (
        <AdminBadge
          variant={getFightStatusVariant(fight.status)}
          pulse={fight.status === 'LIVE'}
        >
          {fight.status}
        </AdminBadge>
      ),
    },
    {
      key: 'participants',
      header: 'Participants',
      render: (fight: Fight) => {
        const pA = fight.participants.find((p) => p.slot === 'A');
        const pB = fight.participants.find((p) => p.slot === 'B');
        return (
          <div className="text-sm">
            <span className="text-white">{pA?.handle || 'Waiting'}</span>
            <span className="text-surface-500 mx-2">vs</span>
            <span className="text-white">{pB?.handle || 'Waiting'}</span>
          </div>
        );
      },
    },
    {
      key: 'stakeUsdc',
      header: 'Stake',
      align: 'right' as const,
      render: (fight: Fight) => (
        <span className="text-surface-300">${fight.stakeUsdc}</span>
      ),
    },
    {
      key: 'durationMinutes',
      header: 'Duration',
      align: 'right' as const,
      render: (fight: Fight) => (
        <span className="text-surface-300">{fight.durationMinutes}m</span>
      ),
    },
    {
      key: 'timeRemaining',
      header: 'Time',
      align: 'right' as const,
      render: (fight: Fight) => {
        if (fight.status === 'LIVE' && fight.timeRemaining !== null) {
          return (
            <span className="text-loss-400 flex items-center gap-1 justify-end">
              <Clock size={14} />
              {formatTimeRemaining(fight.timeRemaining)}
            </span>
          );
        }
        return <span className="text-surface-500">-</span>;
      },
    },
    {
      key: 'result',
      header: 'Result',
      render: (fight: Fight) => {
        if (fight.status !== 'FINISHED') {
          return <span className="text-surface-500">-</span>;
        }
        if (fight.isDraw) {
          return <span className="text-surface-400">Draw</span>;
        }
        const winner = fight.participants.find((p) => p.userId === fight.winnerId);
        return <span className="text-win-400">{winner?.handle || 'Unknown'}</span>;
      },
    },
    {
      key: 'flags',
      header: 'Flags',
      align: 'center' as const,
      render: (fight: Fight) => {
        const hasExternal = fight.participants.some((p) => p.externalTradesDetected);
        const hasViolations = fight.violationsCount > 0;

        if (!hasExternal && !hasViolations) {
          return <span className="text-surface-500">-</span>;
        }

        return (
          <div className="flex gap-1 justify-center">
            {hasExternal && (
              <AdminBadge variant="warning">EXT</AdminBadge>
            )}
            {hasViolations && (
              <AdminBadge variant="danger">{fight.violationsCount}</AdminBadge>
            )}
          </div>
        );
      },
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (fight: Fight) => (
        <span className="text-surface-400 text-sm">
          {new Date(fight.createdAt).toLocaleDateString()}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Fights</h1>
          <p className="text-surface-400 mt-1">Monitor and manage fights</p>
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

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPagination((p) => ({ ...p, page: 1 }));
          }}
          className="px-3 py-2 bg-surface-850 border border-surface-700 rounded-lg text-sm text-white focus:outline-none focus:border-surface-500"
        >
          <option value="">All Status</option>
          <option value="WAITING">Waiting</option>
          <option value="LIVE">Live</option>
          <option value="FINISHED">Finished</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="NO_CONTEST">No Contest</option>
        </select>
      </div>

      {/* Table */}
      <AdminTable
        columns={columns}
        data={fights}
        keyExtractor={(fight) => fight.id}
        isLoading={isLoading}
        emptyMessage="No fights found"
        onRowClick={(fight) => router.push(`/admin/fights/${fight.id}`)}
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
