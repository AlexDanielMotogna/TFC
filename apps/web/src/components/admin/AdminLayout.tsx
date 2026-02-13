'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { AdminSidebar } from './AdminSidebar';
import { AdminAlerts } from './AdminAlerts';
import { Spinner } from '@/components/Spinner';
import { Menu } from 'lucide-react';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const router = useRouter();
  const { isAuthenticated, isAdmin, token, clearAuth, _hasHydrated } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Client-side quick check
  useEffect(() => {
    if (_hasHydrated && (!isAuthenticated || !isAdmin)) {
      router.replace('/');
    }
  }, [_hasHydrated, isAuthenticated, isAdmin, router]);

  // Server-side verification: confirm admin role via JWT (non-blocking)
  // Prevents access if someone tampered with localStorage to set isAdmin=true
  useEffect(() => {
    if (!_hasHydrated || !token || !isAdmin) return;

    fetch('/api/admin/verify', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) {
          // Token invalid or not admin - clear tampered state and redirect
          clearAuth();
          router.replace('/');
        }
      })
      .catch(() => {
        // Network error - ignore, individual API calls will fail if token is bad
      });
  }, [_hasHydrated, token, isAdmin, clearAuth, router]);

  // Show loading while hydrating
  if (!_hasHydrated) {
    return (
      <div className="min-h-screen bg-surface-900 flex items-center justify-center">
        <Spinner size="sm" />
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
      <AdminSidebar
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 bg-surface-850 border-b border-surface-700 flex items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-3">
            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 hover:bg-surface-700 rounded text-surface-400 hover:text-white transition-colors"
            >
              <Menu size={20} />
            </button>
            <span className="text-sm font-medium text-white">Admin Panel</span>
            <span className="px-2 py-0.5 text-xs font-medium bg-primary-500/20 text-primary-400 rounded">
              {process.env.NODE_ENV === 'production' ? 'PROD' : 'DEV'}
            </span>
          </div>

          {/* Alert Badges */}
          <AdminAlerts />

          <div className="hidden sm:block text-sm text-surface-400">
            Trading Fight Club
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
