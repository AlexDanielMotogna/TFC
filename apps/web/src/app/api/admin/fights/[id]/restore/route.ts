/**
 * Admin Restore Fight from NO_CONTEST API
 * POST /api/admin/fights/[id]/restore - Restore a NO_CONTEST fight to FINISHED
 */
import { withAdminAuth } from '@/lib/server/admin-auth';
import { prisma } from '@/lib/server/db';
import { errorResponse, NotFoundError, BadRequestError } from '@/lib/server/errors';
import { broadcastAdminFightUpdate } from '@/lib/server/admin-realtime';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    return withAdminAuth(request, async (adminUser) => {
      const body = await request.json();
      const { reason } = body;

      if (!reason) {
        throw new BadRequestError('reason is required');
      }

      const fight = await prisma.fight.findUnique({
        where: { id },
        include: {
          participants: {
            include: {
              user: { select: { id: true, handle: true } },
            },
          },
        },
      });

      if (!fight) {
        throw new NotFoundError('Fight not found');
      }

      // Can only restore NO_CONTEST fights
      if (fight.status !== 'NO_CONTEST') {
        throw new BadRequestError(
          `Cannot restore fight with status ${fight.status}. Only NO_CONTEST fights can be restored.`
        );
      }

      // Determine winner based on final PnL
      const participantA = fight.participants.find((p) => p.slot === 'A');
      const participantB = fight.participants.find((p) => p.slot === 'B');

      if (!participantA || !participantB) {
        throw new BadRequestError('Fight does not have two participants');
      }

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

      // Update fight to FINISHED
      const updatedFight = await prisma.fight.update({
        where: { id },
        data: {
          status: 'FINISHED',
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

      // Create anti-cheat violation record for restoration
      await prisma.antiCheatViolation.create({
        data: {
          fightId: id,
          ruleCode: 'ADMIN_RESTORE',
          ruleName: 'Admin Restored from NO_CONTEST',
          ruleMessage: reason,
          actionTaken: 'RESTORED',
          metadata: {
            previousStatus: 'NO_CONTEST',
            restoredBy: adminUser.userId,
            winnerId,
            isDraw,
          },
        },
      });

      console.log(
        `[Admin] Fight ${id} restored from NO_CONTEST by ${adminUser.userId}. Winner: ${winnerId || (isDraw ? 'Draw' : 'None')}`
      );

      // Broadcast update
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
        success: true,
        fightId: updatedFight.id,
        previousStatus: 'NO_CONTEST',
        newStatus: 'FINISHED',
        winnerId: updatedFight.winnerId,
        isDraw: updatedFight.isDraw,
        restoredBy: adminUser.userId,
        reason,
        message: 'Fight restored to FINISHED',
      };
    });
  } catch (error) {
    return errorResponse(error);
  }
}
