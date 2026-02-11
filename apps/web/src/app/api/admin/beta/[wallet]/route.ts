/**
 * Admin Beta Whitelist Individual Update API
 * PATCH /api/admin/beta/[wallet] - Update beta status
 */
import { withAdminAuth } from '@/lib/server/admin-auth';
import { prisma } from '@/lib/server/db';
import { errorResponse, NotFoundError, BadRequestError } from '@/lib/server/errors';
import { ErrorCode } from '@/lib/server/error-codes';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ wallet: string }> }
) {
  const { wallet } = await params;

  try {
    return withAdminAuth(request, async (adminUser) => {
      const body = await request.json();
      const { status } = body;

      if (!['approved', 'rejected'].includes(status)) {
        throw new BadRequestError('status must be "approved" or "rejected"', ErrorCode.ERR_VALIDATION_INVALID_PARAMETER);
      }

      const existing = await prisma.betaWhitelist.findUnique({
        where: { walletAddress: wallet },
      });

      if (!existing) {
        throw new NotFoundError('Beta application not found', ErrorCode.ERR_USER_NOT_FOUND);
      }

      const updateData: Record<string, unknown> = { status };

      if (status === 'approved') {
        updateData.approvedAt = new Date();
      } else {
        updateData.approvedAt = null;
      }

      const updated = await prisma.betaWhitelist.update({
        where: { walletAddress: wallet },
        data: updateData,
      });

      console.log(
        `[Admin] Beta ${wallet} ${status} by ${adminUser.userId}`
      );

      return {
        walletAddress: updated.walletAddress,
        status: updated.status,
        approvedAt: updated.approvedAt?.toISOString() || null,
      };
    });
  } catch (error) {
    return errorResponse(error);
  }
}
