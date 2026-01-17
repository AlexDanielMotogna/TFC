/**
 * Admin: Mark prize pool as distributed
 * POST /api/admin/prize-pool/distribute
 *
 * Call this after manually paying the winners to mark the pool as distributed.
 * Requires admin authentication (TODO: add proper admin auth)
 */
import { prisma, PrizeStatus } from '@tfc/db';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { prizePoolId, adminSecret } = body;

    // Simple admin secret check (replace with proper auth in production)
    if (adminSecret !== process.env.ADMIN_SECRET) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!prizePoolId) {
      return NextResponse.json(
        { success: false, error: 'prizePoolId is required' },
        { status: 400 }
      );
    }

    // Get the prize pool
    const prizePool = await prisma.weeklyPrizePool.findUnique({
      where: { id: prizePoolId },
      include: { prizes: true },
    });

    if (!prizePool) {
      return NextResponse.json(
        { success: false, error: 'Prize pool not found' },
        { status: 404 }
      );
    }

    if (!prizePool.isFinalized) {
      return NextResponse.json(
        { success: false, error: 'Prize pool is not finalized yet' },
        { status: 400 }
      );
    }

    if (prizePool.isDistributed) {
      return NextResponse.json(
        { success: false, error: 'Prize pool already distributed' },
        { status: 400 }
      );
    }

    // Mark pool as distributed
    await prisma.weeklyPrizePool.update({
      where: { id: prizePoolId },
      data: {
        isDistributed: true,
        distributedAt: new Date(),
      },
    });

    // Mark all prizes as distributed
    await prisma.weeklyPrize.updateMany({
      where: { prizePoolId },
      data: {
        status: PrizeStatus.DISTRIBUTED,
        distributedAt: new Date(),
      },
    });

    console.log('[Admin] Prize pool marked as distributed:', {
      prizePoolId,
      weekStart: prizePool.weekStartDate,
      prizesCount: prizePool.prizes.length,
    });

    return NextResponse.json({
      success: true,
      data: {
        prizePoolId,
        weekStartDate: prizePool.weekStartDate,
        totalPrizePool: Number(prizePool.totalPrizePool),
        prizesDistributed: prizePool.prizes.length,
      },
    });
  } catch (error) {
    console.error('[Admin] Error distributing prize pool:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to mark as distributed' },
      { status: 500 }
    );
  }
}
