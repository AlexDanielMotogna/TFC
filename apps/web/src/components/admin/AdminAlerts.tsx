'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/store';
import { AlertCircle, AlertTriangle } from 'lucide-react';

interface AlertStatus {
  hasCritical: boolean;
  hasWarning: boolean;
  criticalCount: number;
  warningCount: number;
  details: string[];
}

export function AdminAlerts() {
  const { token } = useAuthStore();
  const [alertStatus, setAlertStatus] = useState<AlertStatus>({
    hasCritical: false,
    hasWarning: false,
    criticalCount: 0,
    warningCount: 0,
    details: [],
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchAlertStatus = async () => {
    if (!token) return;

    try {
      // Fetch both treasury status and payout stats in parallel
      const [treasuryRes, payoutsRes] = await Promise.all([
        fetch('/api/admin/treasury/status', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/admin/referrals/payouts/stats', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const [treasuryData, payoutsData] = await Promise.all([
        treasuryRes.json(),
        payoutsRes.json(),
      ]);

      const critical: string[] = [];
      const warnings: string[] = [];

      // Check treasury alerts
      if (treasuryData.success) {
        const { balances, alerts } = treasuryData.data;

        if (alerts.solCritical) {
          critical.push(`Treasury SOL critically low: ${balances.sol.toFixed(4)} SOL`);
        }

        if (alerts.usdcCritical) {
          critical.push(`Treasury USDC critically low: $${balances.usdc.toFixed(2)}`);
        } else if (alerts.usdcWarning) {
          warnings.push(`Treasury USDC low: $${balances.usdc.toFixed(2)}`);
        }
      }

      // Check payout alerts
      if (payoutsData.success) {
        const { failed, pending } = payoutsData.data;

        if (failed.count > 0) {
          critical.push(`${failed.count} failed payout${failed.count > 1 ? 's' : ''} need attention`);
        }

        if (pending.count > 10) {
          warnings.push(`${pending.count} pending payouts (normal: <10)`);
        }
      }

      setAlertStatus({
        hasCritical: critical.length > 0,
        hasWarning: warnings.length > 0,
        criticalCount: critical.length,
        warningCount: warnings.length,
        details: [...critical, ...warnings],
      });
    } catch (error) {
      console.error('Failed to fetch alert status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAlertStatus();

    // Refresh alerts every 60 seconds
    const interval = setInterval(fetchAlertStatus, 60000);

    return () => clearInterval(interval);
  }, [token]);

  // Don't show anything while loading or if no alerts
  if (isLoading || (!alertStatus.hasCritical && !alertStatus.hasWarning)) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      {/* Critical Badge */}
      {alertStatus.hasCritical && (
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 bg-loss-500/10 border border-loss-500/20 rounded-lg cursor-help"
          title={alertStatus.details.filter((_, i) => i < alertStatus.criticalCount).join('\n')}
        >
          <AlertCircle size={14} className="text-loss-400" />
          <span className="text-xs font-medium text-loss-400">
            {alertStatus.criticalCount} Critical
          </span>
        </div>
      )}

      {/* Warning Badge */}
      {alertStatus.hasWarning && (
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 bg-warning/10 border border-warning/20 rounded-lg cursor-help"
          title={alertStatus.details.filter((_, i) => i >= alertStatus.criticalCount).join('\n')}
        >
          <AlertTriangle size={14} className="text-warning" />
          <span className="text-xs font-medium text-warning">
            {alertStatus.warningCount} Warning{alertStatus.warningCount > 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  );
}
