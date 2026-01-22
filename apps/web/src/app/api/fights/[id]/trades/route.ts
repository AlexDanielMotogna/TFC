/**
 * Fight trades endpoint
 * GET /api/fights/[id]/trades
 * Returns trades executed during the fight from Pacifica (filtered by FightTrade records)
 */
import { withAuth } from '@/lib/server/auth';
import { prisma } from '@/lib/server/db';
import { errorResponse, ForbiddenError } from '@/lib/server/errors';

const PACIFICA_API_URL = process.env.PACIFICA_API_URL || 'https://api.pacifica.fi';

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

      // Get fight trade history_ids from database (include participantUserId for display)
      const fightTrades = await prisma.fightTrade.findMany({
        where: {
          fightId,
          // Only filter by user if fight is still live
          ...(isCompleted ? {} : { participantUserId: user.userId }),
        },
        select: {
          pacificaHistoryId: true,
          participantUserId: true,
        },
      });

      // If no trades recorded for this fight, return empty
      if (fightTrades.length === 0) {
        return Response.json({ success: true, data: [] });
      }

      // Build map of history IDs -> participantUserId for matching and lookup
      const fightHistoryMap = new Map<string, string>();
      for (const t of fightTrades) {
        fightHistoryMap.set(t.pacificaHistoryId.toString(), t.participantUserId);
      }

      // Get unique participant user IDs from the fight trades
      const participantUserIds = [...new Set(fightTrades.map(t => t.participantUserId))];

      // Get Pacifica connections for all participants whose trades we need
      const pacificaConnections = await prisma.pacificaConnection.findMany({
        where: {
          userId: { in: participantUserIds },
        },
        select: {
          userId: true,
          accountAddress: true,
        },
      });

      if (pacificaConnections.length === 0) {
        return Response.json({ success: true, data: [] });
      }

      // Fetch trade history from Pacifica for each participant's account
      const allPacificaTrades: any[] = [];
      for (const connection of pacificaConnections) {
        if (!connection.accountAddress) continue;

        try {
          const url = `${PACIFICA_API_URL}/api/v1/trades/history?account=${connection.accountAddress}&limit=200`;
          const response = await fetch(url);
          if (response.ok) {
            const pacificaResponse = await response.json();
            const trades = pacificaResponse.data || [];
            allPacificaTrades.push(...trades);
          }
        } catch (err) {
          console.error(`[FightTrades] Error fetching from Pacifica for user ${connection.userId}:`, err);
        }
      }

      // Filter to only fight trades by history_id
      const matchedTrades = allPacificaTrades.filter((pt: any) =>
        fightHistoryMap.has(pt.history_id?.toString())
      );

      // Format trades for the fight results page
      // Need to include participantUserId and executedAt for the UI
      const formattedTrades = matchedTrades.map((trade: any) => {
        const historyId = trade.history_id?.toString() || '';
        const participantUserId = fightHistoryMap.get(historyId) || '';

        // Convert Pacifica's created_at (ms timestamp) to ISO string for executedAt
        const executedAt = trade.created_at
          ? new Date(trade.created_at).toISOString()
          : new Date().toISOString();

        // Calculate notional value
        const amount = parseFloat(trade.amount || '0');
        const price = parseFloat(trade.price || '0');
        const notional = (amount * price).toFixed(2);

        // Normalize side from Pacifica format (open_long, close_short) to BUY/SELL
        let normalizedSide = trade.side;
        if (trade.side === 'open_long' || trade.side === 'close_short') {
          normalizedSide = 'BUY';
        } else if (trade.side === 'open_short' || trade.side === 'close_long') {
          normalizedSide = 'SELL';
        }

        return {
          // UI expected fields
          id: historyId,
          participantUserId,
          executedAt,
          notional,
          side: normalizedSide,
          // Pacifica fields
          history_id: trade.history_id,
          order_id: trade.order_id,
          client_order_id: trade.client_order_id,
          symbol: trade.symbol,
          amount: trade.amount,
          price: trade.price,
          entry_price: trade.entry_price,
          fee: trade.fee,
          pnl: trade.pnl,
          event_type: trade.event_type,
          cause: trade.cause,
          created_at: trade.created_at,
          leverage: null, // Pacifica doesn't return leverage per trade
          // Fight metadata
          isFightTrade: true,
          fightId,
        };
      });

      // Sort by execution time (oldest first for chronological order)
      formattedTrades.sort((a, b) => {
        const timeA = new Date(a.executedAt).getTime();
        const timeB = new Date(b.executedAt).getTime();
        return timeA - timeB;
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
