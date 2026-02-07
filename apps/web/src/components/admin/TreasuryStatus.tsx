'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/store';
import { Wallet, RefreshCw, AlertTriangle, AlertCircle } from 'lucide-react';
import { Spinner } from '@/components/Spinner';

interface TreasuryData {
  treasuryAddress: string;
  balances: {
    usdc: number;
    sol: number;
    pacifica: number;
    availableForClaims: number;
  };
  alerts: {
    usdcWarning: boolean;
    usdcCritical: boolean;
    solCritical: boolean;
    hasAlert: boolean;
  };
  lastUpdated: string;
}

export function TreasuryStatus() {
  const { token } = useAuthStore();
  const [data, setData] = useState<TreasuryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTreasuryStatus = async (showRefreshing = false) => {
    if (!token) return;

    try {
      if (showRefreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      const response = await fetch('/api/admin/treasury/status', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || 'Failed to fetch treasury status');
      }
    } catch (err) {
      console.error('Failed to fetch treasury status:', err);
      setError('Failed to fetch treasury status');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTreasuryStatus();
  }, [token]);

  const handleRefresh = () => {
    fetchTreasuryStatus(true);
  };

  if (isLoading) {
    return (
      <div className="bg-surface-850 border border-surface-700 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Wallet className="text-surface-400" size={18} />
          <h3 className="text-sm font-medium text-white">Treasury Status</h3>
        </div>
        <div className="flex items-center justify-center py-4">
          <Spinner size="sm" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-surface-850 border border-surface-700 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Wallet className="text-surface-400" size={18} />
          <h3 className="text-sm font-medium text-white">Treasury Status</h3>
        </div>
        <p className="text-sm text-loss-400">{error || 'No data available'}</p>
      </div>
    );
  }

  const { balances, alerts } = data;

  return (
    <div className="bg-surface-850 border border-surface-700 rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Wallet className="text-surface-400" size={18} />
          <h3 className="text-sm font-medium text-white">Treasury Status</h3>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="p-1 hover:bg-surface-700 rounded transition-colors disabled:opacity-50"
          title="Refresh treasury status"
        >
          <RefreshCw
            size={16}
            className={`text-surface-400 ${isRefreshing ? 'animate-spin' : ''}`}
          />
        </button>
      </div>

      {/* Alert Banner */}
      {alerts.hasAlert && (
        <div
          className={`mb-3 p-2 rounded-lg flex items-start gap-2 ${
            alerts.usdcCritical || alerts.solCritical
              ? 'bg-loss-500/10 border border-loss-500/20'
              : 'bg-warning/10 border border-warning/20'
          }`}
        >
          {alerts.usdcCritical || alerts.solCritical ? (
            <AlertCircle size={16} className="text-loss-400 mt-0.5 flex-shrink-0" />
          ) : (
            <AlertTriangle size={16} className="text-warning mt-0.5 flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p
              className={`text-xs font-medium ${
                alerts.usdcCritical || alerts.solCritical ? 'text-loss-400' : 'text-warning'
              }`}
            >
              {alerts.usdcCritical && 'Critical: USDC balance below $50'}
              {alerts.solCritical && !alerts.usdcCritical && 'Critical: SOL balance below 0.05'}
              {!alerts.usdcCritical && !alerts.solCritical && alerts.usdcWarning && 'Warning: USDC balance below $100'}
            </p>
          </div>
        </div>
      )}

      {/* Balances */}
      <div className="space-y-2">
        {/* USDC Balance */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-surface-400">USDC Balance</span>
          <span
            className={`text-sm font-medium ${
              alerts.usdcCritical
                ? 'text-loss-400'
                : alerts.usdcWarning
                ? 'text-warning'
                : 'text-white'
            }`}
          >
            ${balances.usdc.toFixed(2)}
          </span>
        </div>

        {/* SOL Balance */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-surface-400">SOL Balance</span>
          <span
            className={`text-sm font-medium ${
              alerts.solCritical ? 'text-loss-400' : 'text-white'
            }`}
          >
            {balances.sol.toFixed(4)} SOL
          </span>
        </div>

        {/* Available for Claims */}
        <div className="flex items-center justify-between pt-2 border-t border-surface-700">
          <span className="text-xs text-surface-400">Available for Claims</span>
          <span className="text-sm font-medium text-win-400">
            ${balances.availableForClaims.toFixed(2)}
          </span>
        </div>

        {/* Pacifica Balance (optional info) */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-surface-500">Pacifica Balance</span>
          <span className="text-xs text-surface-400">
            ${balances.pacifica.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Last Updated */}
      <div className="mt-3 pt-3 border-t border-surface-700">
        <p className="text-xs text-surface-500">
          Last updated: {new Date(data.lastUpdated).toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
}
