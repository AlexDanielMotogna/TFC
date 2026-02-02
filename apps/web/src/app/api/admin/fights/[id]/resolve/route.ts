/**
 * Admin Manual Fight Resolution API
 * POST /api/admin/fights/[id]/resolve - Manually resolve a stuck/failed fight
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
      const { status, winnerId, isDraw, reason } = body;

      // Validate status
      if (!['FINISHED', 'NO_CONTEST', 'CANCELLED'].includes(status)) {
        throw new BadRequestError('status must be FINISHED, NO_CONTEST, or CANCELLED');
      }

      // Validate winner/draw for FINISHED status
      if (status === 'FINISHED' && !winnerId && !isDraw) {
        throw new BadRequestError('FINISHED status requires winnerId or isDraw: true');
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

      // Only allow resolving LIVE fights (or stuck states)
      if (!['LIVE', 'WAITING'].includes(fight.status)) {
        throw new BadRequestError(
          `Cannot resolve fight with status ${fight.status}. Only LIVE or WAITING fights can be resolved.`
        );
      }

      // Validate winnerId if provided
      if (winnerId) {
        const isParticipant = fight.participants.some((p) => p.userId === winnerId);
        if (!isParticipant) {
          throw new BadRequestError('winnerId must be a participant in this fight');
        }
      }

      const previousStatus = fight.status;

      // Build update data
      const updateData: Record<string, unknown> = {
        status,
        endedAt: new Date(),
      };

      if (status === 'FINISHED') {
        updateData.winnerId = isDraw ? null : winnerId;
        updateData.isDraw = isDraw || false;
      } else if (status === 'NO_CONTEST') {
        updateData.winnerId = null;
        updateData.isDraw = false;
      }

      // Update fight
      const updatedFight = await prisma.fight.update({
        where: { id },
        data: updateData,
        include: {
          participants: {
            include: {
              user: { select: { id: true, handle: true } },
            },
          },
        },
      });

      // Create anti-cheat violation record for manual resolution
      if (reason) {
        await prisma.antiCheatViolation.create({
          data: {
            fightId: id,
            ruleCode: 'ADMIN_RESOLUTION',
            ruleName: 'Manual Admin Resolution',
            ruleMessage: reason,
            actionTaken: status,
            metadata: {
              previousStatus,
              resolvedBy: adminUser.userId,
              winnerId: updatedFight.winnerId,
              isDraw: updatedFight.isDraw,
            },
          },
        });
      }

      console.log(
        `[Admin] Fight ${id} manually resolved by ${adminUser.userId}. ${previousStatus} -> ${status}. Winner: ${winnerId || (isDraw ? 'Draw' : 'None')}`
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
        previousStatus,
        newStatus: updatedFight.status,
        winnerId: updatedFight.winnerId,
        isDraw: updatedFight.isDraw,
        resolvedBy: adminUser.userId,
        resolvedAt: updatedFight.endedAt?.toISOString(),
      };
    });
  } catch (error) {
    return errorResponse(error);
  }
}
