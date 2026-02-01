/**
 * Join fight endpoint
 * POST /api/fights/[id]/join
 */
import { withAuth } from '@/lib/server/auth';
import { prisma } from '@/lib/server/db';
import { errorResponse, BadRequestError, NotFoundError } from '@/lib/server/errors';
import { getPositions } from '@/lib/server/pacifica';
import { canUsersMatch, recordFightSession } from '@/lib/server/anti-cheat';

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
    console.error(`[notifyRealtime] Failed to notify realtime: ${endpoint}`, { fightId, error });
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    return await withAuth(request, async (user) => {
      // Validate fight exists
      const fight = await prisma.fight.findUnique({
        where: { id: params.id },
        include: {
          participants: true,
          creator: {
            select: {
              id: true,
              handle: true,
              avatarUrl: true,
            },
          },
        },
      });

      if (!fight) {
        throw new NotFoundError('Fight not found');
      }

      // Validate fight is in WAITING status
      if (fight.status !== 'WAITING') {
        throw new BadRequestError('Fight has already started or finished');
      }

      // Validate user is not already in fight
      if (fight.participants.some((p: any) => p.userId === user.userId)) {
        throw new BadRequestError('You are already in this fight');
      }

      // Validate slot B is available
      if (fight.participants.some((p: any) => p.slot === 'B')) {
        throw new BadRequestError('Fight is already full');
      }

      // MVP-1: Check if user already has an active fight (LIVE or WAITING)
      // @see MVP-SIMPLIFIED-RULES.md
      const existingFight = await prisma.fightParticipant.findFirst({
        where: {
          userId: user.userId,
          fight: {
            status: { in: ['LIVE', 'WAITING'] },
          },
        },
        include: {
          fight: {
            select: {
              id: true,
              status: true,
            },
          },
        },
      });

      if (existingFight) {
        const status = existingFight.fight.status === 'LIVE' ? 'active' : 'pending';
        throw new BadRequestError(
          `You already have a ${status} fight. Finish or cancel it before joining another.`
        );
      }

      // Anti-cheat: Check if users can be matched (repeated matchup limit)
      const matchCheck = await canUsersMatch(fight.creatorId, user.userId);
      if (!matchCheck.canMatch) {
        throw new BadRequestError(matchCheck.reason || 'Cannot match with this opponent');
      }

      // Check if user has active Pacifica connection
      const connection = await prisma.pacificaConnection.findUnique({
        where: { userId: user.userId },
        select: { isActive: true },
      });

      if (!connection?.isActive) {
        throw new BadRequestError('Active Pacifica connection required');
      }

      // Get Pacifica connections for both participants to snapshot positions
      const [creatorConnection, joinerConnection] = await Promise.all([
        prisma.pacificaConnection.findUnique({
          where: { userId: fight.creatorId },
          select: { accountAddress: true },
        }),
        prisma.pacificaConnection.findUnique({
          where: { userId: user.userId },
          select: { accountAddress: true },
        }),
      ]);

      // Snapshot current positions from Pacifica (to exclude from fight PnL calculation)
      // IMPORTANT: Log errors instead of silently failing - this caused Bug #2
      const [creatorPositions, joinerPositions] = await Promise.all([
        creatorConnection?.accountAddress
          ? getPositions(creatorConnection.accountAddress).catch((err) => {
              console.error(`[JoinFight] Failed to get creator positions for fight ${params.id}:`, err);
              return [];
            })
          : Promise.resolve([]),
        joinerConnection?.accountAddress
          ? getPositions(joinerConnection.accountAddress).catch((err) => {
              console.error(`[JoinFight] Failed to get joiner positions for fight ${params.id}:`, err);
              return [];
            })
          : Promise.resolve([]),
      ]);

      // Simplify position data for storage
      // IMPORTANT: Include 'side' to distinguish LONG (bid) vs SHORT (ask) positions
      const simplifyPositions = (positions: any[]) =>
        positions.map((p: any) => ({
          symbol: p.symbol,
          amount: p.amount,
          entry_price: p.entry_price,
          side: p.side, // 'bid' = LONG, 'ask' = SHORT
        }));

      const creatorInitialPositions = simplifyPositions(creatorPositions);
      const joinerInitialPositions = simplifyPositions(joinerPositions);

      console.log(`[JoinFight] Fight ${params.id} - Position snapshots:`);
      console.log(`  Creator (${fight.creatorId}): ${creatorInitialPositions.length} positions`,
        creatorInitialPositions.length > 0 ? JSON.stringify(creatorInitialPositions) : '(none)');
      console.log(`  Joiner (${user.userId}): ${joinerInitialPositions.length} positions`,
        joinerInitialPositions.length > 0 ? JSON.stringify(joinerInitialPositions) : '(none)');

      // Join fight and start it
      const updatedFight = await prisma.$transaction(async (tx: any) => {
        // Update creator (participant A) with their CURRENT positions
        // Note: Creator's positions were also captured at fight creation time,
        // but we update them here in case they changed while waiting for a joiner
        await tx.fightParticipant.updateMany({
          where: { fightId: params.id, slot: 'A' },
          data: { initialPositions: creatorInitialPositions },
        });

        // Create joiner (participant B) with their initial positions
        await tx.fightParticipant.create({
          data: {
            fightId: params.id,
            userId: user.userId,
            slot: 'B',
            initialPositions: joinerInitialPositions,
          },
        });

        await tx.fight.update({
          where: { id: params.id },
          data: {
            status: 'LIVE',
            startedAt: new Date(),
          },
        });

        return tx.fight.findUnique({
          where: { id: params.id },
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
          },
        });
      });

      console.log(`[JoinFight] User ${user.userId} joined fight ${params.id}, fight is now LIVE`);

      // Notify realtime server - fight has started
      notifyRealtime('fight-started', params.id);

      // Get joiner's handle for the notification message
      const joiner = await prisma.user.findUnique({
        where: { id: user.userId },
        select: { handle: true },
      });

      // Create notification for the fight creator
      await prisma.notification.create({
        data: {
          userId: fight.creatorId,
          type: 'FIGHT',
          title: 'Opponent Joined!',
          message: `${joiner?.handle || 'Someone'} joined your ${fight.durationMinutes}m fight - Game on!`,
        },
      });

      // Record fight session for anti-cheat (IP tracking)
      try {
        await recordFightSession(params.id, user.userId, request, 'join');
      } catch (err) {
        console.error(`[JoinFight] Failed to record fight session:`, err);
        // Non-blocking - continue even if session recording fails
      }

      return Response.json({ success: true, data: updatedFight });
    });
  } catch (error) {
    return errorResponse(error);
  }
}
