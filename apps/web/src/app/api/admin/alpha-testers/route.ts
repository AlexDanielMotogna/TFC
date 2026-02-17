/**
 * Admin Alpha Testers API
 * GET /api/admin/alpha-testers - List all alpha testers
 * POST /api/admin/alpha-testers - Add wallet to alpha testers
 * PATCH /api/admin/alpha-testers - Update alpha tester (access + note)
 * DELETE /api/admin/alpha-testers - Remove alpha tester
 */
import { withAdminAuth } from '@/lib/server/admin-auth';
import { prisma } from '@/lib/server/db';
import { errorResponse, BadRequestError } from '@/lib/server/errors';
import { ErrorCode } from '@/lib/server/error-codes';

export async function GET(request: Request) {
  try {
    return withAdminAuth(request, async () => {
      const { searchParams } = new URL(request.url);
      const search = searchParams.get('search');
      const page = parseInt(searchParams.get('page') || '1', 10);
      const pageSize = parseInt(searchParams.get('pageSize') || '50', 10);

      const where: Record<string, unknown> = {};

      if (search) {
        where.walletAddress = {
          contains: search,
          mode: 'insensitive',
        };
      }

      const [testers, total] = await Promise.all([
        prisma.alphaTester.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.alphaTester.count({ where }),
      ]);

      const enabledCount = await prisma.alphaTester.count({ where: { accessEnabled: true } });

      return {
        testers,
        counts: {
          total,
          enabled: enabledCount,
          disabled: total - enabledCount,
        },
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
      const { walletAddress, note } = body;

      if (!walletAddress || typeof walletAddress !== 'string') {
        throw new BadRequestError('walletAddress is required', ErrorCode.ERR_VALIDATION_MISSING_FIELD);
      }

      const existing = await prisma.alphaTester.findUnique({
        where: { walletAddress },
      });

      if (existing) {
        throw new BadRequestError('Wallet is already an alpha tester', ErrorCode.ERR_VALIDATION_INVALID_PARAMETER);
      }

      const tester = await prisma.alphaTester.create({
        data: {
          walletAddress,
          note: note || null,
          accessEnabled: false,
        },
      });

      console.log(
        `[Admin] Added alpha tester ${walletAddress} by ${adminUser.userId}`
      );

      return tester;
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    return withAdminAuth(request, async (adminUser) => {
      const body = await request.json();
      const { walletAddress, newWalletAddress, accessEnabled, note } = body;

      if (!walletAddress || typeof walletAddress !== 'string') {
        throw new BadRequestError('walletAddress is required', ErrorCode.ERR_VALIDATION_MISSING_FIELD);
      }

      const data: Record<string, unknown> = {};
      if (typeof accessEnabled === 'boolean') data.accessEnabled = accessEnabled;
      if (note !== undefined) data.note = note || null;
      if (newWalletAddress && typeof newWalletAddress === 'string') data.walletAddress = newWalletAddress;

      if (Object.keys(data).length === 0) {
        throw new BadRequestError('Nothing to update', ErrorCode.ERR_VALIDATION_MISSING_FIELD);
      }

      const tester = await prisma.alphaTester.update({
        where: { walletAddress },
        data,
      });

      console.log(
        `[Admin] Updated alpha tester ${walletAddress} by ${adminUser.userId}`
      );

      return tester;
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    return withAdminAuth(request, async (adminUser) => {
      const { searchParams } = new URL(request.url);
      const walletAddress = searchParams.get('walletAddress');

      if (!walletAddress) {
        throw new BadRequestError('walletAddress is required', ErrorCode.ERR_VALIDATION_MISSING_FIELD);
      }

      await prisma.alphaTester.delete({
        where: { walletAddress },
      });

      console.log(
        `[Admin] Removed alpha tester ${walletAddress} by ${adminUser.userId}`
      );

      return { deleted: true, walletAddress };
    });
  } catch (error) {
    return errorResponse(error);
  }
}
