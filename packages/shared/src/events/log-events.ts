/**
 * Log event taxonomy
 * @see Master-doc.md Section 9.3
 *
 * All log events must use these constants - no improvisation.
 */

export const LOG_EVENTS = {
  // ─────────────────────────────────────────────────────────────
  // Service Lifecycle
  // ─────────────────────────────────────────────────────────────
  API_START: 'api.start',
  API_SHUTDOWN: 'api.shutdown',
  API_ERROR: 'api.error',

  // ─────────────────────────────────────────────────────────────
  // Auth / Pacifica
  // ─────────────────────────────────────────────────────────────
  AUTH_CONNECT_START: 'auth.connect.start',
  AUTH_CONNECT_SUCCESS: 'auth.connect.success',
  AUTH_CONNECT_FAILURE: 'auth.connect.failure',

  PACIFICA_SESSION_REFRESH: 'pacifica.session.refresh',
  PACIFICA_WS_CONNECT: 'pacifica.ws.connect',
  PACIFICA_WS_DISCONNECT: 'pacifica.ws.disconnect',
  PACIFICA_API_RATE_LIMITED: 'pacifica.api.rate_limited',
  PACIFICA_FILL_RECEIVED: 'pacifica.fill.received',

  // ─────────────────────────────────────────────────────────────
  // Fights
  // ─────────────────────────────────────────────────────────────
  FIGHT_CREATE: 'fight.create',
  FIGHT_JOIN_ATTEMPT: 'fight.join.attempt',
  FIGHT_JOIN_SUCCESS: 'fight.join.success',
  FIGHT_JOIN_REJECTED: 'fight.join.rejected',
  FIGHT_START: 'fight.start',
  FIGHT_TICK: 'fight.tick',
  FIGHT_FINISH: 'fight.finish',
  FIGHT_CANCEL_STALE: 'fight.cancel.stale',
  FIGHT_STATE_REHYDRATE: 'fight.state.rehydrate',
  FIGHT_LEAD_CHANGED: 'fight.lead.changed',
  FIGHT_CLEANUP_START: 'fight.cleanup.start',
  FIGHT_CLEANUP_SUCCESS: 'fight.cleanup.success',
  FIGHT_CLEANUP_FAILURE: 'fight.cleanup.failure',
  FIGHT_RECONCILE_TRIGGERED: 'fight.reconcile.triggered',
  FIGHT_RECONCILE_SUCCESS: 'fight.reconcile.success',
  FIGHT_RECONCILE_FAILURE: 'fight.reconcile.failure',
  FIGHT_ACTIVITY: 'fight.activity',

  // ─────────────────────────────────────────────────────────────
  // Orders / Trading
  // ─────────────────────────────────────────────────────────────
  ORDER_PLACE_REQUEST: 'order.place.request',
  ORDER_PLACE_ACCEPTED: 'order.place.accepted',
  ORDER_PLACE_REJECTED: 'order.place.rejected',

  ORDER_CANCEL_REQUEST: 'order.cancel.request',
  ORDER_CANCEL_SUCCESS: 'order.cancel.success',
  ORDER_CANCEL_FAILURE: 'order.cancel.failure',

  FILL_RECEIVED: 'fill.received',
  POSITION_UPDATED: 'position.updated',

  // ─────────────────────────────────────────────────────────────
  // Scoring
  // ─────────────────────────────────────────────────────────────
  SCORING_RECALC_START: 'scoring.recalc.start',
  SCORING_RECALC_SUCCESS: 'scoring.recalc.success',
  SCORING_RECALC_FAILURE: 'scoring.recalc.failure',
  SCORING_SNAPSHOT_WRITE: 'scoring.snapshot.write',

  // ─────────────────────────────────────────────────────────────
  // WebSocket (our WS server)
  // ─────────────────────────────────────────────────────────────
  WS_CLIENT_CONNECT: 'ws.client.connect',
  WS_CLIENT_DISCONNECT: 'ws.client.disconnect',
  WS_EVENT_SENT: 'ws.event.sent',
  WS_EVENT_DROP: 'ws.event.drop',
  WS_SUBSCRIBE: 'ws.subscribe',
  WS_UNSUBSCRIBE: 'ws.unsubscribe',
  WS_BROADCAST: 'ws.broadcast',

  // ─────────────────────────────────────────────────────────────
  // Jobs / Leaderboard
  // ─────────────────────────────────────────────────────────────
  JOB_LEADERBOARD_REFRESH_START: 'job.leaderboard.refresh.start',
  JOB_LEADERBOARD_REFRESH_SUCCESS: 'job.leaderboard.refresh.success',
  JOB_LEADERBOARD_REFRESH_FAILURE: 'job.leaderboard.refresh.failure',
  LEADERBOARD_REFRESH_START: 'leaderboard.refresh.start',
  LEADERBOARD_REFRESH_SUCCESS: 'leaderboard.refresh.success',
  LEADERBOARD_REFRESH_FAILURE: 'leaderboard.refresh.failure',

  JOB_RECONCILE_FILLS_START: 'job.reconcile.fills.start',
  JOB_RECONCILE_FILLS_SUCCESS: 'job.reconcile.fills.success',
  JOB_RECONCILE_FILLS_FAILURE: 'job.reconcile.fills.failure',

  JOB_CLEANUP_STALE_START: 'job.cleanup.stale.start',
  JOB_CLEANUP_STALE_SUCCESS: 'job.cleanup.stale.success',
  JOB_CLEANUP_STALE_FAILURE: 'job.cleanup.stale.failure',

  // ─────────────────────────────────────────────────────────────
  // Prize Pool
  // ─────────────────────────────────────────────────────────────
  PRIZE_POOL_FINALIZE_START: 'prize.pool.finalize.start',
  PRIZE_POOL_FINALIZE_SUCCESS: 'prize.pool.finalize.success',
  PRIZE_POOL_FINALIZE_FAILURE: 'prize.pool.finalize.failure',
  PRIZE_POOL_NO_WINNERS: 'prize.pool.no_winners',

  // ─────────────────────────────────────────────────────────────
  // Treasury / Prize Claims
  // ─────────────────────────────────────────────────────────────
  TREASURY_WITHDRAW_START: 'treasury.withdraw.start',
  TREASURY_WITHDRAW_SUCCESS: 'treasury.withdraw.success',
  TREASURY_WITHDRAW_FAILURE: 'treasury.withdraw.failure',
  TREASURY_STATUS_SUCCESS: 'treasury.status.success',
  TREASURY_STATUS_FAILURE: 'treasury.status.failure',
  PRIZE_CLAIM_START: 'prize.claim.start',
  PRIZE_CLAIM_SUCCESS: 'prize.claim.success',
  PRIZE_CLAIM_FAILURE: 'prize.claim.failure',
} as const;

export type LogEvent = (typeof LOG_EVENTS)[keyof typeof LOG_EVENTS];
