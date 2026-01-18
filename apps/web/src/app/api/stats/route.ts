/**
 * Platform statistics endpoint
 * GET /api/stats - Get platform-wide statistics for landing page
 * Public endpoint (no auth required)
 */
import { prisma } from '@/lib/server/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('[Stats] Fetching platform stats...');
    console.log('[Stats] DATABASE_URL exists:', !!process.env.DATABASE_URL);

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
      // Completed fights count (use string literal to avoid @tfc/db import)
      prisma.fight.count({
        where: { status: 'FINISHED' },
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

    console.log('[Stats] Stats fetched successfully:', stats);

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('[Stats] Error fetching stats:', error);
    console.error('[Stats] DATABASE_URL exists:', !!process.env.DATABASE_URL);

    // Return error details for debugging
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : undefined,
      dbUrlExists: !!process.env.DATABASE_URL,
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
