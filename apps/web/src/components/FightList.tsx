'use client';

import { FightCard } from './FightCard';
import { FIGHT_DURATIONS_MINUTES, FIGHT_STAKES_USDC } from '@tfc/shared/constants';
import type { Fight } from '@/lib/api';

// Placeholder data - will be replaced with API calls
const placeholderFights: Fight[] = [
  {
    id: '1',
    status: 'WAITING',
    durationMinutes: 15,
    stakeUsdc: 500,
    creator: {
      id: 'user-1',
      handle: 'whale_trader',
      avatarUrl: null,
    },
    participants: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    startedAt: null,
    endedAt: null,
    winnerId: null,
    isDraw: false,
  },
  {
    id: '2',
    status: 'LIVE',
    durationMinutes: 30,
    stakeUsdc: 1000,
    creator: {
      id: 'user-2',
      handle: 'alpha_degen',
      avatarUrl: null,
    },
    participants: [
      {
        userId: 'user-2',
        user: { id: 'user-2', handle: 'alpha_degen', avatarUrl: null },
        slot: 'A',
        finalPnlPercent: 2.3,
        finalScoreUsdc: 23,
        externalTradesDetected: false,
        externalTradeIds: [],
      },
      {
        userId: 'user-3',
        user: { id: 'user-3', handle: 'sigma_grinder', avatarUrl: null },
        slot: 'B',
        finalPnlPercent: -1.5,
        finalScoreUsdc: -15,
        externalTradesDetected: false,
        externalTradeIds: [],
      },
    ],
    createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    startedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    endedAt: null,
    winnerId: null,
    isDraw: false,
  },
];

export function FightList() {
  const liveFights = placeholderFights.filter((f) => f.status === 'LIVE');
  const waitingFights = placeholderFights.filter((f) => f.status === 'WAITING');

  return (
    <div className="space-y-10">
      {/* Create fight section */}
      <div className="card p-6">
        <h2 className="font-display text-xl font-semibold uppercase tracking-wide mb-6">
          Start a Fight
        </h2>
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-surface-400 mb-2 uppercase tracking-wider">
              Duration
            </label>
            <select className="select">
              {FIGHT_DURATIONS_MINUTES.map((d) => (
                <option key={d} value={d}>
                  {d} minutes
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-400 mb-2 uppercase tracking-wider">
              Stake (USDC)
            </label>
            <select className="select">
              {FIGHT_STAKES_USDC.map((s) => (
                <option key={s} value={s}>
                  ${s.toLocaleString()}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button className="btn-primary w-full">⚡ Create Fight</button>
          </div>
        </div>
      </div>

      {/* Live fights */}
      {liveFights.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-6">
            <div className="live-indicator">
              <span className="font-display text-xl font-semibold uppercase tracking-wide">
                Live Battles
              </span>
            </div>
            <span className="text-surface-400 text-sm">({liveFights.length})</span>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {liveFights.map((fight) => (
              <FightCard key={fight.id} fight={fight} />
            ))}
          </div>
        </div>
      )}

      {/* Waiting for opponent */}
      <div>
        <div className="flex items-center gap-3 mb-6">
          <span className="font-display text-xl font-semibold uppercase tracking-wide text-white">
            Open Challenges
          </span>
          <span className="text-surface-400 text-sm">({waitingFights.length})</span>
        </div>
        {waitingFights.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-surface-400">No open challenges</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {waitingFights.map((fight) => (
              <FightCard key={fight.id} fight={fight} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
