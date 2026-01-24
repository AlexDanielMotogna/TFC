/**
 * Fight trades endpoint
 * GET /api/fights/[id]/trades
 * Returns trades executed during the fight from fight_trades table (Rule 35 compliant)
 *
 * IMPORTANT: We use fight_trades data directly, NOT Pacifica data, because:
 * - fight_trades contains the FIGHT-RELEVANT amounts (capped by Rule 35)
 * - Pacifica contains the FULL trade amounts (including external/pre-fight portions)
 */
import { withAuth } from '@/lib/server/auth';
import { prisma } from '@/lib/server/db';
import { errorResponse, ForbiddenError } from '@/lib/server/errors';

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

      // Get fight trades directly from fight_trades table
      // This contains the CORRECT fight-relevant amounts (Rule 35 compliant)
      const fightTrades = await prisma.fightTrade.findMany({
        where: {
          fightId,
          // Only filter by user if fight is still live
          ...(isCompleted ? {} : { participantUserId: user.userId }),
        },
        select: {
          id: true,
          pacificaHistoryId: true,
          pacificaOrderId: true,
          participantUserId: true,
          symbol: true,
          side: true,
          amount: true,
          price: true,
          fee: true,
          pnl: true,
          leverage: true,
          executedAt: true,
        },
        orderBy: {
          executedAt: 'asc',
        },
      });

      // If no trades recorded for this fight, return empty
      if (fightTrades.length === 0) {
        return Response.json({ success: true, data: [] });
      }

      // Format trades for the UI
      const formattedTrades = fightTrades.map((trade) => {
        const amount = parseFloat(trade.amount.toString());
        const price = parseFloat(trade.price.toString());
        const notional = (amount * price).toFixed(2);

        return {
          // UI expected fields
          id: trade.pacificaHistoryId.toString(),
          participantUserId: trade.participantUserId,
          executedAt: trade.executedAt.toISOString(),
          notional,
          side: trade.side, // Already BUY/SELL in fight_trades
          // Trade details
          history_id: trade.pacificaHistoryId.toString(),
          order_id: trade.pacificaOrderId?.toString() || null,
          symbol: trade.symbol,
          amount: trade.amount.toString(),
          price: trade.price.toString(),
          fee: trade.fee?.toString() || '0',
          pnl: trade.pnl?.toString() || null,
          leverage: trade.leverage,
          // Fight metadata
          isFightTrade: true,
          fightId,
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
