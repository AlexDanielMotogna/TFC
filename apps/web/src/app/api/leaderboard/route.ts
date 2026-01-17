/**
 * Leaderboard endpoint
 * GET /api/leaderboard?range=weekly|all_time&limit=50
 */
import { prisma } from '@/lib/server/db';
import { errorResponse } from '@/lib/server/errors';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const range = (searchParams.get('range') || 'weekly') as 'weekly' | 'all_time';
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // Try to get cached snapshot first
    const snapshots = await prisma.leaderboardSnapshot.findMany({
      where: { range },
      orderBy: { rank: 'asc' },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            handle: true,
            avatarUrl: true,
          },
        },
      },
    });

    // If no snapshots, calculate live leaderboard
    if (snapshots.length === 0) {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          handle: true,
          avatarUrl: true,
        },
      });

      const leaderboard = await Promise.all(
        users.map(async (user: any) => {
          const participants = await prisma.fightParticipant.findMany({
            where: {
              userId: user.id,
              fight: { status: 'FINISHED' },
            },
            include: {
              fight: true,
            },
          });

          const stats = participants.reduce(
            (acc: any, p: any) => {
              acc.totalFights++;
              if (p.fight.winnerId === user.id) acc.wins++;
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
          const winRate = stats.totalFights > 0 ? (stats.wins / stats.totalFights) * 100 : 0;

          return {
            userId: user.id,
            handle: user.handle,
            avatarUrl: user.avatarUrl,
            ...stats,
            avgPnlPercent,
            winRate,
          };
        })
      );

      // Sort by totalPnlUsdc descending
      leaderboard.sort((a: any, b: any) => b.totalPnlUsdc - a.totalPnlUsdc);

      const entries = leaderboard.slice(0, limit).map((entry: any, index: number) => ({
        rank: index + 1,
        ...entry,
      }));

      return Response.json({ success: true, data: { range, entries } });
    }

    // Return cached snapshots
    const entries = snapshots.map((snapshot: any) => ({
      rank: snapshot.rank,
      userId: snapshot.userId,
      handle: snapshot.user.handle,
      avatarUrl: snapshot.user.avatarUrl,
      totalFights: snapshot.totalFights,
      wins: snapshot.wins,
      losses: snapshot.losses,
      draws: snapshot.draws,
      totalPnlUsdc: parseFloat(snapshot.totalPnlUsdc.toString()),
      avgPnlPercent: parseFloat(snapshot.avgPnlPercent.toString()),
      winRate: snapshot.totalFights > 0 ? (snapshot.wins / snapshot.totalFights) * 100 : 0,
    }));

    return Response.json({ success: true, data: { range, entries } });
  } catch (error) {
    return errorResponse(error);
  }
}
