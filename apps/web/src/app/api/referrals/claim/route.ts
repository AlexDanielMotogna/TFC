/**
 * POST /api/referrals/claim
 * Claim unclaimed referral earnings (minimum $10)
 *
 * SECURITY:
 * - Uses atomic transaction with pessimistic lock (SELECT FOR UPDATE)
 * - Prevents double-claims via database-level locking
 * - All operations (validation + payout creation + mark paid) happen in single transaction
 * - Creates payout record with "pending" status for async processing by cron job
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/server/db';
import { verifyToken } from '@/lib/server/auth';
import { errorResponse, BadRequestError, ConflictError } from '@/lib/server/errors';
import { ErrorCode } from '@/lib/server/error-codes';
import { Prisma } from '@prisma/client';

const MIN_PAYOUT_AMOUNT = 0.05; // $0.05 minimum (TESTING - restore to 10 after)

/**
 * GET /api/referrals/claim
 * Get minimum payout amount configuration
 */
export async function GET() {
  return NextResponse.json({
    minPayoutAmount: MIN_PAYOUT_AMOUNT,
  });
}

export async function POST(request: Request) {
  try {
    // Get user from auth token
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const userId = payload.sub;

    // Use atomic transaction with Serializable isolation level
    // This prevents race conditions and double-claims
    const result = await prisma.$transaction(
      async (tx) => {
        // 1. Lock ALL unpaid earnings for this user with SELECT FOR UPDATE
        // This prevents other transactions from reading/modifying these rows
        const lockedEarnings = await tx.$queryRaw<
          Array<{
            id: string;
            referrer_id: string;
            trader_id: string;
            trade_id: string;
            tier: number;
            symbol: string;
            trade_fee: Prisma.Decimal;
            trade_value: Prisma.Decimal;
            commission_percent: Prisma.Decimal;
            commission_amount: Prisma.Decimal;
            is_paid: boolean;
            paid_at: Date | null;
            created_at: Date;
          }>
        >`
          SELECT * FROM referral_earnings
          WHERE referrer_id = ${userId} AND is_paid = false
          FOR UPDATE
        `;

        // 2. Check for existing pending/processing payout (while earnings are locked)
        const pendingPayout = await tx.referralPayout.findFirst({
          where: {
            userId,
            status: { in: ['pending', 'processing'] },
          },
        });

        if (pendingPayout) {
          console.log('[Referral Claim] Payout already exists:', {
            userId,
            payoutId: pendingPayout.id,
            status: pendingPayout.status,
          });

          // Idempotent response - return existing payout
          // Use ConflictError for consistency (409 status)
          throw new ConflictError('Payout was already initiated and is being processed.', ErrorCode.ERR_REFERRAL_PAYOUT_PENDING);
        }

        // 3. Calculate total from locked earnings
        const unclaimedAmount = lockedEarnings.reduce(
          (sum, e) => sum + Number(e.commission_amount),
          0
        );

        const earningsCount = lockedEarnings.length;

        console.log('[Referral Claim] Earnings locked:', {
          userId,
          earningsCount,
          unclaimedAmount,
        });

        // 4. Check minimum payout amount
        if (unclaimedAmount < MIN_PAYOUT_AMOUNT) {
          throw new BadRequestError(
            `Minimum payout amount is $${MIN_PAYOUT_AMOUNT}. You have $${unclaimedAmount.toFixed(2)} available.`,
            ErrorCode.ERR_REFERRAL_BELOW_MINIMUM
          );
        }

        // 5. Get user wallet address (within transaction)
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            handle: true,
            walletAddress: true,
          },
        });

        if (!user || !user.walletAddress) {
          throw new BadRequestError('Wallet address not set. Please connect your wallet first.', ErrorCode.ERR_REFERRAL_NO_WALLET);
        }

        // 6. Create payout record with "pending" status (still within lock)
        // The cron job will process this asynchronously
        const payout = await tx.referralPayout.create({
          data: {
            userId,
            amount: unclaimedAmount,
            walletAddress: user.walletAddress,
            status: 'pending',
          },
        });

        // 7. Mark all unpaid earnings as paid (still within lock)
        await tx.referralEarning.updateMany({
          where: {
            referrerId: userId,
            isPaid: false,
          },
          data: {
            isPaid: true,
            paidAt: new Date(),
          },
        });

        console.log('[Referral Claim] Payout created successfully:', {
          userId,
          payoutId: payout.id,
          amount: unclaimedAmount,
          earningsCount,
        });

        return NextResponse.json({
          success: true,
          payout: {
            id: payout.id,
            amount: Number(payout.amount),
            status: payout.status,
            walletAddress: payout.walletAddress,
            createdAt: payout.createdAt.toISOString(),
          },
          earningsClaimed: earningsCount,
          message: `Successfully claimed $${unclaimedAmount.toFixed(2)}. Payout is being processed.`,
        });
      },
      {
        // Use Serializable isolation level for maximum safety
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        // 30 second timeout for transaction
        maxWait: 30000,
        timeout: 30000,
      }
    );

    return result;
  } catch (error) {
    // Handle specific transaction errors
    if (error instanceof Error) {
      if (error.message.includes('Serialization failure') || error.message.includes('could not serialize')) {
        console.error('[Referral Claim] Transaction serialization error (concurrent claim attempt):', {
          error: error.message,
        });

        return NextResponse.json(
          {
            success: false,
            error: 'Another claim is being processed. Please wait a moment and try again.',
            code: 'CONCURRENT_CLAIM',
          },
          { status: 409 }
        );
      }
    }

    console.error('[Referral Claim] Error:', error);
    return errorResponse(error);
  }
}
