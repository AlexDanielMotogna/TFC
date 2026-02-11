'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks';
import { useGlobalSocketStore } from '@/hooks/useGlobalSocket';
import type { Fight } from '@/lib/api';
import { Spinner } from './Spinner';
import { CancelFightModal } from './CancelFightModal';
import { useVideoStore } from '@/lib/stores/videoStore';

interface FightCardProps {
  fight: Fight;
  compact?: boolean;
  onJoinFight?: (fightId: string) => Promise<Fight>;
  onCancelFight?: (fightId: string) => Promise<void>;
}

export function FightCard({ fight, compact = false, onJoinFight, onCancelFight }: FightCardProps) {
  const router = useRouter();
  const { user } = useAuth();
  const livePnl = useGlobalSocketStore((state) => state.livePnl.get(fight.id));
  const { startVideo } = useVideoStore();
  const [isJoining, setIsJoining] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const isLive = fight.status === 'LIVE';
  const isWaiting = fight.status === 'WAITING';
  const isCreator = user?.id === fight.creator?.id;

  // Handle join fight
  const handleJoinFight = async () => {
    if (!onJoinFight) return;

    setIsJoining(true);
    try {
      console.log('[FightCard] Calling joinFight API...');
      const updatedFight = await onJoinFight(fight.id);

      console.log('[FightCard] API success! Starting video overlay...');
      // API verified matchup limits - NOW start the video
      startVideo();

      // Redirect happens independently (video plays over the transition)
      console.log('[FightCard] Redirecting to terminal...');
      router.push(`/trade?fight=${updatedFight.id}`);
    } catch (err) {
      console.error('[FightCard] Failed to join fight:', err);
      // Error is shown as a toast by useFights hook
      setIsJoining(false);
    }
  };

  // Handle cancel fight - show modal
  const handleCancelClick = () => {
    setShowCancelModal(true);
  };

  // Confirm cancel fight
  const handleConfirmCancel = async () => {
    if (!onCancelFight) return;

    setIsCancelling(true);
    try {
      await onCancelFight(fight.id);
      setShowCancelModal(false);
    } catch (err) {
      console.error('Failed to cancel fight:', err);
      // Error is shown as a toast by useFights hook
    } finally {
      setIsCancelling(false);
    }
  };

  // Close cancel modal
  const handleCloseCancelModal = () => {
    if (!isCancelling) {
      setShowCancelModal(false);
    }
  };

  // Format time from milliseconds
  const formatTimeRemaining = (ms: number) => {
    const remaining = Math.max(0, ms);
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Format date for display (e.g., "Jan 5, 14:30")
  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  // Calculate time remaining for live fights (fallback when no WebSocket data)
  const getTimeRemaining = () => {
    if (!fight.startedAt) return null;
    const startTime = new Date(fight.startedAt).getTime();
    const endTime = startTime + fight.durationMinutes * 60 * 1000;
    const now = Date.now();
    return formatTimeRemaining(endTime - now);
  };

  // Compact version for sidebar
  if (compact) {
    return (
      <Link href={`/fight/${fight.id}`} className="block">
        <div className="card p-3 hover:bg-surface-800/50 transition-colors cursor-pointer">
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {isLive ? (
                <span className="flex items-center gap-1 text-xs text-live-400">
                  <span className="w-1.5 h-1.5 bg-live-400 rounded-full animate-pulse" />
                  LIVE
                </span>
              ) : (
                <span className="text-xs text-surface-400">OPEN</span>
              )}
              <span className="text-xs text-surface-500">{fight.durationMinutes}m</span>
            </div>
          </div>

          {/* Participants */}
          {isWaiting && fight.creator && (
            <div className="flex items-center gap-2">
              <div className="avatar w-6 h-6 text-xs">
                {fight.creator?.handle?.[0]?.toUpperCase() || '?'}
              </div>
              <span className="text-sm text-white truncate flex-1">
                {fight.creator?.handle || 'Anonymous'}
              </span>
              <span className="text-xs text-surface-400">vs ?</span>
            </div>
          )}

          {isLive && fight.participants && (
            <div className="flex items-center gap-2">
              {fight.participants.map((p, i) => {
                // Get live PnL from WebSocket if available
                const isParticipantA = p.slot === 'A';
                const pnlData = isParticipantA ? livePnl?.participantA : livePnl?.participantB;
                const pnlPercent = Number(pnlData?.pnlPercent ?? p.finalPnlPercent ?? 0);

                return (
                  <div key={i} className="flex items-center gap-1 flex-1 min-w-0">
                    <div className="avatar w-6 h-6 text-xs">
                      {p.user?.handle?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-white truncate">{p.user?.handle || '?'}</p>
                      <p
                        className={`text-xs font-mono ${pnlPercent >= 0 ? 'text-win-400' : 'text-loss-400'
                          }`}
                      >
                        {pnlPercent >= 0 ? '+' : ''}
                        {pnlPercent.toFixed(1)}%
                      </p>
                    </div>
                    {i === 0 && (
                      <span className="text-xs text-surface-500 mx-1">vs</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Time for live */}
          {isLive && fight.startedAt && (
            <div className="mt-2 text-center">
              <span className="text-xs text-surface-400">
                {livePnl?.timeRemainingMs !== undefined
                  ? formatTimeRemaining(livePnl.timeRemainingMs)
                  : getTimeRemaining()} left
              </span>
            </div>
          )}
        </div>
      </Link>
    );
  }

  // Full version - fixed height for consistent grid layout
  return (
    <div className="fight-card card-interactive p-5 h-[240px] flex flex-col">
      {/* Header - fixed */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          {isLive ? (
            <span className="badge-live">
              <span className="w-1.5 h-1.5 bg-live-400 rounded-full animate-pulse mr-1.5" />
              LIVE
            </span>
          ) : isWaiting ? (
            <span className="badge-waiting">WAITING</span>
          ) : (
            <span className="badge-finished">{fight.status}</span>
          )}
          <span className="text-sm text-surface-400">{fight.durationMinutes}m</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-surface-400">Max:</span>
          <span className="font-bold text-white">${fight.stakeUsdc.toLocaleString()}</span>
        </div>
      </div>

      {/* Waiting State */}
      {isWaiting && fight.creator && (
        <div className="flex-1 flex flex-col justify-between overflow-hidden">
          {/* Creator Info */}
          <div className="flex items-center gap-3">
            <div className="avatar w-10 h-10 text-base">
              {fight.creator?.handle?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white truncate">
                {fight.creator?.handle || 'Anonymous'}
              </p>
              <p className="text-xs text-surface-400">Looking for opponent</p>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-auto pt-3">
            {isCreator ? (
              <div className="flex gap-2">
                <Link
                  href={`/trade?fight=${fight.id}`}
                  className="btn-secondary flex-1 text-center flex items-center justify-center text-sm py-2"
                >
                  Terminal
                </Link>
                <button
                  onClick={handleCancelClick}
                  disabled={isCancelling || !onCancelFight}
                  className="btn-ghost text-loss-400 hover:text-loss-300 hover:bg-loss-500/10 text-sm py-2 px-3"
                >
                  {isCancelling ? '...' : 'Cancel'}
                </button>
              </div>
            ) : (
              <button
                onClick={handleJoinFight}
                disabled={isJoining || !onJoinFight}
                className="btn-primary w-full text-sm py-2"
              >
                {isJoining ? (
                  <div className="flex items-center justify-center gap-2">
                    <Spinner size="xs" />
                    <span>Joining...</span>
                  </div>
                ) : (
                  'Accept Challenge'
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Live State */}
      {isLive && fight.participants && (
        <div className="flex-1 flex flex-col justify-between overflow-hidden">
          {/* Participants - compact */}
          <div className="relative space-y-1.5">
            {fight.participants.map((p, i) => {
              // Get live PnL from WebSocket if available, otherwise use finalPnlPercent
              const isParticipantA = p.slot === 'A';
              const pnlData = isParticipantA ? livePnl?.participantA : livePnl?.participantB;
              const pnlPercent = Number(pnlData?.pnlPercent ?? p.finalPnlPercent ?? 0);

              return (
                <div
                  key={i}
                  className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-surface-800/50"
                >
                  <div className="flex items-center gap-2">
                    <div className="avatar w-7 h-7 text-xs">
                      {p.user?.handle?.[0]?.toUpperCase() || '?'}
                    </div>
                    <span className="font-medium text-white text-sm truncate max-w-[100px]">
                      {p.user?.handle || 'Unknown'}
                    </span>
                  </div>
                  <span
                    className={`font-mono font-medium text-sm ${pnlPercent >= 0 ? 'pnl-positive' : 'pnl-negative'
                      }`}
                  >
                    {pnlPercent >= 0 ? '+' : ''}
                    {pnlPercent.toFixed(2)}%
                  </span>
                </div>
              );
            })}
          </div>

          {/* Time + Action */}
          <div className="mt-auto pt-1.5 space-y-1">
            {fight.startedAt && (
              <>
                <div className="flex items-center justify-center gap-2 text-xs">
                  <span className="text-surface-500">Started:</span>
                  <span className="text-surface-400">{formatDate(fight.startedAt)}</span>
                </div>
                <div className="flex items-center justify-center gap-2 text-xs">
                  <span className="text-surface-400">Remaining:</span>
                  <span className="font-mono font-bold text-white">
                    {livePnl?.timeRemainingMs !== undefined
                      ? formatTimeRemaining(livePnl.timeRemainingMs)
                      : getTimeRemaining()}
                  </span>
                </div>
              </>
            )}
            {user && fight.participants.some(p => p.userId === user.id) ? (
              <Link
                href={`/trade?fight=${fight.id}`}
                className="btn-primary w-full text-center flex items-center justify-center text-xs py-1.5"
              >
                Go to Terminal
              </Link>
            ) : (
              <Link
                href={`/fight/${fight.id}`}
                className="btn-secondary w-full text-center text-xs py-1.5"
              >
                Watch Fight
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Finished State */}
      {fight.status === 'FINISHED' && (
        <div className="flex-1 flex flex-col justify-between overflow-hidden">
          {/* Participants with results */}
          <div className="space-y-2">
            {fight.participants?.map((p, i) => {
              const isWinner = p.userId === fight.winnerId;
              return (
                <div
                  key={i}
                  className={`flex items-center justify-between p-2 rounded-lg ${isWinner && !fight.isDraw ? 'bg-win-500/10' : 'bg-surface-800/50'
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="avatar w-7 h-7 text-xs">
                      {p.user?.handle?.[0]?.toUpperCase() || '?'}
                    </div>
                    <span className={`font-medium text-sm truncate max-w-[100px] ${isWinner && !fight.isDraw ? 'text-win-400' : 'text-white'}`}>
                      {p.user?.handle || 'Unknown'}
                      {isWinner && !fight.isDraw && ' '}
                    </span>
                  </div>
                  <span
                    className={`font-mono font-medium text-sm ${Number(p.finalPnlPercent ?? 0) >= 0 ? 'text-win-400' : 'text-loss-400'
                      }`}
                  >
                    {Number(p.finalPnlPercent ?? 0) >= 0 ? '+' : ''}
                    {Number(p.finalPnlPercent ?? 0).toFixed(4)}%
                  </span>
                </div>
              );
            })}
          </div>
          {/* Draw badge + Timestamps on same row */}
          <div className="flex items-center justify-center gap-2 text-xs text-surface-500 py-1">
            {fight.isDraw && <span className="badge-finished text-xs">DRAW</span>}
            {fight.startedAt && <span>{formatDate(fight.startedAt)}</span>}
            {fight.startedAt && fight.endedAt && <span>→</span>}
            {fight.endedAt && <span>{formatDate(fight.endedAt)}</span>}
          </div>
          <Link
            href={`/fight/${fight.id}`}
            className="btn-ghost w-full text-center text-sm py-2 mt-auto"
          >
            View Results →
          </Link>
        </div>
      )}

      {/* Cancelled State */}
      {fight.status === 'CANCELLED' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center gap-3">
            <div className="avatar w-8 h-8 text-sm opacity-50">
              {fight.creator?.handle?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-surface-400 truncate text-sm">
                {fight.creator?.handle || 'Anonymous'}
              </p>
              <p className="text-xs text-surface-500">Fight was cancelled</p>
            </div>
          </div>
        </div>
      )}

      {/* NO_CONTEST State */}
      {fight.status === 'NO_CONTEST' && (
        <div className="flex-1 flex flex-col justify-between overflow-hidden">
          {/* Participants */}
          <div className="space-y-2">
            {fight.participants?.map((p, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-2 rounded-lg bg-surface-800/30 opacity-60"
              >
                <div className="flex items-center gap-2">
                  <div className="avatar w-7 h-7 text-xs">
                    {p.user?.handle?.[0]?.toUpperCase() || '?'}
                  </div>
                  <span className="font-medium text-sm truncate max-w-[100px] text-surface-300">
                    {p.user?.handle || 'Unknown'}
                  </span>
                </div>
                <span className="font-mono text-sm text-surface-500">
                  {Number(p.finalPnlPercent ?? 0) >= 0 ? '+' : ''}
                  {Number(p.finalPnlPercent ?? 0).toFixed(4)}%
                </span>
              </div>
            ))}
          </div>
          {/* Reason + Timestamps */}
          <div className="text-center py-1 space-y-1">
            <span className="text-xs text-surface-500">
              Fight invalidated - no valid activity
            </span>
            <div className="flex items-center justify-center gap-3 text-xs text-surface-500">
              {fight.startedAt && <span>{formatDate(fight.startedAt)}</span>}
              {fight.startedAt && fight.endedAt && <span>→</span>}
              {fight.endedAt && <span>{formatDate(fight.endedAt)}</span>}
            </div>
          </div>
          <Link
            href={`/fight/${fight.id}`}
            className="btn-ghost w-full text-center text-sm py-2 mt-auto text-surface-400"
          >
            View Details →
          </Link>
        </div>
      )}

      {/* Cancel Fight Modal */}
      <CancelFightModal
        isOpen={showCancelModal}
        onConfirm={handleConfirmCancel}
        onCancel={handleCloseCancelModal}
        isLoading={isCancelling}
      />
    </div>
  );
}
