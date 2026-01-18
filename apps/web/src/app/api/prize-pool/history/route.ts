/**
 * Prize Pool History endpoint
 * GET /api/prize-pool/history - Get past weeks' prize pools and winners
 * Public endpoint (no auth required)
 */
import { prisma } from '@/lib/server/db';
import { NextResponse } from 'next/server';

// Force dynamic rendering - don't pre-render at build time
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 52);

    // Get finalized prize pools with their prizes
    const prizePools = await prisma.weeklyPrizePool.findMany({
      where: {
        isFinalized: true,
      },
      orderBy: {
        weekStartDate: 'desc',
      },
      take: limit,
      include: {
        prizes: {
          orderBy: { rank: 'asc' },
        },
      },
    });

    const history = prizePools.map((pool: any) => ({
      weekStartDate: pool.weekStartDate.toISOString(),
      weekEndDate: pool.weekEndDate.toISOString(),
      totalFeesCollected: Number(pool.totalFeesCollected),
      totalPrizePool: Number(pool.totalPrizePool),
      isDistributed: pool.isDistributed,
      distributedAt: pool.distributedAt?.toISOString() || null,
      prizes: pool.prizes.map((prize: any) => ({
        rank: prize.rank,
        userHandle: prize.userHandle,
        prizeAmount: Number(prize.prizeAmount),
        prizePercentage: Number(prize.prizePercentage),
        totalPnlUsdc: Number(prize.totalPnlUsdc),
        totalFights: prize.totalFights,
        wins: prize.wins,
        status: prize.status,
      })),
    }));

    return NextResponse.json({
      success: true,
      data: history,
    });
  } catch (error) {
    console.error('[Prize Pool History] Error:', error);

    return NextResponse.json({
      success: true,
      data: [],
    });
  }
}
