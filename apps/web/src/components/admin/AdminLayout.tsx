'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { AdminSidebar } from './AdminSidebar';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const router = useRouter();
  const { isAuthenticated, isAdmin, _hasHydrated } = useAuthStore();

  useEffect(() => {
    if (_hasHydrated && (!isAuthenticated || !isAdmin)) {
      router.replace('/');
    }
  }, [_hasHydrated, isAuthenticated, isAdmin, router]);

  // Show loading while hydrating
  if (!_hasHydrated) {
    return (
      <div className="min-h-screen bg-surface-900 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Redirect if not authenticated or not admin
  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="min-h-screen bg-surface-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-surface-400 mb-4">Access denied</p>
          <p className="text-sm text-surface-500">Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-900 flex">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 bg-surface-850 border-b border-surface-700 flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-white">Admin Panel</span>
            <span className="px-2 py-0.5 text-xs font-medium bg-primary-500/20 text-primary-400 rounded">
              {process.env.NODE_ENV === 'production' ? 'PROD' : 'DEV'}
            </span>
          </div>
          <div className="text-sm text-surface-400">
            Trading Fight Club
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
