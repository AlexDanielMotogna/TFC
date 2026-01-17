/**
 * Fight duration options in minutes
 * @see Master-doc.md Section 2.2
 */
export const FIGHT_DURATIONS_MINUTES = [5, 15, 30, 60, 120, 240] as const;
export type FightDuration = (typeof FIGHT_DURATIONS_MINUTES)[number];

/**
 * Virtual stake options in USDC
 * @see Master-doc.md Section 2.3
 */
export const FIGHT_STAKES_USDC = [100, 250, 500, 1000, 2500, 5000] as const;
export type FightStake = (typeof FIGHT_STAKES_USDC)[number];

/**
 * Fight status lifecycle
 * @see Master-doc.md Section 1.1
 */
export const FIGHT_STATUS = {
  WAITING: 'WAITING',
  LIVE: 'LIVE',
  FINISHED: 'FINISHED',
  CANCELLED: 'CANCELLED',
} as const;
export type FightStatus = (typeof FIGHT_STATUS)[keyof typeof FIGHT_STATUS];

/**
 * Participant slots
 */
export const PARTICIPANT_SLOTS = {
  A: 'A',
  B: 'B',
} as const;
export type ParticipantSlot = (typeof PARTICIPANT_SLOTS)[keyof typeof PARTICIPANT_SLOTS];

/**
 * Leverage constants
 * Min is universal (1x), max comes from Pacifica API per market
 */
export const MIN_LEVERAGE = 1;

/**
 * PnL tick interval for scoring updates
 * @see Master-doc.md Section 4.2
 */
export const PNL_TICK_INTERVAL_MS = 1000;

/**
 * Candle intervals available in Pacifica
 * @see Pacifica-API.md /api/v1/kline
 */
export const CANDLE_INTERVALS = [
  '1m',
  '3m',
  '5m',
  '15m',
  '30m',
  '1h',
  '2h',
  '4h',
  '8h',
  '12h',
  '1d',
] as const;
export type CandleInterval = (typeof CANDLE_INTERVALS)[number];

/**
 * Leaderboard range options
 * @see Master-doc.md Section 11
 */
export const LEADERBOARD_RANGES = {
  WEEKLY: 'weekly',
  ALL_TIME: 'all_time',
} as const;
export type LeaderboardRange = (typeof LEADERBOARD_RANGES)[keyof typeof LEADERBOARD_RANGES];

/**
 * Order sides
 */
export const ORDER_SIDES = {
  LONG: 'LONG',
  SHORT: 'SHORT',
} as const;
export type OrderSide = (typeof ORDER_SIDES)[keyof typeof ORDER_SIDES];

/**
 * Order types
 */
export const ORDER_TYPES = {
  MARKET: 'MARKET',
  LIMIT: 'LIMIT',
} as const;
export type OrderType = (typeof ORDER_TYPES)[keyof typeof ORDER_TYPES];

/**
 * Pacifica-specific order sides (bid = long, ask = short)
 */
export const PACIFICA_SIDES = {
  BID: 'bid',
  ASK: 'ask',
} as const;
export type PacificaSide = (typeof PACIFICA_SIDES)[keyof typeof PACIFICA_SIDES];

/**
 * Trade sides from Pacifica fills
 */
export const PACIFICA_TRADE_SIDES = {
  OPEN_LONG: 'open_long',
  OPEN_SHORT: 'open_short',
  CLOSE_LONG: 'close_long',
  CLOSE_SHORT: 'close_short',
} as const;
export type PacificaTradeSide = (typeof PACIFICA_TRADE_SIDES)[keyof typeof PACIFICA_TRADE_SIDES];
