'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/lib/store';
import { AdminTable, AdminPagination, AdminBadge } from '@/components/admin';
import {
  ShieldCheck,
  AlertTriangle,
  Users,
  TrendingUp,
  Search,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';

interface Stats {
  totalViolations: number;
  violations24h: number;
  violations7d: number;
  violationsByRule: Record<string, number>;
  violationsByAction: Record<string, number>;
  noContestRate: number;
  totalNoContestFights: number;
  totalCompletedFights: number;
  suspiciousUsersCount: number;
  recentViolations: RecentViolation[];
}

interface RecentViolation {
  id: string;
  fightId: string;
  ruleCode: string;
  ruleName: string;
  ruleMessage: string;
  actionTaken: string;
  createdAt: string;
  participants: { userId: string; handle: string; slot: string }[];
}

interface Violation {
  id: string;
  fightId: string;
  ruleCode: string;
  ruleName: string;
  ruleMessage: string;
  actionTaken: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  fight: {
    status: string;
    stakeUsdc: number;
    durationMinutes: number;
    startedAt: string | null;
    endedAt: string | null;
  };
  participants: {
    userId: string;
    handle: string;
    slot: string;
    finalPnlPercent: number | null;
  }[];
}

interface SuspiciousUser {
  userId: string;
  handle: string;
  walletAddress: string | null;
  violationCount: number;
  mostCommonRule: string;
  lastViolation: string;
  violationBreakdown: Record<string, number>;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

type TabType = 'violations' | 'users';

const RULE_COLORS: Record<string, string> = {
  ZERO_ZERO: 'bg-amber-500/20 text-amber-400',
  MIN_VOLUME: 'bg-orange-500/20 text-orange-400',
  REPEATED_MATCHUP: 'bg-purple-500/20 text-purple-400',
  SAME_IP_PATTERN: 'bg-red-500/20 text-red-400',
  EXTERNAL_TRADES: 'bg-blue-500/20 text-blue-400',
  ADMIN_NO_CONTEST: 'bg-gray-500/20 text-gray-400',
  ADMIN_RESOLVE: 'bg-gray-500/20 text-gray-400',
  ADMIN_RESTORE: 'bg-green-500/20 text-green-400',
};

function getRuleColor(ruleCode: string): string {
  return RULE_COLORS[ruleCode] || 'bg-surface-700 text-surface-300';
}

function getActionVariant(action: string): 'danger' | 'warning' | 'success' | 'default' {
  switch (action) {
    case 'NO_CONTEST':
      return 'danger';
    case 'FLAGGED':
      return 'warning';
    case 'RESTORED':
      return 'success';
    default:
      return 'default';
  }
}

export default function AdminAntiCheatPage() {
  const { token } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabType>('violations');
  const [stats, setStats] = useState<Stats | null>(null);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [suspiciousUsers, setSuspiciousUsers] = useState<SuspiciousUser[]>([]);
  const [violationsPage, setViolationsPage] = useState(1);
  const [violationsTotal, setViolationsTotal] = useState(0);
  const [usersPage, setUsersPage] = useState(1);
  const [usersTotal, setUsersTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [ruleFilter, setRuleFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const pageSize = 20;

  // Fetch stats
  const fetchStats = useCallback(async () => {
    if (!token) return;

    try {
      const response = await fetch('/api/admin/anti-cheat/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch anti-cheat stats:', error);
    }
  }, [token]);

  // Fetch violations
  const fetchViolations = useCallback(async () => {
    if (!token) return;

    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        page: violationsPage.toString(),
        limit: pageSize.toString(),
      });

      if (search) params.set('search', search);
      if (ruleFilter) params.set('ruleCode', ruleFilter);
      if (actionFilter) params.set('actionTaken', actionFilter);

      const response = await fetch(`/api/admin/anti-cheat/violations?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setViolations(data.data?.violations || []);
        setViolationsTotal(data.data?.pagination?.total || 0);
      }
    } catch (error) {
      console.error('Failed to fetch violations:', error);
    } finally {
      setIsLoading(false);
    }
  }, [token, violationsPage, search, ruleFilter, actionFilter]);

  // Fetch suspicious users
  const fetchSuspiciousUsers = useCallback(async () => {
    if (!token) return;

    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        page: usersPage.toString(),
        limit: pageSize.toString(),
        minViolations: '2',
      });

      const response = await fetch(`/api/admin/anti-cheat/suspicious-users?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setSuspiciousUsers(data.data?.users || []);
        setUsersTotal(data.data?.pagination?.total || 0);
      }
    } catch (error) {
      console.error('Failed to fetch suspicious users:', error);
    } finally {
      setIsLoading(false);
    }
  }, [token, usersPage]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (activeTab === 'violations') {
      fetchViolations();
    } else {
      fetchSuspiciousUsers();
    }
  }, [activeTab, fetchViolations, fetchSuspiciousUsers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setViolationsPage(1);
  };

  const violationColumns = [
    {
      key: 'fightId',
      header: 'Fight',
      render: (v: Violation) => (
        <Link
          href={`/admin/fights/${v.fightId}`}
          className="font-mono text-sm text-primary-400 hover:text-primary-300 flex items-center gap-1"
        >
          {v.fightId.slice(0, 8)}...
          <ExternalLink size={12} />
        </Link>
      ),
    },
    {
      key: 'rule',
      header: 'Rule',
      render: (v: Violation) => (
        <span className={`px-2 py-1 rounded text-xs font-medium ${getRuleColor(v.ruleCode)}`}>
          {v.ruleCode}
        </span>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      render: (v: Violation) => (
        <AdminBadge variant={getActionVariant(v.actionTaken)}>{v.actionTaken}</AdminBadge>
      ),
    },
    {
      key: 'participants',
      header: 'Participants',
      render: (v: Violation) => (
        <div className="flex gap-2 text-sm">
          {v.participants.map((p) => (
            <Link
              key={p.userId}
              href={`/admin/users/${p.userId}`}
              className="text-surface-300 hover:text-white"
            >
              @{p.handle}
            </Link>
          ))}
        </div>
      ),
    },
    {
      key: 'message',
      header: 'Message',
      render: (v: Violation) => (
        <span className="text-sm text-surface-400 line-clamp-1 max-w-[200px]" title={v.ruleMessage}>
          {v.ruleMessage}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Date',
      render: (v: Violation) => (
        <span className="text-surface-400 text-sm whitespace-nowrap">
          {new Date(v.createdAt).toLocaleString()}
        </span>
      ),
    },
  ];

  const userColumns = [
    {
      key: 'handle',
      header: 'User',
      render: (u: SuspiciousUser) => (
        <Link
          href={`/admin/users/${u.userId}`}
          className="text-white hover:text-primary-400 font-medium flex items-center gap-1"
        >
          @{u.handle}
          <ExternalLink size={12} />
        </Link>
      ),
    },
    {
      key: 'violations',
      header: 'Violations',
      render: (u: SuspiciousUser) => (
        <span className="text-white font-semibold">{u.violationCount}</span>
      ),
    },
    {
      key: 'mostCommon',
      header: 'Most Common',
      render: (u: SuspiciousUser) => (
        <span className={`px-2 py-1 rounded text-xs font-medium ${getRuleColor(u.mostCommonRule)}`}>
          {u.mostCommonRule}
        </span>
      ),
    },
    {
      key: 'breakdown',
      header: 'Breakdown',
      render: (u: SuspiciousUser) => (
        <div className="flex gap-1 flex-wrap">
          {Object.entries(u.violationBreakdown).map(([rule, count]) => (
            <span
              key={rule}
              className="px-1.5 py-0.5 bg-surface-700 rounded text-xs text-surface-300"
              title={rule}
            >
              {rule.slice(0, 3)}: {count}
            </span>
          ))}
        </div>
      ),
    },
    {
      key: 'lastViolation',
      header: 'Last Violation',
      render: (u: SuspiciousUser) => (
        <span className="text-surface-400 text-sm whitespace-nowrap">
          {new Date(u.lastViolation).toLocaleDateString()}
        </span>
      ),
    },
  ];

  const ruleOptions = stats?.violationsByRule
    ? Object.keys(stats.violationsByRule).filter((r) => !r.startsWith('ADMIN'))
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Anti-Cheat Monitor</h1>
        <p className="text-surface-400 mt-1">Monitor rule violations and suspicious activity</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-surface-850 border border-surface-700 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-surface-700 rounded-lg">
              <ShieldCheck size={20} className="text-surface-400" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">{stats?.totalViolations || 0}</p>
              <p className="text-sm text-surface-400">Total Violations</p>
            </div>
          </div>
        </div>
        <div className="bg-surface-850 border border-surface-700 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 rounded-lg">
              <AlertTriangle size={20} className="text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">{stats?.violations24h || 0}</p>
              <p className="text-sm text-surface-400">Last 24h</p>
            </div>
          </div>
        </div>
        <div className="bg-surface-850 border border-surface-700 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/20 rounded-lg">
              <TrendingUp size={20} className="text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">{stats?.noContestRate || 0}%</p>
              <p className="text-sm text-surface-400">NO_CONTEST Rate</p>
            </div>
          </div>
        </div>
        <div className="bg-surface-850 border border-surface-700 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Users size={20} className="text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">
                {stats?.suspiciousUsersCount || 0}
              </p>
              <p className="text-sm text-surface-400">Suspicious Users</p>
            </div>
          </div>
        </div>
      </div>

      {/* Rule Breakdown */}
      {stats?.violationsByRule && Object.keys(stats.violationsByRule).length > 0 && (
        <div className="bg-surface-850 border border-surface-700 rounded-lg p-4">
          <h3 className="text-sm font-medium text-surface-400 mb-3">Violations by Rule</h3>
          <div className="flex gap-4 flex-wrap">
            {Object.entries(stats.violationsByRule).map(([rule, count]) => (
              <div key={rule} className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded text-xs font-medium ${getRuleColor(rule)}`}>
                  {rule}
                </span>
                <span className="text-white font-semibold">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-4 border-b border-surface-700">
        <button
          onClick={() => setActiveTab('violations')}
          className={`pb-3 px-1 text-sm font-medium transition-colors ${
            activeTab === 'violations'
              ? 'text-white border-b-2 border-primary-500'
              : 'text-surface-400 hover:text-white'
          }`}
        >
          All Violations
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`pb-3 px-1 text-sm font-medium transition-colors ${
            activeTab === 'users'
              ? 'text-white border-b-2 border-primary-500'
              : 'text-surface-400 hover:text-white'
          }`}
        >
          Suspicious Users
        </button>
      </div>

      {activeTab === 'violations' && (
        <>
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
                  placeholder="Search by fight ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-surface-850 border border-surface-700 rounded-lg text-sm text-white placeholder:text-surface-500 focus:outline-none focus:border-surface-500"
                />
              </div>
            </form>

            <select
              value={ruleFilter}
              onChange={(e) => {
                setRuleFilter(e.target.value);
                setViolationsPage(1);
              }}
              className="px-3 py-2 bg-surface-850 border border-surface-700 rounded-lg text-sm text-white focus:outline-none focus:border-surface-500"
            >
              <option value="">All Rules</option>
              {ruleOptions.map((rule) => (
                <option key={rule} value={rule}>
                  {rule}
                </option>
              ))}
            </select>

            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setViolationsPage(1);
              }}
              className="px-3 py-2 bg-surface-850 border border-surface-700 rounded-lg text-sm text-white focus:outline-none focus:border-surface-500"
            >
              <option value="">All Actions</option>
              <option value="NO_CONTEST">NO_CONTEST</option>
              <option value="FLAGGED">FLAGGED</option>
            </select>
          </div>

          {/* Violations Table */}
          <AdminTable
            columns={violationColumns}
            data={violations}
            keyExtractor={(v) => v.id}
            isLoading={isLoading}
            emptyMessage="No violations found"
          />

          <AdminPagination
            page={violationsPage}
            pageSize={pageSize}
            total={violationsTotal}
            onPageChange={(page) => setViolationsPage(page)}
          />
        </>
      )}

      {activeTab === 'users' && (
        <>
          {/* Suspicious Users Table */}
          <AdminTable
            columns={userColumns}
            data={suspiciousUsers}
            keyExtractor={(u) => u.userId}
            isLoading={isLoading}
            emptyMessage="No suspicious users found"
          />

          <AdminPagination
            page={usersPage}
            pageSize={pageSize}
            total={usersTotal}
            onPageChange={(page) => setUsersPage(page)}
          />
        </>
      )}
    </div>
  );
}
