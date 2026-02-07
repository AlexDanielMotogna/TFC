/**
 * Admin Referral Payout Details API
 * GET /api/admin/referrals/payouts/[id] - Get detailed information about a specific payout
 */
import { withAdminAuth } from '@/lib/server/admin-auth';
import { prisma } from '@/lib/server/db';
import { errorResponse, NotFoundError } from '@/lib/server/errors';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    return withAdminAuth(request, async () => {
      const payoutId = params.id;

      // Fetch payout with user info
      const payout = await prisma.referralPayout.findUnique({
        where: { id: payoutId },
      });

      if (!payout) {
        throw new NotFoundError('Payout not found');
      }

      // Fetch user info
      const user = await prisma.user.findUnique({
        where: { id: payout.userId },
        select: { id: true, handle: true, walletAddress: true },
      });

      // Fetch related earnings that were claimed in this payout
      // Earnings are marked as paid at the same time the payout is created
      const relatedEarnings = await prisma.referralEarning.findMany({
        where: {
          referrerId: payout.userId,
          isPaid: true,
          // Find earnings paid around the time of payout creation (within 1 second)
          paidAt: {
            gte: new Date(payout.createdAt.getTime() - 1000),
            lte: new Date(payout.createdAt.getTime() + 1000),
          },
        },
        orderBy: { earnedAt: 'desc' },
        take: 50, // Limit to 50 earnings for performance
      });

      // Fetch trader information separately
      const traderIds = [...new Set(relatedEarnings.map((e) => e.traderId))];
      const traders = await prisma.user.findMany({
        where: { id: { in: traderIds } },
        select: { id: true, handle: true },
      });
      const traderMap = new Map(traders.map((t) => [t.id, t]));

      // Calculate retry information
      const now = new Date();
      const ageMinutes = Math.floor((now.getTime() - payout.createdAt.getTime()) / (1000 * 60));

      let estimatedRetryCount = 0;
      let nextRetryTime = null;

      if (payout.status === 'failed' && payout.processedAt) {
        const timeSinceLastAttempt = Math.floor(
          (now.getTime() - payout.processedAt.getTime()) / (1000 * 60)
        );

        // Retry logic from the processor:
        // Attempt 1: Immediate (0 min delay)
        // Attempt 2: 15 min delay
        // Attempt 3: 60 min delay
        if (timeSinceLastAttempt < 15) {
          estimatedRetryCount = 1;
          nextRetryTime = new Date(payout.processedAt.getTime() + 15 * 60 * 1000);
        } else if (timeSinceLastAttempt < 60) {
          estimatedRetryCount = 2;
          nextRetryTime = new Date(payout.processedAt.getTime() + 60 * 60 * 1000);
        } else {
          estimatedRetryCount = 3; // Max retries reached
        }

        // If payout is older than 24 hours, processor won't retry anymore
        if (ageMinutes > 24 * 60) {
          nextRetryTime = null;
        }
      }

      // Transform related earnings
      const transformedEarnings = relatedEarnings.map((earning) => {
        const trader = traderMap.get(earning.traderId);
        return {
          id: earning.id,
          traderId: earning.traderId,
          traderHandle: trader?.handle || 'Unknown',
          tradeId: earning.tradeId,
          symbol: earning.symbol,
          commissionAmount: parseFloat(earning.commissionAmount.toString()),
          commissionPercent: parseFloat(earning.commissionPercent.toString()),
          earnedAt: earning.earnedAt,
        };
      });

      return Response.json({
        success: true,
        data: {
          payout: {
            id: payout.id,
            userId: payout.userId,
            userHandle: user?.handle || 'Unknown',
            walletAddress: payout.walletAddress,
            amount: parseFloat(payout.amount.toString()),
            status: payout.status,
            txSignature: payout.txSignature,
            createdAt: payout.createdAt,
            processedAt: payout.processedAt,
          },
          relatedEarnings: transformedEarnings,
          retryInfo: {
            estimatedRetryCount,
            nextRetryTime,
            ageMinutes,
            maxRetriesReached: estimatedRetryCount >= 3,
            tooOldForRetry: ageMinutes > 24 * 60,
          },
        },
      });
    });
  } catch (error) {
    return errorResponse(error);
  }
}
