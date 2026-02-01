'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { AdminTable, AdminPagination, AdminBadge, getRoleVariant } from '@/components/admin';
import { Search, Check, X } from 'lucide-react';

interface User {
  id: string;
  handle: string;
  walletAddress: string | null;
  role: 'USER' | 'ADMIN';
  createdAt: string;
  hasPacifica: boolean;
  fightsCount: number;
  tradesCount: number;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const { token } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 25,
    total: 0,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [pacificaFilter, setPacificaFilter] = useState<string>('');

  const fetchUsers = useCallback(async () => {
    if (!token) return;

    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        pageSize: pagination.pageSize.toString(),
      });

      if (search) params.set('search', search);
      if (roleFilter) params.set('role', roleFilter);
      if (pacificaFilter) params.set('hasPacifica', pacificaFilter);

      const response = await fetch(`/api/admin/users?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      if (data.success) {
        setUsers(data.data);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setIsLoading(false);
    }
  }, [token, pagination.page, pagination.pageSize, search, roleFilter, pacificaFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination((p) => ({ ...p, page: 1 }));
  };

  const columns = [
    {
      key: 'handle',
      header: 'User',
      render: (user: User) => (
        <div>
          <p className="font-medium text-white">{user.handle}</p>
          <p className="text-xs text-surface-500 font-mono">
            {user.walletAddress
              ? `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}`
              : 'No wallet'}
          </p>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (user: User) => (
        <AdminBadge variant={getRoleVariant(user.role)}>{user.role}</AdminBadge>
      ),
    },
    {
      key: 'pacifica',
      header: 'Pacifica',
      render: (user: User) =>
        user.hasPacifica ? (
          <Check size={16} className="text-win-400" />
        ) : (
          <X size={16} className="text-surface-500" />
        ),
      align: 'center' as const,
    },
    {
      key: 'fightsCount',
      header: 'Fights',
      align: 'right' as const,
      render: (user: User) => (
        <span className="text-surface-300">{user.fightsCount}</span>
      ),
    },
    {
      key: 'tradesCount',
      header: 'Trades',
      align: 'right' as const,
      render: (user: User) => (
        <span className="text-surface-300">{user.tradesCount}</span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Joined',
      render: (user: User) => (
        <span className="text-surface-400 text-sm">
          {new Date(user.createdAt).toLocaleDateString()}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Users</h1>
        <p className="text-surface-400 mt-1">Manage platform users</p>
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
              placeholder="Search by handle, wallet, or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-surface-850 border border-surface-700 rounded-lg text-sm text-white placeholder:text-surface-500 focus:outline-none focus:border-surface-500"
            />
          </div>
        </form>

        <select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setPagination((p) => ({ ...p, page: 1 }));
          }}
          className="px-3 py-2 bg-surface-850 border border-surface-700 rounded-lg text-sm text-white focus:outline-none focus:border-surface-500"
        >
          <option value="">All Roles</option>
          <option value="USER">User</option>
          <option value="ADMIN">Admin</option>
        </select>

        <select
          value={pacificaFilter}
          onChange={(e) => {
            setPacificaFilter(e.target.value);
            setPagination((p) => ({ ...p, page: 1 }));
          }}
          className="px-3 py-2 bg-surface-850 border border-surface-700 rounded-lg text-sm text-white focus:outline-none focus:border-surface-500"
        >
          <option value="">All Users</option>
          <option value="true">Pacifica Connected</option>
          <option value="false">Not Connected</option>
        </select>
      </div>

      {/* Table */}
      <AdminTable
        columns={columns}
        data={users}
        keyExtractor={(user) => user.id}
        isLoading={isLoading}
        emptyMessage="No users found"
        onRowClick={(user) => router.push(`/admin/users/${user.id}`)}
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
