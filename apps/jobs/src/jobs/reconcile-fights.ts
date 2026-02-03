import { prisma, FightStatus } from '@tfc/db';
import { createLogger } from '@tfc/logger';
import { LOG_EVENTS, calculateScore, ScoringInput } from '@tfc/shared';

const logger = createLogger({ service: 'job' });

const WEB_API_URL = process.env.WEB_API_URL || 'http://localhost:3001';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'dev-internal-key';

/**
 * Call anti-cheat settle API to get final status
 * This ensures reconciled fights also respect anti-cheat violations
 */
async function callAntiCheatSettle(
  fightId: string,
  winnerId: string | null,
  isDraw: boolean
): Promise<{ finalStatus: 'FINISHED' | 'NO_CONTEST'; winnerId: string | null; isDraw: boolean }> {
  try {
    const response = await fetch(`${WEB_API_URL}/api/internal/anti-cheat/settle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Key': INTERNAL_API_KEY,
      },
      body: JSON.stringify({ fightId, winnerId, isDraw }),
    });

    if (!response.ok) {
      logger.warn(LOG_EVENTS.FIGHT_RECONCILE_TRIGGERED, 'Anti-cheat API failed, defaulting to FINISHED', {
        fightId,
        status: response.status,
      });
      return { finalStatus: 'FINISHED', winnerId, isDraw };
    }

    const result = await response.json();
    return {
      finalStatus: result.finalStatus || 'FINISHED',
      winnerId: result.winnerId ?? winnerId,
      isDraw: result.isDraw ?? isDraw,
    };
  } catch (error) {
    logger.error(LOG_EVENTS.FIGHT_RECONCILE_FAILURE, 'Anti-cheat API error', error as Error);
    return { finalStatus: 'FINISHED', winnerId, isDraw };
  }
}

/**
 * Reconcile LIVE fights that should have ended
 * This is a safety net in case the realtime service misses ending a fight
 */
export async function reconcileFights(): Promise<void> {
  const now = Date.now();

  // Find LIVE fights that should have ended
  const liveFights = await prisma.fight.findMany({
    where: {
      status: FightStatus.LIVE,
      startedAt: { not: null },
    },
    include: {
      participants: true,
    },
  });

  for (const fight of liveFights) {
    if (!fight.startedAt) continue;

    const endTime = fight.startedAt.getTime() + fight.durationMinutes * 60 * 1000;

    // If fight should have ended more than 30 seconds ago, reconcile it
    if (now > endTime + 30000) {
      logger.warn(LOG_EVENTS.FIGHT_RECONCILE_TRIGGERED, 'Reconciling overdue fight', {
        fightId: fight.id,
        expectedEnd: new Date(endTime).toISOString(),
        currentTime: new Date(now).toISOString(),
      });

      await finalizeFight(fight.id, fight.stakeUsdc, fight.participants);
    }
  }
}

async function finalizeFight(
  fightId: string,
  stakeUsdc: number,
  participants: Array<{ userId: string; slot: string }>
) {
  // Calculate final scores for each participant
  const scores: Map<string, { pnlPercent: number; scoreUsdc: number; tradesCount: number }> =
    new Map();

  for (const participant of participants) {
    // Get trades for this participant
    const trades = await prisma.fightTrade.findMany({
      where: {
        fightId,
        participantUserId: participant.userId,
      },
    });

    const realizedPnl = trades.reduce((sum, t) => sum + (t.pnl ? Number(t.pnl) : 0), 0);
    const fees = trades.reduce((sum, t) => sum + Number(t.fee), 0);

    const scoringInput: ScoringInput = {
      stake: stakeUsdc,
      realizedPnl,
      unrealizedPnl: 0, // Not available in reconciliation
      fees,
      funding: 0,
    };

    const score = calculateScore(scoringInput);

    scores.set(participant.userId, {
      pnlPercent: score.pnlPercent * 100,
      scoreUsdc: score.scoreUsdc,
      tradesCount: trades.length,
    });
  }

  // Determine winner
  let winnerId: string | null = null;
  let isDraw = false;

  if (participants.length === 2) {
    const participantA = participants[0];
    const participantB = participants[1];

    if (participantA && participantB) {
      const scoreA = scores.get(participantA.userId);
      const scoreB = scores.get(participantB.userId);

      if (scoreA && scoreB) {
        if (scoreA.pnlPercent > scoreB.pnlPercent) {
          winnerId = participantA.userId;
        } else if (scoreB.pnlPercent > scoreA.pnlPercent) {
          winnerId = participantB.userId;
        } else {
          isDraw = true;
        }
      }
    }
  }

  // Call anti-cheat API to get final status (respects violations like MIN_VOLUME, ZERO_ZERO)
  const antiCheatResult = await callAntiCheatSettle(fightId, winnerId, isDraw);

  // Update fight with anti-cheat result
  // Use updateMany with status check to prevent race conditions with realtime service
  const updateResult = await prisma.fight.updateMany({
    where: {
      id: fightId,
      status: FightStatus.LIVE, // Only update if still LIVE
    },
    data: {
      status: antiCheatResult.finalStatus === 'NO_CONTEST'
        ? FightStatus.NO_CONTEST
        : FightStatus.FINISHED,
      endedAt: new Date(),
      winnerId: antiCheatResult.winnerId,
      isDraw: antiCheatResult.isDraw,
    },
  });

  // If no rows updated, realtime service already handled this fight
  if (updateResult.count === 0) {
    logger.info(LOG_EVENTS.FIGHT_RECONCILE_TRIGGERED, 'Fight already settled by realtime service, skipping', {
      fightId,
    });
    return;
  }

  // Update participants
  for (const participant of participants) {
    const score = scores.get(participant.userId);
    if (score) {
      await prisma.fightParticipant.updateMany({
        where: { fightId, userId: participant.userId },
        data: {
          finalPnlPercent: score.pnlPercent,
          finalScoreUsdc: score.scoreUsdc,
          tradesCount: score.tradesCount,
        },
      });
    }
  }

  logger.info(LOG_EVENTS.FIGHT_RECONCILE_SUCCESS, 'Fight reconciled', {
    fightId,
    finalStatus: antiCheatResult.finalStatus,
    winnerId: antiCheatResult.winnerId,
    isDraw: antiCheatResult.isDraw,
  });
}
