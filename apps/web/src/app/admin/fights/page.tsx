'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { AdminTable, AdminPagination, AdminBadge, getFightStatusVariant } from '@/components/admin';
import { Clock } from 'lucide-react';

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

  // Auto-refresh for live fights
  useEffect(() => {
    if (fights.some((f) => f.status === 'LIVE')) {
      const interval = setInterval(fetchFights, 10000);
      return () => clearInterval(interval);
    }
  }, [fights, fetchFights]);

  const formatTimeRemaining = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const columns = [
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
      <div>
        <h1 className="text-2xl font-semibold text-white">Fights</h1>
        <p className="text-surface-400 mt-1">Monitor and manage fights</p>
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

        {fights.some((f) => f.status === 'LIVE') && (
          <span className="text-xs text-surface-500">
            Auto-refreshing every 10s
          </span>
        )}
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
