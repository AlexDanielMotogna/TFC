/**
 * Admin: Mark prize pool as distributed
 * POST /api/admin/prize-pool/distribute
 *
 * Call this after manually paying the winners to mark the pool as distributed.
 * Requires admin authentication (TODO: add proper admin auth)
 */
import { prisma, PrizeStatus } from '@tfc/db';
import { NextResponse } from 'next/server';
import { errorResponse, UnauthorizedError, BadRequestError, NotFoundError, ConflictError } from '@/lib/server/errors';
import { ErrorCode } from '@/lib/server/error-codes';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { prizePoolId, adminSecret } = body;

    // Simple admin secret check (replace with proper auth in production)
    if (adminSecret !== process.env.ADMIN_SECRET) {
      throw new UnauthorizedError('Unauthorized', ErrorCode.ERR_AUTH_UNAUTHORIZED);
    }

    if (!prizePoolId) {
      throw new BadRequestError('prizePoolId is required', ErrorCode.ERR_VALIDATION_MISSING_FIELD);
    }

    // Get the prize pool
    const prizePool = await prisma.weeklyPrizePool.findUnique({
      where: { id: prizePoolId },
      include: { prizes: true },
    });

    if (!prizePool) {
      throw new NotFoundError('Prize pool not found', ErrorCode.ERR_PRIZE_NOT_FOUND);
    }

    if (!prizePool.isFinalized) {
      throw new BadRequestError('Prize pool is not finalized yet', ErrorCode.ERR_PRIZE_NOT_FINALIZED);
    }

    if (prizePool.isDistributed) {
      throw new ConflictError('Prize pool already distributed', ErrorCode.ERR_PRIZE_ALREADY_DISTRIBUTED);
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
    return errorResponse(error);
  }
}
