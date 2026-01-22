/**
 * Order validation helpers for stake-based position limits
 */
import { prisma, FightStatus } from '@tfc/db';
import { getPrices, MarketPrice } from './pacifica';

/**
 * Get current market price for a symbol
 */
export async function getCurrentPrice(symbol: string): Promise<number> {
  const prices = await getPrices();
  const price = prices.find((p: MarketPrice) => p.symbol === symbol);

  if (!price) {
    throw new Error(`Price not found for symbol: ${symbol}`);
  }

  return parseFloat(price.mark);
}

/**
 * Calculate current position exposure for a specific fight from FightTrade records
 * This ensures each fight has independent exposure tracking
 *
 * @param fightId - The specific fight to calculate exposure for
 * @param userId - The user's ID
 * @returns Current open position notional value for this fight only
 */
export async function calculateFightExposure(
  fightId: string,
  userId: string
): Promise<number> {
  const fightTrades = await prisma.fightTrade.findMany({
    where: {
      fightId,
      participantUserId: userId,
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

    const pos = positionsBySymbol[symbol];

    if (trade.side === 'BUY') {
      // Opening/adding to LONG, or closing SHORT
      if (pos.amount < 0) {
        // Closing SHORT position
        const shortToClose = Math.min(amount, Math.abs(pos.amount));
        const longToOpen = amount - shortToClose;
        // Reduce short notional proportionally
        if (Math.abs(pos.amount) > 0) {
          const avgShortEntry = pos.totalNotional / Math.abs(pos.amount);
          pos.totalNotional -= shortToClose * avgShortEntry;
        }
        // Add new long notional if opening long
        if (longToOpen > 0) {
          pos.totalNotional += longToOpen * price;
        }
      } else {
        // Opening/adding to LONG
        pos.totalNotional += amount * price;
      }
      pos.amount += amount;
    } else {
      // SELL: Opening/adding to SHORT, or closing LONG
      if (pos.amount > 0) {
        // Closing LONG position
        const longToClose = Math.min(amount, pos.amount);
        const shortToOpen = amount - longToClose;
        // Reduce long notional proportionally
        if (pos.amount > 0) {
          const avgLongEntry = pos.totalNotional / pos.amount;
          pos.totalNotional -= longToClose * avgLongEntry;
        }
        // Add new short notional if opening short
        if (shortToOpen > 0) {
          pos.totalNotional += shortToOpen * price;
        }
      } else {
        // Opening/adding to SHORT
        pos.totalNotional += amount * price;
      }
      pos.amount -= amount;
    }
  }

  // Current exposure = sum of absolute notional values of open positions from THIS fight
  return Object.values(positionsBySymbol).reduce((sum, pos) => {
    // Only count if there's still an open position
    if (Math.abs(pos.amount) < 0.0000001) {
      return sum;
    }
    return sum + Math.abs(pos.totalNotional);
  }, 0);
}

/**
 * Get active LIVE fight for a user (if any)
 * @param fightId - Optional specific fight ID to look for. If provided, only returns if user is in that specific fight.
 */
export async function getActiveFightForUser(userId: string, fightId?: string): Promise<{
  fightId: string;
  participantId: string;
  stakeUsdc: number;
  maxExposureUsed: number;
} | null> {
  // Build where clause - if fightId provided, look for that specific fight
  const whereClause = fightId
    ? {
        userId,
        fightId,
        fight: { status: FightStatus.LIVE },
      }
    : {
        userId,
        fight: { status: FightStatus.LIVE },
      };

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
    return null;
  }

  return {
    fightId: participant.fight.id,
    participantId: participant.id,
    stakeUsdc: participant.fight.stakeUsdc,
    maxExposureUsed: parseFloat(participant.maxExposureUsed?.toString() || '0'),
  };
}

/**
 * Get user ID from Pacifica account address
 */
export async function getUserIdFromAccount(accountAddress: string): Promise<string | null> {
  const connection = await prisma.pacificaConnection.findUnique({
    where: { accountAddress },
  });

  return connection?.userId || null;
}

/**
 * Validate order against stake limit
 * Throws error if order would exceed the stake limit
 *
 * Returns fight info if validation passes and user is in a fight
 * (used to update maxExposureUsed after order executes)
 *
 * @param fightId - Optional specific fight ID. If provided, validates against that fight only.
 *                  If not provided, validates against any active fight the user is in.
 */
export async function validateStakeLimit(
  accountAddress: string,
  symbol: string,
  amount: string,
  price: string | undefined,
  type: 'MARKET' | 'LIMIT',
  reduceOnly: boolean,
  fightId?: string
): Promise<{
  inFight: boolean;
  fightId?: string;
  participantId?: string;
  newExposure?: number;
  currentMaxExposure?: number;
} | null> {
  // Reduce-only orders are always allowed (they reduce exposure)
  if (reduceOnly) {
    return { inFight: false };
  }

  // Get user ID from account
  const userId = await getUserIdFromAccount(accountAddress);
  if (!userId) {
    // User not linked to TFC - no restrictions
    return { inFight: false };
  }

  // Check if user is in an active fight (specific fight if fightId provided)
  const activeFight = await getActiveFightForUser(userId, fightId);
  if (!activeFight) {
    // Not in a fight (or not in the specified fight) - no restrictions
    return { inFight: false };
  }

  const stake = activeFight.stakeUsdc;
  const { maxExposureUsed } = activeFight;

  // Calculate current position exposure from FightTrade records for THIS specific fight
  const currentExposure = await calculateFightExposure(
    activeFight.fightId,
    userId
  );

  // Calculate order notional value
  let orderPrice: number;
  if (type === 'MARKET' || !price) {
    orderPrice = await getCurrentPrice(symbol);
  } else {
    orderPrice = parseFloat(price);
  }

  const orderAmount = Math.abs(parseFloat(amount));
  const orderNotional = orderPrice * orderAmount;

  // Calculate new exposure after this order
  const newExposure = currentExposure + orderNotional;

  // Calculate available capital: stake minus what's already been used (maxExposureUsed)
  // BUT we can "reuse" capital that's currently in open positions (currentExposure)
  // because that capital is already counted in maxExposureUsed
  //
  // Example with $100 stake:
  // 1. Open $80 position → maxExposure=$80, current=$80, available=$20
  // 2. Close position → maxExposure=$80, current=$0, available=$20 (NOT $100!)
  // 3. Open $20 position → maxExposure=$100, current=$20, available=$0
  //
  // The formula: available = stake - maxExposureUsed + currentExposure
  // Because currentExposure is "capital already allocated" that can be reused
  const availableCapital = stake - maxExposureUsed + currentExposure;

  // Check if order exceeds available capital
  if (orderNotional > availableCapital) {
    const available = Math.max(0, availableCapital);
    const error = new Error(
      `Stake limit exceeded. ` +
      `Fight stake: ${stake.toFixed(2)} USDC. ` +
      `Max capital used: ${maxExposureUsed.toFixed(2)} USDC. ` +
      `Available: ${available.toFixed(2)} USDC. ` +
      `Order size: ${orderNotional.toFixed(2)} USDC.`
    );
    (error as any).code = 'STAKE_LIMIT_EXCEEDED';
    (error as any).details = {
      stake,
      maxExposureUsed,
      currentExposure,
      orderNotional,
      newExposure,
      available,
    };
    throw error;
  }

  // maxExposureUsed is now updated in recordFightTradeWithDetails after the trade is recorded
  // This ensures the calculation uses the actual recorded FightTrade data

  return {
    inFight: true,
    fightId: activeFight.fightId,
    participantId: activeFight.participantId,
  };
}

// Note: maxExposureUsed is now updated inside recordFightTradeWithDetails in route.ts
// after the FightTrade is recorded. This ensures accurate calculation from actual trade data.
