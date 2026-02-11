/**
 * Centralized trading utilities
 * Source: TpSlModal.tsx (lines 166-187)
 */

export interface PositionInfo {
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  margin: number;
  sizeInToken: number;
}

/**
 * Calculate TP price based on percentage gain
 * Formula: TP = entryPrice ± (margin × gainPercent / 100) / size
 */
export function calculateTpPrice(
  gainPercent: number,
  position: PositionInfo,
  size?: number
): number {
  const effectiveSize = size || position.sizeInToken;
  const margin = position.margin * (effectiveSize / position.sizeInToken);
  const gainAmount = (margin * gainPercent) / 100;

  if (position.side === 'LONG') {
    return position.entryPrice + gainAmount / effectiveSize;
  } else {
    return position.entryPrice - gainAmount / effectiveSize;
  }
}

/**
 * Calculate SL price based on percentage loss
 * Formula: SL = entryPrice ∓ (margin × lossPercent / 100) / size
 */
export function calculateSlPrice(
  lossPercent: number,
  position: PositionInfo,
  size?: number
): number {
  const effectiveSize = size || position.sizeInToken;
  const margin = position.margin * (effectiveSize / position.sizeInToken);
  const lossAmount = (margin * Math.abs(lossPercent)) / 100;

  if (position.side === 'LONG') {
    return position.entryPrice - lossAmount / effectiveSize;
  } else {
    return position.entryPrice + lossAmount / effectiveSize;
  }
}

/**
 * Calculate PnL from price difference
 */
export function calculatePnl(
  entryPrice: number,
  currentPrice: number,
  size: number,
  side: 'LONG' | 'SHORT'
): number {
  const priceDiff = side === 'LONG'
    ? currentPrice - entryPrice
    : entryPrice - currentPrice;
  return priceDiff * size;
}

/**
 * Calculate PnL percentage (ROI based on margin)
 */
export function calculatePnlPercent(pnl: number, margin: number): number {
  if (margin === 0) return 0;
  return (pnl / margin) * 100;
}

/**
 * Format price for display
 */
export function formatPrice(price: number): string {
  if (price >= 10000) return price.toFixed(0);
  if (price >= 100) return price.toFixed(2);
  if (price >= 1) return price.toFixed(4);
  return price.toFixed(6);
}

/**
 * Raw position from Pacifica API
 */
export interface RawPosition {
  symbol: string;
  side: 'bid' | 'ask';
  amount: string;
  entry_price: string;
  margin: string;
  funding: string;
  isolated: boolean;
  liq_price: string | null;
}

/**
 * Parameters for calculating position metrics
 */
export interface EnhancedPositionParams {
  position: RawPosition;
  markPrice: number; // Current price from usePrices
  leverage: number; // From account settings or MAX_LEVERAGE
}

/**
 * Enhanced position metrics with correctly calculated margin and PnL
 */
export interface EnhancedPositionResult {
  entryPrice: number;
  markPrice: number;
  amount: number;
  side: 'LONG' | 'SHORT';
  margin: number; // Correctly calculated for cross/isolated
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
}

/**
 * Calculate enhanced position data with correct margin and PnL
 * Extracted from terminal logic (trade/page.tsx:707-735)
 *
 * Handles the critical difference between isolated and cross margin:
 * - Isolated: Uses margin from API
 * - Cross: Calculates margin = positionValue / leverage (API returns '0' for cross)
 */
export function calculatePositionMetrics(params: EnhancedPositionParams): EnhancedPositionResult {
  const { position, markPrice, leverage } = params;

  const entryPrice = parseFloat(position.entry_price);
  const amount = parseFloat(position.amount);
  const isLong = position.side === 'bid';
  const isolated = position.isolated ?? false;

  // Calculate margin correctly (terminal logic)
  // For cross margin, API returns margin='0', so we must calculate it
  const apiMargin = parseFloat(position.margin || '0');
  const positionValue = amount * entryPrice;
  const margin = isolated && apiMargin > 0
    ? apiMargin
    : positionValue / leverage;

  // Calculate PnL using existing centralized functions
  const side = isLong ? 'LONG' : 'SHORT';
  const pnl = calculatePnl(entryPrice, markPrice, amount, side);
  const pnlPercent = calculatePnlPercent(pnl, margin);

  return {
    entryPrice,
    markPrice,
    amount,
    side,
    margin,
    unrealizedPnl: pnl,
    unrealizedPnlPercent: pnlPercent,
  };
}

// ─────────────────────────────────────────────────────────────
// PRIORITY 1: CRITICAL FUNCTIONS
// ─────────────────────────────────────────────────────────────

/**
 * Parameters for liquidation price calculation
 */
export interface LiquidationPriceParams {
  entryPrice: number;
  sizeInToken: number;
  margin: number;
  leverage: number;
  side: 'LONG' | 'SHORT';
  apiLiqPrice?: number;
  accountEquity?: number;
  isolated?: boolean;
}

/**
 * Calculate liquidation price using Pacifica's official formula
 * Extracted from terminal logic (trade/page.tsx:740-756)
 *
 * Formula: liquidation_price = [price - (side * position_margin) / position_size] / (1 - side / max_leverage / 2)
 * Where: side = 1 for LONG, -1 for SHORT
 *
 * Falls back to API liq price if available (from WebSocket)
 * For cross margin, uses account equity if available
 */
export function calculateLiquidationPrice(params: LiquidationPriceParams): number {
  const { entryPrice, sizeInToken, margin, leverage, side, apiLiqPrice, accountEquity, isolated } = params;

  // If we have real liq price from Pacifica WebSocket, use it
  if (apiLiqPrice && apiLiqPrice > 0) {
    return apiLiqPrice;
  }

  // Calculate using Pacifica's official formula
  const sideMultiplier = side === 'LONG' ? 1 : -1;
  const positionMargin = isolated && margin > 0
    ? margin
    : accountEquity && accountEquity > 0
      ? accountEquity
      : (sizeInToken * entryPrice) / leverage;

  const numerator = entryPrice - (sideMultiplier * positionMargin) / sizeInToken;
  const denominator = 1 - sideMultiplier / leverage / 2;

  return Math.max(0, numerator / denominator);
}

/**
 * Order interface for TP/SL filtering
 */
export interface Order {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  type: string;
  size: string;
  price: string;
  stopPrice?: string | null;
  reduceOnly?: boolean;
}

/**
 * Normalized TP/SL order result
 */
export interface TpSlOrder {
  orderId: string;
  type: 'TP' | 'SL';
  triggerPrice: number;
  amount: number;
  orderType: 'market' | 'limit';
  limitPrice?: number;
}

/**
 * Position info for TP/SL filtering
 */
export interface PositionForOrders {
  symbol: string;
  side: 'LONG' | 'SHORT';
}

/**
 * Filter and detect Take Profit orders for a position
 * Extracted from terminal logic (trade/page.tsx:769-795)
 *
 * Detects two types of TP orders:
 * 1. Native Pacifica TP: order.type includes 'TP' or 'take_profit'
 * 2. Hybrid TP: reduce_only LIMIT orders at profit-taking price
 *    - For LONG: TP price is ABOVE entry price
 *    - For SHORT: TP price is BELOW entry price
 *
 * TP orders are on opposite side of position (LONG → SHORT orders, SHORT → LONG orders)
 */
export function filterTpOrders(
  orders: Order[],
  position: PositionForOrders,
  entryPrice: number
): TpSlOrder[] {
  const posSymbol = position.symbol.replace('-USD', '');
  const oppositeOrderSide = position.side === 'LONG' ? 'SHORT' : 'LONG';

  return orders.filter(order => {
    const orderSymbol = order.symbol?.replace('-USD', '') || order.symbol;
    if (orderSymbol !== posSymbol || order.side !== oppositeOrderSide) return false;

    // Check for native Pacifica TP orders
    const isNativeTP = order.type?.includes('TP') || order.type?.toLowerCase().includes('take_profit');
    if (isNativeTP) return true;

    // Check for hybrid TP (limit orders with reduce_only at profit-taking price)
    const isLimitOrder = order.type?.toUpperCase() === 'LIMIT' || order.type?.toLowerCase() === 'limit order';
    if (isLimitOrder && order.reduceOnly) {
      const orderPrice = parseFloat(order.price) || 0;
      // For LONG: TP is above entry, for SHORT: TP is below entry
      if (position.side === 'LONG' && orderPrice > entryPrice) return true;
      if (position.side === 'SHORT' && orderPrice < entryPrice) return true;
    }

    return false;
  }).map(order => ({
    orderId: order.id,
    type: 'TP' as const,
    triggerPrice: parseFloat(order.stopPrice || order.price) || 0,
    amount: parseFloat(order.size) || 0,
    orderType: (order.type?.includes('MARKET') ? 'market' : 'limit') as 'market' | 'limit',
    limitPrice: order.type?.includes('LIMIT') ? parseFloat(order.price) : undefined,
  }));
}

/**
 * Filter and detect Stop Loss orders for a position
 * Extracted from terminal logic (trade/page.tsx:803-829)
 *
 * Detects two types of SL orders:
 * 1. Native Pacifica SL: order.type includes 'SL' or 'stop_loss'
 * 2. Hybrid SL: reduce_only STOP orders at loss-limiting price
 *    - For LONG: SL price is BELOW entry price
 *    - For SHORT: SL price is ABOVE entry price
 *
 * SL orders are on opposite side of position (LONG → SHORT orders, SHORT → LONG orders)
 */
export function filterSlOrders(
  orders: Order[],
  position: PositionForOrders,
  entryPrice: number
): TpSlOrder[] {
  const posSymbol = position.symbol.replace('-USD', '');
  const oppositeOrderSide = position.side === 'LONG' ? 'SHORT' : 'LONG';

  return orders.filter(order => {
    const orderSymbol = order.symbol?.replace('-USD', '') || order.symbol;
    if (orderSymbol !== posSymbol || order.side !== oppositeOrderSide) return false;

    // Check for native Pacifica SL orders
    const isNativeSL = order.type?.includes('SL') || order.type?.toLowerCase().includes('stop_loss');
    if (isNativeSL) return true;

    // Check for hybrid SL (stop orders with reduce_only at loss-limiting price)
    const isStopOrder = order.type?.toUpperCase().includes('STOP') && !order.type?.includes('TP') && !order.type?.includes('SL');
    if (isStopOrder && order.reduceOnly) {
      const triggerPrice = parseFloat(order.stopPrice || order.price) || 0;
      // For LONG: SL is below entry, for SHORT: SL is above entry
      if (position.side === 'LONG' && triggerPrice < entryPrice) return true;
      if (position.side === 'SHORT' && triggerPrice > entryPrice) return true;
    }

    return false;
  }).map(order => ({
    orderId: order.id,
    type: 'SL' as const,
    triggerPrice: parseFloat(order.stopPrice || order.price) || 0,
    amount: parseFloat(order.size) || 0,
    orderType: (order.type?.includes('MARKET') ? 'market' : 'limit') as 'market' | 'limit',
    limitPrice: order.type?.includes('LIMIT') ? parseFloat(order.price) : undefined,
  }));
}

// ─────────────────────────────────────────────────────────────
// PRIORITY 2: HIGH-VALUE FUNCTIONS
// ─────────────────────────────────────────────────────────────

/**
 * Round amount to lot size (floor to lot size multiple)
 * Extracted from terminal logic (trade/page.tsx:257-261)
 *
 * Pacifica requires order amounts to be multiples of lot size
 * Example: amount=0.00123456, lotSize=0.00001 → returns "0.00123"
 */
export function roundToLotSize(amount: number, lotSize: number): string {
  const precision = Math.max(0, -Math.floor(Math.log10(lotSize)));
  const rounded = Math.floor(amount / lotSize) * lotSize;
  return rounded.toFixed(precision);
}

/**
 * Round price to tick size (round to nearest tick size multiple)
 * Extracted from terminal logic (trade/page.tsx:264-268)
 *
 * Pacifica requires prices to be multiples of tick size
 * Example: price=65310.7, tickSize=1 → returns "65311"
 */
export function roundToTickSize(price: number, tickSize: number): string {
  const rounded = Math.round(price / tickSize) * tickSize;
  const decimals = tickSize >= 1 ? 0 : Math.ceil(-Math.log10(tickSize));
  return rounded.toFixed(decimals);
}

/**
 * Account interface for statistics calculation
 */
export interface AccountForStats {
  accountEquity: string;
  totalMarginUsed: string;
  availableToSpend: string;
  takerFee?: string;
  makerFee?: string;
  crossMmr?: string;
}

/**
 * Position interface for statistics calculation
 */
export interface PositionForStats {
  size: number;
}

/**
 * Account statistics result
 */
export interface AccountStats {
  takerFeePercent: string;
  makerFeePercent: string;
  restingOrderValue: number;
  crossAccountLeverage: number;
  maintenanceMargin: number;
}

/**
 * Calculate account statistics (fees, leverage, margins)
 * Extracted from terminal logic (trade/page.tsx:1738-1753)
 *
 * Calculates:
 * - Taker/maker fees including builder fee
 * - Resting order value (locked in pending orders)
 * - Cross account leverage (total position value / equity)
 * - Maintenance margin from API or 50% of margin used
 */
export function calculateAccountStats(
  account: AccountForStats,
  positions: PositionForStats[],
  realtimeUnrealizedPnl: number,
  builderFee: number
): AccountStats {
  // Fee calculations with builder fee
  const pacificaTakerFee = parseFloat(account.takerFee || '0.0007'); // Default fallback
  const pacificaMakerFee = parseFloat(account.makerFee || '0.000575'); // Default fallback
  const takerFeePercent = ((pacificaTakerFee + builderFee) * 100).toFixed(4);
  const makerFeePercent = ((pacificaMakerFee + builderFee) * 100).toFixed(4);

  // Account values
  const equity = parseFloat(account.accountEquity) || 0;
  const marginUsed = parseFloat(account.totalMarginUsed) || 0;
  const available = parseFloat(account.availableToSpend) || 0;

  // Resting order value (locked in pending orders)
  const restingOrderValue = Math.max(0, equity - marginUsed - available - realtimeUnrealizedPnl);

  // Cross account leverage = total position value / equity
  const totalPositionValue = positions.reduce((sum, p) => sum + p.size, 0);
  const crossAccountLeverage = equity > 0 ? totalPositionValue / equity : 0;

  // Maintenance margin from API or 50% of margin used
  const maintenanceMargin = parseFloat(account.crossMmr || '0') || marginUsed * 0.5;

  return {
    takerFeePercent,
    makerFeePercent,
    restingOrderValue,
    crossAccountLeverage,
    maintenanceMargin,
  };
}

/**
 * Parameters for order amount calculation
 */
export interface OrderAmountParams {
  positionSize: number;
  leverage: number;
  maxLeverage: number;
  price: number;
  lotSize: number;
}

/**
 * Calculate order amount in tokens with leverage and lot size rounding
 * Extracted from terminal logic (trade/page.tsx:325-336)
 *
 * Formula: amount = (positionSize * leverage) / price
 * Then rounds down to lot size to avoid Pacifica API rejection
 */
export function calculateOrderAmount(params: OrderAmountParams): string {
  const { positionSize, leverage, maxLeverage, price, lotSize } = params;

  const effectiveLeverage = Math.min(leverage, maxLeverage);
  const effectivePositionSize = positionSize * effectiveLeverage;
  const rawAmount = effectivePositionSize / price;

  return roundToLotSize(rawAmount, lotSize);
}

// ─────────────────────────────────────────────────────────────
// PRIORITY 3: MEDIUM-VALUE FUNCTIONS
// ─────────────────────────────────────────────────────────────

/**
 * Position value calculation result
 */
export interface PositionValues {
  valueAtEntry: number;
  valueAtMark: number;
}

/**
 * Calculate position values at entry and mark prices
 * Extracted from terminal logic (trade/page.tsx:736-737)
 *
 * valueAtEntry = sizeInToken * entryPrice
 * valueAtMark = sizeInToken * markPrice
 */
export function calculatePositionValues(
  sizeInToken: number,
  entryPrice: number,
  markPrice: number
): PositionValues {
  return {
    valueAtEntry: sizeInToken * entryPrice,
    valueAtMark: sizeInToken * markPrice,
  };
}

/**
 * Convert margin to position size (leveraged USD value)
 * Extracted from terminal logic (trade/page.tsx:2015)
 *
 * Formula: positionSize = margin * leverage
 */
export function marginToPositionSize(margin: number, leverage: number, maxLeverage: number): number {
  const effectiveLeverage = Math.min(leverage, maxLeverage);
  return margin * effectiveLeverage;
}

/**
 * Convert position size to margin (unleveraged USD value)
 * Extracted from terminal logic (trade/page.tsx:2049)
 *
 * Formula: margin = positionSize / leverage
 */
export function positionSizeToMargin(positionSize: number, leverage: number, maxLeverage: number): number {
  const effectiveLeverage = Math.min(leverage, maxLeverage);
  return positionSize / effectiveLeverage;
}

/**
 * Convert token amount to margin
 * Extracted from terminal logic (trade/page.tsx:2030)
 *
 * Formula: margin = (tokenAmount * price) / leverage
 */
export function tokenToMargin(tokenAmount: number, price: number, leverage: number, maxLeverage: number): number {
  const effectiveLeverage = Math.min(leverage, maxLeverage);
  return (tokenAmount * price) / effectiveLeverage;
}

/**
 * Convert position size to token amount
 * Extracted from terminal logic (trade/page.tsx:2016)
 *
 * Formula: tokenAmount = positionSize / price
 */
export function positionSizeToTokenAmount(positionSize: number, price: number): number {
  return price > 0 ? positionSize / price : 0;
}

/**
 * Calculate TP price from leverage-based percentage gain (for NEW orders)
 * Extracted from terminal logic (trade/page.tsx:2175-2181)
 *
 * This is different from calculateTpPrice which is for EXISTING positions
 * This one is for setting TP on new orders using leverage-adjusted percentages
 *
 * Formula: priceMove = (gainPercent / 100 / leverage) * refPrice
 * LONG: TP = refPrice + priceMove
 * SHORT: TP = refPrice - priceMove
 */
export function calculateTpPriceFromLeverageGain(
  gainPercent: number,
  refPrice: number,
  leverage: number,
  maxLeverage: number,
  side: 'LONG' | 'SHORT',
  tickSize: number
): string {
  const effectiveLev = Math.min(leverage, maxLeverage);
  const priceMove = (gainPercent / 100 / effectiveLev) * refPrice;
  const rawPrice = side === 'LONG'
    ? refPrice + priceMove
    : refPrice - priceMove;
  return roundToTickSize(rawPrice, tickSize);
}

/**
 * Calculate SL price from leverage-based percentage loss (for NEW orders)
 * Extracted from terminal logic (trade/page.tsx:2184-2190)
 *
 * This is different from calculateSlPrice which is for EXISTING positions
 * This one is for setting SL on new orders using leverage-adjusted percentages
 *
 * Formula: priceMove = (lossPercent / 100 / leverage) * refPrice
 * LONG: SL = refPrice - priceMove
 * SHORT: SL = refPrice + priceMove
 */
export function calculateSlPriceFromLeverageLoss(
  lossPercent: number,
  refPrice: number,
  leverage: number,
  maxLeverage: number,
  side: 'LONG' | 'SHORT',
  tickSize: number
): string {
  const effectiveLev = Math.min(leverage, maxLeverage);
  const priceMove = (Math.abs(lossPercent) / 100 / effectiveLev) * refPrice;
  const rawPrice = side === 'LONG'
    ? refPrice - priceMove
    : refPrice + priceMove;
  return roundToTickSize(rawPrice, tickSize);
}

/**
 * Position interface for aggregation
 */
export interface PositionForAggregation {
  unrealizedPnl: number;
  margin: number;
}

/**
 * Aggregated position metrics result
 */
export interface PositionAggregates {
  totalUnrealizedPnl: number;
  totalMargin: number;
  roi: number;
}

/**
 * Aggregate position metrics (total PnL, margin, ROI)
 * Extracted from terminal logic (trade/page.tsx:920-926)
 *
 * Calculates:
 * - Total unrealized PnL across all positions
 * - Total margin used
 * - ROI = (totalPnl / totalMargin) * 100
 */
export function aggregatePositionMetrics(positions: PositionForAggregation[]): PositionAggregates {
  const totalUnrealizedPnl = positions.reduce((sum, pos) => sum + pos.unrealizedPnl, 0);
  const totalMargin = positions.reduce((sum, pos) => sum + pos.margin, 0);
  const roi = totalMargin > 0 ? (totalUnrealizedPnl / totalMargin) * 100 : 0;

  return {
    totalUnrealizedPnl,
    totalMargin,
    roi,
  };
}

// ─────────────────────────────────────────────────────────────
// PRIORITY 4: LOWER-VALUE FUNCTIONS
// ─────────────────────────────────────────────────────────────

/**
 * Position interface for filtering
 */
export interface PositionForFiltering {
  symbol: string;
}

/**
 * Filter positions by blocked symbols (for fight mode)
 * Extracted from terminal logic (trade/page.tsx:911-913)
 *
 * Used in fight mode to exclude pre-fight positions from display
 */
export function filterPositionsByBlockedSymbols<T extends PositionForFiltering>(
  positions: T[],
  blockedSymbols: string[]
): T[] {
  return positions.filter(pos => !blockedSymbols.includes(pos.symbol));
}

/**
 * Position interface for leverage validation
 */
export interface PositionForLeverageValidation {
  symbol: string;
  leverage?: number;
}

/**
 * Leverage validation result
 */
export interface LeverageValidation {
  valid: boolean;
  error?: string;
}

/**
 * Validate leverage change against open positions
 * Extracted from terminal logic (trade/page.tsx:271-288)
 *
 * Pacifica only allows INCREASING leverage on open positions
 * Cannot decrease leverage below current position leverage
 */
export function validateLeverageChange(
  newLeverage: number,
  positions: PositionForLeverageValidation[],
  symbol: string
): LeverageValidation {
  const marketSymbol = symbol.replace('-USD', '');
  const openPosition = positions.find(
    p => p.symbol.replace('-USD', '') === marketSymbol
  );

  if (openPosition) {
    const positionLeverage = openPosition.leverage || 1;
    // Pacifica only allows INCREASING leverage on open positions
    if (newLeverage < positionLeverage) {
      return {
        valid: false,
        error: `Cannot decrease leverage below ${positionLeverage}x while ${marketSymbol} position is open`
      };
    }
  }

  return { valid: true };
}

/**
 * TP/SL parameters for order placement
 */
export interface TpSlParams {
  tp?: { stop_price: string };
  sl?: { stop_price: string };
}

/**
 * Build TP/SL parameters for order placement
 * Extracted from terminal logic (trade/page.tsx:340-345)
 *
 * Rounds prices to tick size to avoid "Invalid stop tick" errors from Pacifica
 * Only includes params if enabled and price is provided
 */
export function buildTpSlParams(
  orderType: string,
  tpEnabled: boolean,
  slEnabled: boolean,
  takeProfit: string,
  stopLoss: string,
  tickSize: number
): TpSlParams {
  const params: TpSlParams = {};

  // TP/SL only supported for market and limit orders
  if (orderType === 'market' || orderType === 'limit') {
    if (tpEnabled && takeProfit) {
      params.tp = { stop_price: roundToTickSize(parseFloat(takeProfit), tickSize) };
    }
    if (slEnabled && stopLoss) {
      params.sl = { stop_price: roundToTickSize(parseFloat(stopLoss), tickSize) };
    }
  }

  return params;
}
