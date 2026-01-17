/**
 * Stake info endpoint
 * GET /api/fights/stake-info?account=...&fightId=...
 * Returns stake limit info for users in active fights
 *
 * If fightId is provided, returns info for that specific fight
 * Otherwise, returns info for any active fight the user is in
 */
import { errorResponse, BadRequestError } from '@/lib/server/errors';
import { prisma, FightStatus } from '@tfc/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const account = searchParams.get('account');
    const fightId = searchParams.get('fightId');

    if (!account) {
      throw new BadRequestError('account is required');
    }

    // Get user from account
    const connection = await prisma.pacificaConnection.findUnique({
      where: { accountAddress: account },
    });

    if (!connection) {
      // Not linked to TFC - no stake info
      return Response.json({
        success: true,
        data: {
          inFight: false,
          stake: null,
          currentExposure: null,
          available: null,
        },
      });
    }

    // Build query - if fightId is provided, look for that specific fight
    // Otherwise, look for any active fight
    const whereClause = fightId
      ? {
          userId: connection.userId,
          fightId: fightId,
          fight: { status: FightStatus.LIVE },
        }
      : {
          userId: connection.userId,
          fight: { status: FightStatus.LIVE },
        };

    // Check if in active fight
    const participant = await prisma.fightParticipant.findFirst({
      where: whereClause,
      include: {
        fight: {
          select: {
            id: true,
            stakeUsdc: true,
          },
        },
      },
    });

    if (!participant) {
      return Response.json({
        success: true,
        data: {
          inFight: false,
          stake: null,
          currentExposure: null,
          available: null,
        },
      });
    }

    // Calculate current exposure from FightTrade records for THIS specific fight
    // This ensures each fight has independent exposure tracking
    const fightTrades = await prisma.fightTrade.findMany({
      where: {
        fightId: participant.fight.id,
        participantUserId: connection.userId,
      },
    });

    // Calculate net position per symbol from fight trades
    const positionsBySymbol: Record<string, { amount: number; totalNotional: number }> = {};

    for (const trade of fightTrades) {
      const symbol = trade.symbol;
      const amount = parseFloat(trade.amount.toString());
      const price = parseFloat(trade.price.toString());

      if (!positionsBySymbol[symbol]) {
        positionsBySymbol[symbol] = { amount: 0, totalNotional: 0 };
      }

      if (trade.side === 'BUY') {
        positionsBySymbol[symbol].amount += amount;
        positionsBySymbol[symbol].totalNotional += amount * price;
      } else {
        // SELL reduces the position
        positionsBySymbol[symbol].amount -= amount;
        // Reduce notional proportionally (we're closing part of the position)
        if (positionsBySymbol[symbol].amount > 0) {
          // Still have long position, reduce notional
          const avgEntryPrice = positionsBySymbol[symbol].totalNotional / (positionsBySymbol[symbol].amount + amount);
          positionsBySymbol[symbol].totalNotional = positionsBySymbol[symbol].amount * avgEntryPrice;
        } else {
          // Position closed or went short
          positionsBySymbol[symbol].totalNotional = 0;
        }
      }
    }

    // Current exposure = sum of absolute notional values of open positions from THIS fight
    const currentExposure = Object.values(positionsBySymbol).reduce((sum: number, pos: any) => {
      // Only count if there's still an open position
      if (Math.abs(pos.amount) < 0.0000001) {
        return sum;
      }
      return sum + Math.abs(pos.totalNotional);
    }, 0);

    const stake = participant.fight.stakeUsdc;
    // maxExposureUsed tracks the highest exposure ever reached during the fight
    // This never decreases, even when positions are closed
    const maxExposureUsed = parseFloat(participant.maxExposureUsed?.toString() || '0');
    // Available = stake - maxExposureUsed + currentExposure
    // Because capital in open positions can be "reused" (it's already counted in maxExposureUsed)
    // Example: stake=$100, maxUsed=$80, current=$80 → available=$100 (can close and reopen up to $100)
    // Example: stake=$100, maxUsed=$80, current=$0 → available=$20 (already used $80, only $20 left)
    const available = Math.max(0, stake - maxExposureUsed + currentExposure);

    return Response.json({
      success: true,
      data: {
        inFight: true,
        fightId: participant.fight.id,
        stake,
        currentExposure,  // Still useful to show actual position size
        maxExposureUsed,  // The actual limit tracker
        available,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
