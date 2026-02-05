/**
 * User profile endpoint
 * GET /api/users/[id]
 */
import { prisma } from '@/lib/server/db';
import { errorResponse, NotFoundError } from '@/lib/server/errors';
import { ErrorCode } from '@/lib/server/error-codes';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const profile = await prisma.user.findUnique({
      where: { id: params.id },
      include: {
        pacificaConnection: true,
      },
    });

    if (!profile) {
      throw new NotFoundError('User not found', ErrorCode.ERR_USER_NOT_FOUND);
    }

    // Calculate stats
    const participants = await prisma.fightParticipant.findMany({
      where: {
        userId: params.id,
        fight: { status: 'FINISHED' },
      },
      include: {
        fight: true,
      },
    });

    const stats = participants.reduce(
      (acc: any, p: any) => {
        acc.totalFights++;
        if (p.fight.winnerId === params.id) acc.wins++;
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

    return Response.json({
      success: true,
      data: {
        id: profile.id,
        handle: profile.handle,
        avatarUrl: profile.avatarUrl,
        createdAt: profile.createdAt.toISOString(),
        pacificaConnected: profile.pacificaConnection?.isActive === true,
        stats: {
          ...stats,
          avgPnlPercent,
        },
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
