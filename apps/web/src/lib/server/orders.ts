/**
 * Order validation helpers for stake-based position limits
 *
 * @see MVP-SIMPLIFIED-RULES.md - Stake Limit section
 */
import { getPrices, MarketPrice, getOpenOrders, getPositions } from './pacifica';
import {
  calculateFightExposure,
  getActiveFightForUser,
  getUserIdFromAccount,
  calculateAvailableCapital,
  updateMaxExposureIfHigher,
} from './fight-exposure';
import { prisma } from '@tfc/db';

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
  let { maxExposureUsed } = activeFight;

  // Calculate current position exposure from FightTrade records for THIS specific fight
  const { currentExposure: fightTradeExposure } = await calculateFightExposure(
    activeFight.fightId,
    userId
  );

  // Also get live Pacifica positions for symbols traded during THIS fight
  // This catches positions from filled limit orders that haven't been recorded to FightTrade yet
  // Only count positions in symbols where we have a TfcOrderAction for this fight
  let livePositionExposure = 0;
  try {
    // Get symbols that were actually traded during this fight
    const fightSymbolsRaw = await prisma.$queryRaw<Array<{ symbol: string }>>`
      SELECT DISTINCT symbol
      FROM tfc_order_actions
      WHERE fight_id = ${activeFight.fightId}
        AND user_id = ${userId}
        AND success = true
    `;
    const fightSymbols = new Set(fightSymbolsRaw.map(r => r.symbol));

    if (fightSymbols.size > 0) {
      const positions = await getPositions(accountAddress);
      // Only count positions in symbols that were traded during THIS fight
      livePositionExposure = positions
        .filter((p: any) => fightSymbols.has(p.symbol))
        .reduce((sum: number, p: any) => {
          return sum + Math.abs(parseFloat(p.amount)) * parseFloat(p.entry_price);
        }, 0);
    }
  } catch (err) {
    console.error('[validateStakeLimit] Failed to fetch live positions:', err);
  }

  // Use the HIGHER of FightTrade exposure vs live position exposure
  // This ensures we don't under-count when fill detector hasn't caught up
  const currentExposure = Math.max(fightTradeExposure, livePositionExposure);

  // If live exposure is higher than recorded maxExposureUsed, update the water mark
  if (livePositionExposure > maxExposureUsed) {
    maxExposureUsed = livePositionExposure;
    // Fire-and-forget update to DB
    updateMaxExposureIfHigher(activeFight.participantId, livePositionExposure).catch(err => {
      console.error('[validateStakeLimit] Failed to update maxExposureUsed:', err);
    });
  }

  // Calculate order notional value
  let orderPrice: number;
  if (type === 'MARKET' || !price) {
    orderPrice = await getCurrentPrice(symbol);
  } else {
    orderPrice = parseFloat(price);
  }

  const orderAmount = Math.abs(parseFloat(amount));
  const orderNotional = orderPrice * orderAmount;

  // Calculate pending notional from unfilled limit/stop orders placed during this fight
  let pendingNotional = 0;
  try {
    // Use raw SQL with TEXT cast because CREATE_STOP may not be in the PostgreSQL enum yet
    const [openOrders, fightOrderActions] = await Promise.all([
      getOpenOrders(accountAddress),
      prisma.$queryRaw<Array<{ pacifica_order_id: bigint }>>`
        SELECT pacifica_order_id
        FROM tfc_order_actions
        WHERE fight_id = ${activeFight.fightId}
          AND user_id = ${userId}
          AND action_type::text IN ('LIMIT_ORDER', 'CREATE_STOP')
          AND pacifica_order_id IS NOT NULL
          AND success = true
      `,
    ]);

    const fightOrderIds = new Set(
      fightOrderActions.map(a => a.pacifica_order_id.toString())
    );

    // Sum notional of open orders that were placed during this fight
    // Use remaining amount (initial - filled - cancelled) for partially filled orders
    // For stop orders, use stop_price when price is 0 (stop market orders have no limit price)
    pendingNotional = openOrders
      .filter(o => fightOrderIds.has(o.order_id?.toString()))
      .reduce((sum, o) => {
        const remaining = parseFloat(o.initial_amount) - parseFloat(o.filled_amount) - parseFloat(o.cancelled_amount || '0');
        const orderPrice = parseFloat(o.price) || parseFloat(o.stop_price || '0');
        return sum + Math.max(0, remaining) * orderPrice;
      }, 0);
  } catch (err) {
    console.error('[validateStakeLimit] Failed to calculate pending notional:', err);
    // Continue without pending notional rather than blocking the order
  }

  // Calculate new exposure after this order
  const newExposure = currentExposure + orderNotional;

  // Calculate available capital using centralized formula, minus pending order notional
  const availableCapital = calculateAvailableCapital(
    stake,
    maxExposureUsed,
    currentExposure
  ) - pendingNotional;

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
          pendingNotional: number;
          orderNotional: number;
          newExposure: number;
          available: number;
        };
      }
    ).details = {
      stake,
      maxExposureUsed,
      currentExposure,
      pendingNotional,
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
