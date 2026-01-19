/**
 * Notifications endpoints
 * GET /api/notifications - Get user's notifications
 * POST /api/notifications - Create a notification
 */
import { withAuth } from '@/lib/server/auth';
import { prisma } from '@/lib/server/db';
import { errorResponse, BadRequestError } from '@/lib/server/errors';

export async function GET(request: Request) {
  try {
    return withAuth(request, async (user) => {
      const url = new URL(request.url);
      const limit = parseInt(url.searchParams.get('limit') || '50', 10);
      const offset = parseInt(url.searchParams.get('offset') || '0', 10);

      const notifications = await prisma.notification.findMany({
        where: { userId: user.userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      });

      return notifications;
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    return withAuth(request, async (user) => {
      const body = await request.json();
      const { type, title, message } = body;

      if (!type || !title || !message) {
        throw new BadRequestError('type, title, and message are required');
      }

      const notification = await prisma.notification.create({
        data: {
          userId: user.userId,
          type,
          title,
          message,
        },
      });

      return notification;
    });
  } catch (error) {
    return errorResponse(error);
  }
}
