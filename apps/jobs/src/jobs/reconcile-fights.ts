import {
  prisma,
  FightStatus,
  acquireSettlementLock,
  releaseSettlementLock,
  SETTLEMENT_LOCK_TIMEOUT_MS,
  SETTLEMENT_LOCK_PREFIX,
} from '@tfc/db';
import { createLogger } from '@tfc/logger';
import { LOG_EVENTS, calculateScore, ScoringInput } from '@tfc/shared';

const logger = createLogger({ service: 'job' });

// Process identifier for this job (used for distributed lock)
const PROCESS_ID = SETTLEMENT_LOCK_PREFIX.JOB_RECONCILE;

// Buffer time after fight should have ended before reconciling
// Increased from 30s to 60s to give realtime service more time
const RECONCILE_BUFFER_MS = 60000;

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

    const result = await response.json() as {
      finalStatus?: 'FINISHED' | 'NO_CONTEST';
      winnerId?: string | null;
      isDraw?: boolean;
    };
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
 *
 * Uses distributed lock (settling_at/settling_by fields) to prevent race conditions
 * with the realtime FightEngine.
 * @see docs/Agents/Fight-Enginer-Scanner.md
 */
export async function reconcileFights(): Promise<void> {
  const now = Date.now();
  const lockTimeout = new Date(now - SETTLEMENT_LOCK_TIMEOUT_MS);

  // Find LIVE fights that should have ended AND don't have an active lock
  // This prevents race conditions with the realtime service
  const liveFights = await prisma.fight.findMany({
    where: {
      status: FightStatus.LIVE,
      startedAt: { not: null },
      // Only consider fights without an active lock
      OR: [
        { settlingAt: null },
        { settlingAt: { lt: lockTimeout } }, // Lock expired
      ],
    },
    include: {
      participants: true,
    },
  });

  logger.info(LOG_EVENTS.FIGHT_RECONCILE_TRIGGERED, 'Checking for overdue fights', {
    foundCount: liveFights.length,
    bufferMs: RECONCILE_BUFFER_MS,
  });

  for (const fight of liveFights) {
    if (!fight.startedAt) continue;

    const endTime = fight.startedAt.getTime() + fight.durationMinutes * 60 * 1000;

    // If fight should have ended more than RECONCILE_BUFFER_MS ago, reconcile it
    if (now > endTime + RECONCILE_BUFFER_MS) {
      // Try to acquire the distributed lock
      const lockResult = await acquireSettlementLock(prisma, fight.id, PROCESS_ID);

      if (!lockResult.acquired) {
        logger.info(LOG_EVENTS.FIGHT_RECONCILE_TRIGGERED, 'Fight being settled by another process, skipping', {
          fightId: fight.id,
          settlingBy: lockResult.settlingBy,
          fightStatus: lockResult.fightStatus,
        });
        continue;
      }

      logger.warn(LOG_EVENTS.FIGHT_RECONCILE_TRIGGERED, 'Reconciling overdue fight (lock acquired)', {
        fightId: fight.id,
        expectedEnd: new Date(endTime).toISOString(),
        currentTime: new Date(now).toISOString(),
        overdueMs: now - endTime,
      });

      try {
        await finalizeFight(fight.id, fight.stakeUsdc, fight.participants);
      } catch (error) {
        // Release lock on error
        await releaseSettlementLock(prisma, fight.id, PROCESS_ID);
        logger.error(LOG_EVENTS.FIGHT_RECONCILE_FAILURE, 'Failed to finalize fight', error as Error, {
          fightId: fight.id,
        });
      }
    }
  }
}

/**
 * Finalize a fight that was missed by the realtime service.
 * Uses atomic transaction to update participants and fight together.
 * Lock is acquired before this function is called.
 */
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

  // Use atomic transaction to:
  // 1. Verify we still hold the lock
  // 2. Update participants
  // 3. Update fight status
  // 4. Clear the lock
  const result = await prisma.$transaction(async (tx) => {
    // Verify we still hold the lock
    const currentFight = await tx.fight.findUnique({
      where: { id: fightId },
      select: { status: true, settlingBy: true },
    });

    if (!currentFight) {
      return { success: false, reason: 'fight_not_found' };
    }

    if (currentFight.status !== FightStatus.LIVE) {
      return { success: false, reason: 'already_settled', currentStatus: currentFight.status };
    }

    if (currentFight.settlingBy !== PROCESS_ID) {
      return { success: false, reason: 'lock_stolen', lockHolder: currentFight.settlingBy };
    }

    // Update participants
    for (const participant of participants) {
      const score = scores.get(participant.userId);
      if (score) {
        await tx.fightParticipant.updateMany({
          where: { fightId, userId: participant.userId },
          data: {
            finalPnlPercent: score.pnlPercent,
            finalScoreUsdc: score.scoreUsdc,
            tradesCount: score.tradesCount,
          },
        });
      }
    }

    // Update fight and clear lock
    await tx.fight.update({
      where: { id: fightId },
      data: {
        status: antiCheatResult.finalStatus === 'NO_CONTEST'
          ? FightStatus.NO_CONTEST
          : FightStatus.FINISHED,
        endedAt: new Date(),
        winnerId: antiCheatResult.winnerId,
        isDraw: antiCheatResult.isDraw,
        settlingAt: null, // Clear the lock
        settlingBy: null,
      },
    });

    return { success: true };
  });

  if (!result.success) {
    logger.info(LOG_EVENTS.FIGHT_RECONCILE_TRIGGERED, 'Fight settlement transaction failed', {
      fightId,
      reason: result.reason,
      ...(result.currentStatus && { currentStatus: result.currentStatus }),
      ...(result.lockHolder && { lockHolder: result.lockHolder }),
    });
    return;
  }

  logger.info(LOG_EVENTS.FIGHT_RECONCILE_SUCCESS, 'Fight reconciled successfully', {
    fightId,
    finalStatus: antiCheatResult.finalStatus,
    winnerId: antiCheatResult.winnerId,
    isDraw: antiCheatResult.isDraw,
  });
}
