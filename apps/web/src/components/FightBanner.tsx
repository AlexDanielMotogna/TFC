/**
 * Fight Banner - Active fight status bar
 * Professional, minimal design
 */
'use client';

import { useFight } from '@/hooks/useFight';
import { useAuthStore } from '@/lib/store';

export function FightBanner() {
  const { _hasHydrated } = useAuthStore();
  const {
    fightId,
    isActive,
    isLoading,
    isConnected,
    opponent,
    myPnl,
    opponentPnl,
    timeRemaining,
    maxSize,
    externalTradesDetected,
  } = useFight();

  if (!fightId) {
    return null;
  }

  if (!_hasHydrated || isLoading) {
    return (
      <div className="w-full bg-surface-850 border-b border-surface-700">
        <div className="max-w-screen-2xl mx-auto px-4 h-10 flex items-center justify-center">
          <div className="spinner" />
        </div>
      </div>
    );
  }

  if (!isActive || !opponent) {
    return null;
  }

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatPnl = (pnl: number) => {
    const sign = pnl >= 0 ? '+' : '';
    return `${sign}${pnl.toFixed(4)}%`;
  };

  const isWinning = myPnl > opponentPnl;
  const isLosing = myPnl < opponentPnl;
  const isLowTime = timeRemaining !== null && timeRemaining < 60000;

  return (
    <div className="w-full bg-surface-850 border-b border-surface-700">
      <div className="max-w-screen-2xl mx-auto px-4">
        <div className="flex items-center justify-between h-10">

          {/* Left: Status + Opponent */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-surface-500'}`} />
              <span className="text-surface-400">Live</span>
            </div>
            <div className="h-4 w-px bg-surface-700" />
            <span className="text-zinc-400">
              vs <span className="text-zinc-100 font-medium">{opponent.user?.handle || 'Opponent'}</span>
            </span>
          </div>

          {/* Center: Timer */}
          <div className="flex items-center gap-3">
            <span className={`font-mono text-base tabular-nums ${isLowTime ? 'text-red-500' : 'text-zinc-100'}`}>
              {timeRemaining !== null ? formatTime(timeRemaining) : '--:--'}
            </span>
            <span className="text-xs text-surface-500">
              ${maxSize.toLocaleString()} stake
            </span>
          </div>

          {/* Right: PnL */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-xs text-surface-500">You</div>
                <div className={`font-mono tabular-nums ${myPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {formatPnl(myPnl)}
                </div>
              </div>
              <div className="h-6 w-px bg-surface-700" />
              <div>
                <div className="text-xs text-surface-500">Opp</div>
                <div className={`font-mono tabular-nums ${opponentPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {formatPnl(opponentPnl)}
                </div>
              </div>
            </div>
            <div className={`px-2 py-0.5 rounded text-xs font-medium ${
              isWinning
                ? 'bg-green-500/10 text-green-500'
                : isLosing
                  ? 'bg-red-500/10 text-red-500'
                  : 'bg-surface-700 text-surface-400'
            }`}>
              {isWinning ? 'Ahead' : isLosing ? 'Behind' : 'Tied'}
            </div>
            {/* External trades warning */}
            {externalTradesDetected && (
              <div className="px-2 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-500" title="Trades made outside TradeFightClub detected">
                External Trades
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
