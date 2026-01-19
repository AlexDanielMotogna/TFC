/**
 * Unread notification count endpoint
 * GET /api/notifications/unread-count
 */
import { withAuth } from '@/lib/server/auth';
import { prisma } from '@/lib/server/db';
import { errorResponse } from '@/lib/server/errors';

export async function GET(request: Request) {
  try {
    return withAuth(request, async (user) => {
      const count = await prisma.notification.count({
        where: {
          userId: user.userId,
          isRead: false,
        },
      });

      return { count };
    });
  } catch (error) {
    return errorResponse(error);
  }
}
