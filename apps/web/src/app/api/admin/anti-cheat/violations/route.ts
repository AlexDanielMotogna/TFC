/**
 * Admin Anti-Cheat Violations API
 * GET /api/admin/anti-cheat/violations - List violations grouped by fight
 */
import { withAdminAuth } from '@/lib/server/admin-auth';
import { prisma } from '@/lib/server/db';
import { errorResponse } from '@/lib/server/errors';

// Priority order for determining fight's overall status
const ACTION_PRIORITY: Record<string, number> = {
  NO_CONTEST: 3,
  FLAGGED: 2,
  RESTORED: 1,
};

function getHighestPriorityAction(actions: string[]): string {
  return actions.reduce((highest, action) => {
    const currentPriority = ACTION_PRIORITY[action] || 0;
    const highestPriority = ACTION_PRIORITY[highest] || 0;
    return currentPriority > highestPriority ? action : highest;
  }, actions[0] || 'UNKNOWN');
}

export async function GET(request: Request) {
  try {
    return withAdminAuth(request, async () => {
      const { searchParams } = new URL(request.url);
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '20');
      const ruleCode = searchParams.get('ruleCode');
      const actionTaken = searchParams.get('actionTaken');
      const search = searchParams.get('search');

      // Build where clause for violations
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

      // Get all violations matching criteria
      const allViolations = await prisma.antiCheatViolation.findMany({
        where,
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
      });

      // Group violations by fightId
      const fightViolationsMap = new Map<
        string,
        {
          fightId: string;
          fight: {
            status: string;
            stakeUsdc: number;
            durationMinutes: number;
            startedAt: Date | null;
            endedAt: Date | null;
          };
          participants: {
            userId: string;
            handle: string;
            slot: string;
            finalPnlPercent: number | null;
          }[];
          violations: {
            id: string;
            ruleCode: string;
            ruleName: string;
            ruleMessage: string;
            actionTaken: string;
            metadata: unknown;
            createdAt: Date;
          }[];
          latestViolation: Date;
          overallAction: string;
        }
      >();

      for (const v of allViolations) {
        if (!fightViolationsMap.has(v.fightId)) {
          fightViolationsMap.set(v.fightId, {
            fightId: v.fightId,
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
            violations: [],
            latestViolation: v.createdAt,
            overallAction: v.actionTaken,
          });
        }

        const fightData = fightViolationsMap.get(v.fightId)!;
        fightData.violations.push({
          id: v.id,
          ruleCode: v.ruleCode,
          ruleName: v.ruleName,
          ruleMessage: v.ruleMessage,
          actionTaken: v.actionTaken,
          metadata: v.metadata,
          createdAt: v.createdAt,
        });

        // Update latest violation timestamp
        if (v.createdAt > fightData.latestViolation) {
          fightData.latestViolation = v.createdAt;
        }
      }

      // Calculate overall action for each fight based on priority
      for (const fightData of fightViolationsMap.values()) {
        const actions = fightData.violations.map((v) => v.actionTaken);
        fightData.overallAction = getHighestPriorityAction(actions);
      }

      // Convert to array and sort by latest violation
      const groupedFights = Array.from(fightViolationsMap.values()).sort(
        (a, b) => b.latestViolation.getTime() - a.latestViolation.getTime()
      );

      // Apply pagination to grouped fights
      const total = groupedFights.length;
      const skip = (page - 1) * limit;
      const paginatedFights = groupedFights.slice(skip, skip + limit);

      return {
        fights: paginatedFights.map((f) => ({
          fightId: f.fightId,
          fight: f.fight,
          participants: f.participants,
          violations: f.violations.map((v) => ({
            ...v,
            createdAt: v.createdAt.toISOString(),
          })),
          violationCount: f.violations.length,
          latestViolation: f.latestViolation.toISOString(),
          overallAction: f.overallAction,
          // Group violations by rule for summary
          rulesSummary: f.violations.reduce(
            (acc, v) => {
              acc[v.ruleCode] = (acc[v.ruleCode] || 0) + 1;
              return acc;
            },
            {} as Record<string, number>
          ),
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
