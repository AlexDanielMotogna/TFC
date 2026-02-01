/**
 * Admin User Detail API
 * GET /api/admin/users/[id] - Get user details
 * PATCH /api/admin/users/[id] - Update user (role)
 */
import { withAdminAuth } from '@/lib/server/admin-auth';
import { prisma } from '@/lib/server/db';
import { errorResponse, NotFoundError, BadRequestError } from '@/lib/server/errors';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    return withAdminAuth(request, async () => {
      const user = await prisma.user.findUnique({
        where: { id },
        include: {
          pacificaConnection: true,
          leaderboardSnapshots: {
            where: { range: { in: ['weekly', 'all_time'] } },
            orderBy: { calculatedAt: 'desc' },
            take: 2,
          },
          _count: {
            select: {
              fightParticipants: true,
              trades: true,
              createdFights: true,
              notifications: true,
              referrals: true,
            },
          },
        },
      });

      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Get recent fights
      const recentFights = await prisma.fightParticipant.findMany({
        where: { userId: id },
        include: {
          fight: {
            include: {
              creator: { select: { id: true, handle: true } },
              participants: {
                include: {
                  user: { select: { id: true, handle: true } },
                },
              },
            },
          },
        },
        orderBy: { joinedAt: 'desc' },
        take: 10,
      });

      // Calculate aggregate stats from trades
      const tradeStats = await prisma.trade.aggregate({
        where: { userId: id },
        _sum: { fee: true, pnl: true },
        _count: true,
      });

      // Get leaderboard ranks
      const weeklyRank = user.leaderboardSnapshots.find(
        (s) => s.range === 'weekly'
      );
      const allTimeRank = user.leaderboardSnapshots.find(
        (s) => s.range === 'all_time'
      );

      return {
        id: user.id,
        handle: user.handle,
        walletAddress: user.walletAddress,
        avatarUrl: user.avatarUrl,
        role: user.role,
        referralCode: user.referralCode,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        pacificaConnection: user.pacificaConnection
          ? {
              accountAddress: user.pacificaConnection.accountAddress,
              isActive: user.pacificaConnection.isActive,
              builderCodeApproved: user.pacificaConnection.builderCodeApproved,
              connectedAt: user.pacificaConnection.connectedAt,
            }
          : null,
        stats: {
          fightsCount: user._count.fightParticipants,
          tradesCount: user._count.trades,
          createdFightsCount: user._count.createdFights,
          referralsCount: user._count.referrals,
          totalFees: Number(tradeStats._sum.fee || 0),
          totalPnl: Number(tradeStats._sum.pnl || 0),
        },
        leaderboard: {
          weekly: weeklyRank
            ? {
                rank: weeklyRank.rank,
                wins: weeklyRank.wins,
                losses: weeklyRank.losses,
                totalPnlUsdc: Number(weeklyRank.totalPnlUsdc),
              }
            : null,
          allTime: allTimeRank
            ? {
                rank: allTimeRank.rank,
                wins: allTimeRank.wins,
                losses: allTimeRank.losses,
                totalPnlUsdc: Number(allTimeRank.totalPnlUsdc),
              }
            : null,
        },
        recentFights: recentFights.map((fp) => ({
          fightId: fp.fight.id,
          status: fp.fight.status,
          slot: fp.slot,
          stakeUsdc: fp.fight.stakeUsdc,
          durationMinutes: fp.fight.durationMinutes,
          finalPnlPercent: fp.finalPnlPercent ? Number(fp.finalPnlPercent) : null,
          isWinner: fp.fight.winnerId === id,
          isDraw: fp.fight.isDraw,
          opponent: fp.fight.participants.find((p) => p.userId !== id)?.user || null,
          joinedAt: fp.joinedAt,
          startedAt: fp.fight.startedAt,
          endedAt: fp.fight.endedAt,
        })),
      };
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    return withAdminAuth(request, async (adminUser) => {
      const body = await request.json();
      const { role } = body;

      // Validate role
      if (role && !['USER', 'ADMIN'].includes(role)) {
        throw new BadRequestError('Invalid role. Must be USER or ADMIN');
      }

      // Prevent self-demotion
      if (adminUser.userId === id && role === 'USER') {
        throw new BadRequestError('Cannot demote yourself');
      }

      const user = await prisma.user.findUnique({
        where: { id },
        select: { id: true, role: true },
      });

      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Update user
      const updatedUser = await prisma.user.update({
        where: { id },
        data: { role },
        select: {
          id: true,
          handle: true,
          walletAddress: true,
          role: true,
          updatedAt: true,
        },
      });

      console.log(`[Admin] User ${id} role changed to ${role} by ${adminUser.userId}`);

      return updatedUser;
    });
  } catch (error) {
    return errorResponse(error);
  }
}
