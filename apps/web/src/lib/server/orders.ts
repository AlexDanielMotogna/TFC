/**
 * Order validation helpers for stake-based position limits
 *
 * @see MVP-SIMPLIFIED-RULES.md - Stake Limit section
 */
import { getPrices, MarketPrice } from './pacifica';
import {
  calculateFightExposure,
  getActiveFightForUser,
  getUserIdFromAccount,
  calculateAvailableCapital,
} from './fight-exposure';

// Re-export commonly used functions for backward compatibility
export {
  calculateFightExposure,
  getActiveFightForUser,
  getUserIdFromAccount,
} from './fight-exposure';

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
  const { currentExposure } = await calculateFightExposure(
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

  // Calculate available capital using centralized formula
  const availableCapital = calculateAvailableCapital(
    stake,
    maxExposureUsed,
    currentExposure
  );

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
    (error as unknown as { code: string }).code = 'STAKE_LIMIT_EXCEEDED';
    (
      error as unknown as {
        details: {
          stake: number;
          maxExposureUsed: number;
          currentExposure: number;
          orderNotional: number;
          newExposure: number;
          available: number;
        };
      }
    ).details = {
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
