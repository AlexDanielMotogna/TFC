/**
 * Admin Force Finish Fight API
 * POST /api/admin/fights/[id]/finish - Force finish a fight
 */
import { withAdminAuth } from '@/lib/server/admin-auth';
import { prisma } from '@/lib/server/db';
import { errorResponse, NotFoundError, BadRequestError } from '@/lib/server/errors';
import { broadcastAdminFightUpdate } from '@/lib/server/admin-realtime';
import { SETTLEMENT_LOCK_TIMEOUT_MS } from '@tfc/db';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    return withAdminAuth(request, async (adminUser) => {
      const fight = await prisma.fight.findUnique({
        where: { id },
        include: {
          participants: true,
        },
      });

      if (!fight) {
        throw new NotFoundError('Fight not found');
      }

      // Can only finish LIVE fights
      if (fight.status !== 'LIVE') {
        throw new BadRequestError(
          `Cannot finish fight with status ${fight.status}. Only LIVE fights can be finished.`
        );
      }

      // Check if fight is being settled by another process
      if (fight.settlingBy && fight.settlingAt) {
        const lockAge = Date.now() - fight.settlingAt.getTime();
        if (lockAge < SETTLEMENT_LOCK_TIMEOUT_MS) {
          throw new BadRequestError(
            `Fight is currently being settled by ${fight.settlingBy}. Please wait and try again.`
          );
        }
      }

      // Get participants
      const participantA = fight.participants.find((p) => p.slot === 'A');
      const participantB = fight.participants.find((p) => p.slot === 'B');

      if (!participantA || !participantB) {
        throw new BadRequestError('Fight does not have two participants');
      }

      // Determine winner based on final PnL (if available) or set as draw
      let winnerId: string | null = null;
      let isDraw = false;

      const pnlA = participantA.finalPnlPercent
        ? Number(participantA.finalPnlPercent)
        : 0;
      const pnlB = participantB.finalPnlPercent
        ? Number(participantB.finalPnlPercent)
        : 0;

      if (pnlA > pnlB) {
        winnerId = participantA.userId;
      } else if (pnlB > pnlA) {
        winnerId = participantB.userId;
      } else {
        isDraw = true;
      }

      // Update fight status
      const updatedFight = await prisma.fight.update({
        where: { id },
        data: {
          status: 'FINISHED',
          endedAt: new Date(),
          winnerId,
          isDraw,
        },
        include: {
          participants: {
            include: {
              user: { select: { id: true, handle: true } },
            },
          },
        },
      });

      console.log(
        `[Admin] Fight ${id} force finished by ${adminUser.userId}. Winner: ${winnerId || 'Draw'}`
      );

      // Broadcast real-time update to admin panel
      const pA = updatedFight.participants.find((p) => p.slot === 'A');
      const pB = updatedFight.participants.find((p) => p.slot === 'B');
      broadcastAdminFightUpdate('ended', {
        id: updatedFight.id,
        status: updatedFight.status,
        stakeUsdc: Number(updatedFight.stakeUsdc),
        durationMinutes: updatedFight.durationMinutes,
        creatorId: updatedFight.creatorId,
        winnerId: updatedFight.winnerId,
        isDraw: updatedFight.isDraw,
        participantA: pA ? { userId: pA.userId, handle: pA.user.handle } : null,
        participantB: pB ? { userId: pB.userId, handle: pB.user.handle } : null,
        createdAt: updatedFight.createdAt,
        startedAt: updatedFight.startedAt,
        endedAt: updatedFight.endedAt,
      });

      return {
        id: updatedFight.id,
        status: updatedFight.status,
        winnerId: updatedFight.winnerId,
        isDraw: updatedFight.isDraw,
        message: 'Fight finished successfully',
      };
    });
  } catch (error) {
    return errorResponse(error);
  }
}
