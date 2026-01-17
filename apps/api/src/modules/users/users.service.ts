import { Injectable } from '@nestjs/common';
import { prisma, FightStatus } from '@tfc/db';

@Injectable()
export class UsersService {
  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        pacificaConnection: {
          select: {
            isActive: true,
            builderCodeApproved: true,
            connectedAt: true,
          },
        },
      },
    });

    if (!user) {
      return null;
    }

    // Get fight stats
    const participants = await prisma.fightParticipant.findMany({
      where: { userId },
      include: {
        fight: {
          select: {
            status: true,
            winnerId: true,
            isDraw: true,
          },
        },
      },
    });

    const finishedFights = participants.filter(
      (p) => p.fight.status === FightStatus.FINISHED
    );

    let wins = 0;
    let losses = 0;
    let draws = 0;
    let totalPnlUsdc = 0;
    let totalPnlPercent = 0;

    for (const p of finishedFights) {
      if (p.fight.isDraw) {
        draws++;
      } else if (p.fight.winnerId === userId) {
        wins++;
      } else {
        losses++;
      }

      if (p.finalScoreUsdc) {
        totalPnlUsdc += Number(p.finalScoreUsdc);
      }
      if (p.finalPnlPercent) {
        totalPnlPercent += Number(p.finalPnlPercent);
      }
    }

    const avgPnlPercent = finishedFights.length > 0 ? totalPnlPercent / finishedFights.length : 0;

    return {
      id: user.id,
      handle: user.handle,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      pacificaConnected: user.pacificaConnection?.isActive || false,
      stats: {
        totalFights: finishedFights.length,
        wins,
        losses,
        draws,
        totalPnlUsdc,
        avgPnlPercent,
      },
    };
  }

  async getFightHistory(userId: string, limit = 20) {
    return prisma.fightParticipant.findMany({
      where: { userId },
      include: {
        fight: {
          include: {
            participants: {
              include: { user: true },
            },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
      take: limit,
    });
  }
}
