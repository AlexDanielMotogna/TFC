'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/lib/store';
import { AdminTable, AdminPagination, AdminBadge } from '@/components/admin';
import { Search, Users, ShieldCheck, ShieldOff, Plus, Power, PowerOff, Pencil, Trash2, Download } from 'lucide-react';
import { toast } from 'sonner';

interface AlphaTester {
  id: string;
  walletAddress: string;
  accessEnabled: boolean;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface Counts {
  total: number;
  enabled: number;
  disabled: number;
}

export default function AdminAlphaTestersPage() {
  const { token } = useAuthStore();
  const [testers, setTesters] = useState<AlphaTester[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 50,
    total: 0,
    totalPages: 0,
  });
  const [counts, setCounts] = useState<Counts>({
    total: 0,
    enabled: 0,
    disabled: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Add wallet modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newWallet, setNewWallet] = useState('');
  const [newNote, setNewNote] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // Edit modal state
  const [editingTester, setEditingTester] = useState<AlphaTester | null>(null);
  const [editWallet, setEditWallet] = useState('');
  const [editNote, setEditNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Export state
  const [isExporting, setIsExporting] = useState(false);

  // Delete confirm state
  const [deletingWallet, setDeletingWallet] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const exportTesters = async (format: 'csv' | 'xlsx') => {
    if (!token) return;
    setIsExporting(true);
    try {
      const params = new URLSearchParams({ page: '1', pageSize: '10000' });
      if (search) params.set('search', search);

      const response = await fetch(`/api/admin/alpha-testers?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!data.success) return;

      const rows = (data.data?.testers || []).map((t: AlphaTester) => ({
        'Wallet Address': t.walletAddress,
        Note: t.note || '',
        Access: t.accessEnabled ? 'Enabled' : 'Disabled',
        Added: new Date(t.createdAt).toLocaleString(),
      }));

      if (format === 'csv') {
        const headers = Object.keys(rows[0] || {});
        const csvContent = [
          headers.join(','),
          ...rows.map((row: Record<string, string | number>) =>
            headers.map((h) => `"${String(row[h]).replace(/"/g, '""')}"`).join(',')
          ),
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tfc-alpha-testers-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const headers = Object.keys(rows[0] || {});
        const xmlRows = rows.map((row: Record<string, string | number>) =>
          '<Row>' + headers.map((h) => `<Cell><Data ss:Type="${typeof row[h] === 'number' ? 'Number' : 'String'}">${String(row[h]).replace(/&/g, '&amp;').replace(/</g, '&lt;')}</Data></Cell>`).join('') + '</Row>'
        ).join('\n');

        const xml = `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="Alpha Testers"><Table>
<Row>${headers.map((h) => `<Cell><Data ss:Type="String">${h}</Data></Cell>`).join('')}</Row>
${xmlRows}
</Table></Worksheet></Workbook>`;

        const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tfc-alpha-testers-${new Date().toISOString().slice(0, 10)}.xls`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const fetchTesters = useCallback(async () => {
    if (!token) return;

    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        pageSize: pagination.pageSize.toString(),
      });

      if (search) params.set('search', search);

      const response = await fetch(`/api/admin/alpha-testers?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      if (data.success) {
        setTesters(data.data?.testers || []);
        setPagination(data.data?.pagination || pagination);
        setCounts(data.data?.counts || counts);
      }
    } catch (error) {
      console.error('Failed to fetch alpha testers:', error);
    } finally {
      setIsLoading(false);
    }
  }, [token, pagination.page, pagination.pageSize, search]);

  useEffect(() => {
    fetchTesters();
  }, [fetchTesters]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination((p) => ({ ...p, page: 1 }));
  };

  const toggleAccess = async (walletAddress: string, accessEnabled: boolean) => {
    if (!token) return;

    try {
      const response = await fetch('/api/admin/alpha-testers', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ walletAddress, accessEnabled }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success(`Access ${accessEnabled ? 'enabled' : 'disabled'} for ${walletAddress.slice(0, 8)}...`);
        fetchTesters();
      } else {
        toast.error(data.error || 'Failed to update access');
      }
    } catch (error) {
      console.error('Failed to toggle access:', error);
      toast.error('Failed to update access');
    }
  };

  const addWallet = async () => {
    if (!token || !newWallet.trim()) return;

    try {
      setIsAdding(true);
      const response = await fetch('/api/admin/alpha-testers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          walletAddress: newWallet.trim(),
          note: newNote.trim() || null,
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Alpha tester added');
        setNewWallet('');
        setNewNote('');
        setShowAddModal(false);
        fetchTesters();
      } else {
        toast.error(data.error || 'Failed to add alpha tester');
      }
    } catch (error) {
      console.error('Failed to add alpha tester:', error);
      toast.error('Failed to add alpha tester');
    } finally {
      setIsAdding(false);
    }
  };

  const openEdit = (tester: AlphaTester) => {
    setEditingTester(tester);
    setEditWallet(tester.walletAddress);
    setEditNote(tester.note || '');
  };

  const saveEdit = async () => {
    if (!token || !editingTester) return;

    try {
      setIsSaving(true);
      const response = await fetch('/api/admin/alpha-testers', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          walletAddress: editingTester.walletAddress,
          newWalletAddress: editWallet.trim() !== editingTester.walletAddress ? editWallet.trim() : undefined,
          note: editNote.trim() || null,
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Tester updated');
        setEditingTester(null);
        fetchTesters();
      } else {
        toast.error(data.error || 'Failed to update');
      }
    } catch (error) {
      console.error('Failed to update tester:', error);
      toast.error('Failed to update');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteTester = async (walletAddress: string) => {
    if (!token) return;

    try {
      setIsDeleting(true);
      const response = await fetch(`/api/admin/alpha-testers?walletAddress=${encodeURIComponent(walletAddress)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      if (data.success) {
        toast.success(`Removed ${walletAddress.slice(0, 8)}...`);
        setDeletingWallet(null);
        fetchTesters();
      } else {
        toast.error(data.error || 'Failed to delete');
      }
    } catch (error) {
      console.error('Failed to delete tester:', error);
      toast.error('Failed to delete');
    } finally {
      setIsDeleting(false);
    }
  };

  const columns = [
    {
      key: 'walletAddress',
      header: 'Wallet Address',
      render: (tester: AlphaTester) => (
        <span className="font-mono text-sm text-white">{tester.walletAddress}</span>
      ),
    },
    {
      key: 'note',
      header: 'Note',
      render: (tester: AlphaTester) => (
        <span className="text-surface-400 text-sm truncate max-w-[200px] block" title={tester.note || undefined}>
          {tester.note || '-'}
        </span>
      ),
    },
    {
      key: 'accessEnabled',
      header: 'Access',
      render: (tester: AlphaTester) => (
        <AdminBadge variant={tester.accessEnabled ? 'success' : 'warning'}>
          {tester.accessEnabled ? 'ENABLED' : 'DISABLED'}
        </AdminBadge>
      ),
    },
    {
      key: 'createdAt',
      header: 'Added',
      render: (tester: AlphaTester) => (
        <span className="text-surface-400 text-sm">
          {new Date(tester.createdAt).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (tester: AlphaTester) => (
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => toggleAccess(tester.walletAddress, !tester.accessEnabled)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${
              tester.accessEnabled
                ? 'bg-loss-500/20 hover:bg-loss-500/30 text-loss-400'
                : 'bg-win-500/20 hover:bg-win-500/30 text-win-400'
            }`}
            title={tester.accessEnabled ? 'Disable access' : 'Enable access'}
          >
            {tester.accessEnabled ? <PowerOff size={12} /> : <Power size={12} />}
          </button>
          <button
            onClick={() => openEdit(tester)}
            className="p-1.5 bg-primary-500/20 hover:bg-primary-500/30 text-primary-400 rounded transition-colors"
            title="Edit"
          >
            <Pencil size={12} />
          </button>
          <button
            onClick={() => setDeletingWallet(tester.walletAddress)}
            className="p-1.5 bg-loss-500/20 hover:bg-loss-500/30 text-loss-400 rounded transition-colors"
            title="Delete"
          >
            <Trash2 size={12} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Alpha Testers</h1>
          <p className="text-surface-400 mt-1">Manage alpha tester access</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-400 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus size={16} />
          Add Wallet
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
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
            <div className="p-2 bg-win-500/20 rounded-lg">
              <ShieldCheck size={20} className="text-win-400" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">{counts.enabled}</p>
              <p className="text-sm text-surface-400">Enabled</p>
            </div>
          </div>
        </div>
        <div className="bg-surface-850 border border-surface-700 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-warning/20 rounded-lg">
              <ShieldOff size={20} className="text-warning" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">{counts.disabled}</p>
              <p className="text-sm text-surface-400">Disabled</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Export */}
      <div className="flex gap-4 items-center">
        <form onSubmit={handleSearch} className="flex-1 max-w-md">
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

        <div className="flex gap-2 ml-auto">
          <button
            onClick={() => exportTesters('csv')}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-3 py-2 bg-surface-850 border border-surface-700 rounded-lg text-sm text-surface-300 hover:text-white hover:border-surface-500 transition-colors disabled:opacity-50"
          >
            <Download size={14} />
            CSV
          </button>
          <button
            onClick={() => exportTesters('xlsx')}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-3 py-2 bg-surface-850 border border-surface-700 rounded-lg text-sm text-surface-300 hover:text-white hover:border-surface-500 transition-colors disabled:opacity-50"
          >
            <Download size={14} />
            Excel
          </button>
        </div>
      </div>

      {/* Table */}
      <AdminTable
        columns={columns}
        data={testers}
        keyExtractor={(tester) => tester.id}
        isLoading={isLoading}
        emptyMessage="No alpha testers found"
      />

      {/* Pagination */}
      <AdminPagination
        page={pagination.page}
        pageSize={pagination.pageSize}
        total={pagination.total}
        onPageChange={(page) => setPagination((p) => ({ ...p, page }))}
      />

      {/* Add Wallet Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowAddModal(false)}>
          <div
            className="bg-surface-850 border border-surface-700 rounded-xl p-6 w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-white mb-4">Add Alpha Tester</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-surface-400 mb-1.5">Wallet Address</label>
                <input
                  type="text"
                  placeholder="Solana wallet address..."
                  value={newWallet}
                  onChange={(e) => setNewWallet(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-900 border border-surface-700 rounded-lg text-sm text-white placeholder:text-surface-500 focus:outline-none focus:border-surface-500 font-mono"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm text-surface-400 mb-1.5">Note (optional)</label>
                <input
                  type="text"
                  placeholder="e.g., YouTuber partnership, early supporter..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-900 border border-surface-700 rounded-lg text-sm text-white placeholder:text-surface-500 focus:outline-none focus:border-surface-500"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-2 bg-surface-700 hover:bg-surface-600 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={addWallet}
                disabled={!newWallet.trim() || isAdding}
                className="flex-1 px-4 py-2 bg-primary-500 hover:bg-primary-400 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAdding ? 'Adding...' : 'Add Tester'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Edit Modal */}
      {editingTester && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setEditingTester(null)}>
          <div
            className="bg-surface-850 border border-surface-700 rounded-xl p-6 w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-white mb-4">Edit Alpha Tester</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-surface-400 mb-1.5">Wallet Address</label>
                <input
                  type="text"
                  value={editWallet}
                  onChange={(e) => setEditWallet(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-900 border border-surface-700 rounded-lg text-sm text-white placeholder:text-surface-500 focus:outline-none focus:border-surface-500 font-mono"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm text-surface-400 mb-1.5">Note</label>
                <input
                  type="text"
                  placeholder="e.g., YouTuber partnership, early supporter..."
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-900 border border-surface-700 rounded-lg text-sm text-white placeholder:text-surface-500 focus:outline-none focus:border-surface-500"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditingTester(null)}
                className="flex-1 px-4 py-2 bg-surface-700 hover:bg-surface-600 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={isSaving}
                className="flex-1 px-4 py-2 bg-primary-500 hover:bg-primary-400 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deletingWallet && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setDeletingWallet(null)}>
          <div
            className="bg-surface-850 border border-surface-700 rounded-xl p-6 w-full max-w-sm mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-white mb-2">Remove Alpha Tester</h2>
            <p className="text-sm text-surface-400 mb-1">Are you sure you want to remove:</p>
            <p className="text-sm text-white font-mono mb-4 break-all">{deletingWallet}</p>

            <div className="flex gap-3">
              <button
                onClick={() => setDeletingWallet(null)}
                className="flex-1 px-4 py-2 bg-surface-700 hover:bg-surface-600 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteTester(deletingWallet)}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 bg-loss-500 hover:bg-loss-400 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
