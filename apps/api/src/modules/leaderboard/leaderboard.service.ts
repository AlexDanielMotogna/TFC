import { Injectable } from '@nestjs/common';
import { prisma, FightStatus } from '@tfc/db';

export type LeaderboardRange = 'weekly' | 'all_time';

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  handle: string;
  avatarUrl: string | null;
  totalFights: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  totalPnlUsdc: number;
  avgPnlPercent: number;
}

interface UserStats {
  user: {
    id: string;
    handle: string;
    avatarUrl: string | null;
  };
  totalFights: number;
  wins: number;
  losses: number;
  draws: number;
  totalPnlUsdc: number;
  totalPnlPercent: number;
}

@Injectable()
export class LeaderboardService {
  /**
   * Get leaderboard by range
   * Returns cached snapshot if available, otherwise calculates live
   */
  async getLeaderboard(range: LeaderboardRange, limit = 50): Promise<{
    range: LeaderboardRange;
    snapshotTime: Date;
    entries: LeaderboardEntry[];
  }> {
    // Try to get cached snapshot first
    const snapshots = await prisma.leaderboardSnapshot.findMany({
      where: { range },
      orderBy: { rank: 'asc' },
      take: limit,
    });

    if (snapshots.length > 0) {
      // Get user info for each snapshot entry
      const userIds = snapshots.map((s) => s.userId);
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, handle: true, avatarUrl: true },
      });
      const userMap = new Map(users.map((u) => [u.id, u]));

      const entries: LeaderboardEntry[] = snapshots.map((s) => {
        const user = userMap.get(s.userId);
        return {
          rank: s.rank || 0,
          userId: s.userId,
          handle: user?.handle || 'Unknown',
          avatarUrl: user?.avatarUrl || null,
          totalFights: s.totalFights,
          wins: s.wins,
          losses: s.losses,
          draws: s.draws,
          winRate: s.totalFights > 0 ? s.wins / s.totalFights : 0,
          totalPnlUsdc: Number(s.totalPnlUsdc),
          avgPnlPercent: Number(s.avgPnlPercent),
        };
      });

      return {
        range,
        snapshotTime: snapshots[0]?.calculatedAt || new Date(),
        entries,
      };
    }

    // If no snapshot, calculate live (expensive)
    return this.calculateLeaderboard(range, limit);
  }

  /**
   * Calculate leaderboard from database
   * This is expensive and should be cached via scheduled job
   */
  async calculateLeaderboard(range: LeaderboardRange, limit = 50): Promise<{
    range: LeaderboardRange;
    snapshotTime: Date;
    entries: LeaderboardEntry[];
  }> {
    const startDate = this.getStartDateForRange(range);

    // Get all finished fight participants within range
    const participants = await prisma.fightParticipant.findMany({
      where: {
        fight: {
          status: FightStatus.FINISHED,
          startedAt: startDate ? { gte: startDate } : undefined,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            handle: true,
            avatarUrl: true,
          },
        },
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
          user: p.user,
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

    // Convert to array and calculate win rate
    const entries: LeaderboardEntry[] = Array.from(userStats.values())
      .map((stats) => ({
        rank: 0, // Will be set below
        userId: stats.user.id,
        handle: stats.user.handle,
        avatarUrl: stats.user.avatarUrl,
        totalFights: stats.totalFights,
        wins: stats.wins,
        losses: stats.losses,
        draws: stats.draws,
        winRate: stats.totalFights > 0 ? stats.wins / stats.totalFights : 0,
        totalPnlUsdc: stats.totalPnlUsdc,
        avgPnlPercent: stats.totalFights > 0 ? stats.totalPnlPercent / stats.totalFights : 0,
      }))
      // Sort by total PnL (descending)
      .sort((a, b) => b.totalPnlUsdc - a.totalPnlUsdc)
      .slice(0, limit)
      // Add rank
      .map((entry, index) => ({ ...entry, rank: index + 1 }));

    return {
      range,
      snapshotTime: new Date(),
      entries,
    };
  }

  /**
   * Save leaderboard snapshot (called by jobs service)
   * This saves individual rows per user, not a single JSON blob
   */
  async saveSnapshot(range: LeaderboardRange): Promise<void> {
    const leaderboard = await this.calculateLeaderboard(range, 100);

    // Delete old snapshots for this range
    await prisma.leaderboardSnapshot.deleteMany({
      where: { range },
    });

    // Insert new snapshots
    await prisma.leaderboardSnapshot.createMany({
      data: leaderboard.entries.map((entry) => ({
        userId: entry.userId,
        range,
        totalFights: entry.totalFights,
        wins: entry.wins,
        losses: entry.losses,
        draws: entry.draws,
        totalPnlUsdc: entry.totalPnlUsdc,
        avgPnlPercent: entry.avgPnlPercent,
        rank: entry.rank,
      })),
    });
  }

  /**
   * Get start date for range calculation
   */
  private getStartDateForRange(range: LeaderboardRange): Date | null {
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
}
