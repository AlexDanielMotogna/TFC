/**
 * Prize Pool endpoint
 * GET /api/prize-pool - Get current week's prize pool and top 3 winners
 * Public endpoint (no auth required)
 */
import { prisma, PrizeStatus } from '@tfc/db';
import { NextResponse } from 'next/server';

// Prize percentages for top 3
const PRIZE_PERCENTAGES = {
  1: 5.0,  // 1st place: 5%
  2: 3.0,  // 2nd place: 3%
  3: 2.0,  // 3rd place: 2%
};

// Get week boundaries (Sunday 00:00:00 UTC to Saturday 23:59:59 UTC)
function getWeekBoundaries(date: Date = new Date()): { start: Date; end: Date } {
  const d = new Date(date);
  // Set to UTC
  d.setUTCHours(0, 0, 0, 0);

  // Get current day of week (0 = Sunday)
  const dayOfWeek = d.getUTCDay();

  // Calculate start of week (Sunday)
  const start = new Date(d);
  start.setUTCDate(d.getUTCDate() - dayOfWeek);

  // Calculate end of week (Saturday 23:59:59.999)
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);

  return { start, end };
}

export async function GET() {
  try {
    const { start: weekStart, end: weekEnd } = getWeekBoundaries();

    // Get or create current week's prize pool
    let prizePool = await prisma.weeklyPrizePool.findUnique({
      where: { weekStartDate: weekStart },
      include: {
        prizes: {
          orderBy: { rank: 'asc' },
        },
      },
    });

    // Calculate current week's builder code fees (0.05% of volume)
    // Builder code fee = notional volume * 0.0005
    const feesResult = await prisma.$queryRaw<[{ builder_fees: number }]>`
      SELECT COALESCE(SUM(amount * price) * 0.0005, 0)::float as builder_fees
      FROM trades
      WHERE executed_at >= ${weekStart} AND executed_at <= ${weekEnd}
    `;
    const totalFees = feesResult[0]?.builder_fees || 0;

    // Total prize pool is 10% of fees (5% + 3% + 2%)
    const totalPrizePool = totalFees * 0.10;

    // Get top 3 from weekly leaderboard
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
            avatarUrl: true,
          },
        },
      },
    });

    // Build prize data
    const prizes = topUsers.map((entry: any) => {
      const rank = entry.rank || 0;
      const percentage = PRIZE_PERCENTAGES[rank as 1 | 2 | 3] || 0;
      const amount = (totalFees * percentage) / 100;

      return {
        rank,
        userId: entry.userId,
        userHandle: entry.user.handle,
        avatarUrl: entry.user.avatarUrl,
        prizePercentage: percentage,
        prizeAmount: amount,
        totalPnlUsdc: Number(entry.totalPnlUsdc),
        totalFights: entry.totalFights,
        wins: entry.wins,
        losses: entry.losses,
        avgPnlPercent: Number(entry.avgPnlPercent),
      };
    });

    // Calculate time remaining in week
    const now = new Date();
    const timeRemainingMs = weekEnd.getTime() - now.getTime();
    const daysRemaining = Math.floor(timeRemainingMs / (1000 * 60 * 60 * 24));
    const hoursRemaining = Math.floor((timeRemainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    return NextResponse.json({
      success: true,
      data: {
        weekStartDate: weekStart.toISOString(),
        weekEndDate: weekEnd.toISOString(),
        totalFeesCollected: totalFees,
        totalPrizePool,
        prizes,
        timeRemaining: {
          days: Math.max(0, daysRemaining),
          hours: Math.max(0, hoursRemaining),
          formatted: `${Math.max(0, daysRemaining)}d ${Math.max(0, hoursRemaining)}h`,
        },
        isFinalized: prizePool?.isFinalized || false,
        isDistributed: prizePool?.isDistributed || false,
      },
    });
  } catch (error) {
    console.error('[Prize Pool] Error fetching prize pool:', error);

    // Return empty state on error
    return NextResponse.json({
      success: true,
      data: {
        weekStartDate: new Date().toISOString(),
        weekEndDate: new Date().toISOString(),
        totalFeesCollected: 0,
        totalPrizePool: 0,
        prizes: [],
        timeRemaining: {
          days: 0,
          hours: 0,
          formatted: '0d 0h',
        },
        isFinalized: false,
        isDistributed: false,
      },
    });
  }
}
