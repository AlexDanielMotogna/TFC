/**
 * Admin Beta Whitelist API
 * GET /api/admin/beta - List all beta applications
 * POST /api/admin/beta/bulk - Bulk approve/reject
 */
import { withAdminAuth } from '@/lib/server/admin-auth';
import { prisma } from '@/lib/server/db';
import { errorResponse, BadRequestError } from '@/lib/server/errors';
import { ErrorCode } from '@/lib/server/error-codes';

export async function GET(request: Request) {
  try {
    return withAdminAuth(request, async () => {
      const { searchParams } = new URL(request.url);
      const status = searchParams.get('status');
      const search = searchParams.get('search');
      const ip = searchParams.get('ip');
      const flaggedOnly = searchParams.get('flagged') === 'true';
      const page = parseInt(searchParams.get('page') || '1', 10);
      const pageSize = parseInt(searchParams.get('pageSize') || '25', 10);

      const where: Record<string, unknown> = {};

      if (status) {
        where.status = status;
      }

      if (search) {
        where.walletAddress = {
          contains: search,
          mode: 'insensitive',
        };
      }

      if (ip) {
        where.ipAddress = ip;
      }

      if (flaggedOnly) {
        where.OR = [
          { multiIpFlag: true },
          { deviceMatchFlag: true },
        ];
      }

      const [applications, total] = await Promise.all([
        prisma.betaWhitelist.findMany({
          where,
          orderBy: { appliedAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.betaWhitelist.count({ where }),
      ]);

      // Get counts by status + flagged count
      const [statusCounts, flaggedCount] = await Promise.all([
        prisma.betaWhitelist.groupBy({
          by: ['status'],
          _count: true,
        }),
        prisma.betaWhitelist.count({
          where: {
            OR: [
              { multiIpFlag: true },
              { deviceMatchFlag: true },
            ],
          },
        }),
      ]);

      const counts = {
        pending: 0,
        approved: 0,
        rejected: 0,
        flagged: flaggedCount,
        total,
      };

      for (const sc of statusCounts) {
        if (sc.status === 'pending') counts.pending = sc._count;
        else if (sc.status === 'approved') counts.approved = sc._count;
        else if (sc.status === 'rejected') counts.rejected = sc._count;
      }

      return {
        applications,
        counts,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      };
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    return withAdminAuth(request, async (adminUser) => {
      const body = await request.json();
      const { walletAddresses, status } = body;

      if (!walletAddresses || !Array.isArray(walletAddresses) || walletAddresses.length === 0) {
        throw new BadRequestError('walletAddresses array is required', ErrorCode.ERR_VALIDATION_MISSING_FIELD);
      }

      if (!['approved', 'rejected'].includes(status)) {
        throw new BadRequestError('status must be "approved" or "rejected"', ErrorCode.ERR_VALIDATION_INVALID_PARAMETER);
      }

      const updateData: Record<string, unknown> = { status };

      if (status === 'approved') {
        updateData.approvedAt = new Date();
      }

      const result = await prisma.betaWhitelist.updateMany({
        where: {
          walletAddress: { in: walletAddresses },
        },
        data: updateData,
      });

      console.log(
        `[Admin] Bulk ${status} ${result.count} beta applications by ${adminUser.userId}`
      );

      return {
        count: result.count,
        status,
        message: `${result.count} applications ${status}`,
      };
    });
  } catch (error) {
    return errorResponse(error);
  }
}
