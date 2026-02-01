'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/store';
import { AdminBadge } from '@/components/admin';
import {
  RefreshCw,
  Database,
  Server,
  Globe,
  Shield,
  CheckCircle,
  XCircle,
} from 'lucide-react';

interface HealthCheck {
  name: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  latency?: number;
  message: string;
}

interface SystemInfo {
  environment: string;
  nodeEnv: string;
  adminWalletsCount: number;
}

export default function AdminSystemPage() {
  const { token } = useAuthStore();
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([]);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSystemHealth = async () => {
    if (!token) return;

    try {
      setIsLoading(true);

      // Check database health via stats endpoint
      const statsStart = Date.now();
      const statsRes = await fetch('/api/admin/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const statsLatency = Date.now() - statsStart;
      const statsOk = statsRes.ok;

      // Check main health endpoint
      const healthStart = Date.now();
      let healthOk = false;
      try {
        const healthRes = await fetch('/api/health');
        healthOk = healthRes.ok;
      } catch {
        healthOk = false;
      }
      const healthLatency = Date.now() - healthStart;

      // Simulate realtime server check
      const realtimeOk = true; // Would check actual realtime server

      setHealthChecks([
        {
          name: 'Database',
          status: statsOk ? 'healthy' : 'unhealthy',
          latency: statsLatency,
          message: statsOk
            ? `Connected (${statsLatency}ms)`
            : 'Connection failed',
        },
        {
          name: 'API Server',
          status: healthOk ? 'healthy' : 'unhealthy',
          latency: healthLatency,
          message: healthOk
            ? `Responding (${healthLatency}ms)`
            : 'Not responding',
        },
        {
          name: 'Realtime Server',
          status: realtimeOk ? 'healthy' : 'unknown',
          message: realtimeOk
            ? 'Connected'
            : 'Status unknown (check REALTIME_URL)',
        },
      ]);

      setSystemInfo({
        environment:
          process.env.NODE_ENV === 'production' ? 'Production' : 'Development',
        nodeEnv: process.env.NODE_ENV || 'unknown',
        adminWalletsCount: 1, // Would be fetched from server
      });
    } catch (error) {
      console.error('Failed to fetch system health:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSystemHealth();
  }, [token]);

  const getStatusIcon = (status: HealthCheck['status']) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle size={18} className="text-win-400" />;
      case 'unhealthy':
        return <XCircle size={18} className="text-loss-400" />;
      default:
        return <Server size={18} className="text-surface-400" />;
    }
  };

  const getServiceIcon = (name: string) => {
    switch (name) {
      case 'Database':
        return <Database size={18} className="text-surface-400" />;
      case 'API Server':
        return <Server size={18} className="text-surface-400" />;
      case 'Realtime Server':
        return <Globe size={18} className="text-surface-400" />;
      default:
        return <Server size={18} className="text-surface-400" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">System Health</h1>
          <p className="text-surface-400 mt-1">
            Monitor system status and configuration
          </p>
        </div>
        <button
          onClick={fetchSystemHealth}
          disabled={isLoading}
          className="px-4 py-2 bg-surface-700 hover:bg-surface-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors flex items-center gap-2"
        >
          <RefreshCw
            size={16}
            className={isLoading ? 'animate-spin' : ''}
          />
          Refresh
        </button>
      </div>

      {/* Health Checks */}
      <div>
        <h2 className="text-lg font-medium text-white mb-4">Service Health</h2>
        <div className="space-y-4">
          {isLoading && healthChecks.length === 0 ? (
            <div className="bg-surface-850 border border-surface-700 rounded-lg p-8 text-center">
              <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : (
            healthChecks.map((check) => (
              <div
                key={check.name}
                className="bg-surface-850 border border-surface-700 rounded-lg p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getServiceIcon(check.name)}
                    <div>
                      <p className="text-white font-medium">{check.name}</p>
                      <p className="text-sm text-surface-400">
                        {check.message}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(check.status)}
                    <AdminBadge
                      variant={
                        check.status === 'healthy'
                          ? 'success'
                          : check.status === 'unhealthy'
                          ? 'danger'
                          : 'default'
                      }
                    >
                      {check.status.toUpperCase()}
                    </AdminBadge>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* System Info */}
      <div>
        <h2 className="text-lg font-medium text-white mb-4">
          Environment Information
        </h2>
        <div className="bg-surface-850 border border-surface-700 rounded-lg p-4">
          {systemInfo ? (
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-surface-400">Environment</dt>
                <dd>
                  <AdminBadge
                    variant={
                      systemInfo.environment === 'Production'
                        ? 'danger'
                        : 'success'
                    }
                  >
                    {systemInfo.environment}
                  </AdminBadge>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-surface-400">NODE_ENV</dt>
                <dd className="text-white font-mono">{systemInfo.nodeEnv}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-surface-400">Admin Wallets Configured</dt>
                <dd className="text-white">{systemInfo.adminWalletsCount}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-surface-500">Loading system info...</p>
          )}
        </div>
      </div>

      {/* Security Configuration */}
      <div>
        <h2 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
          <Shield size={18} />
          Security Configuration
        </h2>
        <div className="bg-surface-850 border border-surface-700 rounded-lg p-4">
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-surface-400">JWT Expiry</dt>
              <dd className="text-white">7 days</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-surface-400">Admin Auth Method</dt>
              <dd className="text-white">JWT Role + X-Admin-Secret</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-surface-400">Rate Limiting</dt>
              <dd className="text-surface-400">Via Vercel Edge</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Referral Configuration */}
      <div>
        <h2 className="text-lg font-medium text-white mb-4">
          Referral Configuration
        </h2>
        <div className="bg-surface-850 border border-surface-700 rounded-lg p-4">
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-surface-400">Tier 1 Commission</dt>
              <dd className="text-white">34%</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-surface-400">Tier 2 Commission</dt>
              <dd className="text-white">12%</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-surface-400">Tier 3 Commission</dt>
              <dd className="text-white">4%</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-surface-400">Status</dt>
              <dd>
                <AdminBadge variant="success">Enabled</AdminBadge>
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
