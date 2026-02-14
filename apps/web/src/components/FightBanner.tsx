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
import { Spinner } from './Spinner';

export function FightBanner() {
  const { _hasHydrated } = useAuthStore();
  const {
    fightId,
    isActive,
    isLoading,
    isConnected,
    isResolving,
    fightResult,
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

  // Show resolving overlay when fight just ended
  if (isResolving) {
    const resultConfig = {
      victory: { text: 'Victory!', color: 'text-win-400' },
      defeat: { text: 'Defeat', color: 'text-loss-400' },
      draw: { text: 'Draw', color: 'text-surface-300' },
      cancelled: { text: 'Cancelled', color: 'text-amber-400' },
      no_contest: { text: 'No Contest', color: 'text-amber-400' },
      resolving: { text: 'Fight Ended', color: 'text-surface-300' },
    }[fightResult || 'resolving'];

    return (
      <div className="w-full relative overflow-hidden border-b border-surface-800">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-surface-800/50 to-transparent" />
        <div className="relative flex items-center justify-center gap-3 h-10 px-4">
          <Spinner size="xs" />
          <span className={`font-display font-bold text-sm ${resultConfig.color}`}>
            {resultConfig.text}
          </span>
          <span className="text-surface-400 text-xs">Loading results...</span>
        </div>
      </div>
    );
  }

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

  // Calculate PnL advantage for background split
  // Positive diff = you're winning, negative = opponent winning
  // Map to a percentage: 50% = tied, >50% = you dominate, <50% = opp dominates
  const pnlDiff = myPnl - opponentPnl;
  // Clamp the diff so the bar doesn't go fully to one side (keep 10-90% range)
  const maxDiff = 2; // ±2% PnL diff = full bar
  const normalizedDiff = Math.max(-1, Math.min(1, pnlDiff / maxDiff));
  const myBarPercent = 50 + normalizedDiff * 40; // 10% to 90%

  return (
    <div className="w-full relative overflow-hidden border-b border-surface-800">
      {/* Dynamic PnL background — colors reflect winning/losing status */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {/* Your side (left) — green when winning, red when losing */}
        <div
          className={`absolute inset-y-0 left-0 transition-all duration-700 ease-out ${
            isWinning ? 'bg-gradient-to-r from-win-500/30 via-win-500/15 to-transparent'
            : isLosing ? 'bg-gradient-to-r from-loss-500/30 via-loss-500/15 to-transparent'
            : 'bg-gradient-to-r from-surface-500/15 to-transparent'
          }`}
          style={{ width: `${myBarPercent}%` }}
        />
        {/* Opponent side (right) — red when you're winning, green when you're losing */}
        <div
          className={`absolute inset-y-0 right-0 transition-all duration-700 ease-out ${
            isWinning ? 'bg-gradient-to-l from-loss-500/30 via-loss-500/15 to-transparent'
            : isLosing ? 'bg-gradient-to-l from-win-500/30 via-win-500/15 to-transparent'
            : 'bg-gradient-to-l from-surface-500/15 to-transparent'
          }`}
          style={{ width: `${100 - myBarPercent}%` }}
        />
      </div>
      <div className="relative max-w-screen-2xl mx-auto px-2 sm:px-4">
        {/* Mobile: 2 rows — You (left) | Timer | Opp (right) */}
        <div className="sm:hidden py-1.5">
          {/* Row 1: You PnL + Timer + Opp PnL */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-surface-500'}`} />
              <span className="text-[10px] text-surface-500">You</span>
              <span className={`font-mono text-xs font-semibold tabular-nums ${myPnl >= 0 ? 'text-win-400' : 'text-loss-400'}`}>
                {formatPnl(myPnl)}
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
            <div className="flex items-center gap-2">
              <span className={`font-mono text-xs font-semibold tabular-nums ${opponentPnl >= 0 ? 'text-win-400' : 'text-loss-400'}`}>
                {formatPnl(opponentPnl)}
              </span>
              <span className="text-[10px] text-surface-500">{opponent.user?.handle || 'Opp'}</span>
            </div>
          </div>
          {/* Row 2: Stake + Warnings */}
          <div className="flex items-center justify-center gap-3 text-[10px]">
            <span className="text-surface-500">${maxSize.toLocaleString()} stake</span>
            {hasOpenPositions && (
              <span className="text-amber-500 animate-pulse">{fightPositions.length} Open</span>
            )}
          </div>
        </div>

        {/* Desktop: You (left) | Center (timer + status) | Opp (right) */}
        <div className="hidden sm:flex items-center justify-between h-10 gap-4">
          {/* Left: You — PnL + status + warnings */}
          <div className="flex items-center gap-3 text-sm min-w-0">
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-surface-500'}`} />
              <span className="text-surface-400">You</span>
            </div>
            <div className={`font-mono text-sm font-semibold tabular-nums ${myPnl >= 0 ? 'text-win-400' : 'text-loss-400'}`} title="Realized PnL from closed positions only">
              {formatPnl(myPnl)}
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
                External
              </div>
            )}
          </div>

          {/* Center: Timer + Stake + Status */}
          <div className="flex items-center gap-3">
            <div className={`px-2 py-0.5 rounded text-xs font-medium ${
              isWinning
                ? 'bg-win-500/10 text-win-500'
                : isLosing
                  ? 'bg-loss-500/10 text-loss-500'
                  : 'bg-surface-700 text-surface-400'
            }`}>
              {isWinning ? 'Ahead' : isLosing ? 'Behind' : 'Tied'}
            </div>
            <span className={`font-mono text-base font-semibold tabular-nums ${isLowTime ? 'text-loss-500' : 'text-zinc-100'}`}>
              {timeRemaining !== null ? formatTime(timeRemaining) : '--:--'}
            </span>
            <span className="text-xs text-surface-500">
              ${maxSize.toLocaleString()}
            </span>
          </div>

          {/* Right: Opponent — PnL + name */}
          <div className="flex items-center gap-3 text-sm min-w-0">
            <div className={`font-mono text-sm font-semibold tabular-nums ${opponentPnl >= 0 ? 'text-win-400' : 'text-loss-400'}`} title="Realized PnL from closed positions only">
              {formatPnl(opponentPnl)}
            </div>
            <span className="text-surface-400 truncate">
              {opponent.user?.handle || 'Opponent'}
            </span>
          </div>
        </div>
      </div>{/* end relative content */}
    </div>
  );
}
