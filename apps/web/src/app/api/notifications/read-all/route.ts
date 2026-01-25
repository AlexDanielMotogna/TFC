/**
 * Mark all notifications as read endpoint
 * POST /api/notifications/read-all
 */
import { withAuth } from '@/lib/server/auth';
import { prisma } from '@/lib/server/db';
import { errorResponse } from '@/lib/server/errors';

export async function POST(request: Request) {
  try {
    return await withAuth(request, async (user) => {
      await prisma.notification.updateMany({
        where: {
          userId: user.userId,
          isRead: false,
        },
        data: { isRead: true },
      });

      return { success: true };
    });
  } catch (error) {
    return errorResponse(error);
  }
}
