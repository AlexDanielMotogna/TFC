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
      // TFC platform fee rate: 0.05% (5 bps) — charged as builder fee on all exchanges
      const TFC_FEE_RATE = 0.0005;

      const [
        totalUsers,
        exchangeConnections,
        fightsByStatus,
        tradeStats,
        activeUsers7dResult,
        volume24hResult,
        volumeAllResult,
        volumeByExchange,
      ] = await Promise.all([
        // Total users
        prisma.user.count(),

        // Connected users per exchange
        prisma.exchangeConnection.groupBy({
          by: ['exchangeType'],
          where: { isActive: true },
          _count: true,
        }),

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

        // Trading volume per exchange (for per-exchange fee breakdown)
        prisma.$queryRaw<Array<{ exchange_type: string; volume: number; trade_count: bigint }>>`
          SELECT
            exchange_type,
            COALESCE(SUM(amount * price), 0)::float as volume,
            COUNT(*) as trade_count
          FROM trades
          GROUP BY exchange_type
        `,
      ]);

      // Transform fights by status to object
      const fightsByStatusObj: Record<string, number> = {};
      for (const item of fightsByStatus) {
        fightsByStatusObj[item.status] = item._count;
      }

      // Connected users per exchange
      const connectedByExchange: Record<string, number> = {};
      for (const item of exchangeConnections) {
        connectedByExchange[item.exchangeType] = item._count;
      }

      const tradingVolumeAll = Number(volumeAllResult[0]?.volume || 0);
      // TFC platform fees = builder fee (0.05%) applied to total volume across all exchanges
      const platformFees = tradingVolumeAll * TFC_FEE_RATE;

      // Per-exchange breakdown
      const exchangeBreakdown: Record<string, { volume: number; trades: number; fees: number }> = {};
      for (const row of volumeByExchange) {
        const vol = Number(row.volume || 0);
        exchangeBreakdown[row.exchange_type] = {
          volume: vol,
          trades: Number(row.trade_count || 0),
          fees: vol * TFC_FEE_RATE,
        };
      }

      return {
        totalUsers,
        activeUsers7d: activeUsers7dResult.length,
        pacificaConnected: connectedByExchange['pacifica'] || 0,
        connectedByExchange,
        fightsByStatus: fightsByStatusObj,
        totalTrades: tradeStats._count,
        totalFees: platformFees,
        tradingVolume24h: Number(volume24hResult[0]?.volume || 0),
        tradingVolumeAll,
        exchangeBreakdown,
      };
    });
  } catch (error) {
    return errorResponse(error);
  }
}
