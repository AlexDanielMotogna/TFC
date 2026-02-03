/**
 * Admin Force Cancel Fight API
 * POST /api/admin/fights/[id]/cancel - Force cancel a fight
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
      const fight = await prisma.fight.findUnique({
        where: { id },
        select: { id: true, status: true },
      });

      if (!fight) {
        throw new NotFoundError('Fight not found');
      }

      // Can only cancel WAITING or LIVE fights
      if (!['WAITING', 'LIVE'].includes(fight.status)) {
        throw new BadRequestError(
          `Cannot cancel fight with status ${fight.status}`
        );
      }

      // Update fight status
      const updatedFight = await prisma.fight.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          endedAt: new Date(),
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
        `[Admin] Fight ${id} force cancelled by ${adminUser.userId}`
      );

      // Broadcast real-time update to admin panel
      const participantA = updatedFight.participants.find((p) => p.slot === 'A');
      const participantB = updatedFight.participants.find((p) => p.slot === 'B');
      broadcastAdminFightUpdate('cancelled', {
        id: updatedFight.id,
        status: updatedFight.status,
        stakeUsdc: Number(updatedFight.stakeUsdc),
        durationMinutes: updatedFight.durationMinutes,
        creatorId: updatedFight.creatorId,
        participantA: participantA
          ? { userId: participantA.userId, handle: participantA.user.handle }
          : null,
        participantB: participantB
          ? { userId: participantB.userId, handle: participantB.user.handle }
          : null,
        createdAt: updatedFight.createdAt,
        startedAt: updatedFight.startedAt,
        endedAt: updatedFight.endedAt,
      });

      return {
        id: updatedFight.id,
        status: updatedFight.status,
        message: 'Fight cancelled successfully',
      };
    });
  } catch (error) {
    return errorResponse(error);
  }
}
