/**
 * Active Fights Switcher - Shows a list of active fights and allows switching between them
 */
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useMyActiveFights } from '@/hooks/useMyActiveFights';
import { useAuthStore } from '@/lib/store';

export function ActiveFightsSwitcher() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentFightId = searchParams?.get('fight');
  const { user } = useAuthStore();
  const { activeFights, activeFightsCount, isLoading } = useMyActiveFights();

  // Return hidden placeholder to avoid layout shifts
  if (isLoading || activeFightsCount === 0) {
    return <div className="h-0 overflow-hidden" />;
  }

  // Calculate time remaining for a fight
  const getTimeRemaining = (fight: typeof activeFights[0]) => {
    if (!fight.startedAt) return '--:--';
    const startTime = new Date(fight.startedAt).getTime();
    const endTime = startTime + fight.durationMinutes * 60 * 1000;
    const remaining = Math.max(0, endTime - Date.now());
    const totalSeconds = Math.floor(remaining / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Get opponent for a fight
  const getOpponent = (fight: typeof activeFights[0]) => {
    const opponent = fight.participants.find((p) => p.userId !== user?.id);
    return opponent?.user?.handle || 'Opponent';
  };

  // Handle switching to a fight
  const handleSwitchFight = (fightId: string) => {
    router.push(`/trade?fight=${fightId}`);
  };

  // If we're already viewing a fight, show a compact switcher
  if (currentFightId) {
    const otherFights = activeFights.filter((f) => f.id !== currentFightId);
    if (otherFights.length === 0) {
      return <div className="h-0 overflow-hidden" />; // No other fights to switch to
    }

    return (
      <div className="w-full bg-surface-800/50 border-b border-surface-700">
        <div className="container mx-auto px-4 py-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-surface-400">
              {activeFightsCount} active fight{activeFightsCount > 1 ? 's' : ''}
            </span>
            <div className="flex items-center gap-2">
              {otherFights.map((fight) => (
                <button
                  key={fight.id}
                  onClick={() => handleSwitchFight(fight.id)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-surface-700 hover:bg-surface-600 rounded-lg text-xs transition-colors"
                >
                  <span className="text-surface-300">vs</span>
                  <span className="font-medium text-white">{getOpponent(fight)}</span>
                  <span className="text-surface-400">|</span>
                  <span className="font-mono text-primary-400">{getTimeRemaining(fight)}</span>
                  <span className="text-surface-400">|</span>
                  <span className="text-surface-300">${fight.stakeUsdc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Not in any fight - show all active fights
  return (
    <div className="w-full bg-gradient-to-r from-primary-900/30 via-surface-800/50 to-primary-900/30 border-b border-primary-500/30">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-primary-400">
              You have {activeFightsCount} active fight{activeFightsCount > 1 ? 's' : ''}!
            </span>
            <span className="text-xs text-surface-400">
              Click to view and trade
            </span>
          </div>
          <div className="flex items-center gap-2">
            {activeFights.map((fight) => (
              <button
                key={fight.id}
                onClick={() => handleSwitchFight(fight.id)}
                className="flex items-center gap-3 px-4 py-2 bg-primary-500/10 hover:bg-primary-500/20 border border-primary-500/30 rounded-lg transition-colors"
              >
                <div className="flex flex-col items-start">
                  <span className="text-xs text-surface-400">vs</span>
                  <span className="text-sm font-semibold text-white">{getOpponent(fight)}</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-xs text-surface-400">Time</span>
                  <span className="font-mono font-bold text-primary-400">{getTimeRemaining(fight)}</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-xs text-surface-400">Stake</span>
                  <span className="font-mono text-white">${fight.stakeUsdc}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
