import { prisma, FightStatus } from '@tfc/db';
import { createLogger } from '@tfc/logger';
import { LOG_EVENTS, calculateScore, ScoringInput } from '@tfc/shared';

const logger = createLogger({ service: 'job' });

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

  // Update fight
  await prisma.fight.update({
    where: { id: fightId },
    data: {
      status: FightStatus.FINISHED,
      endedAt: new Date(),
      winnerId,
      isDraw,
    },
  });

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
    winnerId,
    isDraw,
  });
}
