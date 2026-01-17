/**
 * Fight trades endpoint
 * GET /api/fights/[id]/trades
 * Returns trades executed during the fight (from FightTrade table)
 */
import { withAuth } from '@/lib/server/auth';
import { prisma } from '@/lib/server/db';
import { errorResponse, NotFoundError, ForbiddenError } from '@/lib/server/errors';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: fightId } = await params;

  return withAuth(request, async (user) => {
    try {
      // Verify user is a participant in this fight
      const participant = await prisma.fightParticipant.findFirst({
        where: {
          fightId,
          userId: user.userId,
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

      if (!participant) {
        throw new ForbiddenError('You are not a participant in this fight');
      }

      // For completed fights, show ALL trades from both participants
      // For live fights, only show the current user's trades
      const isCompleted = participant.fight.status === 'FINISHED' || participant.fight.status === 'CANCELLED';

      const trades = await prisma.fightTrade.findMany({
        where: {
          fightId,
          // Only filter by user if fight is still live
          ...(isCompleted ? {} : { participantUserId: user.userId }),
        },
        orderBy: {
          executedAt: 'desc',
        },
      });

      // Format trades for response
      const formattedTrades = trades.map((trade) => {
        const amount = parseFloat(trade.amount.toString());
        const price = parseFloat(trade.price.toString());
        const notional = amount * price;

        return {
          id: trade.id,
          history_id: trade.pacificaHistoryId.toString(),
          order_id: trade.pacificaOrderId?.toString() || null,
          symbol: trade.symbol,
          // Keep side as BUY/SELL for clarity
          side: trade.side,
          amount: trade.amount.toString(),
          price: trade.price.toString(),
          fee: trade.fee.toString(),
          pnl: trade.pnl?.toString() || null,
          leverage: trade.leverage || null,
          notional: notional.toFixed(2),
          executedAt: trade.executedAt.toISOString(),
          // Fight-specific metadata
          isFightTrade: true,
          fightId: trade.fightId,
          participantUserId: trade.participantUserId,
        };
      });

      return Response.json({
        success: true,
        data: formattedTrades,
      });
    } catch (error) {
      console.error('[FightTrades] Error:', error);
      return errorResponse(error);
    }
  });
}
