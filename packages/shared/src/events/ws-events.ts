/**
 * WebSocket event names for fight terminal
 * @see Master-doc.md Section 8
 */

export const WS_EVENTS = {
  // Server → Client (Fight room)
  FIGHT_STATE: 'FIGHT_STATE',
  FIGHT_STARTED: 'FIGHT_STARTED',
  TRADE_EVENT: 'TRADE_EVENT',
  PNL_TICK: 'PNL_TICK',
  LEAD_CHANGED: 'LEAD_CHANGED',
  FIGHT_FINISHED: 'FIGHT_FINISHED',
  STAKE_INFO: 'STAKE_INFO',  // Real-time stake/exposure updates for a user
  EXTERNAL_TRADES_DETECTED: 'EXTERNAL_TRADES_DETECTED',  // Trades made outside TradeFightClub
  FIGHT_ENDING_SOON: 'FIGHT_ENDING_SOON',  // 30 seconds warning before fight ends (per Rules 30-32)
  ERROR: 'ERROR',

  // Arena events (Server → Client, broadcast to arena subscribers)
  ARENA_FIGHT_CREATED: 'arena:fight_created',
  ARENA_FIGHT_UPDATED: 'arena:fight_updated',
  ARENA_FIGHT_STARTED: 'arena:fight_started',
  ARENA_FIGHT_ENDED: 'arena:fight_ended',
  ARENA_FIGHT_DELETED: 'arena:fight_deleted',
  ARENA_PNL_TICK: 'arena:pnl_tick',  // Live PnL updates for all active fights

  // Platform stats (Server → Client, broadcast to all connected clients)
  PLATFORM_STATS: 'platform:stats',  // Real-time platform statistics
} as const;

export type WsEventName = (typeof WS_EVENTS)[keyof typeof WS_EVENTS];

// ─────────────────────────────────────────────────────────────
// Event Payload Types
// ─────────────────────────────────────────────────────────────

export interface ParticipantScore {
  userId: string;
  handle: string;
  avatarUrl: string | null;
  pnlPercent: number;
  scoreUsdc: number;
  tradesCount: number;
}

export interface FightStatePayload {
  fightId: string;
  status: 'WAITING' | 'LIVE' | 'FINISHED';
  durationMinutes: number;
  stakeUsdc: number;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
  participantA: ParticipantScore | null;
  participantB: ParticipantScore | null;
  leaderId: string | null;
  winnerId: string | null;
  isDraw: boolean;
}

export interface FightStartedPayload {
  fightId: string;
  startedAt: string;
  endedAt: string;
  participantA: {
    userId: string;
    handle: string;
    avatarUrl: string | null;
  };
  participantB: {
    userId: string;
    handle: string;
    avatarUrl: string | null;
  };
}

export interface TradeEventPayload {
  fightId: string;
  userId: string;
  symbol: string;
  side: string;
  amount: string;
  price: string;
  fee: string;
  pnl: string | null;
  timestamp: string;
}

export interface PnlTickPayload {
  fightId: string;
  timestamp: string;
  participantA: ParticipantScore;
  participantB: ParticipantScore;
  leaderId: string | null;
  timeRemainingMs: number;
}

export interface LeadChangedPayload {
  fightId: string;
  newLeaderId: string;
  previousLeaderId: string | null;
  timestamp: string;
}

export interface FightFinishedPayload {
  fightId: string;
  winnerId: string | null;
  isDraw: boolean;
  finalScores: {
    participantA: ParticipantScore;
    participantB: ParticipantScore;
  };
  endedAt: string;
}

export interface WsErrorPayload {
  code: string;
  message: string;
}

export interface StakeInfoPayload {
  fightId: string;
  userId: string;
  stake: number;
  currentExposure: number;
  maxExposureUsed: number;
  available: number;
}

export interface ExternalTradesDetectedPayload {
  fightId: string;
  userId: string;
  count: number;
  tradeIds: string[];
}

export interface FightEndingSoonPayload {
  fightId: string;
  secondsRemaining: number;
  message: string;
}

export interface ArenaPnlTickPayload {
  fights: Array<{
    fightId: string;
    participantA: { userId: string; pnlPercent: number } | null;
    participantB: { userId: string; pnlPercent: number } | null;
    leader: string | null;
    timeRemainingMs: number;
  }>;
  timestamp: number;
}

export interface PlatformStatsPayload {
  tradingVolume: number;
  fightVolume: number;
  fightsCompleted: number;
  totalFees: number;
  activeUsers: number;
  totalTrades: number;
  timestamp: number;
}

// Union type for all payloads
export type WsEventPayload =
  | { event: typeof WS_EVENTS.FIGHT_STATE; data: FightStatePayload }
  | { event: typeof WS_EVENTS.FIGHT_STARTED; data: FightStartedPayload }
  | { event: typeof WS_EVENTS.TRADE_EVENT; data: TradeEventPayload }
  | { event: typeof WS_EVENTS.PNL_TICK; data: PnlTickPayload }
  | { event: typeof WS_EVENTS.LEAD_CHANGED; data: LeadChangedPayload }
  | { event: typeof WS_EVENTS.FIGHT_FINISHED; data: FightFinishedPayload }
  | { event: typeof WS_EVENTS.STAKE_INFO; data: StakeInfoPayload }
  | { event: typeof WS_EVENTS.EXTERNAL_TRADES_DETECTED; data: ExternalTradesDetectedPayload }
  | { event: typeof WS_EVENTS.FIGHT_ENDING_SOON; data: FightEndingSoonPayload }
  | { event: typeof WS_EVENTS.ERROR; data: WsErrorPayload };
