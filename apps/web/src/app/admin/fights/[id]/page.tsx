'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { AdminCard, AdminBadge, getFightStatusVariant } from '@/components/admin';
import { Spinner } from '@/components/Spinner';
import { ArrowLeft, Clock, AlertTriangle, XCircle, CheckCircle } from 'lucide-react';

interface FightDetail {
  id: string;
  status: string;
  durationMinutes: number;
  stakeUsdc: number;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
  winnerId: string | null;
  isDraw: boolean;
  creator: { id: string; handle: string; walletAddress: string | null };
  participantA: Participant | null;
  participantB: Participant | null;
  trades: Trade[];
  snapshots: Snapshot[];
  sessions: Session[];
  violations: Violation[];
  timeRemaining: number | null;
}

interface Participant {
  userId: string;
  handle: string;
  walletAddress: string | null;
  slot: string;
  joinedAt: string;
  initialPositions: unknown;
  maxExposureUsed: number;
  finalPnlPercent: number | null;
  finalScoreUsdc: number | null;
  tradesCount: number;
  externalTradesDetected: boolean;
  externalTradeIds: string[];
}

interface Trade {
  id: string;
  participantUserId: string;
  symbol: string;
  side: string;
  amount: number;
  price: number;
  fee: number;
  pnl: number | null;
  leverage: number | null;
  executedAt: string;
}

interface Snapshot {
  timestamp: string;
  participantAPnlPercent: number;
  participantAScoreUsdc: number;
  participantBPnlPercent: number;
  participantBScoreUsdc: number;
  leaderId: string | null;
}

interface Session {
  userId: string;
  sessionType: string;
  ipAddress: string;
  userAgent: string | null;
  createdAt: string;
}

interface Violation {
  ruleCode: string;
  ruleName: string;
  ruleMessage: string;
  actionTaken: string;
  metadata: unknown;
  createdAt: string;
}

export default function AdminFightDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { token } = useAuthStore();
  const [fight, setFight] = useState<FightDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActioning, setIsActioning] = useState(false);
  const [activeTab, setActiveTab] = useState<'trades' | 'snapshots' | 'sessions'>('trades');

  useEffect(() => {
    async function fetchFight() {
      if (!token) return;

      try {
        setIsLoading(true);
        const response = await fetch(`/api/admin/fights/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await response.json();
        if (data.success) {
          setFight(data.data);
        }
      } catch (error) {
        console.error('Failed to fetch fight:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchFight();
  }, [token, id]);

  const handleForceCancel = async () => {
    if (!token || !confirm('Are you sure you want to cancel this fight?')) return;

    try {
      setIsActioning(true);
      const response = await fetch(`/api/admin/fights/${id}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      if (data.success) {
        setFight((prev) => (prev ? { ...prev, status: 'CANCELLED' } : null));
        alert('Fight cancelled successfully');
      } else {
        alert(data.error || 'Failed to cancel fight');
      }
    } catch (error) {
      console.error('Failed to cancel fight:', error);
      alert('Failed to cancel fight');
    } finally {
      setIsActioning(false);
    }
  };

  const handleForceFinish = async () => {
    if (!token || !confirm('Are you sure you want to finish this fight?')) return;

    try {
      setIsActioning(true);
      const response = await fetch(`/api/admin/fights/${id}/finish`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      if (data.success) {
        setFight((prev) =>
          prev
            ? {
                ...prev,
                status: 'FINISHED',
                winnerId: data.data.winnerId,
                isDraw: data.data.isDraw,
              }
            : null
        );
        alert('Fight finished successfully');
      } else {
        alert(data.error || 'Failed to finish fight');
      }
    } catch (error) {
      console.error('Failed to finish fight:', error);
      alert('Failed to finish fight');
    } finally {
      setIsActioning(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="sm" />
      </div>
    );
  }

  if (!fight) {
    return (
      <div className="text-center py-12">
        <p className="text-surface-400">Fight not found</p>
      </div>
    );
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-surface-800 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} className="text-surface-400" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-white">Fight Details</h1>
              <AdminBadge
                variant={getFightStatusVariant(fight.status)}
                pulse={fight.status === 'LIVE'}
              >
                {fight.status}
              </AdminBadge>
            </div>
            <p className="text-sm text-surface-400 font-mono mt-1">{fight.id}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {['WAITING', 'LIVE'].includes(fight.status) && (
            <button
              onClick={handleForceCancel}
              disabled={isActioning}
              className="px-4 py-2 bg-loss-500/20 hover:bg-loss-500/30 text-loss-400 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              <XCircle size={16} />
              Force Cancel
            </button>
          )}
          {fight.status === 'LIVE' && (
            <button
              onClick={handleForceFinish}
              disabled={isActioning}
              className="px-4 py-2 bg-win-500/20 hover:bg-win-500/30 text-win-400 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              <CheckCircle size={16} />
              Force Finish
            </button>
          )}
        </div>
      </div>

      {/* Violations Warning */}
      {fight.violations.length > 0 && (
        <div className="bg-loss-500/10 border border-loss-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 text-loss-400 mb-2">
            <AlertTriangle size={18} />
            <span className="font-medium">Anti-Cheat Violations Detected</span>
          </div>
          <ul className="space-y-1">
            {fight.violations.map((v, i) => (
              <li key={i} className="text-sm text-loss-300">
                <span className="font-medium">{v.ruleName}:</span> {v.ruleMessage}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Fight Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <AdminCard title="Stake" value={`$${fight.stakeUsdc}`} />
        <AdminCard title="Duration" value={`${fight.durationMinutes} minutes`} />
        <AdminCard
          title="Total Trades"
          value={fight.trades.length}
        />
        {fight.status === 'LIVE' && fight.timeRemaining !== null && (
          <AdminCard
            title="Time Remaining"
            value={formatTime(fight.timeRemaining)}
            icon={Clock}
            variant="danger"
          />
        )}
      </div>

      {/* Participants */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Participant A */}
        <div
          className={`bg-surface-850 border rounded-lg p-4 ${
            fight.winnerId === fight.participantA?.userId && !fight.isDraw
              ? 'border-win-500/50'
              : 'border-surface-700'
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-0.5 bg-surface-700 text-surface-400 rounded">
                Slot A
              </span>
              {fight.winnerId === fight.participantA?.userId && !fight.isDraw && (
                <AdminBadge variant="success">WINNER</AdminBadge>
              )}
            </div>
            {fight.participantA?.externalTradesDetected && (
              <AdminBadge variant="warning">External Trades</AdminBadge>
            )}
          </div>
          {fight.participantA ? (
            <div className="space-y-3">
              <div>
                <p className="text-lg font-medium text-white">
                  {fight.participantA.handle}
                </p>
                <p className="text-xs text-surface-500 font-mono">
                  {fight.participantA.walletAddress || 'No wallet'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-surface-400">PnL %</p>
                  <p
                    className={
                      fight.participantA.finalPnlPercent !== null
                        ? fight.participantA.finalPnlPercent >= 0
                          ? 'text-win-400'
                          : 'text-loss-400'
                        : 'text-white'
                    }
                  >
                    {fight.participantA.finalPnlPercent !== null
                      ? `${fight.participantA.finalPnlPercent >= 0 ? '+' : ''}${fight.participantA.finalPnlPercent.toFixed(2)}%`
                      : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-surface-400">Score</p>
                  <p className="text-white">
                    {fight.participantA.finalScoreUsdc !== null
                      ? `$${fight.participantA.finalScoreUsdc.toFixed(2)}`
                      : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-surface-400">Trades</p>
                  <p className="text-white">{fight.participantA.tradesCount}</p>
                </div>
                <div>
                  <p className="text-surface-400">Max Exposure</p>
                  <p className="text-white">
                    ${fight.participantA.maxExposureUsed.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-surface-500">Waiting for participant...</p>
          )}
        </div>

        {/* Participant B */}
        <div
          className={`bg-surface-850 border rounded-lg p-4 ${
            fight.winnerId === fight.participantB?.userId && !fight.isDraw
              ? 'border-win-500/50'
              : 'border-surface-700'
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-0.5 bg-surface-700 text-surface-400 rounded">
                Slot B
              </span>
              {fight.winnerId === fight.participantB?.userId && !fight.isDraw && (
                <AdminBadge variant="success">WINNER</AdminBadge>
              )}
            </div>
            {fight.participantB?.externalTradesDetected && (
              <AdminBadge variant="warning">External Trades</AdminBadge>
            )}
          </div>
          {fight.participantB ? (
            <div className="space-y-3">
              <div>
                <p className="text-lg font-medium text-white">
                  {fight.participantB.handle}
                </p>
                <p className="text-xs text-surface-500 font-mono">
                  {fight.participantB.walletAddress || 'No wallet'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-surface-400">PnL %</p>
                  <p
                    className={
                      fight.participantB.finalPnlPercent !== null
                        ? fight.participantB.finalPnlPercent >= 0
                          ? 'text-win-400'
                          : 'text-loss-400'
                        : 'text-white'
                    }
                  >
                    {fight.participantB.finalPnlPercent !== null
                      ? `${fight.participantB.finalPnlPercent >= 0 ? '+' : ''}${fight.participantB.finalPnlPercent.toFixed(2)}%`
                      : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-surface-400">Score</p>
                  <p className="text-white">
                    {fight.participantB.finalScoreUsdc !== null
                      ? `$${fight.participantB.finalScoreUsdc.toFixed(2)}`
                      : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-surface-400">Trades</p>
                  <p className="text-white">{fight.participantB.tradesCount}</p>
                </div>
                <div>
                  <p className="text-surface-400">Max Exposure</p>
                  <p className="text-white">
                    ${fight.participantB.maxExposureUsed.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-surface-500">Waiting for participant...</p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-surface-700">
        <nav className="flex gap-4">
          {(['trades', 'snapshots', 'sessions'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'text-white border-b-2 border-primary-500'
                  : 'text-surface-400 hover:text-white'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              <span className="ml-2 text-xs text-surface-500">
                ({tab === 'trades'
                  ? fight.trades.length
                  : tab === 'snapshots'
                  ? fight.snapshots.length
                  : fight.sessions.length})
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-surface-850 border border-surface-700 rounded-lg overflow-hidden">
        {activeTab === 'trades' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-800 text-left text-surface-400">
                  <th className="px-4 py-3 font-medium">Participant</th>
                  <th className="px-4 py-3 font-medium">Symbol</th>
                  <th className="px-4 py-3 font-medium">Side</th>
                  <th className="px-4 py-3 font-medium text-right">Amount</th>
                  <th className="px-4 py-3 font-medium text-right">Price</th>
                  <th className="px-4 py-3 font-medium text-right">PnL</th>
                  <th className="px-4 py-3 font-medium text-right">Time</th>
                </tr>
              </thead>
              <tbody>
                {fight.trades.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-surface-500">
                      No trades recorded
                    </td>
                  </tr>
                ) : (
                  fight.trades.map((trade) => (
                    <tr key={trade.id} className="border-t border-surface-700/50">
                      <td className="px-4 py-3">
                        {trade.participantUserId === fight.participantA?.userId
                          ? fight.participantA.handle
                          : fight.participantB?.handle || 'Unknown'}
                      </td>
                      <td className="px-4 py-3 text-white font-medium">
                        {trade.symbol}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            trade.side === 'BUY' ? 'text-win-400' : 'text-loss-400'
                          }
                        >
                          {trade.side}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-surface-300 font-mono">
                        {trade.amount.toFixed(4)}
                      </td>
                      <td className="px-4 py-3 text-right text-surface-300 font-mono">
                        ${trade.price.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {trade.pnl !== null ? (
                          <span
                            className={
                              trade.pnl >= 0 ? 'text-win-400' : 'text-loss-400'
                            }
                          >
                            {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-surface-500">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-surface-400">
                        {new Date(trade.executedAt).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'snapshots' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-800 text-left text-surface-400">
                  <th className="px-4 py-3 font-medium">Time</th>
                  <th className="px-4 py-3 font-medium text-right">A PnL %</th>
                  <th className="px-4 py-3 font-medium text-right">A Score</th>
                  <th className="px-4 py-3 font-medium text-right">B PnL %</th>
                  <th className="px-4 py-3 font-medium text-right">B Score</th>
                  <th className="px-4 py-3 font-medium">Leader</th>
                </tr>
              </thead>
              <tbody>
                {fight.snapshots.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-surface-500">
                      No snapshots recorded
                    </td>
                  </tr>
                ) : (
                  fight.snapshots.map((snap, i) => (
                    <tr key={i} className="border-t border-surface-700/50">
                      <td className="px-4 py-3 text-surface-400">
                        {new Date(snap.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        <span
                          className={
                            snap.participantAPnlPercent >= 0
                              ? 'text-win-400'
                              : 'text-loss-400'
                          }
                        >
                          {snap.participantAPnlPercent >= 0 ? '+' : ''}
                          {snap.participantAPnlPercent.toFixed(2)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-surface-300 font-mono">
                        ${snap.participantAScoreUsdc.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        <span
                          className={
                            snap.participantBPnlPercent >= 0
                              ? 'text-win-400'
                              : 'text-loss-400'
                          }
                        >
                          {snap.participantBPnlPercent >= 0 ? '+' : ''}
                          {snap.participantBPnlPercent.toFixed(2)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-surface-300 font-mono">
                        ${snap.participantBScoreUsdc.toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        {snap.leaderId
                          ? snap.leaderId === fight.participantA?.userId
                            ? fight.participantA.handle
                            : fight.participantB?.handle
                          : 'Tied'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'sessions' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-800 text-left text-surface-400">
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">IP Address</th>
                  <th className="px-4 py-3 font-medium">User Agent</th>
                  <th className="px-4 py-3 font-medium text-right">Time</th>
                </tr>
              </thead>
              <tbody>
                {fight.sessions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-surface-500">
                      No sessions recorded
                    </td>
                  </tr>
                ) : (
                  fight.sessions.map((session, i) => (
                    <tr key={i} className="border-t border-surface-700/50">
                      <td className="px-4 py-3">
                        {session.userId === fight.participantA?.userId
                          ? fight.participantA.handle
                          : session.userId === fight.participantB?.userId
                          ? fight.participantB?.handle
                          : session.userId}
                      </td>
                      <td className="px-4 py-3">
                        <AdminBadge variant="default">{session.sessionType}</AdminBadge>
                      </td>
                      <td className="px-4 py-3 font-mono text-surface-300">
                        {session.ipAddress}
                      </td>
                      <td className="px-4 py-3 text-surface-400 text-xs max-w-xs truncate">
                        {session.userAgent || '-'}
                      </td>
                      <td className="px-4 py-3 text-right text-surface-400">
                        {new Date(session.createdAt).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
