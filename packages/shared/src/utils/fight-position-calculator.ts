/**
 * Fight Position Calculator
 *
 * Pure functions for calculating fight positions from trade records.
 * These functions are used by both the API routes and can be unit tested.
 */

export interface FightTrade {
  symbol: string;
  side: 'BUY' | 'SELL';
  amount: string | number;
  price: string | number;
  leverage?: number | null;
}

export interface InitialPosition {
  symbol: string;
  amount: string | number; // Positive = LONG, Negative = SHORT
}

export interface PositionState {
  amount: number;
  totalCost: number;
  tradesCount: number;
  leverage: number | null;
}

export interface CalculatedPosition {
  symbol: string;
  side: 'LONG' | 'SHORT';
  amount: number;
  avgEntryPrice: number;
  tradesCount: number;
  leverage: number | null;
}

/**
 * Calculate net positions from a list of fight trades
 *
 * @param trades - List of trades executed during the fight
 * @returns Map of symbol to position state
 */
export function calculatePositionsFromTrades(
  trades: FightTrade[]
): Record<string, PositionState> {
  const positionsBySymbol: Record<string, PositionState> = {};

  for (const trade of trades) {
    const symbol = trade.symbol;
    const amount = typeof trade.amount === 'string' ? parseFloat(trade.amount) : trade.amount;
    const price = typeof trade.price === 'string' ? parseFloat(trade.price) : trade.price;

    if (!positionsBySymbol[symbol]) {
      positionsBySymbol[symbol] = { amount: 0, totalCost: 0, tradesCount: 0, leverage: null };
    }

    const pos = positionsBySymbol[symbol];
    pos.tradesCount++;

    // Track leverage from trades
    if (trade.leverage) {
      pos.leverage = trade.leverage;
    }

    if (trade.side === 'BUY') {
      if (pos.amount < 0) {
        // Closing SHORT position
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

  return positionsBySymbol;
}

/**
 * Determine how much of a trade should be recorded as a fight trade
 * when there are pre-fight positions.
 *
 * Rules:
 * - Closing pre-fight positions should NOT be recorded
 * - Opening new positions during fight SHOULD be recorded
 * - Closing positions opened during fight SHOULD be recorded
 *
 * @param tradeSide - 'BUY' or 'SELL'
 * @param tradeAmount - Amount being traded
 * @param initialPositions - Positions held before fight started
 * @param existingFightTrades - Trades already recorded for this fight
 * @returns Amount that should be recorded (0 if should skip entirely)
 */
export function calculateFightRelevantAmount(
  tradeSide: 'BUY' | 'SELL',
  tradeAmount: number,
  symbol: string,
  initialPositions: InitialPosition[],
  existingFightTrades: FightTrade[]
): number {
  const baseSymbol = symbol.replace('-USD', '');
  const initialPos = initialPositions.find(
    (ip) => ip.symbol === baseSymbol || ip.symbol === symbol
  );

  // Calculate what we've already done in the fight
  const fightBuys = existingFightTrades
    .filter((t) => (t.symbol === symbol || t.symbol === baseSymbol) && t.side === 'BUY')
    .reduce((sum, t) => sum + (typeof t.amount === 'string' ? parseFloat(t.amount) : t.amount), 0);

  const fightSells = existingFightTrades
    .filter((t) => (t.symbol === symbol || t.symbol === baseSymbol) && t.side === 'SELL')
    .reduce((sum, t) => sum + (typeof t.amount === 'string' ? parseFloat(t.amount) : t.amount), 0);

  if (tradeSide === 'SELL') {
    // For SELL trades:
    // 1. Closing pre-fight LONG -> don't record
    // 2. Closing fight LONG -> record
    // 3. Opening new SHORT -> record

    const initialLong = initialPos
      ? Math.max(0, typeof initialPos.amount === 'string' ? parseFloat(initialPos.amount) : initialPos.amount)
      : 0;

    const fightNetPosition = fightBuys - fightSells;

    // How much of the initial long is still open?
    // Initial long gets closed first by sells
    const sellsUsedToClosePreFight = Math.min(initialLong, fightSells);
    const remainingPreFightLong = Math.max(0, initialLong - sellsUsedToClosePreFight);

    // Current fight-only long position
    const currentFightLong = Math.max(0, fightNetPosition);

    // Allocate this SELL
    let remaining = tradeAmount;

    // First, closes pre-fight long (don't record)
    const closesPreFight = Math.min(remaining, remainingPreFightLong);
    remaining -= closesPreFight;

    // Then, closes fight long (record)
    const closesFightLong = Math.min(remaining, currentFightLong);
    remaining -= closesFightLong;

    // Finally, opens new short (record)
    const opensNewShort = remaining;

    return closesFightLong + opensNewShort;
  } else {
    // For BUY trades:
    // 1. Closing pre-fight SHORT -> don't record
    // 2. Closing fight SHORT -> record
    // 3. Opening new LONG -> record

    const initialShort = initialPos
      ? Math.abs(Math.min(0, typeof initialPos.amount === 'string' ? parseFloat(initialPos.amount) : initialPos.amount))
      : 0;

    const fightNetPosition = fightBuys - fightSells;

    // How much of the initial short is still open?
    const buysUsedToClosePreFight = Math.min(initialShort, fightBuys);
    const remainingPreFightShort = Math.max(0, initialShort - buysUsedToClosePreFight);

    // Current fight-only short position
    const currentFightShort = Math.abs(Math.min(0, fightNetPosition));

    // Allocate this BUY
    let remaining = tradeAmount;

    // First, closes pre-fight short (don't record)
    const closesPreFight = Math.min(remaining, remainingPreFightShort);
    remaining -= closesPreFight;

    // Then, closes fight short (record)
    const closesFightShort = Math.min(remaining, currentFightShort);
    remaining -= closesFightShort;

    // Finally, opens new long (record)
    const opensNewLong = remaining;

    return closesFightShort + opensNewLong;
  }
}

/**
 * Convert position states to calculated positions (filtering out closed positions)
 */
export function getOpenPositions(
  positionsBySymbol: Record<string, PositionState>
): CalculatedPosition[] {
  return Object.entries(positionsBySymbol)
    .filter(([_, pos]) => Math.abs(pos.amount) > 0.0000001)
    .map(([symbol, pos]) => ({
      symbol,
      side: pos.amount > 0 ? 'LONG' as const : 'SHORT' as const,
      amount: Math.abs(pos.amount),
      avgEntryPrice: pos.amount !== 0 ? Math.abs(pos.totalCost / pos.amount) : 0,
      tradesCount: pos.tradesCount,
      leverage: pos.leverage,
    }));
}
