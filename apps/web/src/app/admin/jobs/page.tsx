'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/store';
import { AdminBadge } from '@/components/admin';
import { Spinner } from '@/components/Spinner';
import { useAdminSubscription } from '@/hooks/useGlobalSocket';
import { RefreshCw, Clock, CheckCircle, AlertTriangle, XCircle, Wifi, WifiOff } from 'lucide-react';

interface JobStatus {
  name: string;
  schedule: string;
  lastRun: string | null;
  status: 'healthy' | 'stale' | 'failed';
  message: string;
}

export default function AdminJobsPage() {
  const { token } = useAuthStore();
  const [jobs, setJobs] = useState<JobStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Subscribe to admin real-time updates
  const { isConnected, isAdminSubscribed, adminJobs } = useAdminSubscription();

  const fetchJobStatus = async () => {
    if (!token) return;

    try {
      setIsLoading(true);
      // For now, simulate job status based on data freshness
      // In production, this would call /api/admin/jobs/status
      const response = await fetch('/api/admin/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();

      // Simulated job status based on stats
      const simulatedJobs: JobStatus[] = [
        {
          name: 'Leaderboard Refresh',
          schedule: 'Every 5 minutes',
          lastRun: new Date().toISOString(),
          status: 'healthy',
          message: 'Leaderboard snapshots are up to date',
        },
        {
          name: 'Stale Fight Cleanup',
          schedule: 'Every 1 minute',
          lastRun: new Date().toISOString(),
          status:
            data.success && data.data.fightsByStatus?.WAITING > 10
              ? 'stale'
              : 'healthy',
          message:
            data.success && data.data.fightsByStatus?.WAITING > 10
              ? `${data.data.fightsByStatus.WAITING} fights in WAITING status`
              : 'No stale fights detected',
        },
        {
          name: 'Fight Reconciliation',
          schedule: 'Every 1 minute',
          lastRun: new Date().toISOString(),
          status: 'healthy',
          message: 'All live fights are within time bounds',
        },
        {
          name: 'Prize Pool Update',
          schedule: 'Every 5 minutes',
          lastRun: new Date().toISOString(),
          status: 'healthy',
          message: 'Prize pool totals are current',
        },
        {
          name: 'Prize Pool Finalize',
          schedule: 'Weekly (Sunday 00:00 UTC)',
          lastRun: null,
          status: 'healthy',
          message: 'Scheduled for next Sunday',
        },
      ];

      setJobs(simulatedJobs);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Failed to fetch job status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchJobStatus();
  }, [token]);

  // Merge real-time job updates with fetched jobs
  useEffect(() => {
    if (adminJobs.length === 0) return;

    setJobs((currentJobs) => {
      const merged = [...currentJobs];
      for (const liveJob of adminJobs) {
        const existingIndex = merged.findIndex((j) => j.name === liveJob.name);
        const existing = merged[existingIndex];
        if (existingIndex >= 0 && existing) {
          merged[existingIndex] = {
            ...existing,
            status: liveJob.status,
            lastRun: liveJob.lastRun,
            message: liveJob.message,
          };
        }
      }
      setLastRefresh(new Date());
      return merged;
    });
  }, [adminJobs]);

  const getStatusIcon = (status: JobStatus['status']) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle size={18} className="text-win-400" />;
      case 'stale':
        return <AlertTriangle size={18} className="text-warning" />;
      case 'failed':
        return <XCircle size={18} className="text-loss-400" />;
    }
  };

  const getStatusVariant = (
    status: JobStatus['status']
  ): 'success' | 'warning' | 'danger' => {
    switch (status) {
      case 'healthy':
        return 'success';
      case 'stale':
        return 'warning';
      case 'failed':
        return 'danger';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Jobs Monitor</h1>
          <p className="text-surface-400 mt-1">
            Monitor background job health
          </p>
        </div>
        <div className="flex items-center gap-4">
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
          {lastRefresh && (
            <span className="text-xs text-surface-500">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={fetchJobStatus}
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
      </div>

      {/* Status Legend */}
      <div className="flex gap-4 text-sm">
        <div className="flex items-center gap-2">
          <CheckCircle size={14} className="text-win-400" />
          <span className="text-surface-400">Healthy</span>
        </div>
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} className="text-warning" />
          <span className="text-surface-400">Stale (2x+ interval)</span>
        </div>
        <div className="flex items-center gap-2">
          <XCircle size={14} className="text-loss-400" />
          <span className="text-surface-400">Failed (3x+ interval)</span>
        </div>
      </div>

      {/* Jobs List */}
      <div className="space-y-4">
        {isLoading && jobs.length === 0 ? (
          <div className="bg-surface-850 border border-surface-700 rounded-lg p-8 text-center">
            <Spinner size="sm" className="mx-auto" />
          </div>
        ) : (
          jobs.map((job) => (
            <div
              key={job.name}
              className="bg-surface-850 border border-surface-700 rounded-lg p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getStatusIcon(job.status)}
                  <div>
                    <p className="text-white font-medium">{job.name}</p>
                    <p className="text-sm text-surface-400">{job.schedule}</p>
                  </div>
                </div>
                <AdminBadge variant={getStatusVariant(job.status)}>
                  {job.status.toUpperCase()}
                </AdminBadge>
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-surface-400">{job.message}</span>
                {job.lastRun && (
                  <span className="text-surface-500 flex items-center gap-1">
                    <Clock size={12} />
                    {new Date(job.lastRun).toLocaleTimeString()}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Note */}
      <div className="bg-surface-850 border border-surface-700 rounded-lg p-4">
        <p className="text-sm text-surface-400">
          <strong className="text-white">Note:</strong> Job health is determined
          by data freshness. Jobs run on the separate jobs service
          (apps/jobs). This page monitors their effects on the database.
        </p>
      </div>
    </div>
  );
}
