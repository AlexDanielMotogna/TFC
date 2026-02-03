/**
 * Admin Anti-Cheat Violations API
 * GET /api/admin/anti-cheat/violations - List all violations with pagination
 */
import { withAdminAuth } from '@/lib/server/admin-auth';
import { prisma } from '@/lib/server/db';
import { errorResponse } from '@/lib/server/errors';

export async function GET(request: Request) {
  try {
    return withAdminAuth(request, async () => {
      const { searchParams } = new URL(request.url);
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '20');
      const ruleCode = searchParams.get('ruleCode');
      const actionTaken = searchParams.get('actionTaken');
      const search = searchParams.get('search');
      const skip = (page - 1) * limit;

      // Build where clause
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = {};

      if (ruleCode) {
        where.ruleCode = ruleCode;
      }

      if (actionTaken) {
        where.actionTaken = actionTaken;
      }

      if (search) {
        where.OR = [
          { fightId: { contains: search, mode: 'insensitive' } },
          { ruleCode: { contains: search, mode: 'insensitive' } },
          { ruleName: { contains: search, mode: 'insensitive' } },
          { ruleMessage: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [violations, total] = await Promise.all([
        prisma.antiCheatViolation.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            fight: {
              include: {
                participants: {
                  include: {
                    user: { select: { id: true, handle: true } },
                  },
                },
              },
            },
          },
        }),
        prisma.antiCheatViolation.count({ where }),
      ]);

      return {
        violations: violations.map((v) => ({
          id: v.id,
          fightId: v.fightId,
          ruleCode: v.ruleCode,
          ruleName: v.ruleName,
          ruleMessage: v.ruleMessage,
          actionTaken: v.actionTaken,
          metadata: v.metadata,
          createdAt: v.createdAt,
          fight: {
            status: v.fight.status,
            stakeUsdc: Number(v.fight.stakeUsdc),
            durationMinutes: v.fight.durationMinutes,
            startedAt: v.fight.startedAt,
            endedAt: v.fight.endedAt,
          },
          participants: v.fight.participants.map((p) => ({
            userId: p.userId,
            handle: p.user.handle,
            slot: p.slot,
            finalPnlPercent: p.finalPnlPercent ? Number(p.finalPnlPercent) : null,
          })),
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    });
  } catch (error) {
    return errorResponse(error);
  }
}
