/**
 * Admin Referral Payout Stats API
 * GET /api/admin/referrals/payouts/stats - Get payout statistics
 */
import { withAdminAuth } from '@/lib/server/admin-auth';
import { prisma } from '@/lib/server/db';
import { errorResponse } from '@/lib/server/errors';

export async function GET(request: Request) {
  try {
    return withAdminAuth(request, async () => {
      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // All time stats
      const allTimeStats = await prisma.referralPayout.aggregate({
        _count: { id: true },
        _sum: { amount: true },
      });

      // Last 24h stats
      const last24hStats = await prisma.referralPayout.aggregate({
        where: {
          createdAt: { gte: last24h },
        },
        _count: { id: true },
        _sum: { amount: true },
      });

      // Last 7d stats
      const last7dStats = await prisma.referralPayout.aggregate({
        where: {
          createdAt: { gte: last7d },
        },
        _count: { id: true },
        _sum: { amount: true },
      });

      // Pending payouts
      const pendingStats = await prisma.referralPayout.aggregate({
        where: {
          status: { in: ['pending', 'processing'] },
        },
        _count: { id: true },
        _sum: { amount: true },
      });

      // Failed payouts (last 24h)
      const failedCount = await prisma.referralPayout.count({
        where: {
          status: 'failed',
          createdAt: { gte: last24h },
        },
      });

      // Completed in last 24h
      const completed24hStats = await prisma.referralPayout.aggregate({
        where: {
          status: 'completed',
          processedAt: { gte: last24h },
        },
        _count: { id: true },
        _sum: { amount: true },
      });

      // Average processing time (for completed payouts in last 24h)
      const completedPayouts = await prisma.referralPayout.findMany({
        where: {
          status: 'completed',
          processedAt: { gte: last24h },
        },
        select: {
          createdAt: true,
          processedAt: true,
        },
      });

      let avgProcessingTime = 0;
      if (completedPayouts.length > 0) {
        const totalMinutes = completedPayouts.reduce((sum, payout) => {
          if (payout.processedAt && payout.createdAt) {
            const minutes =
              (payout.processedAt.getTime() - payout.createdAt.getTime()) / (1000 * 60);
            return sum + minutes;
          }
          return sum;
        }, 0);
        avgProcessingTime = Math.round(totalMinutes / completedPayouts.length);
      }

      return Response.json({
        success: true,
        data: {
          allTime: {
            total: allTimeStats._count.id,
            totalAmount: parseFloat(allTimeStats._sum.amount?.toString() || '0'),
          },
          last24h: {
            total: last24hStats._count.id,
            totalAmount: parseFloat(last24hStats._sum.amount?.toString() || '0'),
          },
          last7d: {
            total: last7dStats._count.id,
            totalAmount: parseFloat(last7dStats._sum.amount?.toString() || '0'),
          },
          pending: {
            count: pendingStats._count.id,
            totalAmount: parseFloat(pendingStats._sum.amount?.toString() || '0'),
          },
          failed: {
            count: failedCount,
          },
          completed24h: {
            count: completed24hStats._count.id,
            totalAmount: parseFloat(completed24hStats._sum.amount?.toString() || '0'),
          },
          avgProcessingTime,
        },
      });
    });
  } catch (error) {
    return errorResponse(error);
  }
}
