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

  return calculateExposureFromTrades(fightTrades);
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
 * Uses atomic update to prevent race conditions
 *
 * @param participantId - FightParticipant ID
 * @param newExposure - New calculated exposure after trade
 */
export async function updateMaxExposureIfHigher(
  participantId: string,
  newExposure: number
): Promise<void> {
  // Use raw SQL for atomic "update only if higher" operation
  // This prevents race conditions when multiple trades execute concurrently
  // IMPORTANT: Use COALESCE because GREATEST(NULL, x) returns NULL in PostgreSQL
  await prisma.$executeRaw`
    UPDATE fight_participants
    SET max_exposure_used = GREATEST(COALESCE(max_exposure_used, 0), ${newExposure}::decimal(18,6))
    WHERE id = ${participantId}::uuid
  `;
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
