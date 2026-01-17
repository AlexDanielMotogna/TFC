/**
 * Fight positions endpoint
 * GET /api/fights/[id]/positions
 * Returns positions for THIS specific fight calculated from FightTrade records
 * Each fight has independent position tracking
 */
import { withAuth } from '@/lib/server/auth';
import { prisma } from '@/lib/server/db';
import { errorResponse, ForbiddenError } from '@/lib/server/errors';
import { getPrices, getPositions } from '@/lib/server/pacifica';

// Default max leverage per symbol (from Pacifica settings)
// Pacifica REST API doesn't return leverage, so we use these defaults
const MAX_LEVERAGE: Record<string, number> = {
  BTC: 50, ETH: 50, SOL: 20, HYPE: 20, XRP: 20, DOGE: 20, LINK: 20, AVAX: 20,
  SUI: 10, BNB: 10, AAVE: 10, ARB: 10, OP: 10, APT: 10, INJ: 10, TIA: 10,
  SEI: 10, WIF: 10, JUP: 10, PENDLE: 10, RENDER: 10, FET: 10, ZEC: 10,
  PAXG: 10, ENA: 10, KPEPE: 10,
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: fightId } = await params;

  return withAuth(request, async (user) => {
    try {
      // Get fight and participant info
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

      // Get FightTrade records for THIS specific fight
      const fightTrades = await prisma.fightTrade.findMany({
        where: {
          fightId,
          participantUserId: user.userId,
        },
        orderBy: {
          executedAt: 'asc',
        },
      });

      console.log(`[FightPositions] Found ${fightTrades.length} fight trades for user ${user.userId} in fight ${fightId}`);
      fightTrades.forEach((t, i) => {
        console.log(`[FightPositions] Trade ${i + 1}: ${t.side} ${t.amount} ${t.symbol} @ ${t.price}`);
      });

      // Calculate net position per symbol from fight trades
      // Also track leverage used (from the trades that opened the position)
      const positionsBySymbol: Record<string, {
        amount: number;
        totalCost: number;
        tradesCount: number;
        leverage: number | null; // Leverage used when opening the position
      }> = {};

      for (const trade of fightTrades) {
        const symbol = trade.symbol;
        const amount = parseFloat(trade.amount.toString());
        const price = parseFloat(trade.price.toString());

        if (!positionsBySymbol[symbol]) {
          positionsBySymbol[symbol] = { amount: 0, totalCost: 0, tradesCount: 0, leverage: null };
        }

        const pos = positionsBySymbol[symbol];
        pos.tradesCount++;

        // Track leverage from opening trades (BUY opens LONG, SELL opens SHORT)
        if (trade.leverage) {
          pos.leverage = trade.leverage;
        }

        if (trade.side === 'BUY') {
          if (pos.amount < 0) {
            // Closing SHORT position
            // Calculate how much closes the short vs opens new long
            const shortToClose = Math.min(amount, Math.abs(pos.amount));
            const longToOpen = amount - shortToClose;

            // Reduce short cost proportionally
            if (Math.abs(pos.amount) > 0) {
              const avgShortEntry = pos.totalCost / Math.abs(pos.amount);
              pos.totalCost -= shortToClose * avgShortEntry;
            }

            // Add new long cost if opening long
            if (longToOpen > 0) {
              pos.totalCost += longToOpen * price;
            }

            pos.amount += amount;
          } else {
            // Opening or adding to LONG position
            pos.totalCost += amount * price;
            pos.amount += amount;
          }
        } else {
          // SELL
          if (pos.amount > 0) {
            // Closing LONG position
            // Calculate how much closes the long vs opens new short
            const longToClose = Math.min(amount, pos.amount);
            const shortToOpen = amount - longToClose;

            // Reduce long cost proportionally
            if (pos.amount > 0) {
              const avgLongEntry = pos.totalCost / pos.amount;
              pos.totalCost -= longToClose * avgLongEntry;
            }

            // Add new short cost if opening short
            if (shortToOpen > 0) {
              pos.totalCost += shortToOpen * price;
            }

            pos.amount -= amount;
          } else {
            // Opening or adding to SHORT position
            pos.totalCost += amount * price;
            pos.amount -= amount;
          }
        }
      }

      // Get Pacifica connection for this user to fetch real position data
      const pacificaConnection = await prisma.pacificaConnection.findUnique({
        where: { userId: user.userId },
        select: { accountAddress: true },
      });

      // Get current prices and real positions from Pacifica
      // Note: Pacifica REST API doesn't return leverage, so we use MAX_LEVERAGE defaults
      const [prices, realPositions] = await Promise.all([
        getPrices(),
        pacificaConnection?.accountAddress
          ? getPositions(pacificaConnection.accountAddress)
          : Promise.resolve([]),
      ]);

      // Helper to normalize symbol (ensure consistent format)
      const normalizeSymbol = (s: string) => s.includes('-USD') ? s : `${s}-USD`;
      // Helper to get base symbol (BTC from BTC-USD)
      const getBaseSymbol = (s: string) => s.replace('-USD', '');

      // Create lookup map for real position data (for funding)
      const realPositionBySymbol: Record<string, {
        funding: string;
      }> = {};
      for (const pos of realPositions) {
        const normalizedSymbol = normalizeSymbol(pos.symbol);
        realPositionBySymbol[normalizedSymbol] = {
          funding: pos.funding || '0',
        };
      }

      // Log calculated positions before filtering
      console.log('[FightPositions] Calculated positions:', JSON.stringify(positionsBySymbol));

      // Build position list from calculated data
      const fightPositions = Object.entries(positionsBySymbol)
        .filter(([_, pos]) => Math.abs(pos.amount) > 0.0000001) // Only open positions
        .map(([symbol, pos]) => {
          // Normalize symbol for lookups
          const normalizedSymbol = normalizeSymbol(symbol);
          const baseSymbol = getBaseSymbol(normalizedSymbol);

          const priceData = prices.find((p) => normalizeSymbol(p.symbol) === normalizedSymbol);
          const markPrice = priceData ? parseFloat(priceData.mark) : 0;
          // For both LONG and SHORT, totalCost is positive and represents entry_price * |amount|
          // avgEntryPrice should always be positive
          const avgEntryPrice = Math.abs(pos.amount) > 0 ? pos.totalCost / Math.abs(pos.amount) : 0;

          // Get leverage: first from FightTrade (if available), then from MAX_LEVERAGE defaults
          // FightTrade.leverage is set when placing the order, so it's the actual leverage used
          const leverage = pos.leverage || MAX_LEVERAGE[baseSymbol] || 10;

          // Calculate PnL
          const priceDiff = markPrice - avgEntryPrice;
          const unrealizedPnl = priceDiff * pos.amount;
          const positionValue = Math.abs(pos.amount) * markPrice;

          // Calculate margin from leverage
          const margin = positionValue / leverage;

          // ROI% is PnL as percentage of margin (not position value)
          const roiPercent = margin > 0 ? (unrealizedPnl / margin) * 100 : 0;

          // Get funding from real position if available
          const realPos = realPositionBySymbol[normalizedSymbol];

          console.log(`[FightPositions] ${baseSymbol}: leverage=${leverage}, posValue=${positionValue.toFixed(2)}, margin=${margin.toFixed(2)}, pnl=${unrealizedPnl.toFixed(4)}, roi=${roiPercent.toFixed(2)}%`);

          // Format price with appropriate precision (5 decimals for small prices, 2 for large)
          const formatPrice = (p: number) => p < 1 ? p.toFixed(5) : p.toFixed(2);

          return {
            symbol: normalizedSymbol,
            side: pos.amount > 0 ? 'LONG' : 'SHORT',
            size: Math.abs(pos.amount).toString(),
            entryPrice: formatPrice(avgEntryPrice),
            markPrice: formatPrice(markPrice),
            leverage: leverage.toString(),
            margin: margin.toFixed(2),
            unrealizedPnl: unrealizedPnl.toFixed(4),
            unrealizedPnlPercent: roiPercent.toFixed(2),
            funding: realPos?.funding || '0',
            liqPrice: '0', // Not available from REST API
            // Fight-specific metadata
            isFightPosition: true,
            fightAmount: pos.amount.toString(),
            totalAmount: pos.amount.toString(),
            initialAmount: '0',
          };
        });

      return Response.json({
        success: true,
        data: fightPositions,
      });
    } catch (error) {
      console.error('[FightPositions] Error:', error);
      return errorResponse(error);
    }
  });
}
