/**
 * Admin Anti-Cheat Suspicious Users API
 * GET /api/admin/anti-cheat/suspicious-users - Users with multiple violations
 */
import { withAdminAuth } from '@/lib/server/admin-auth';
import { prisma } from '@/lib/server/db';
import { errorResponse } from '@/lib/server/errors';

interface SuspiciousUserRow {
  user_id: string;
  handle: string;
  wallet_address: string | null;
  violation_count: bigint;
  most_common_rule: string;
  last_violation: Date;
}

export async function GET(request: Request) {
  try {
    return withAdminAuth(request, async () => {
      const { searchParams } = new URL(request.url);
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '20');
      const minViolations = parseInt(searchParams.get('minViolations') || '2');
      const offset = (page - 1) * limit;

      // Get users with violations
      const suspiciousUsers = await prisma.$queryRaw<SuspiciousUserRow[]>`
        SELECT
          u.id as user_id,
          u.handle,
          u.wallet_address,
          COUNT(DISTINCT acv.id) as violation_count,
          (
            SELECT acv2.rule_code
            FROM anti_cheat_violations acv2
            JOIN fight_participants fp2 ON fp2.fight_id = acv2.fight_id
            WHERE fp2.user_id = u.id
            GROUP BY acv2.rule_code
            ORDER BY COUNT(*) DESC
            LIMIT 1
          ) as most_common_rule,
          MAX(acv.created_at) as last_violation
        FROM users u
        JOIN fight_participants fp ON fp.user_id = u.id
        JOIN anti_cheat_violations acv ON acv.fight_id = fp.fight_id
        GROUP BY u.id, u.handle, u.wallet_address
        HAVING COUNT(DISTINCT acv.id) >= ${minViolations}
        ORDER BY COUNT(DISTINCT acv.id) DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;

      // Get total count
      const totalResult = await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count FROM (
          SELECT u.id
          FROM users u
          JOIN fight_participants fp ON fp.user_id = u.id
          JOIN anti_cheat_violations acv ON acv.fight_id = fp.fight_id
          GROUP BY u.id
          HAVING COUNT(DISTINCT acv.id) >= ${minViolations}
        ) as suspicious_users
      `;

      const total = Number(totalResult[0]?.count || 0);

      // Get violation breakdown for each user
      const userIds = suspiciousUsers.map((u) => u.user_id);

      const violationBreakdown =
        userIds.length > 0
          ? await prisma.$queryRaw<
              { user_id: string; rule_code: string; count: bigint }[]
            >`
        SELECT
          fp.user_id,
          acv.rule_code,
          COUNT(*) as count
        FROM anti_cheat_violations acv
        JOIN fight_participants fp ON fp.fight_id = acv.fight_id
        WHERE fp.user_id IN (${userIds.join(',')})
        GROUP BY fp.user_id, acv.rule_code
      `.catch(() => [])
          : [];

      // Group breakdown by user
      const breakdownByUser = violationBreakdown.reduce(
        (acc, row) => {
          if (!acc[row.user_id]) {
            acc[row.user_id] = {};
          }
          acc[row.user_id][row.rule_code] = Number(row.count);
          return acc;
        },
        {} as Record<string, Record<string, number>>
      );

      return {
        users: suspiciousUsers.map((u) => ({
          userId: u.user_id,
          handle: u.handle,
          walletAddress: u.wallet_address,
          violationCount: Number(u.violation_count),
          mostCommonRule: u.most_common_rule,
          lastViolation: u.last_violation,
          violationBreakdown: breakdownByUser[u.user_id] || {},
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        filters: {
          minViolations,
        },
      };
    });
  } catch (error) {
    return errorResponse(error);
  }
}
