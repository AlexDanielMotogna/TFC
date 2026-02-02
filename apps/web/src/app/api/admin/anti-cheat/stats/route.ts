/**
 * Admin Anti-Cheat Stats API
 * GET /api/admin/anti-cheat/stats - Get violation statistics
 */
import { withAdminAuth } from '@/lib/server/admin-auth';
import { prisma } from '@/lib/server/db';
import { errorResponse } from '@/lib/server/errors';

export async function GET(request: Request) {
  try {
    return withAdminAuth(request, async () => {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Get total violations count
      const [totalViolations, violations24h, violations7d] = await Promise.all([
        prisma.antiCheatViolation.count(),
        prisma.antiCheatViolation.count({
          where: { createdAt: { gte: oneDayAgo } },
        }),
        prisma.antiCheatViolation.count({
          where: { createdAt: { gte: sevenDaysAgo } },
        }),
      ]);

      // Get violations by rule
      const violationsByRule = await prisma.antiCheatViolation.groupBy({
        by: ['ruleCode'],
        _count: { id: true },
      });

      // Get violations by action taken
      const violationsByAction = await prisma.antiCheatViolation.groupBy({
        by: ['actionTaken'],
        _count: { id: true },
      });

      // Get total finished fights and NO_CONTEST fights for rate calculation
      const [totalFinishedFights, noContestFights] = await Promise.all([
        prisma.fight.count({
          where: { status: { in: ['FINISHED', 'NO_CONTEST'] } },
        }),
        prisma.fight.count({
          where: { status: 'NO_CONTEST' },
        }),
      ]);

      const noContestRate =
        totalFinishedFights > 0
          ? ((noContestFights / totalFinishedFights) * 100).toFixed(2)
          : '0.00';

      // Get users with multiple violations (suspicious users count)
      const suspiciousUsers = await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(DISTINCT user_id) as count
        FROM (
          SELECT fp.user_id, COUNT(*) as violation_count
          FROM anti_cheat_violations acv
          JOIN fight_participants fp ON fp.fight_id = acv.fight_id
          GROUP BY fp.user_id
          HAVING COUNT(*) >= 2
        ) as suspicious
      `;

      const suspiciousUsersCount = Number(suspiciousUsers[0]?.count || 0);

      // Recent violations (last 10)
      const recentViolations = await prisma.antiCheatViolation.findMany({
        take: 10,
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

      return {
        totalViolations,
        violations24h,
        violations7d,
        violationsByRule: violationsByRule.reduce(
          (acc, v) => ({
            ...acc,
            [v.ruleCode]: v._count.id,
          }),
          {} as Record<string, number>
        ),
        violationsByAction: violationsByAction.reduce(
          (acc, v) => ({
            ...acc,
            [v.actionTaken]: v._count.id,
          }),
          {} as Record<string, number>
        ),
        noContestRate: parseFloat(noContestRate),
        totalNoContestFights: noContestFights,
        totalCompletedFights: totalFinishedFights,
        suspiciousUsersCount,
        recentViolations: recentViolations.map((v) => ({
          id: v.id,
          fightId: v.fightId,
          ruleCode: v.ruleCode,
          ruleName: v.ruleName,
          ruleMessage: v.ruleMessage,
          actionTaken: v.actionTaken,
          createdAt: v.createdAt,
          participants: v.fight.participants.map((p) => ({
            userId: p.userId,
            handle: p.user.handle,
            slot: p.slot,
          })),
        })),
      };
    });
  } catch (error) {
    return errorResponse(error);
  }
}
