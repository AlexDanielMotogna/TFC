/**
 * Centralized Anti-Cheat Service for TradeFightClub
 *
 * This service contains all anti-cheat validation logic in one place.
 * Each rule is implemented as a separate function that returns a ValidationResult.
 *
 * Rules:
 * - ZERO_ZERO: Both players PnL ~ 0 or 0 trades
 * - MIN_VOLUME: Total notional < MIN_NOTIONAL_PER_PLAYER
 * - REPEATED_MATCHUP: Same pair fought >= 3 times in 24h
 * - SAME_IP_PATTERN: Same IP + repeated matchup pattern
 *
 * @see Anti-Cheat.md for full documentation
 */

import { prisma } from './db';
import type { Fight, FightParticipant, FightTrade, FightSession } from '@prisma/client';

// ─────────────────────────────────────────────────────────────
// CONSTANTS (configurable via environment variables)
// ─────────────────────────────────────────────────────────────

// Helper to parse env var as number with fallback
const parseEnvNumber = (key: string, fallback: number): number => {
  const value = process.env[key];
  if (value === undefined || value === '') return fallback;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? fallback : parsed;
};

export const ANTI_CHEAT_CONSTANTS = {
  // Rule 1: Zero-Zero threshold (consider 0 if within this range)
  // ENV: ANTI_CHEAT_ZERO_PNL_THRESHOLD_USDC (default: 0.01)
  ZERO_PNL_THRESHOLD_USDC: parseEnvNumber('ANTI_CHEAT_ZERO_PNL_THRESHOLD_USDC', 0.01),

  // Rule 2: Minimum volume per player in USDC
  // ENV: ANTI_CHEAT_MIN_NOTIONAL_PER_PLAYER (default: 10)
  MIN_NOTIONAL_PER_PLAYER: parseEnvNumber('ANTI_CHEAT_MIN_NOTIONAL_PER_PLAYER', 10),

  // Rule 4: Repeated matchup limit in 24 hours
  // ENV: ANTI_CHEAT_MAX_MATCHUPS_PER_24H (default: 3)
  MAX_MATCHUPS_PER_24H: parseEnvNumber('ANTI_CHEAT_MAX_MATCHUPS_PER_24H', 3),
  // ENV: ANTI_CHEAT_MATCHUP_WINDOW_HOURS (default: 24)
  MATCHUP_WINDOW_HOURS: parseEnvNumber('ANTI_CHEAT_MATCHUP_WINDOW_HOURS', 24),

  // Rule 5: IP same-pair threshold for auto-exclusion
  // ENV: ANTI_CHEAT_IP_SAME_PAIR_THRESHOLD (default: 2)
  IP_SAME_PAIR_THRESHOLD: parseEnvNumber('ANTI_CHEAT_IP_SAME_PAIR_THRESHOLD', 2),
};

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export type AntiCheatRuleCode =
  | 'ZERO_ZERO'
  | 'MIN_VOLUME'
  | 'REPEATED_MATCHUP'
  | 'SAME_IP_PATTERN'
  | 'EXTERNAL_TRADES';

export interface ValidationResult {
  passed: boolean;
  ruleCode: AntiCheatRuleCode;
  ruleName: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface FightValidationResult {
  isValid: boolean;
  shouldCountForRanking: boolean;
  recommendedStatus: 'FINISHED' | 'NO_CONTEST';
  violations: ValidationResult[];
  allChecks: ValidationResult[];
}

export interface FightDataForValidation {
  fight: Fight;
  participants: (FightParticipant & {
    user: { id: string; handle: string };
  })[];
  trades: FightTrade[];
  sessions?: FightSession[];
}

export interface MatchmakingCheckResult {
  canMatch: boolean;
  reason?: string;
  matchupCount?: number;
}

// ─────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────

/**
 * Extract IP address from request headers
 * Works with Vercel, Cloudflare, and direct connections
 */
export function extractIpAddress(request: Request): string {
  const headers = request.headers;

  // Vercel/Cloudflare proxy headers
  const xForwardedFor = headers.get('x-forwarded-for');
  if (xForwardedFor) {
    // x-forwarded-for can be comma-separated list, take the first (client) IP
    const firstIp = xForwardedFor.split(',')[0];
    return firstIp?.trim() || 'unknown';
  }

  // Cloudflare specific
  const cfConnectingIp = headers.get('cf-connecting-ip');
  if (cfConnectingIp) return cfConnectingIp;

  // Vercel specific
  const xRealIp = headers.get('x-real-ip');
  if (xRealIp) return xRealIp;

  // Fallback
  return 'unknown';
}

/**
 * Extract user agent from request headers
 */
export function extractUserAgent(request: Request): string | null {
  return request.headers.get('user-agent');
}

/**
 * Calculate total notional volume for a participant
 */
function calculateParticipantNotional(trades: FightTrade[], userId: string): number {
  return trades
    .filter((t) => t.participantUserId === userId)
    .reduce((sum, t) => {
      const amount = parseFloat(t.amount.toString());
      const price = parseFloat(t.price.toString());
      return sum + amount * price;
    }, 0);
}

// ─────────────────────────────────────────────────────────────
// RULE VALIDATORS
// ─────────────────────────────────────────────────────────────

/**
 * Rule 1: Zero-Zero No Contest
 * If both players have PnL ~ 0 or 0 trades, mark as NO_CONTEST
 */
async function validateZeroZeroRule(data: FightDataForValidation): Promise<ValidationResult> {
  const { participants } = data;
  const threshold = ANTI_CHEAT_CONSTANTS.ZERO_PNL_THRESHOLD_USDC;

  const participantA = participants.find((p) => p.slot === 'A');
  const participantB = participants.find((p) => p.slot === 'B');

  if (!participantA || !participantB) {
    return {
      passed: true,
      ruleCode: 'ZERO_ZERO',
      ruleName: 'Zero-Zero No Contest',
      message: 'Missing participant data, skipping check',
    };
  }

  const pnlA = participantA.finalScoreUsdc ? parseFloat(participantA.finalScoreUsdc.toString()) : 0;
  const pnlB = participantB.finalScoreUsdc ? parseFloat(participantB.finalScoreUsdc.toString()) : 0;
  const tradesA = participantA.tradesCount || 0;
  const tradesB = participantB.tradesCount || 0;

  // Check if both have zero or near-zero PnL
  const aIsZero = Math.abs(pnlA) <= threshold;
  const bIsZero = Math.abs(pnlB) <= threshold;

  // Check if both have zero trades
  const noTrades = tradesA === 0 && tradesB === 0;

  if ((aIsZero && bIsZero) || noTrades) {
    return {
      passed: false,
      ruleCode: 'ZERO_ZERO',
      ruleName: 'Zero-Zero No Contest',
      message: noTrades
        ? 'Both players made 0 trades - fight excluded'
        : `Both players have near-zero PnL (A: $${pnlA.toFixed(2)}, B: $${pnlB.toFixed(2)}) - fight excluded`,
      metadata: {
        pnlA,
        pnlB,
        tradesA,
        tradesB,
        threshold,
      },
    };
  }

  return {
    passed: true,
    ruleCode: 'ZERO_ZERO',
    ruleName: 'Zero-Zero No Contest',
    message: 'At least one player has meaningful activity',
  };
}

/**
 * Rule 2: Minimum Volume
 * Total notional must be >= MIN_NOTIONAL_PER_PLAYER for each player
 */
async function validateMinVolumeRule(data: FightDataForValidation): Promise<ValidationResult> {
  const { participants, trades } = data;
  const minNotional = ANTI_CHEAT_CONSTANTS.MIN_NOTIONAL_PER_PLAYER;

  const participantA = participants.find((p) => p.slot === 'A');
  const participantB = participants.find((p) => p.slot === 'B');

  if (!participantA || !participantB) {
    return {
      passed: true,
      ruleCode: 'MIN_VOLUME',
      ruleName: 'Minimum Volume',
      message: 'Missing participant data, skipping check',
    };
  }

  const notionalA = calculateParticipantNotional(trades, participantA.userId);
  const notionalB = calculateParticipantNotional(trades, participantB.userId);

  const aFails = notionalA < minNotional;
  const bFails = notionalB < minNotional;

  if (aFails || bFails) {
    return {
      passed: false,
      ruleCode: 'MIN_VOLUME',
      ruleName: 'Minimum Volume',
      message: `Insufficient trading volume - A: $${notionalA.toFixed(2)}, B: $${notionalB.toFixed(2)} (minimum: $${minNotional})`,
      metadata: {
        notionalA,
        notionalB,
        minNotional,
        failedUserIds: [...(aFails ? [participantA.userId] : []), ...(bFails ? [participantB.userId] : [])],
      },
    };
  }

  return {
    passed: true,
    ruleCode: 'MIN_VOLUME',
    ruleName: 'Minimum Volume',
    message: `Both players meet minimum volume (A: $${notionalA.toFixed(2)}, B: $${notionalB.toFixed(2)})`,
  };
}

/**
 * Rule 4: Repeated Matchups
 * Same pair cannot fight >= 3 times in 24 hours for ranking
 */
async function validateRepeatedMatchupRule(data: FightDataForValidation): Promise<ValidationResult> {
  const { fight, participants } = data;
  const maxMatchups = ANTI_CHEAT_CONSTANTS.MAX_MATCHUPS_PER_24H;
  const windowHours = ANTI_CHEAT_CONSTANTS.MATCHUP_WINDOW_HOURS;

  const participantA = participants.find((p) => p.slot === 'A');
  const participantB = participants.find((p) => p.slot === 'B');

  if (!participantA || !participantB) {
    return {
      passed: true,
      ruleCode: 'REPEATED_MATCHUP',
      ruleName: 'Repeated Matchup Limit',
      message: 'Missing participant data, skipping check',
    };
  }

  const userIds = [participantA.userId, participantB.userId].sort();
  const windowStart = new Date(Date.now() - windowHours * 60 * 60 * 1000);

  // Count finished fights between these two users in the time window
  // Find fights where both users are participants
  const recentFights = await prisma.fight.findMany({
    where: {
      id: { not: fight.id },
      status: { in: ['FINISHED', 'NO_CONTEST'] },
      startedAt: { gte: windowStart },
    },
    include: {
      participants: {
        select: { userId: true },
      },
    },
  });

  // Filter to only fights with both users
  const matchupCount = recentFights.filter((f) => {
    const fightUserIds = f.participants.map((p) => p.userId).sort();
    return fightUserIds.length === 2 && fightUserIds[0] === userIds[0] && fightUserIds[1] === userIds[1];
  }).length;

  if (matchupCount >= maxMatchups - 1) {
    // -1 because this fight counts too
    return {
      passed: false,
      ruleCode: 'REPEATED_MATCHUP',
      ruleName: 'Repeated Matchup Limit',
      message: `Users have fought ${matchupCount + 1} times in ${windowHours}h (max: ${maxMatchups})`,
      metadata: {
        userAId: participantA.userId,
        userBId: participantB.userId,
        matchupCount: matchupCount + 1,
        maxMatchups,
        windowHours,
      },
    };
  }

  return {
    passed: true,
    ruleCode: 'REPEATED_MATCHUP',
    ruleName: 'Repeated Matchup Limit',
    message: `Matchup count OK (${matchupCount + 1}/${maxMatchups} in ${windowHours}h)`,
  };
}

/**
 * Rule 5: Same IP Pattern Detection
 * Flag if same IP + repeated matchup pattern
 */
async function validateSameIpPattern(data: FightDataForValidation): Promise<ValidationResult> {
  const { fight, participants, sessions } = data;

  if (!sessions || sessions.length === 0) {
    return {
      passed: true,
      ruleCode: 'SAME_IP_PATTERN',
      ruleName: 'Same IP Pattern',
      message: 'No session data available',
    };
  }

  const participantA = participants.find((p) => p.slot === 'A');
  const participantB = participants.find((p) => p.slot === 'B');

  if (!participantA || !participantB) {
    return {
      passed: true,
      ruleCode: 'SAME_IP_PATTERN',
      ruleName: 'Same IP Pattern',
      message: 'Missing participant data, skipping check',
    };
  }

  // Get IPs for each participant
  const ipsA = sessions.filter((s) => s.userId === participantA.userId).map((s) => s.ipAddress);
  const ipsB = sessions.filter((s) => s.userId === participantB.userId).map((s) => s.ipAddress);

  // Check for overlapping IPs
  const sharedIps = ipsA.filter((ip) => ipsB.includes(ip) && ip !== 'unknown');

  if (sharedIps.length > 0) {
    // Check if this is a repeated pattern (same IP pair multiple times)
    const windowStart = new Date(Date.now() - ANTI_CHEAT_CONSTANTS.MATCHUP_WINDOW_HOURS * 60 * 60 * 1000);

    // Find previous fights where both users used the same IP
    const previousSessions = await prisma.fightSession.findMany({
      where: {
        ipAddress: { in: sharedIps },
        createdAt: { gte: windowStart },
        fightId: { not: fight.id },
      },
      select: {
        fightId: true,
        userId: true,
      },
    });

    // Group by fightId and count fights where both users appeared from same IP
    const fightUserMap = new Map<string, Set<string>>();
    for (const session of previousSessions) {
      if (!fightUserMap.has(session.fightId)) {
        fightUserMap.set(session.fightId, new Set());
      }
      fightUserMap.get(session.fightId)!.add(session.userId);
    }

    const sameIpMatchupCount = Array.from(fightUserMap.values()).filter(
      (users) => users.has(participantA.userId) && users.has(participantB.userId)
    ).length;

    if (sameIpMatchupCount >= ANTI_CHEAT_CONSTANTS.IP_SAME_PAIR_THRESHOLD) {
      return {
        passed: false,
        ruleCode: 'SAME_IP_PATTERN',
        ruleName: 'Same IP Pattern',
        message: `Suspicious pattern: Same IP (${sharedIps[0]}) used by both players in ${sameIpMatchupCount + 1} fights`,
        metadata: {
          sharedIps,
          sameIpMatchupCount: sameIpMatchupCount + 1,
          threshold: ANTI_CHEAT_CONSTANTS.IP_SAME_PAIR_THRESHOLD,
          userAId: participantA.userId,
          userBId: participantB.userId,
        },
      };
    }

    // Just flag but don't fail (first offense)
    return {
      passed: true,
      ruleCode: 'SAME_IP_PATTERN',
      ruleName: 'Same IP Pattern',
      message: `Warning: Both players connected from same IP (${sharedIps[0]}) - flagged for review`,
      metadata: {
        sharedIps,
        sameIpMatchupCount: sameIpMatchupCount + 1,
        warning: true,
      },
    };
  }

  return {
    passed: true,
    ruleCode: 'SAME_IP_PATTERN',
    ruleName: 'Same IP Pattern',
    message: 'No IP overlap detected',
  };
}

/**
 * Rule: External Trades (already implemented, this wraps existing check)
 */
async function validateExternalTradesRule(data: FightDataForValidation): Promise<ValidationResult> {
  const { participants } = data;

  const hasExternal = participants.some((p) => p.externalTradesDetected);

  if (hasExternal) {
    const violators = participants.filter((p) => p.externalTradesDetected).map((p) => p.userId);

    return {
      passed: false,
      ruleCode: 'EXTERNAL_TRADES',
      ruleName: 'External Trades Detection',
      message: `External trades detected for ${violators.length} participant(s)`,
      metadata: {
        violatorUserIds: violators,
        externalTradeIds: participants
          .filter((p) => p.externalTradesDetected)
          .flatMap((p) => p.externalTradeIds || []),
      },
    };
  }

  return {
    passed: true,
    ruleCode: 'EXTERNAL_TRADES',
    ruleName: 'External Trades Detection',
    message: 'No external trades detected',
  };
}

// ─────────────────────────────────────────────────────────────
// MAIN VALIDATION FUNCTIONS
// ─────────────────────────────────────────────────────────────

/**
 * Validate a completed fight against all anti-cheat rules
 * Called at fight settlement time
 */
export async function validateFightForSettlement(fightId: string): Promise<FightValidationResult> {
  // Load all fight data
  const fight = await prisma.fight.findUnique({
    where: { id: fightId },
    include: {
      participants: {
        include: {
          user: {
            select: { id: true, handle: true },
          },
        },
      },
    },
  });

  if (!fight) {
    throw new Error(`Fight ${fightId} not found`);
  }

  const trades = await prisma.fightTrade.findMany({
    where: { fightId },
  });

  const sessions = await prisma.fightSession.findMany({
    where: { fightId },
  });

  const data: FightDataForValidation = {
    fight,
    participants: fight.participants,
    trades,
    sessions,
  };

  // Run all validators
  const results = await Promise.all([
    validateZeroZeroRule(data),
    validateMinVolumeRule(data),
    validateRepeatedMatchupRule(data),
    validateSameIpPattern(data),
    validateExternalTradesRule(data),
  ]);

  const violations = results.filter((r) => !r.passed);
  const isValid = violations.length === 0;

  // Determine if fight should count for ranking
  // External trades are warnings, don't exclude (handled separately)
  const excludingViolations = violations.filter(
    (v) =>
      ['ZERO_ZERO', 'MIN_VOLUME', 'REPEATED_MATCHUP'].includes(v.ruleCode) ||
      (v.ruleCode === 'SAME_IP_PATTERN' &&
        (v.metadata?.sameIpMatchupCount as number) >= ANTI_CHEAT_CONSTANTS.IP_SAME_PAIR_THRESHOLD)
  );

  return {
    isValid,
    shouldCountForRanking: excludingViolations.length === 0,
    recommendedStatus: excludingViolations.length > 0 ? 'NO_CONTEST' : 'FINISHED',
    violations,
    allChecks: results,
  };
}

/**
 * Check if two users can be matched (pre-matchmaking check)
 * Used to block matchmaking if repeated matchup limit exceeded
 */
export async function canUsersMatch(userAId: string, userBId: string): Promise<MatchmakingCheckResult> {
  const userIds = [userAId, userBId].sort();
  const maxMatchups = ANTI_CHEAT_CONSTANTS.MAX_MATCHUPS_PER_24H;
  const windowHours = ANTI_CHEAT_CONSTANTS.MATCHUP_WINDOW_HOURS;
  const windowStart = new Date(Date.now() - windowHours * 60 * 60 * 1000);

  // Find fights where BOTH users are participants in the time window
  const recentFights = await prisma.fight.findMany({
    where: {
      status: { in: ['FINISHED', 'NO_CONTEST', 'LIVE'] },
      startedAt: { gte: windowStart },
    },
    include: {
      participants: {
        select: { userId: true },
      },
    },
  });

  // Filter to only fights with both users
  const matchupCount = recentFights.filter((f) => {
    const fightUserIds = f.participants.map((p) => p.userId).sort();
    return fightUserIds.length === 2 && fightUserIds[0] === userIds[0] && fightUserIds[1] === userIds[1];
  }).length;

  if (matchupCount >= maxMatchups) {
    return {
      canMatch: false,
      reason: `Matchup limit exceeded: ${matchupCount}/${maxMatchups} in ${windowHours}h`,
      matchupCount,
    };
  }

  return {
    canMatch: true,
    matchupCount,
  };
}

/**
 * Record a fight session (IP/UserAgent) for a user
 */
export async function recordFightSession(
  fightId: string,
  userId: string,
  request: Request,
  sessionType: 'join' | 'trade'
): Promise<void> {
  const ipAddress = extractIpAddress(request);
  const userAgent = extractUserAgent(request);

  await prisma.fightSession.create({
    data: {
      fightId,
      userId,
      ipAddress,
      userAgent,
      sessionType,
    },
  });
}

/**
 * Log an anti-cheat violation to the database
 */
export async function logViolation(
  fightId: string,
  violation: ValidationResult,
  actionTaken: 'NO_CONTEST' | 'FLAGGED'
): Promise<void> {
  await prisma.antiCheatViolation.create({
    data: {
      fightId,
      ruleCode: violation.ruleCode,
      ruleName: violation.ruleName,
      ruleMessage: violation.message,
      metadata: (violation.metadata || {}) as Record<string, string | number | boolean | null>,
      actionTaken,
    },
  });
}

/**
 * Process fight settlement with anti-cheat validation
 * Returns the final status and winner information
 */
export async function settleFightWithAntiCheat(
  fightId: string,
  determinedWinnerId: string | null,
  isDraw: boolean
): Promise<{
  finalStatus: 'FINISHED' | 'NO_CONTEST';
  winnerId: string | null;
  isDraw: boolean;
  violations: ValidationResult[];
}> {
  const validation = await validateFightForSettlement(fightId);

  // Log all violations
  for (const violation of validation.violations) {
    const action = validation.shouldCountForRanking ? 'FLAGGED' : 'NO_CONTEST';
    await logViolation(fightId, violation, action);
  }

  if (!validation.shouldCountForRanking) {
    // Fight excluded from ranking
    return {
      finalStatus: 'NO_CONTEST',
      winnerId: null,
      isDraw: false,
      violations: validation.violations,
    };
  }

  // Fight counts normally
  return {
    finalStatus: 'FINISHED',
    winnerId: determinedWinnerId,
    isDraw,
    violations: validation.violations,
  };
}
