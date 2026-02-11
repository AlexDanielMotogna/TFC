/**
 * Admin Unban User API
 * POST /api/admin/users/[id]/unban - Unban a user
 */
import { withAdminAuth } from '@/lib/server/admin-auth';
import { prisma } from '@/lib/server/db';
import { errorResponse, NotFoundError, BadRequestError } from '@/lib/server/errors';
import { ErrorCode } from '@/lib/server/error-codes';
import { broadcastUserUpdated } from '@/lib/server/admin-realtime';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    return withAdminAuth(request, async (adminUser) => {
      const user = await prisma.user.findUnique({
        where: { id },
        select: { id: true, status: true },
      });

      if (!user) {
        throw new NotFoundError('User not found', ErrorCode.ERR_USER_NOT_FOUND);
      }

      if (user.status !== 'BANNED') {
        throw new BadRequestError('User is not banned', ErrorCode.ERR_VALIDATION_INVALID_PARAMETER);
      }

      // Update user status
      const updatedUser = await prisma.user.update({
        where: { id },
        data: {
          status: 'ACTIVE',
          bannedAt: null,
          bannedReason: null,
        },
        select: {
          id: true,
          handle: true,
          walletAddress: true,
          role: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      console.log(`[Admin] User ${id} unbanned by ${adminUser.userId}`);

      // Broadcast update
      broadcastUserUpdated(updatedUser);

      return {
        success: true,
        userId: updatedUser.id,
        status: updatedUser.status,
        message: 'User unbanned successfully',
      };
    });
  } catch (error) {
    return errorResponse(error);
  }
}
