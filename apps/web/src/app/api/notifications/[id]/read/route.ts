/**
 * Mark notification as read endpoint
 * POST /api/notifications/:id/read
 */
import { withAuth } from '@/lib/server/auth';
import { prisma } from '@/lib/server/db';
import { errorResponse } from '@/lib/server/errors';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    return withAuth(request, async (user) => {
      const { id } = await params;

      await prisma.notification.updateMany({
        where: {
          id,
          userId: user.userId, // Ensure user owns this notification
        },
        data: { isRead: true },
      });

      return { success: true };
    });
  } catch (error) {
    return errorResponse(error);
  }
}
