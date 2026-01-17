/**
 * User fights endpoint
 * GET /api/users/[id]/fights
 */
import { prisma } from '@/lib/server/db';
import { errorResponse } from '@/lib/server/errors';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const fights = await prisma.fight.findMany({
      where: {
        participants: {
          some: {
            userId: params.id,
          },
        },
      },
      include: {
        creator: {
          select: {
            id: true,
            handle: true,
            avatarUrl: true,
          },
        },
        participants: {
          include: {
            user: {
              select: {
                id: true,
                handle: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
    });

    return Response.json({ success: true, data: fights });
  } catch (error) {
    return errorResponse(error);
  }
}
