/**
 * Admin Stats API
 * GET /api/admin/stats - Get aggregated platform statistics
 */
import { withAdminAuth } from '@/lib/server/admin-auth';
import { prisma } from '@/lib/server/db';
import { errorResponse } from '@/lib/server/errors';

export async function GET(request: Request) {
  try {
    return withAdminAuth(request, async () => {
      // Calculate date boundaries
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Run all queries in parallel
      const [
        totalUsers,
        pacificaConnected,
        fightsByStatus,
        tradeStats,
        activeUsers7dResult,
        volume24hResult,
        volumeAllResult,
      ] = await Promise.all([
        // Total users
        prisma.user.count(),

        // Pacifica connected users
        prisma.pacificaConnection.count({ where: { isActive: true } }),

        // Fights by status
        prisma.fight.groupBy({
          by: ['status'],
          _count: true,
        }),

        // Trade stats
        prisma.trade.aggregate({
          _sum: { fee: true },
          _count: true,
        }),

        // Active users in last 7 days (users with trades)
        prisma.trade.groupBy({
          by: ['userId'],
          where: {
            createdAt: { gte: sevenDaysAgo },
          },
        }),

        // Trading volume 24h
        prisma.$queryRaw<[{ volume: bigint | null }]>`
          SELECT COALESCE(SUM(amount * price), 0) as volume
          FROM trades
          WHERE created_at >= ${twentyFourHoursAgo}
        `,

        // Trading volume all time
        prisma.$queryRaw<[{ volume: bigint | null }]>`
          SELECT COALESCE(SUM(amount * price), 0) as volume
          FROM trades
        `,
      ]);

      // Transform fights by status to object
      const fightsByStatusObj: Record<string, number> = {};
      for (const item of fightsByStatus) {
        fightsByStatusObj[item.status] = item._count;
      }

      return {
        totalUsers,
        activeUsers7d: activeUsers7dResult.length,
        pacificaConnected,
        fightsByStatus: fightsByStatusObj,
        totalTrades: tradeStats._count,
        totalFees: Number(tradeStats._sum.fee || 0),
        tradingVolume24h: Number(volume24hResult[0]?.volume || 0),
        tradingVolumeAll: Number(volumeAllResult[0]?.volume || 0),
      };
    });
  } catch (error) {
    return errorResponse(error);
  }
}
