/**
 * Admin Ban User API
 * POST /api/admin/users/[id]/ban - Ban a user
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
      const body = await request.json().catch(() => ({}));
      const { reason } = body;

      // Prevent self-ban
      if (adminUser.userId === id) {
        throw new BadRequestError('Cannot ban yourself', ErrorCode.ERR_USER_CANNOT_BAN_SELF);
      }

      const user = await prisma.user.findUnique({
        where: { id },
        select: { id: true, status: true, role: true },
      });

      if (!user) {
        throw new NotFoundError('User not found', ErrorCode.ERR_USER_NOT_FOUND);
      }

      if (user.status === 'BANNED') {
        throw new BadRequestError('User is already banned', ErrorCode.ERR_USER_CANNOT_BAN_SELF);
      }

      // Prevent banning other admins
      if (user.role === 'ADMIN') {
        throw new BadRequestError('Cannot ban an admin user', ErrorCode.ERR_USER_CANNOT_BAN_ADMIN);
      }

      // Cancel any active fights
      const cancelledFights = await prisma.fight.updateMany({
        where: {
          status: { in: ['WAITING', 'LIVE'] },
          participants: {
            some: { userId: id },
          },
        },
        data: {
          status: 'CANCELLED',
          endedAt: new Date(),
        },
      });

      // Update user status
      const updatedUser = await prisma.user.update({
        where: { id },
        data: {
          status: 'BANNED',
          bannedAt: new Date(),
          bannedReason: reason || null,
        },
        select: {
          id: true,
          handle: true,
          walletAddress: true,
          role: true,
          status: true,
          bannedAt: true,
          bannedReason: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      console.log(
        `[Admin] User ${id} banned by ${adminUser.userId}. Reason: ${reason || 'Not specified'}. Cancelled ${cancelledFights.count} fights.`
      );

      // Broadcast update
      broadcastUserUpdated(updatedUser);

      return {
        success: true,
        userId: updatedUser.id,
        status: updatedUser.status,
        bannedAt: updatedUser.bannedAt?.toISOString(),
        bannedReason: updatedUser.bannedReason,
        cancelledFights: cancelledFights.count,
      };
    });
  } catch (error) {
    return errorResponse(error);
  }
}
