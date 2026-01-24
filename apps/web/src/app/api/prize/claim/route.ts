/**
 * Prize Claim API
 * Allows users to claim their earned weekly prizes
 *
 * POST /api/prize/claim
 * Body: { prizeId: string }
 *
 * Flow:
 * 1. Verify user is authenticated
 * 2. Verify prize belongs to user and status is EARNED
 * 3. Get user's wallet address
 * 4. Check treasury can fulfill claim
 * 5. Execute USDC transfer
 * 6. Update prize status to DISTRIBUTED with txSignature
 */
import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/server/auth';
import { prisma } from '@/lib/server/db';
import { errorResponse, BadRequestError, NotFoundError, ForbiddenError } from '@/lib/server/errors';
import { PrizeStatus } from '@prisma/client';
import * as Treasury from '@/lib/server/treasury';

// Format rank with ordinal suffix
function formatRank(rank: number): string {
  switch (rank) {
    case 1:
      return '1st';
    case 2:
      return '2nd';
    case 3:
      return '3rd';
    default:
      return `${rank}th`;
  }
}

export async function POST(request: NextRequest) {
  try {
    return withAuth(request, async (user) => {
      // Parse request body
      const body = await request.json();
      const { prizeId } = body;

      if (!prizeId) {
        throw new BadRequestError('Prize ID required');
      }

      // Get prize and verify ownership
      const prize = await prisma.weeklyPrize.findUnique({
        where: { id: prizeId },
        include: {
          prizePool: true,
        },
      });

      if (!prize) {
        throw new NotFoundError('Prize not found');
      }

      if (prize.userId !== user.userId) {
        throw new ForbiddenError('This prize does not belong to you');
      }

      // Check prize status
      if (prize.status === PrizeStatus.DISTRIBUTED) {
        throw new BadRequestError('Prize already claimed');
      }

      if (prize.status !== PrizeStatus.EARNED) {
        throw new BadRequestError('Prize is not yet available for claiming. Wait for the week to end.');
      }

      // Get user's wallet address
      const dbUser = await prisma.user.findUnique({
        where: { id: user.userId },
        select: { walletAddress: true },
      });

      if (!dbUser?.walletAddress) {
        throw new BadRequestError('No wallet address associated with your account');
      }

      // Check treasury can fulfill claim
      const prizeAmount = Number(prize.prizeAmount);
      const { canFulfill, reason, balances } = await Treasury.canFulfillClaim(prizeAmount);

      if (!canFulfill) {
        // Log error for admin notification
        console.error('Prize claim failed - insufficient funds:', {
          prizeId,
          userId: user.userId,
          amount: prizeAmount,
          reason,
          balances,
        });

        return Response.json(
          {
            success: false,
            error: 'Technical issue with prize distribution. Please contact support.',
            code: 'INSUFFICIENT_FUNDS',
          },
          { status: 503 }
        );
      }

      // Process the claim (transfer from treasury wallet)
      const transferResult = await Treasury.processClaim(dbUser.walletAddress, prizeAmount);

      if (!transferResult.success) {
        console.error('Prize transfer failed:', {
          prizeId,
          userId: user.userId,
          amount: prizeAmount,
          error: transferResult.error,
        });

        return Response.json(
          {
            success: false,
            error: 'Failed to process prize transfer. Please try again later or contact support.',
            code: 'TRANSFER_FAILED',
          },
          { status: 503 }
        );
      }

      // Update prize status
      const updatedPrize = await prisma.weeklyPrize.update({
        where: { id: prizeId },
        data: {
          status: PrizeStatus.DISTRIBUTED,
          distributedAt: new Date(),
          txSignature: transferResult.signature,
        },
      });

      // Create notification for user
      await prisma.notification.create({
        data: {
          userId: user.userId,
          type: 'PRIZE',
          title: 'Prize Claimed!',
          message: `You have successfully claimed your ${formatRank(prize.rank)} place prize of $${prizeAmount.toFixed(2)} USDC! Tx: ${transferResult.signature?.slice(0, 8)}...`,
        },
      });

      // Check if all prizes for this pool are distributed
      const remainingPrizes = await prisma.weeklyPrize.count({
        where: {
          prizePoolId: prize.prizePoolId,
          status: { not: PrizeStatus.DISTRIBUTED },
        },
      });

      if (remainingPrizes === 0) {
        // All prizes distributed, update pool status
        await prisma.weeklyPrizePool.update({
          where: { id: prize.prizePoolId },
          data: {
            isDistributed: true,
            distributedAt: new Date(),
          },
        });
      }

      return {
        prizeId: updatedPrize.id,
        amount: prizeAmount,
        txSignature: transferResult.signature,
        explorerUrl: `https://solscan.io/tx/${transferResult.signature}`,
      };
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * GET /api/prize/claim
 * Get user's claimable prizes
 */
export async function GET(request: NextRequest) {
  try {
    return withAuth(request, async (user) => {
      // Get all prizes for this user
      const prizes = await prisma.weeklyPrize.findMany({
        where: { userId: user.userId },
        include: {
          prizePool: {
            select: {
              weekStartDate: true,
              weekEndDate: true,
              totalPrizePool: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Get treasury balance info
      const balances = await Treasury.getBalances();

      return {
        prizes: prizes.map((prize) => ({
          id: prize.id,
          rank: prize.rank,
          amount: Number(prize.prizeAmount),
          status: prize.status,
          txSignature: prize.txSignature,
          distributedAt: prize.distributedAt,
          weekStartDate: prize.prizePool.weekStartDate,
          weekEndDate: prize.prizePool.weekEndDate,
          canClaim: prize.status === PrizeStatus.EARNED,
        })),
        treasury: {
          address: Treasury.getTreasuryAddress(),
          availableForClaims: balances.availableForClaims,
        },
      };
    });
  } catch (error) {
    return errorResponse(error);
  }
}
