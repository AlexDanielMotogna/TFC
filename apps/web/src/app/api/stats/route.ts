/**
 * Platform statistics endpoint
 * GET /api/stats - Get platform-wide statistics for landing page
 * Public endpoint (no auth required)
 */
import { prisma, FightStatus } from '@tfc/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Get all stats in parallel for performance
    const [
      volumeResult,
      fightsCount,
      fightVolumeResult,
      totalFeesResult,
      activeUsersCount,
      totalTradesCount,
    ] = await Promise.all([
      // Total trading volume (sum of notional values)
      prisma.$queryRaw<[{ total_volume: number }]>`
        SELECT COALESCE(SUM(amount * price), 0)::float as total_volume FROM trades
      `,
      // Completed fights count
      prisma.fight.count({
        where: { status: FightStatus.FINISHED },
      }),
      // Fight volume (sum of notional values from fight trades)
      prisma.$queryRaw<[{ fight_volume: number }]>`
        SELECT COALESCE(SUM(amount * price), 0)::float as fight_volume
        FROM fight_trades
      `,
      // Total fees collected
      prisma.$queryRaw<[{ total_fees: number }]>`
        SELECT COALESCE(SUM(fee), 0)::float as total_fees FROM trades
      `,
      // Unique active users (users who have traded)
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(DISTINCT user_id) as count FROM trades
      `,
      // Total trades executed
      prisma.trade.count(),
    ]);

    const stats = {
      tradingVolume: volumeResult[0]?.total_volume || 0,
      fightVolume: fightVolumeResult[0]?.fight_volume || 0,
      fightsCompleted: fightsCount,
      totalFees: totalFeesResult[0]?.total_fees || 0,
      activeUsers: Number(activeUsersCount[0]?.count || 0),
      totalTrades: totalTradesCount,
    };

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('[Stats] Error fetching stats:', error);

    // Return zeros if there's an error (e.g., table doesn't exist yet)
    return NextResponse.json({
      success: true,
      data: {
        tradingVolume: 0,
        fightVolume: 0,
        fightsCompleted: 0,
        totalFees: 0,
        activeUsers: 0,
        totalTrades: 0,
      },
    });
  }
}
