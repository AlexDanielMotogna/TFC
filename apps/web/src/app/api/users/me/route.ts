/**
 * Current user profile endpoint
 * GET /api/users/me
 */
import { withAuth } from '@/lib/server/auth';
import { prisma } from '@/lib/server/db';
import { errorResponse } from '@/lib/server/errors';

export async function GET(request: Request) {
  try {
    return withAuth(request, async (user) => {
      const profile = await prisma.user.findUnique({
        where: { id: user.userId },
        include: {
          pacificaConnection: true,
        },
      });

      if (!profile) {
        return Response.json({ error: 'User not found' }, { status: 404 });
      }

      // Calculate stats
      const participants = await prisma.fightParticipant.findMany({
        where: {
          userId: user.userId,
          fight: { status: 'FINISHED' },
        },
        include: {
          fight: true,
        },
      });

      const stats = participants.reduce(
        (acc: any, p: any) => {
          acc.totalFights++;
          if (p.fight.winnerId === user.userId) acc.wins++;
          else if (p.fight.isDraw) acc.draws++;
          else acc.losses++;
          if (p.finalScoreUsdc) {
            acc.totalPnlUsdc += parseFloat(p.finalScoreUsdc.toString());
          }
          return acc;
        },
        { totalFights: 0, wins: 0, losses: 0, draws: 0, totalPnlUsdc: 0 }
      );

      const avgPnlPercent = stats.totalFights > 0 ? (stats.totalPnlUsdc / stats.totalFights) * 100 : 0;

      return {
        id: profile.id,
        handle: profile.handle,
        avatarUrl: profile.avatarUrl,
        createdAt: profile.createdAt.toISOString(),
        pacificaConnected: profile.pacificaConnection?.isActive === true,
        stats: {
          ...stats,
          avgPnlPercent,
        },
      };
    });
  } catch (error) {
    return errorResponse(error);
  }
}
