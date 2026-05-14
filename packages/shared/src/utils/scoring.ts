/**
 * Scoring calculation utilities
 * @see Master-doc.md Section 2.5
 */

export interface ScoringInput {
  stake: number;
  realizedPnl: number;
  unrealizedPnl: number;
  fees: number;
  funding: number;
}

export interface ScoringResult {
  equityVirtual: number;
  pnlPercent: number;
  scoreUsdc: number;
}

/**
 * Calculate fight score based on virtual equity
 *
 * Formula from Master-doc.md Section 2.5:
 * - EquityVirtual = Stake + RealizedPnL + UnrealizedPnL - Fees - Funding
 * - PnL% = (EquityVirtual / Stake) - 1
 * - ScoreUSDC = Stake × PnL%
 *
 * Winner is determined by highest ScoreUSDC at fight end.
 */
export function calculateScore(input: ScoringInput): ScoringResult {
  const { stake, realizedPnl, unrealizedPnl, fees, funding } = input;

  // Validate inputs
  if (stake <= 0) {
    throw new Error('Stake must be positive');
  }

  // Calculate virtual equity
  const equityVirtual = stake + realizedPnl + unrealizedPnl - fees - funding;

  // Calculate PnL percentage
  const pnlPercent = equityVirtual / stake - 1;

  // Calculate score in USDC
  const scoreUsdc = stake * pnlPercent;

  // Validate results (no NaN or Infinity)
  if (!Number.isFinite(equityVirtual) || !Number.isFinite(pnlPercent) || !Number.isFinite(scoreUsdc)) {
    throw new Error('Scoring calculation produced invalid result');
  }

  return {
    equityVirtual,
    pnlPercent,
    scoreUsdc,
  };
}

/**
 * Live fight score, computed the way the realtime engine does it.
 *
 * Unlike `calculateScore` (Master-doc formula, denominator = stake), this matches what
 * the realtime engine emits in PNL_TICK and writes at endFight: the denominator is the
 * EFFECTIVE MARGIN actually committed during the fight (max of currentMargin,
 * maxExposureUsed water-mark, and notional from trades). Used by reconcile-fights so
 * both code paths converge on the same winner.
 *
 * Returns pnlPercent as a percentage (e.g. 5.0 = 5%), NOT a fraction.
 */
export interface LiveScoreInput {
  stake: number;
  realizedPnl: number;
  fees: number;
  /** Water-mark of capital used during the fight (FightParticipant.maxExposureUsed). */
  maxExposureUsed: number;
  /** Optional: notional of currently-open positions. realtime sets this; reconcile cannot. */
  currentMargin?: number;
  /** Optional: cumulative opening notional reconstructed from trades. */
  maxExposureFromTrades?: number;
}

export interface LiveScoreResult {
  pnlPercent: number;
  scoreUsdc: number;
  effectiveMargin: number;
}

export function calculateLiveScore(input: LiveScoreInput): LiveScoreResult {
  const {
    stake,
    realizedPnl,
    fees,
    maxExposureUsed,
    currentMargin = 0,
    maxExposureFromTrades = 0,
  } = input;

  if (stake <= 0) {
    throw new Error('Stake must be positive');
  }

  const totalPnl = realizedPnl - fees;
  // Fall back to stake when nothing was ever opened, so pnlPercent doesn't divide by 0
  // and reconcile gives a sane answer for fights that ended with no exposure.
  const effectiveMargin = Math.max(currentMargin, maxExposureUsed, maxExposureFromTrades) || stake;
  const pnlPercent = (totalPnl / effectiveMargin) * 100;
  const scoreUsdc = stake * (pnlPercent / 100);

  if (!Number.isFinite(pnlPercent) || !Number.isFinite(scoreUsdc)) {
    throw new Error('Live score calculation produced invalid result');
  }

  return { pnlPercent, scoreUsdc, effectiveMargin };
}

/**
 * Format PnL percentage for display
 * @param pnlPercent - Raw PnL percentage (e.g., 0.05 for 5%)
 * @returns Formatted string (e.g., "+5.00%" or "-2.50%")
 */
export function formatPnlPercent(pnlPercent: number): string {
  const formatted = (pnlPercent * 100).toFixed(2);
  return pnlPercent >= 0 ? `+${formatted}%` : `${formatted}%`;
}

/**
 * Format USDC amount for display
 * @param amount - USDC amount
 * @returns Formatted string (e.g., "+$50.00" or "-$25.00")
 */
export function formatUsdcAmount(amount: number): string {
  const absAmount = Math.abs(amount).toFixed(2);
  return amount >= 0 ? `+$${absAmount}` : `-$${absAmount}`;
}

/**
 * Determine fight winner
 * @returns winnerId or null for draw
 */
export function determineWinner(
  participantAId: string,
  participantAScore: number,
  participantBId: string,
  participantBScore: number
): { winnerId: string | null; isDraw: boolean } {
  // Handle floating point comparison with epsilon
  const epsilon = 0.000001;
  const diff = Math.abs(participantAScore - participantBScore);

  if (diff < epsilon) {
    return { winnerId: null, isDraw: true };
  }

  return {
    winnerId: participantAScore > participantBScore ? participantAId : participantBId,
    isDraw: false,
  };
}
