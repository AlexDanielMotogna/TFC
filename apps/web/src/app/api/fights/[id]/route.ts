/**
 * Single fight endpoint
 * GET /api/fights/[id] - Get fight details
 * DELETE /api/fights/[id] - Cancel a waiting fight (creator only)
 */
import { prisma, FightStatus } from '@tfc/db';
import { withAuth } from '@/lib/server/auth';
import { errorResponse, NotFoundError, ForbiddenError, BadRequestError } from '@/lib/server/errors';

// Realtime server notification helper
const REALTIME_URL = process.env.REALTIME_URL || 'http://localhost:3002';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'dev-internal-key';

async function notifyRealtime(endpoint: string, fightId: string) {
  try {
    await fetch(`${REALTIME_URL}/internal/arena/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Key': INTERNAL_API_KEY,
      },
      body: JSON.stringify({ fightId }),
    });
  } catch (error) {
    // Log but don't fail the request if realtime notification fails
    console.error(`[notifyRealtime] Failed to notify realtime: ${endpoint}`, { fightId, error });
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const fight = await prisma.fight.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
            id: true,
            handle: true,
            avatarUrl: true,
          },
        },
        participants: {
          include: {
            user: {
              select: {
                id: true,
                handle: true,
                avatarUrl: true,
              },
            },
          },
        },
        // Include violations for NO_CONTEST fights to show reason in UI
        violations: {
          select: {
            ruleCode: true,
            ruleName: true,
            ruleMessage: true,
          },
        },
      },
    });

    if (!fight) {
      throw new NotFoundError('Fight not found');
    }

    return Response.json({ success: true, data: fight });
  } catch (error) {
    console.error('[getFight] Error:', error);
    return errorResponse(error);
  }
}

/**
 * Cancel a fight (only creator can cancel, only WAITING fights)
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: fightId } = await params;

  return withAuth(request, async (user) => {
    try {
      console.log(`[CancelFight] User ${user.userId} attempting to cancel fight ${fightId}`);

      // Get fight
      const fight = await prisma.fight.findUnique({
        where: { id: fightId },
      });

      // Validation: fight exists
      if (!fight) {
        console.warn(`[CancelFight] Fight not found: ${fightId}`);
        throw new NotFoundError('Fight not found');
      }

      // Validation: user is the creator
      if (fight.creatorId !== user.userId) {
        console.warn(`[CancelFight] Non-creator ${user.userId} attempted to cancel fight ${fightId} (creator: ${fight.creatorId})`);
        throw new ForbiddenError('Only the creator can cancel a fight');
      }

      // Validation: fight is in WAITING status
      if (fight.status !== FightStatus.WAITING) {
        console.warn(`[CancelFight] Cannot cancel fight ${fightId} with status ${fight.status}`);
        throw new BadRequestError('Only waiting fights can be cancelled');
      }

      // Cancel the fight (delete it)
      await prisma.$transaction(async (tx: any) => {
        // Delete participants first (foreign key constraint)
        await tx.fightParticipant.deleteMany({
          where: { fightId },
        });

        // Delete the fight
        await tx.fight.delete({
          where: { id: fightId },
        });
      });

      console.log(`[CancelFight] Fight ${fightId} cancelled successfully by user ${user.userId}`);

      // Notify realtime server for arena updates
      notifyRealtime('fight-deleted', fightId);

      return Response.json({ success: true, data: { id: fightId } });
    } catch (error) {
      console.error(`[CancelFight] Error cancelling fight ${fightId}:`, error);
      return errorResponse(error);
    }
  });
}
