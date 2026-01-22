/**
 * Fight PnL Calculator
 *
 * Extracted from fight-engine.ts for testability.
 * Implements Fight-Engine_Rules.md Rules 18-25:
 *
 * Rules 18-21 (PnL Calculation):
 * - Rule 18: PnL is calculated ONLY from valid fight trades (completely closed)
 * - Rule 19: Open positions don't generate PnL
 * - Rule 20: If fight ends with open positions, those are NOT included in PnL
 * - Rule 21: For valid PnL, all positions must be closed before endTime
 *
 * Rules 22-25 (Fees):
 * - Rule 22: PnL MUST include ALL trading fees
 * - Rule 23: Fees include Pacifica fees + 0.05% platform fee
 * - Rule 24: PnL = Gross PnL - Pacifica fees - platform fee
 * - Rule 25: PnL shown is NET PnL after all fees
 */

export interface FightTrade {
  symbol: string;
  side: 'BUY' | 'SELL';
  amount: number;
  price: number;
  pnl: number; // From Pacifica: opening trades = -fee, closing trades = actual pnl
  fee: number;
  leverage?: number | null;
}

export interface PnlCalculationResult {
  realizedPnl: number;
  unrealizedPnl: number;
  totalFees: number;
  margin: number;
  tradesCount: number;
  positionsBySymbol: Record<string, {
    amount: number;
    totalCost: number;
    leverage: number | null;
  }>;
}

/**
 * Calculate realized PnL from fight trades
 *
 * Per Fight-Engine_Rules.md Rules 18-21:
 * - Only CLOSING trades count for realized PnL
 * - Opening trades don't contribute (even though they have negative pnl = -fee)
 *
 * @param trades - Array of fight trades in chronological order
 * @param currentPrices - Optional map of symbol -> current mark price for unrealized PnL
 */
export function calculateFightPnl(
  trades: FightTrade[],
  currentPrices?: Record<string, number>
): PnlCalculationResult {
  const positionsBySymbol: Record<string, { amount: number; totalCost: number; leverage: number | null }> = {};

  let realizedPnl = 0;
  let totalFees = 0;

  for (const trade of trades) {
    const { symbol, side, amount, price, pnl, fee, leverage } = trade;

    totalFees += fee;

    if (!positionsBySymbol[symbol]) {
      positionsBySymbol[symbol] = { amount: 0, totalCost: 0, leverage: leverage || null };
    }

    // Update leverage if this trade has one
    if (leverage) {
      positionsBySymbol[symbol].leverage = leverage;
    }

    if (side === 'BUY') {
      // BUY increases LONG position or closes SHORT
      if (positionsBySymbol[symbol].amount < 0) {
        // CLOSING SHORT position - this pnl counts!
        const absShort = Math.abs(positionsBySymbol[symbol].amount);
        const closeAmount = Math.min(amount, absShort);
        const openAmount = amount - closeAmount;

        // Only count pnl proportionally if partially closing
        if (closeAmount > 0 && amount > 0) {
          const pnlPortion = closeAmount / amount;
          realizedPnl += pnl * pnlPortion;
        }

        // Reduce SHORT proportionally
        if (absShort > 0) {
          const avgShortEntry = positionsBySymbol[symbol].totalCost / absShort;
          positionsBySymbol[symbol].totalCost -= closeAmount * avgShortEntry;
        }
        positionsBySymbol[symbol].amount += closeAmount;

        // Any remaining opens a new LONG (this portion's pnl doesn't count)
        if (openAmount > 0) {
          positionsBySymbol[symbol].totalCost += openAmount * price;
          positionsBySymbol[symbol].amount += openAmount;
        }
      } else {
        // OPENING/increasing LONG position - pnl doesn't count per Rules 18-21
        positionsBySymbol[symbol].totalCost += amount * price;
        positionsBySymbol[symbol].amount += amount;
      }
    } else {
      // SELL increases SHORT position or closes LONG
      if (positionsBySymbol[symbol].amount > 0) {
        // CLOSING LONG position - this pnl counts!
        const closeAmount = Math.min(amount, positionsBySymbol[symbol].amount);
        const openAmount = amount - closeAmount;

        // Only count pnl proportionally if partially closing
        if (closeAmount > 0 && amount > 0) {
          const pnlPortion = closeAmount / amount;
          realizedPnl += pnl * pnlPortion;
        }

        // Reduce LONG proportionally
        const avgLongEntry = positionsBySymbol[symbol].totalCost / positionsBySymbol[symbol].amount;
        positionsBySymbol[symbol].totalCost -= closeAmount * avgLongEntry;
        positionsBySymbol[symbol].amount -= closeAmount;

        // Any remaining opens a new SHORT (this portion's pnl doesn't count)
        if (openAmount > 0) {
          positionsBySymbol[symbol].totalCost += openAmount * price;
          positionsBySymbol[symbol].amount -= openAmount;
        }
      } else {
        // OPENING/increasing SHORT position - pnl doesn't count per Rules 18-21
        positionsBySymbol[symbol].totalCost += amount * price;
        positionsBySymbol[symbol].amount -= amount;
      }
    }
  }

  // Calculate unrealized PnL and margin for open positions
  let unrealizedPnl = 0;
  let totalMargin = 0;

  for (const [symbol, pos] of Object.entries(positionsBySymbol)) {
    // Skip if no position
    if (Math.abs(pos.amount) < 0.0000001) {
      continue;
    }

    const markPrice = currentPrices?.[symbol];
    if (markPrice) {
      const avgEntryPrice = Math.abs(pos.amount) > 0 ? pos.totalCost / Math.abs(pos.amount) : 0;
      // PnL formula works for both LONG and SHORT
      unrealizedPnl += (markPrice - avgEntryPrice) * pos.amount;
    }

    // Calculate margin
    const positionValue = Math.abs(pos.amount) * (markPrice || pos.totalCost / Math.abs(pos.amount));
    const leverage = pos.leverage || 10;
    totalMargin += positionValue / leverage;
  }

  return {
    realizedPnl,
    unrealizedPnl,
    totalFees,
    margin: totalMargin,
    tradesCount: trades.length,
    positionsBySymbol,
  };
}

/**
 * Calculate PnL percentage (ROI%)
 *
 * Per Fight-Engine_Rules.md:
 * - Uses current margin if there are open positions
 * - Falls back to maxExposureUsed for closed positions
 *
 * @param totalPnl - The total PnL (realized only, per Rules 18-21)
 * @param currentMargin - Current margin from open positions
 * @param maxExposureUsed - Maximum exposure used during the fight
 */
export function calculatePnlPercent(
  totalPnl: number,
  currentMargin: number,
  maxExposureUsed: number
): number {
  const effectiveMargin = currentMargin > 0 ? currentMargin : maxExposureUsed;
  return effectiveMargin > 0 ? (totalPnl / effectiveMargin) * 100 : 0;
}
