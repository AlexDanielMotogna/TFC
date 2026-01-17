import { prisma, FightStatus } from '@tfc/db';
import { createLogger } from '@tfc/logger';
import { LOG_EVENTS } from '@tfc/shared';

const logger = createLogger({ service: 'job' });

type LeaderboardRange = 'weekly' | 'all_time';

interface UserStats {
  userId: string;
  totalFights: number;
  wins: number;
  losses: number;
  draws: number;
  totalPnlUsdc: number;
  totalPnlPercent: number;
}

/**
 * Refresh all leaderboards
 * @see Master-doc.md Section 11
 */
export async function refreshLeaderboards(): Promise<void> {
  await refreshLeaderboard('weekly');
  await refreshLeaderboard('all_time');
}

async function refreshLeaderboard(range: LeaderboardRange): Promise<void> {
  const startDate = getStartDateForRange(range);

  // Get all finished fight participants within range
  const participants = await prisma.fightParticipant.findMany({
    where: {
      fight: {
        status: FightStatus.FINISHED,
        startedAt: startDate ? { gte: startDate } : undefined,
      },
    },
    include: {
      fight: {
        select: {
          winnerId: true,
          isDraw: true,
        },
      },
    },
  });

  // Aggregate stats by user
  const userStats = new Map<string, UserStats>();

  for (const p of participants) {
    const userId = p.userId;

    if (!userStats.has(userId)) {
      userStats.set(userId, {
        userId,
        totalFights: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        totalPnlUsdc: 0,
        totalPnlPercent: 0,
      });
    }

    const stats = userStats.get(userId)!;
    stats.totalFights++;

    if (p.fight.isDraw) {
      stats.draws++;
    } else if (p.fight.winnerId === userId) {
      stats.wins++;
    } else {
      stats.losses++;
    }

    if (p.finalScoreUsdc) {
      stats.totalPnlUsdc += Number(p.finalScoreUsdc);
    }
    if (p.finalPnlPercent) {
      stats.totalPnlPercent += Number(p.finalPnlPercent);
    }
  }

  // Calculate rankings sorted by total PnL
  const rankedUsers = Array.from(userStats.values())
    .sort((a, b) => b.totalPnlUsdc - a.totalPnlUsdc)
    .slice(0, 100)
    .map((stats, index) => ({
      ...stats,
      rank: index + 1,
      avgPnlPercent: stats.totalFights > 0 ? stats.totalPnlPercent / stats.totalFights : 0,
    }));

  // Delete old snapshots for this range
  await prisma.leaderboardSnapshot.deleteMany({
    where: { range },
  });

  // Insert new snapshots
  if (rankedUsers.length > 0) {
    await prisma.leaderboardSnapshot.createMany({
      data: rankedUsers.map((user) => ({
        userId: user.userId,
        range,
        totalFights: user.totalFights,
        wins: user.wins,
        losses: user.losses,
        draws: user.draws,
        totalPnlUsdc: user.totalPnlUsdc,
        avgPnlPercent: user.avgPnlPercent,
        rank: user.rank,
      })),
    });
  }

  logger.info(LOG_EVENTS.LEADERBOARD_REFRESH_SUCCESS, 'Leaderboard refreshed', {
    range,
    userCount: rankedUsers.length,
  });
}

function getStartDateForRange(range: LeaderboardRange): Date | null {
  if (range === 'all_time') {
    return null;
  }

  // Weekly: start of current week (Sunday)
  const now = new Date();
  const dayOfWeek = now.getDay();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - dayOfWeek);
  startOfWeek.setHours(0, 0, 0, 0);
  return startOfWeek;
}
