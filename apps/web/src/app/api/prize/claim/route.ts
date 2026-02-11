/**
 * Prize Claim API
 * Allows users to claim their earned weekly prizes
 *
 * POST /api/prize/claim
 * Body: { prizeId: string }
 *
 * SECURITY:
 * - Uses atomic transaction with pessimistic lock (SELECT FOR UPDATE)
 * - Prevents double-claims via database-level locking
 * - All operations (validation + transfer + update) happen in single transaction
 */
import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/server/auth';
import { prisma } from '@/lib/server/db';
import { errorResponse, BadRequestError, NotFoundError, ForbiddenError, ConflictError, ServiceUnavailableError } from '@/lib/server/errors';
import { ErrorCode } from '@/lib/server/error-codes';
import { PrizeStatus, Prisma } from '@prisma/client';
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
    return await withAuth(request, async (user) => {
      // Parse request body
      const body = await request.json();
      const { prizeId } = body;

      if (!prizeId) {
        throw new BadRequestError('Prize ID required');
      }

      // Use atomic transaction with Serializable isolation level
      // This prevents race conditions and double-claims
      return await prisma.$transaction(
        async (tx) => {
          // 1. Lock the prize row with SELECT FOR UPDATE
          // This prevents other transactions from reading/modifying this row
          const lockedPrizes = await tx.$queryRaw<
            Array<{
              id: string;
              prize_pool_id: string;
              user_id: string;
              rank: number;
              prize_amount: Prisma.Decimal;
              status: string;
              distributed_at: Date | null;
              tx_signature: string | null;
            }>
          >`
            SELECT * FROM weekly_prizes
            WHERE id = ${prizeId}
            FOR UPDATE
          `;

          if (!lockedPrizes || lockedPrizes.length === 0) {
            throw new NotFoundError('Prize not found', ErrorCode.ERR_PRIZE_NOT_FOUND);
          }

          const prize = lockedPrizes[0];
          if (!prize) {
            throw new NotFoundError('Prize not found', ErrorCode.ERR_PRIZE_NOT_FOUND);
          }

          // 2. Verify ownership (while row is locked)
          if (prize.user_id !== user.userId) {
            throw new ForbiddenError('This prize does not belong to you', ErrorCode.ERR_PRIZE_NOT_OWNED);
          }

          // 3. Check prize status (now safely locked)
          if (prize.status === PrizeStatus.DISTRIBUTED) {
            // If already distributed, check if it was this user's previous attempt
            if (prize.tx_signature) {
              console.log('[Claim] Prize already claimed:', {
                prizeId,
                userId: user.userId,
                existingTx: prize.tx_signature,
              });

              // Return success with existing transaction (idempotent response)
              return Response.json(
                {
                  success: true,
                  prizeId: prize.id,
                  amount: Number(prize.prize_amount),
                  txSignature: prize.tx_signature,
                  explorerUrl: `https://solscan.io/tx/${prize.tx_signature}`,
                  message: 'Prize was already claimed',
                },
                { status: 200 }
              );
            }

            throw new ConflictError('Prize already claimed', ErrorCode.ERR_PRIZE_ALREADY_CLAIMED);
          }

          if (prize.status !== PrizeStatus.EARNED) {
            throw new BadRequestError('Prize is not yet available for claiming. Wait for the week to end.', ErrorCode.ERR_PRIZE_NOT_AVAILABLE);
          }

          // 4. Get user's wallet address (within transaction)
          const dbUser = await tx.user.findUnique({
            where: { id: user.userId },
            select: { walletAddress: true },
          });

          if (!dbUser?.walletAddress) {
            throw new BadRequestError('No wallet address associated with your account', ErrorCode.ERR_PRIZE_NO_WALLET);
          }

          const prizeAmount = Number(prize.prize_amount);

          // 5. Check treasury can fulfill claim
          const { canFulfill, reason, balances } = await Treasury.canFulfillClaim(prizeAmount);

          if (!canFulfill) {
            console.error('[Claim] Treasury insufficient funds:', {
              prizeId,
              userId: user.userId,
              amount: prizeAmount,
              reason,
              balances,
            });

            throw new ServiceUnavailableError(`Treasury cannot fulfill claim: ${reason}`, ErrorCode.ERR_PRIZE_TREASURY_INSUFFICIENT);
          }

          // 6. Execute USDC transfer
          console.log('[Claim] Processing transfer:', {
            prizeId,
            userId: user.userId,
            amount: prizeAmount,
            wallet: dbUser.walletAddress,
          });

          const transferResult = await Treasury.processClaim(dbUser.walletAddress, prizeAmount);

          if (!transferResult.success) {
            console.error('[Claim] Transfer failed:', {
              prizeId,
              userId: user.userId,
              amount: prizeAmount,
              error: transferResult.error,
            });

            throw new ServiceUnavailableError(`Transfer failed: ${transferResult.error}`, ErrorCode.ERR_PRIZE_TRANSFER_FAILED);
          }

          console.log('[Claim] Transfer successful:', {
            prizeId,
            userId: user.userId,
            signature: transferResult.signature,
          });

          // 7. Update prize status (still within transaction lock)
          const updatedPrize = await tx.weeklyPrize.update({
            where: { id: prizeId },
            data: {
              status: PrizeStatus.DISTRIBUTED,
              distributedAt: new Date(),
              txSignature: transferResult.signature,
            },
          });

          // 8. Create notification for user
          await tx.notification.create({
            data: {
              userId: user.userId,
              type: 'PRIZE',
              title: 'Prize Claimed!',
              message: `You have successfully claimed your ${formatRank(prize.rank)} place prize of $${prizeAmount.toFixed(2)} USDC! Tx: ${transferResult.signature?.slice(0, 8)}...`,
            },
          });

          // 9. Check if all prizes for this pool are distributed
          const remainingPrizes = await tx.weeklyPrize.count({
            where: {
              prizePoolId: prize.prize_pool_id,
              status: { not: PrizeStatus.DISTRIBUTED },
            },
          });

          if (remainingPrizes === 0) {
            // All prizes distributed, update pool status
            await tx.weeklyPrizePool.update({
              where: { id: prize.prize_pool_id },
              data: {
                isDistributed: true,
                distributedAt: new Date(),
              },
            });
          }

          return {
            success: true,
            prizeId: updatedPrize.id,
            amount: prizeAmount,
            txSignature: transferResult.signature,
            explorerUrl: `https://solscan.io/tx/${transferResult.signature}`,
          };
        },
        {
          // Use Serializable isolation level for maximum safety
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          // 30 second timeout for transaction
          maxWait: 30000,
          timeout: 30000,
        }
      );
    });
  } catch (error) {
    // Handle specific transaction errors
    if (error instanceof Error) {
      if (error.message.includes('Serialization failure') || error.message.includes('could not serialize')) {
        console.error('[Claim] Transaction serialization error (likely concurrent claim attempt):', {
          error: error.message,
        });

        return Response.json(
          {
            success: false,
            error: 'Another claim is being processed. Please wait a moment and try again.',
            code: 'CONCURRENT_CLAIM',
          },
          { status: 409 }
        );
      }

      if (error.message.includes('Treasury cannot fulfill') || error.message.includes('Insufficient')) {
        return Response.json(
          {
            success: false,
            error: 'Technical issue with prize distribution. Please contact support.',
            code: 'INSUFFICIENT_FUNDS',
          },
          { status: 503 }
        );
      }

      if (error.message.includes('Transfer failed')) {
        return Response.json(
          {
            success: false,
            error: 'Failed to process prize transfer. Please try again later or contact support.',
            code: 'TRANSFER_FAILED',
          },
          { status: 503 }
        );
      }
    }

    return errorResponse(error);
  }
}

/**
 * GET /api/prize/claim
 * Get user's claimable prizes
 */
export async function GET(request: NextRequest) {
  try {
    return await withAuth(request, async (user) => {
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
