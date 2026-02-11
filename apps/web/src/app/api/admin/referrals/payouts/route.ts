/**
 * Admin Referral Payouts API
 * GET /api/admin/referrals/payouts - List all payouts with filters and pagination
 */
import { withAdminAuth } from '@/lib/server/admin-auth';
import { prisma } from '@/lib/server/db';
import { errorResponse } from '@/lib/server/errors';
import { Prisma } from '@prisma/client';

export async function GET(request: Request) {
  try {
    return withAdminAuth(request, async () => {
      const { searchParams } = new URL(request.url);
      const page = parseInt(searchParams.get('page') || '1', 10);
      const limit = parseInt(searchParams.get('limit') || '50', 10);
      const status = searchParams.get('status');
      const dateFrom = searchParams.get('dateFrom');
      const dateTo = searchParams.get('dateTo');
      const amountMin = searchParams.get('amountMin');
      const amountMax = searchParams.get('amountMax');
      const userId = searchParams.get('userId');
      const search = searchParams.get('search');

      // Build where clause
      const where: Prisma.ReferralPayoutWhereInput = {};

      // Filter by status
      if (status && ['pending', 'processing', 'completed', 'failed'].includes(status)) {
        where.status = status;
      }

      // Filter by date range
      if (dateFrom || dateTo) {
        where.createdAt = {};
        if (dateFrom) {
          where.createdAt.gte = new Date(dateFrom);
        }
        if (dateTo) {
          where.createdAt.lte = new Date(dateTo);
        }
      }

      // Filter by amount range
      if (amountMin || amountMax) {
        where.amount = {};
        if (amountMin) {
          where.amount.gte = parseFloat(amountMin);
        }
        if (amountMax) {
          where.amount.lte = parseFloat(amountMax);
        }
      }

      // Filter by user ID
      if (userId) {
        where.userId = userId;
      }

      // Search by payout ID, wallet address, or tx signature
      if (search) {
        where.OR = [
          { id: { contains: search, mode: 'insensitive' } },
          { walletAddress: { contains: search, mode: 'insensitive' } },
          { txSignature: { contains: search, mode: 'insensitive' } },
        ];
      }

      // Fetch payouts with pagination
      const [payouts, total] = await Promise.all([
        prisma.referralPayout.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.referralPayout.count({ where }),
      ]);

      // Fetch user data for all payouts
      const userIds = [...new Set(payouts.map((p) => p.userId))];
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, handle: true, walletAddress: true },
      });

      const userMap = new Map(users.map((u) => [u.id, u]));

      // Transform for response
      const transformedPayouts = payouts.map((payout) => {
        const user = userMap.get(payout.userId);
        const processingTimeMinutes =
          payout.processedAt && payout.createdAt
            ? Math.round(
                (payout.processedAt.getTime() - payout.createdAt.getTime()) / (1000 * 60)
              )
            : null;

        return {
          id: payout.id,
          userId: payout.userId,
          userHandle: user?.handle || 'Unknown',
          walletAddress: payout.walletAddress,
          amount: parseFloat(payout.amount.toString()),
          status: payout.status,
          txSignature: payout.txSignature,
          createdAt: payout.createdAt,
          processedAt: payout.processedAt,
          processingTimeMinutes,
        };
      });

      return Response.json({
        success: true,
        payouts: transformedPayouts,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    });
  } catch (error) {
    return errorResponse(error);
  }
}
