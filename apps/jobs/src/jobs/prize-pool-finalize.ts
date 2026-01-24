import { prisma, PrizeStatus, FightStatus } from '@tfc/db';
import { createLogger } from '@tfc/logger';
import { LOG_EVENTS } from '@tfc/shared';

const logger = createLogger({ service: 'job' });

// Web app URL for internal API calls
const WEB_APP_URL = process.env.WEB_APP_URL || 'http://localhost:3000';
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET;

// Prize percentages for top 3
const PRIZE_PERCENTAGES: Record<number, number> = {
  1: 5.0,  // 1st place: 5%
  2: 3.0,  // 2nd place: 3%
  3: 2.0,  // 3rd place: 2%
};

interface UserStats {
  userId: string;
  userHandle: string;
  totalFights: number;
  wins: number;
  losses: number;
  totalPnlUsdc: number;
}

/**
 * Get week boundaries (Sunday 00:00:00 UTC to Saturday 23:59:59 UTC)
 */
function getWeekBoundaries(date: Date = new Date()): { start: Date; end: Date } {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);

  const dayOfWeek = d.getUTCDay();
  const start = new Date(d);
  start.setUTCDate(d.getUTCDate() - dayOfWeek);

  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);

  return { start, end };
}

/**
 * Get previous week's boundaries
 */
function getPreviousWeekBoundaries(): { start: Date; end: Date } {
  const now = new Date();
  const previousWeek = new Date(now);
  previousWeek.setUTCDate(now.getUTCDate() - 7);
  return getWeekBoundaries(previousWeek);
}

/**
 * Finalize weekly prize pool
 * Called at the start of a new week to finalize the previous week's prizes
 */
export async function finalizePrizePool(): Promise<void> {
  const { start: weekStart, end: weekEnd } = getPreviousWeekBoundaries();

  logger.info(LOG_EVENTS.PRIZE_POOL_FINALIZE_START, 'Starting prize pool finalization', {
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
  });

  // Check if this week has already been finalized
  const existingPool = await prisma.weeklyPrizePool.findUnique({
    where: { weekStartDate: weekStart },
  });

  if (existingPool?.isFinalized) {
    logger.info(LOG_EVENTS.PRIZE_POOL_FINALIZE_SUCCESS, 'Prize pool already finalized', {
      weekStart: weekStart.toISOString(),
    });
    return;
  }

  // Calculate total builder code fees for the week (0.05% of volume)
  const feesResult = await prisma.$queryRaw<[{ builder_fees: number }]>`
    SELECT COALESCE(SUM(amount * price) * 0.0005, 0)::float as builder_fees
    FROM trades
    WHERE executed_at >= ${weekStart} AND executed_at <= ${weekEnd}
  `;
  const totalFees = feesResult[0]?.builder_fees || 0;

  // Total prize pool is 10% of fees
  const totalPrizePool = totalFees * 0.10;

  // Calculate top 3 directly from fights in the previous week
  // (Can't use leaderboard snapshot because it gets refreshed for new week first)
  const participants = await prisma.fightParticipant.findMany({
    where: {
      fight: {
        status: FightStatus.FINISHED,
        startedAt: { gte: weekStart, lte: weekEnd },
      },
    },
    include: {
      fight: {
        select: {
          winnerId: true,
          isDraw: true,
        },
      },
      user: {
        select: {
          id: true,
          handle: true,
        },
      },
    },
  });

  // Aggregate stats by user
  const userStatsMap = new Map<string, UserStats>();

  for (const p of participants) {
    const userId = p.userId;

    if (!userStatsMap.has(userId)) {
      userStatsMap.set(userId, {
        userId,
        userHandle: p.user.handle,
        totalFights: 0,
        wins: 0,
        losses: 0,
        totalPnlUsdc: 0,
      });
    }

    const stats = userStatsMap.get(userId)!;
    stats.totalFights++;

    if (!p.fight.isDraw) {
      if (p.fight.winnerId === userId) {
        stats.wins++;
      } else {
        stats.losses++;
      }
    }

    if (p.finalScoreUsdc) {
      stats.totalPnlUsdc += Number(p.finalScoreUsdc);
    }
  }

  // Get top 3 sorted by PnL
  const topUsers = Array.from(userStatsMap.values())
    .sort((a, b) => b.totalPnlUsdc - a.totalPnlUsdc)
    .slice(0, 3)
    .map((stats, index) => ({
      ...stats,
      rank: index + 1,
    }));

  if (topUsers.length === 0) {
    logger.info(LOG_EVENTS.PRIZE_POOL_NO_WINNERS, 'No winners for this week', {
      weekStart: weekStart.toISOString(),
      totalFees,
    });

    // Still create the pool record to mark as finalized
    await prisma.weeklyPrizePool.upsert({
      where: { weekStartDate: weekStart },
      create: {
        weekStartDate: weekStart,
        weekEndDate: weekEnd,
        totalFeesCollected: totalFees,
        totalPrizePool: 0,
        isFinalized: true,
        finalizedAt: new Date(),
      },
      update: {
        totalFeesCollected: totalFees,
        totalPrizePool: 0,
        isFinalized: true,
        finalizedAt: new Date(),
      },
    });
    return;
  }

  // Create or update the prize pool
  const prizePool = await prisma.weeklyPrizePool.upsert({
    where: { weekStartDate: weekStart },
    create: {
      weekStartDate: weekStart,
      weekEndDate: weekEnd,
      totalFeesCollected: totalFees,
      totalPrizePool,
      isFinalized: true,
      finalizedAt: new Date(),
    },
    update: {
      totalFeesCollected: totalFees,
      totalPrizePool,
      isFinalized: true,
      finalizedAt: new Date(),
    },
  });

  // Create prize records for top 3
  for (const entry of topUsers) {
    const rank = entry.rank;
    const percentage = PRIZE_PERCENTAGES[rank] || 0;
    const amount = (totalFees * percentage) / 100;

    await prisma.weeklyPrize.upsert({
      where: {
        prizePoolId_rank: {
          prizePoolId: prizePool.id,
          rank,
        },
      },
      create: {
        prizePoolId: prizePool.id,
        userId: entry.userId,
        rank,
        prizePercentage: percentage,
        prizeAmount: amount,
        totalPnlUsdc: entry.totalPnlUsdc,
        totalFights: entry.totalFights,
        wins: entry.wins,
        userHandle: entry.userHandle,
        status: PrizeStatus.EARNED,
      },
      update: {
        userId: entry.userId,
        prizePercentage: percentage,
        prizeAmount: amount,
        totalPnlUsdc: entry.totalPnlUsdc,
        totalFights: entry.totalFights,
        wins: entry.wins,
        userHandle: entry.userHandle,
        status: PrizeStatus.EARNED,
      },
    });
  }

  // Withdraw the prize pool from Pacifica in one transaction
  // This saves on Pacifica fees ($1 per withdrawal)
  if (totalPrizePool > 0 && INTERNAL_API_SECRET) {
    try {
      const response = await fetch(`${WEB_APP_URL}/api/internal/treasury/withdraw-for-prizes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${INTERNAL_API_SECRET}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount: totalPrizePool }),
      });

      const result = await response.json() as { success: boolean; error?: string; data?: { withdrawnAmount?: number } };

      if (result.success) {
        logger.info(LOG_EVENTS.TREASURY_WITHDRAW_SUCCESS, 'Prize pool withdrawn from Pacifica', {
          amount: totalPrizePool,
          withdrawnAmount: result.data?.withdrawnAmount,
        });
      } else {
        logger.warn(LOG_EVENTS.TREASURY_WITHDRAW_FAILURE, 'Failed to withdraw prize pool', {
          error: result.error,
          amount: totalPrizePool,
        });
      }
    } catch (error) {
      logger.warn(LOG_EVENTS.TREASURY_WITHDRAW_FAILURE, 'Prize pool withdrawal request failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        amount: totalPrizePool,
      });
    }
  }

  logger.info(LOG_EVENTS.PRIZE_POOL_FINALIZE_SUCCESS, 'Prize pool finalized', {
    weekStart: weekStart.toISOString(),
    totalFees,
    totalPrizePool,
    winnersCount: topUsers.length,
    prizes: topUsers.map(u => ({
      rank: u.rank,
      userId: u.userId,
      handle: u.userHandle,
      amount: (totalFees * (PRIZE_PERCENTAGES[u.rank] || 0)) / 100,
    })),
  });
}

/**
 * Update current week's prize pool (for real-time display)
 * Called periodically to update the current week's pool status
 */
export async function updateCurrentPrizePool(): Promise<void> {
  const { start: weekStart, end: weekEnd } = getWeekBoundaries();

  // Calculate current week's builder code fees (0.05% of volume)
  const feesResult = await prisma.$queryRaw<[{ builder_fees: number }]>`
    SELECT COALESCE(SUM(amount * price) * 0.0005, 0)::float as builder_fees
    FROM trades
    WHERE executed_at >= ${weekStart} AND executed_at <= ${weekEnd}
  `;
  const totalFees = feesResult[0]?.builder_fees || 0;
  const totalPrizePool = totalFees * 0.10;

  // Upsert current week's pool (not finalized)
  await prisma.weeklyPrizePool.upsert({
    where: { weekStartDate: weekStart },
    create: {
      weekStartDate: weekStart,
      weekEndDate: weekEnd,
      totalFeesCollected: totalFees,
      totalPrizePool,
      isFinalized: false,
    },
    update: {
      totalFeesCollected: totalFees,
      totalPrizePool,
    },
  });
}
