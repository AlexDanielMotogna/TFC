/**
 * Admin Force NO_CONTEST Fight API
 * POST /api/admin/fights/[id]/no-contest - Force a fight to NO_CONTEST status
 */
import { withAdminAuth } from '@/lib/server/admin-auth';
import { prisma } from '@/lib/server/db';
import { errorResponse, NotFoundError, BadRequestError } from '@/lib/server/errors';
import { ErrorCode } from '@/lib/server/error-codes';
import { broadcastAdminFightUpdate } from '@/lib/server/admin-realtime';
import { SETTLEMENT_LOCK_TIMEOUT_MS } from '@tfc/db';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    return withAdminAuth(request, async (adminUser) => {
      const body = await request.json();
      const { reason, ruleCode, excludeFromLeaderboard = true } = body;

      if (!reason) {
        throw new BadRequestError('reason is required', ErrorCode.ERR_VALIDATION_MISSING_FIELD);
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
        throw new NotFoundError('Fight not found', ErrorCode.ERR_FIGHT_NOT_FOUND);
      }

      // Can force NO_CONTEST on LIVE or FINISHED fights
      if (!['LIVE', 'FINISHED'].includes(fight.status)) {
        throw new BadRequestError(
          `Cannot mark fight as NO_CONTEST with status ${fight.status}`,
          ErrorCode.ERR_FIGHT_INVALID_STATUS
        );
      }

      // Check if fight is being settled by another process (only for LIVE fights)
      if (fight.status === 'LIVE' && fight.settlingBy && fight.settlingAt) {
        const lockAge = Date.now() - fight.settlingAt.getTime();
        if (lockAge < SETTLEMENT_LOCK_TIMEOUT_MS) {
          throw new BadRequestError(
            `Fight is currently being settled by ${fight.settlingBy}. Please wait and try again.`,
            ErrorCode.ERR_FIGHT_INVALID_STATUS
          );
        }
      }

      const previousStatus = fight.status;

      // Update fight to NO_CONTEST
      const updatedFight = await prisma.fight.update({
        where: { id },
        data: {
          status: 'NO_CONTEST',
          endedAt: fight.endedAt || new Date(),
          winnerId: null,
          isDraw: false,
        },
        include: {
          participants: {
            include: {
              user: { select: { id: true, handle: true } },
            },
          },
        },
      });

      // Create anti-cheat violation record
      await prisma.antiCheatViolation.create({
        data: {
          fightId: id,
          ruleCode: ruleCode || 'ADMIN_NO_CONTEST',
          ruleName: 'Admin Forced NO_CONTEST',
          ruleMessage: reason,
          actionTaken: 'NO_CONTEST',
          metadata: {
            previousStatus,
            forcedBy: adminUser.userId,
            excludeFromLeaderboard,
          },
        },
      });

      // If excluding from leaderboard, we could remove related leaderboard entries
      // For now, the leaderboard calculation should filter out NO_CONTEST fights

      console.log(
        `[Admin] Fight ${id} forced to NO_CONTEST by ${adminUser.userId}. Reason: ${reason}`
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
        winnerId: null,
        isDraw: false,
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
        newStatus: 'NO_CONTEST',
        reason,
        forcedBy: adminUser.userId,
        message: 'Fight marked as NO_CONTEST',
      };
    });
  } catch (error) {
    return errorResponse(error);
  }
}
