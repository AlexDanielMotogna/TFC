/**
 * Fight Exposure Calculation Utilities
 *
 * Centralized module for calculating fight capital exposure.
 * This ensures consistent calculation across all parts of the system:
 * - Order validation (stake limit)
 * - Stake info API
 * - PnL calculations
 *
 * @see MVP-SIMPLIFIED-RULES.md - Stake Limit section
 */
import { prisma, FightStatus, Prisma } from '@tfc/db';

/**
 * Position tracking for exposure calculation
 */
interface PositionState {
  amount: number; // Positive = LONG, Negative = SHORT
  totalNotional: number; // Total USD value at entry prices
}

/**
 * Fight exposure calculation result
 */
export interface FightExposureResult {
  currentExposure: number; // Current open position notional value
  cumulativeOpeningNotional: number; // Total capital committed to OPENING positions (not closing)
  positionsBySymbol: Record<string, PositionState>;
}

/**
 * Calculate current position exposure for a specific fight from FightTrade records.
 * This is the SINGLE SOURCE OF TRUTH for exposure calculation.
 *
 * @param fightId - The specific fight to calculate exposure for
 * @param userId - The user's ID
 * @returns Current open position notional value and position details
 */
export async function calculateFightExposure(
  fightId: string,
  userId: string
): Promise<FightExposureResult> {
  const fightTrades = await prisma.fightTrade.findMany({
    where: {
      fightId,
      participantUserId: userId,
    },
    orderBy: {
      executedAt: 'asc',
    },
  });

  console.log(`[calculateFightExposure] Found ${fightTrades.length} trades for fight ${fightId}, user ${userId}`);
  fightTrades.forEach((t, i) => {
    console.log(`[calculateFightExposure]   Trade ${i + 1}: ${t.side} ${t.amount} ${t.symbol} @ ${t.price}`);
  });

  const result = calculateExposureFromTrades(fightTrades);
  console.log(`[calculateFightExposure] Result: currentExposure=${result.currentExposure}, cumulativeOpeningNotional=${result.cumulativeOpeningNotional}`);

  return result;
}

/**
 * Calculate exposure from a list of trades.
 * Pure function for easy testing.
 */
export function calculateExposureFromTrades(
  trades: Array<{
    symbol: string;
    side: string;
    amount: Prisma.Decimal | number | string;
    price: Prisma.Decimal | number | string;
  }>
): FightExposureResult {
  const positionsBySymbol: Record<string, PositionState> = {};

  // Track cumulative notional used for OPENING positions (not closing)
  // This is the total capital ever committed, regardless of whether positions were later closed
  let cumulativeOpeningNotional = 0;

  for (const trade of trades) {
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
        // Closing SHORT position (and possibly opening LONG)
        const shortToClose = Math.min(amount, Math.abs(pos.amount));
        const longToOpen = amount - shortToClose;

        // Reduce short notional proportionally
        if (Math.abs(pos.amount) > 0) {
          const avgShortEntry = pos.totalNotional / Math.abs(pos.amount);
          pos.totalNotional -= shortToClose * avgShortEntry;
        }

        // Add new long notional if opening long (flip case)
        if (longToOpen > 0) {
          pos.totalNotional += longToOpen * price;
          // Only the OPENING portion counts toward cumulative
          cumulativeOpeningNotional += longToOpen * price;
        }
      } else {
        // Opening/adding to LONG - entire amount is opening
        pos.totalNotional += amount * price;
        cumulativeOpeningNotional += amount * price;
      }
      pos.amount += amount;
    } else {
      // SELL: Opening/adding to SHORT, or closing LONG
      if (pos.amount > 0) {
        // Closing LONG position (and possibly opening SHORT)
        const longToClose = Math.min(amount, pos.amount);
        const shortToOpen = amount - longToClose;

        // Reduce long notional proportionally
        if (pos.amount > 0) {
          const avgLongEntry = pos.totalNotional / pos.amount;
          pos.totalNotional -= longToClose * avgLongEntry;
        }

        // Add new short notional if opening short (flip case)
        if (shortToOpen > 0) {
          pos.totalNotional += shortToOpen * price;
          // Only the OPENING portion counts toward cumulative
          cumulativeOpeningNotional += shortToOpen * price;
        }
      } else {
        // Opening/adding to SHORT - entire amount is opening
        pos.totalNotional += amount * price;
        cumulativeOpeningNotional += amount * price;
      }
      pos.amount -= amount;
    }
  }

  // Calculate total current exposure
  // Threshold for considering a position as closed (handles floating point issues)
  const DUST_THRESHOLD = 0.0000001;

  const currentExposure = Object.values(positionsBySymbol).reduce(
    (sum, pos) => {
      // Only count if there's still an open position
      if (Math.abs(pos.amount) < DUST_THRESHOLD) {
        return sum;
      }
      return sum + Math.abs(pos.totalNotional);
    },
    0
  );

  return {
    currentExposure,
    cumulativeOpeningNotional,
    positionsBySymbol,
  };
}

/**
 * Get active LIVE fight for a user (if any)
 *
 * @param userId - User ID
 * @param fightId - Optional specific fight ID. If provided, only returns if user is in that specific fight.
 */
export async function getActiveFightForUser(
  userId: string,
  fightId?: string
): Promise<{
  fightId: string;
  participantId: string;
  stakeUsdc: number;
  maxExposureUsed: number;
} | null> {
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
 * Calculate available capital for a fight participant
 *
 * Formula: available = stake - maxExposureUsed + currentExposure
 *
 * Because capital in open positions can be "reused" (it's already counted in maxExposureUsed)
 * Example: stake=$100, maxUsed=$80, current=$80 → available=$100 (can close and reopen up to $100)
 * Example: stake=$100, maxUsed=$80, current=$0 → available=$20 (already used $80, only $20 left)
 */
export function calculateAvailableCapital(
  stake: number,
  maxExposureUsed: number,
  currentExposure: number
): number {
  return Math.max(0, stake - maxExposureUsed + currentExposure);
}

/**
 * Check if user has any active LIVE fight
 * Used for MVP rule: only one active fight per user
 */
export async function hasActiveFight(userId: string): Promise<{
  hasActive: boolean;
  activeFight?: {
    fightId: string;
    startedAt: Date | null;
    opponentHandle?: string;
  };
}> {
  const participant = await prisma.fightParticipant.findFirst({
    where: {
      userId,
      fight: { status: FightStatus.LIVE },
    },
    include: {
      fight: {
        select: {
          id: true,
          startedAt: true,
          participants: {
            where: {
              userId: { not: userId },
            },
            include: {
              user: {
                select: { handle: true },
              },
            },
          },
        },
      },
    },
  });

  if (!participant) {
    return { hasActive: false };
  }

  const opponent = participant.fight.participants[0];

  return {
    hasActive: true,
    activeFight: {
      fightId: participant.fight.id,
      startedAt: participant.fight.startedAt,
      opponentHandle: opponent?.user?.handle,
    },
  };
}

/**
 * Check if user has any pending WAITING fight (as creator)
 * Used for MVP rule: only one active fight per user (includes waiting fights)
 */
export async function hasWaitingFight(userId: string): Promise<{
  hasWaiting: boolean;
  waitingFight?: {
    fightId: string;
    createdAt: Date;
  };
}> {
  const fight = await prisma.fight.findFirst({
    where: {
      creatorId: userId,
      status: FightStatus.WAITING,
    },
    select: {
      id: true,
      createdAt: true,
    },
  });

  if (!fight) {
    return { hasWaiting: false };
  }

  return {
    hasWaiting: true,
    waitingFight: {
      fightId: fight.id,
      createdAt: fight.createdAt,
    },
  };
}

/**
 * Update maxExposureUsed for a participant after a trade
 * Only updates if newExposure is higher than current value (water mark)
 *
 * @param participantId - FightParticipant ID
 * @param newExposure - New calculated exposure after trade
 */
export async function updateMaxExposureIfHigher(
  participantId: string,
  newExposure: number
): Promise<void> {
  console.log(`[updateMaxExposureIfHigher] Called with participantId=${participantId}, newExposure=${newExposure}`);

  // Get current value
  const current = await prisma.fightParticipant.findUnique({
    where: { id: participantId },
    select: { maxExposureUsed: true },
  });

  const currentMax = parseFloat(current?.maxExposureUsed?.toString() || '0');
  console.log(`[updateMaxExposureIfHigher] Current maxExposureUsed=${currentMax}`);

  // Only update if new value is higher
  if (newExposure > currentMax) {
    console.log(`[updateMaxExposureIfHigher] Updating: ${currentMax} -> ${newExposure}`);
    const result = await prisma.fightParticipant.update({
      where: { id: participantId },
      data: { maxExposureUsed: newExposure },
    });
    console.log(`[updateMaxExposureIfHigher] Update result: maxExposureUsed=${result.maxExposureUsed}`);
  } else {
    console.log(`[updateMaxExposureIfHigher] No update needed (${newExposure} <= ${currentMax})`);
  }
}

/**
 * Get user ID from Pacifica account address
 */
export async function getUserIdFromAccount(
  accountAddress: string
): Promise<string | null> {
  const connection = await prisma.pacificaConnection.findUnique({
    where: { accountAddress },
  });

  return connection?.userId || null;
}
