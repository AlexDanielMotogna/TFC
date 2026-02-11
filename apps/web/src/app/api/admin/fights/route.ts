/**
 * Admin Fights API
 * GET /api/admin/fights - List fights with pagination and filters
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
      const pageSize = parseInt(searchParams.get('pageSize') || '25', 10);
      const status = searchParams.get('status');
      const dateFrom = searchParams.get('dateFrom');
      const dateTo = searchParams.get('dateTo');

      // Build where clause
      const where: Prisma.FightWhereInput = {};

      if (status) {
        where.status = status as Prisma.EnumFightStatusFilter;
      }

      if (dateFrom || dateTo) {
        where.createdAt = {};
        if (dateFrom) where.createdAt.gte = new Date(dateFrom);
        if (dateTo) where.createdAt.lte = new Date(dateTo);
      }

      // Fetch fights with pagination
      const [fights, total] = await Promise.all([
        prisma.fight.findMany({
          where,
          include: {
            creator: { select: { id: true, handle: true } },
            participants: {
              include: {
                user: { select: { id: true, handle: true } },
              },
            },
            _count: {
              select: { trades: true, snapshots: true, violations: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.fight.count({ where }),
      ]);

      // Transform for response
      const transformedFights = fights.map((fight) => ({
        id: fight.id,
        status: fight.status,
        creator: fight.creator,
        durationMinutes: fight.durationMinutes,
        stakeUsdc: fight.stakeUsdc,
        createdAt: fight.createdAt,
        startedAt: fight.startedAt,
        endedAt: fight.endedAt,
        winnerId: fight.winnerId,
        isDraw: fight.isDraw,
        participants: fight.participants.map((p) => ({
          userId: p.userId,
          handle: p.user.handle,
          slot: p.slot,
          finalPnlPercent: p.finalPnlPercent ? Number(p.finalPnlPercent) : null,
          finalScoreUsdc: p.finalScoreUsdc ? Number(p.finalScoreUsdc) : null,
          tradesCount: p.tradesCount,
          externalTradesDetected: p.externalTradesDetected,
        })),
        tradesCount: fight._count.trades,
        snapshotsCount: fight._count.snapshots,
        violationsCount: fight._count.violations,
        // Calculate time remaining for live fights
        timeRemaining:
          fight.status === 'LIVE' && fight.startedAt
            ? Math.max(
                0,
                fight.durationMinutes * 60 -
                  Math.floor(
                    (Date.now() - new Date(fight.startedAt).getTime()) / 1000
                  )
              )
            : null,
      }));

      return Response.json({
        success: true,
        data: transformedFights,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      });
    });
  } catch (error) {
    return errorResponse(error);
  }
}
