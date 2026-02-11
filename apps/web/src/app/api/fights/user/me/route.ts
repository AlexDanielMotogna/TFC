/**
 * My fights endpoint
 * GET /api/fights/user/me
 * Returns ALL fights for the authenticated user (any status)
 */
import { withAuth } from '@/lib/server/auth';
import { prisma } from '@/lib/server/db';
import { errorResponse } from '@/lib/server/errors';
import { FightStatus } from '@tfc/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as FightStatus | null;

    return await withAuth(request, async (user) => {
      // Find all fights where the user is a participant
      const participants = await prisma.fightParticipant.findMany({
        where: {
          userId: user.userId,
          ...(status && { fight: { status } }),
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
            createdAt: 'desc',
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
