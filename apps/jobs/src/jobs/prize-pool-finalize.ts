import { prisma, PrizeStatus } from '@tfc/db';
import { createLogger } from '@tfc/logger';
import { LOG_EVENTS } from '@tfc/shared';

const logger = createLogger({ service: 'job' });

// Prize percentages for top 3
const PRIZE_PERCENTAGES: Record<number, number> = {
  1: 5.0,  // 1st place: 5%
  2: 3.0,  // 2nd place: 3%
  3: 2.0,  // 3rd place: 2%
};

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

  // Get top 3 from weekly leaderboard (refreshed just before this job)
  const topUsers = await prisma.leaderboardSnapshot.findMany({
    where: {
      range: 'weekly',
      rank: { lte: 3 },
    },
    orderBy: { rank: 'asc' },
    include: {
      user: {
        select: {
          id: true,
          handle: true,
        },
      },
    },
  });

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
    const rank = entry.rank || 0;
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
        userHandle: entry.user.handle,
        status: PrizeStatus.EARNED,
      },
      update: {
        userId: entry.userId,
        prizePercentage: percentage,
        prizeAmount: amount,
        totalPnlUsdc: entry.totalPnlUsdc,
        totalFights: entry.totalFights,
        wins: entry.wins,
        userHandle: entry.user.handle,
        status: PrizeStatus.EARNED,
      },
    });
  }

  logger.info(LOG_EVENTS.PRIZE_POOL_FINALIZE_SUCCESS, 'Prize pool finalized', {
    weekStart: weekStart.toISOString(),
    totalFees,
    totalPrizePool,
    winnersCount: topUsers.length,
    prizes: topUsers.map(u => ({
      rank: u.rank,
      userId: u.userId,
      handle: u.user.handle,
      amount: (totalFees * (PRIZE_PERCENTAGES[u.rank || 0] || 0)) / 100,
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
