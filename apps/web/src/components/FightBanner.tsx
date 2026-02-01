/**
 * Fight Banner - Active fight status bar
 * Professional, minimal design
 *
 * MVP-5: Shows ONLY realized PnL (closed positions)
 * MVP-6: Warning when open positions exist
 * @see MVP-SIMPLIFIED-RULES.md
 */
'use client';

import { useFight } from '@/hooks/useFight';
import { useFightPositions } from '@/hooks/useFightPositions';
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

  // MVP-6: Get open fight positions to show warning
  const { positions: fightPositions } = useFightPositions(fightId);
  const hasOpenPositions = fightPositions.length > 0;

  // Return empty placeholder with 0 height to avoid layout shifts
  // The component always renders but with height:0 when not active
  const shouldShow = fightId && _hasHydrated && !isLoading && isActive && opponent;

  if (!shouldShow) {
    // Hidden state - no height, no border, no content
    return <div className="h-0 overflow-hidden" />;
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
    <div className="w-full bg-surface-850 border-b border-surface-800">
      <div className="max-w-screen-2xl mx-auto px-2 sm:px-4">
        {/* Mobile: 2 rows layout */}
        <div className="sm:hidden py-1.5">
          {/* Row 1: Opponent + Timer + Status */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-surface-500'}`} />
              <span className="text-zinc-400 text-xs">
                vs <span className="text-zinc-100 font-medium">{opponent.user?.handle || 'Opponent'}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`font-mono text-sm font-semibold tabular-nums ${isLowTime ? 'text-loss-500' : 'text-zinc-100'}`}>
                {timeRemaining !== null ? formatTime(timeRemaining) : '--:--'}
              </span>
              <div className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                isWinning
                  ? 'bg-win-500/10 text-win-500'
                  : isLosing
                    ? 'bg-loss-500/10 text-loss-500'
                    : 'bg-surface-700 text-surface-400'
              }`}>
                {isWinning ? 'Ahead' : isLosing ? 'Behind' : 'Tied'}
              </div>
            </div>
          </div>
          {/* Row 2: Stake + PnL comparison */}
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-surface-500">${maxSize.toLocaleString()} stake</span>
            <div className="flex items-center gap-3">
              <span className="text-surface-500">
                You: <span className={`font-mono tabular-nums ${myPnl >= 0 ? 'text-win-500' : 'text-loss-500'}`}>{formatPnl(myPnl)}</span>
              </span>
              <span className="text-surface-500">
                Opp: <span className={`font-mono tabular-nums ${opponentPnl >= 0 ? 'text-win-500' : 'text-loss-500'}`}>{formatPnl(opponentPnl)}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Desktop: Single row layout */}
        <div className="hidden sm:flex items-center justify-between h-10 gap-4">
          {/* Left: Status + Opponent */}
          <div className="flex items-center gap-3 text-sm">
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-surface-500'}`} />
              <span className="text-surface-400">Live</span>
            </div>
            <div className="h-4 w-px bg-surface-700" />
            <span className="text-zinc-400">
              vs <span className="text-zinc-100 font-medium">{opponent.user?.handle || 'Opponent'}</span>
            </span>
          </div>

          {/* Center: Timer + Stake */}
          <div className="flex items-center gap-3">
            <span className={`font-mono text-base font-semibold tabular-nums ${isLowTime ? 'text-loss-500' : 'text-zinc-100'}`}>
              {timeRemaining !== null ? formatTime(timeRemaining) : '--:--'}
            </span>
            <span className="text-xs text-surface-500">
              ${maxSize.toLocaleString()} stake
            </span>
          </div>

          {/* Right: PnL - MVP-5: Realized only */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-3">
              <div className="text-right" title="Realized PnL from closed positions only">
                <div className="text-xs text-surface-500">You</div>
                <div className={`font-mono tabular-nums ${myPnl >= 0 ? 'text-win-500' : 'text-loss-500'}`}>
                  {formatPnl(myPnl)}
                </div>
              </div>
              <div className="h-6 w-px bg-surface-700" />
              <div title="Realized PnL from closed positions only">
                <div className="text-xs text-surface-500">Opp</div>
                <div className={`font-mono tabular-nums ${opponentPnl >= 0 ? 'text-win-500' : 'text-loss-500'}`}>
                  {formatPnl(opponentPnl)}
                </div>
              </div>
            </div>
            <div className={`px-2 py-0.5 rounded text-xs font-medium ${
              isWinning
                ? 'bg-win-500/10 text-win-500'
                : isLosing
                  ? 'bg-loss-500/10 text-loss-500'
                  : 'bg-surface-700 text-surface-400'
            }`}>
              {isWinning ? 'Ahead' : isLosing ? 'Behind' : 'Tied'}
            </div>
            {/* MVP-6: Open positions warning */}
            {hasOpenPositions && (
              <div
                className="px-2 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-500 animate-pulse"
                title="Close positions to lock in PnL! Open positions don't count toward your score."
              >
                {fightPositions.length} Open
              </div>
            )}
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
