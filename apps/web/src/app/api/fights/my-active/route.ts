/**
 * My active fights endpoint
 * GET /api/fights/my-active
 * Returns all active (LIVE) fights for the authenticated user
 */
import { withAuth } from '@/lib/server/auth';
import { prisma } from '@/lib/server/db';
import { errorResponse } from '@/lib/server/errors';

export async function GET(request: Request) {
  try {
    return withAuth(request, async (user) => {
      // Find all LIVE fights where the user is a participant
      const participants = await prisma.fightParticipant.findMany({
        where: {
          userId: user.userId,
          fight: { status: 'LIVE' },
        },
        include: {
          fight: {
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
          },
        },
        orderBy: {
          fight: {
            startedAt: 'desc',
          },
        },
      });

      // Extract the fights from participants
      const fights = participants.map((p: any) => p.fight);

      return Response.json({
        success: true,
        data: fights,
      });
    });
  } catch (error) {
    return errorResponse(error);
  }
}
