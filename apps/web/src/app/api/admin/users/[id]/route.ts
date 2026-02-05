/**
 * Admin User Detail API
 * GET /api/admin/users/[id] - Get user details
 * PATCH /api/admin/users/[id] - Update user (role)
 * DELETE /api/admin/users/[id] - Delete user account (soft delete, ?hard=true for GDPR)
 */
import { withAdminAuth } from '@/lib/server/admin-auth';
import { prisma } from '@/lib/server/db';
import { errorResponse, NotFoundError, BadRequestError } from '@/lib/server/errors';
import { ErrorCode } from '@/lib/server/error-codes';
import { broadcastUserUpdated } from '@/lib/server/admin-realtime';

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
        throw new NotFoundError('User not found', ErrorCode.ERR_USER_NOT_FOUND);
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
        status: user.status,
        bannedAt: user.bannedAt,
        bannedReason: user.bannedReason,
        deletedAt: user.deletedAt,
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
      const { role, status, bannedReason } = body;

      // Validate role if provided
      if (role && !['USER', 'ADMIN'].includes(role)) {
        throw new BadRequestError('Invalid role. Must be USER or ADMIN', ErrorCode.ERR_VALIDATION_INVALID_PARAMETER);
      }

      // Validate status if provided
      if (status && !['ACTIVE', 'BANNED'].includes(status)) {
        throw new BadRequestError('Invalid status. Must be ACTIVE or BANNED', ErrorCode.ERR_VALIDATION_INVALID_PARAMETER);
      }

      // Prevent self-demotion
      if (adminUser.userId === id && role === 'USER') {
        throw new BadRequestError('Cannot demote yourself', ErrorCode.ERR_USER_CANNOT_BAN_SELF);
      }

      // Prevent self-ban
      if (adminUser.userId === id && status === 'BANNED') {
        throw new BadRequestError('Cannot ban yourself', ErrorCode.ERR_USER_CANNOT_BAN_SELF);
      }

      const user = await prisma.user.findUnique({
        where: { id },
        select: { id: true, role: true, status: true },
      });

      if (!user) {
        throw new NotFoundError('User not found', ErrorCode.ERR_USER_NOT_FOUND);
      }

      // Prevent banning admins (unless they're being demoted first)
      if (status === 'BANNED' && user.role === 'ADMIN' && !role) {
        throw new BadRequestError('Cannot ban an admin user. Demote them first.', ErrorCode.ERR_USER_CANNOT_BAN_ADMIN);
      }

      // Build update data
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updateData: any = {};

      if (role) {
        updateData.role = role;
      }

      if (status) {
        updateData.status = status;
        if (status === 'BANNED') {
          updateData.bannedAt = new Date();
          updateData.bannedReason = bannedReason || 'Banned by admin';
        } else if (status === 'ACTIVE') {
          // Clear ban fields when activating
          updateData.bannedAt = null;
          updateData.bannedReason = null;
        }
      }

      // Update user
      const updatedUser = await prisma.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          handle: true,
          walletAddress: true,
          role: true,
          status: true,
          bannedAt: true,
          bannedReason: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (role) {
        console.log(`[Admin] User ${id} role changed to ${role} by ${adminUser.userId}`);
      }
      if (status) {
        console.log(`[Admin] User ${id} status changed to ${status} by ${adminUser.userId}`);
      }

      // Broadcast real-time update to admin panel
      broadcastUserUpdated(updatedUser);

      return updatedUser;
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    return withAdminAuth(request, async (adminUser) => {
      const { searchParams } = new URL(request.url);
      const hardDelete = searchParams.get('hard') === 'true';

      // Prevent self-deletion
      if (adminUser.userId === id) {
        throw new BadRequestError('Cannot delete yourself', ErrorCode.ERR_USER_CANNOT_BAN_SELF);
      }

      const user = await prisma.user.findUnique({
        where: { id },
        select: { id: true, status: true, role: true, handle: true },
      });

      if (!user) {
        throw new NotFoundError('User not found', ErrorCode.ERR_USER_NOT_FOUND);
      }

      // Prevent deleting admins
      if (user.role === 'ADMIN') {
        throw new BadRequestError('Cannot delete an admin user', ErrorCode.ERR_USER_CANNOT_BAN_ADMIN);
      }

      if (hardDelete) {
        // Hard delete - GDPR compliance
        // First cancel active fights
        await prisma.fight.updateMany({
          where: {
            status: { in: ['WAITING', 'LIVE'] },
            participants: {
              some: { userId: id },
            },
          },
          data: {
            status: 'CANCELLED',
            endedAt: new Date(),
          },
        });

        // Delete related records in order (respecting foreign keys)
        await prisma.$transaction([
          prisma.notification.deleteMany({ where: { userId: id } }),
          prisma.referralEarning.deleteMany({ where: { OR: [{ referrerId: id }, { traderId: id }] } }),
          prisma.referral.deleteMany({ where: { OR: [{ referrerId: id }, { referredId: id }] } }),
          prisma.trade.deleteMany({ where: { userId: id } }),
          prisma.fightParticipant.deleteMany({ where: { userId: id } }),
          prisma.leaderboardSnapshot.deleteMany({ where: { userId: id } }),
          prisma.pacificaConnection.deleteMany({ where: { userId: id } }),
          prisma.user.delete({ where: { id } }),
        ]);

        console.log(`[Admin] User ${id} (${user.handle}) HARD DELETED by ${adminUser.userId}`);

        return {
          success: true,
          userId: id,
          deleted: true,
          hardDelete: true,
          message: 'User permanently deleted',
        };
      } else {
        // Soft delete
        // Cancel active fights
        const cancelledFights = await prisma.fight.updateMany({
          where: {
            status: { in: ['WAITING', 'LIVE'] },
            participants: {
              some: { userId: id },
            },
          },
          data: {
            status: 'CANCELLED',
            endedAt: new Date(),
          },
        });

        const updatedUser = await prisma.user.update({
          where: { id },
          data: {
            status: 'DELETED',
            deletedAt: new Date(),
          },
          select: {
            id: true,
            handle: true,
            walletAddress: true,
            role: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        console.log(`[Admin] User ${id} (${user.handle}) soft deleted by ${adminUser.userId}`);

        broadcastUserUpdated(updatedUser);

        return {
          success: true,
          userId: id,
          deleted: true,
          hardDelete: false,
          cancelledFights: cancelledFights.count,
          message: 'User account deleted',
        };
      }
    });
  } catch (error) {
    return errorResponse(error);
  }
}
