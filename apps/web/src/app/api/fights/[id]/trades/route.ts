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
      // Get the fight first to check its status
      const fight = await prisma.fight.findUnique({
        where: { id: fightId },
        select: {
          id: true,
          status: true,
        },
      });

      if (!fight) {
        throw new ForbiddenError('Fight not found');
      }

      // Check if user is a participant
      const participant = await prisma.fightParticipant.findFirst({
        where: {
          fightId,
          userId: user.userId,
        },
      });

      // For completed fights, anyone can view trades (public data)
      // For live fights, only participants can view
      const isCompleted = fight.status === 'FINISHED' || fight.status === 'CANCELLED' || fight.status === 'NO_CONTEST';

      if (!isCompleted && !participant) {
        throw new ForbiddenError('You are not a participant in this fight');
      }

      // Get fight trades directly from fight_trades table
      // This contains the CORRECT fight-relevant amounts (Rule 35 compliant)
      const fightTrades = await prisma.fightTrade.findMany({
        where: {
          fightId,
          // Only filter by user if fight is still live (and user is participant)
          ...(isCompleted ? {} : participant ? { participantUserId: user.userId } : {}),
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

      // Log for debugging
      console.log('[FightTrades] Query result:', {
        fightId,
        fightStatus: fight.status,
        isCompleted,
        isParticipant: !!participant,
        tradesFound: fightTrades.length,
      });

      // If no trades in fight_trades, fallback to trades table
      // This handles cases where RULE 35 blocked recording to fight_trades
      // but the trade was still recorded to the general trades table
      if (fightTrades.length === 0 && isCompleted) {
        console.log('[FightTrades] No fight_trades found, checking trades table as fallback');

        const generalTrades = await prisma.trade.findMany({
          where: { fightId },
          select: {
            id: true,
            userId: true,
            pacificaHistoryId: true,
            pacificaOrderId: true,
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

        console.log('[FightTrades] Fallback trades found:', generalTrades.length);

        if (generalTrades.length === 0) {
          return Response.json({ success: true, data: [] });
        }

        // Format trades from general table
        const formattedFallbackTrades = generalTrades.map((trade) => {
          const amount = parseFloat(trade.amount.toString());
          const price = parseFloat(trade.price.toString());
          const notional = (amount * price).toFixed(2);

          return {
            id: trade.pacificaHistoryId.toString(),
            participantUserId: trade.userId, // userId in trades table = participantUserId
            executedAt: trade.executedAt.toISOString(),
            notional,
            side: trade.side,
            history_id: trade.pacificaHistoryId.toString(),
            order_id: trade.pacificaOrderId?.toString() || null,
            symbol: trade.symbol.includes('-USD') ? trade.symbol : `${trade.symbol}-USD`,
            amount: trade.amount.toString(),
            price: trade.price.toString(),
            fee: trade.fee?.toString() || '0',
            pnl: trade.pnl?.toString() || null,
            leverage: trade.leverage,
            isFightTrade: false, // Mark as from general trades table
            fightId,
          };
        });

        return Response.json({
          success: true,
          data: formattedFallbackTrades,
          source: 'trades_fallback', // Indicate this is fallback data
        });
      }

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
