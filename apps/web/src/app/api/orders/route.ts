/**
 * Orders endpoints
 * POST /api/orders - Place order (proxies to Pacifica)
 * DELETE /api/orders - Cancel all orders (proxies to Pacifica)
 */
import { errorResponse, BadRequestError, StakeLimitError, ServiceUnavailableError, GatewayTimeoutError } from '@/lib/server/errors';
import { ErrorCode } from '@/lib/server/error-codes';
import { validateStakeLimit } from '@/lib/server/orders';
import {
  calculateFightExposure,
  updateMaxExposureIfHigher,
} from '@/lib/server/fight-exposure';
import { recordOrderAction } from '@/lib/server/order-actions';
import { calculateReferralCommissions } from '@/lib/server/services/referral';
import { prisma, FightStatus } from '@tfc/db';
import { FeatureFlags } from '@/lib/server/feature-flags';

const PACIFICA_API_URL = process.env.PACIFICA_API_URL || 'https://api.pacifica.fi';
const REALTIME_URL = process.env.REALTIME_URL || 'http://localhost:3002';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'dev-internal-key';

// TFC platform fee rate (0.05%) - used to calculate referral commissions
// Referral commissions are based on TFC's revenue, not total Pacifica fees
const TFC_FEE_RATE = 0.0005;

/**
 * Fetch and emit platform stats via realtime server
 */
async function emitPlatformStats() {
  try {
    // Fetch current stats from database
    const [volumeResult, fightsCount, fightVolumeResult, totalFeesResult, activeUsersCount, totalTradesCount] =
      await Promise.all([
        prisma.$queryRaw<[{ total_volume: number }]>`
          SELECT COALESCE(SUM(amount * price), 0)::float as total_volume FROM trades
        `,
        prisma.fight.count({
          where: { status: FightStatus.FINISHED },
        }),
        prisma.$queryRaw<[{ fight_volume: number }]>`
          SELECT COALESCE(SUM(stake_usdc), 0)::float as fight_volume FROM fights
        `,
        prisma.$queryRaw<[{ total_fees: number }]>`
          SELECT COALESCE(SUM(fee), 0)::float as total_fees FROM trades
        `,
        prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(DISTINCT user_id) as count FROM trades
        `,
        prisma.trade.count(),
      ]);

    const stats = {
      tradingVolume: volumeResult[0]?.total_volume || 0,
      fightVolume: fightVolumeResult[0]?.fight_volume || 0,
      fightsCompleted: fightsCount,
      totalFees: totalFeesResult[0]?.total_fees || 0,
      activeUsers: Number(activeUsersCount[0]?.count || 0),
      totalTrades: totalTradesCount,
    };

    // Emit via realtime server
    await fetch(`${REALTIME_URL}/internal/platform-stats`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Key': INTERNAL_API_KEY,
      },
      body: JSON.stringify(stats),
    });

    console.log('[emitPlatformStats] Stats emitted successfully');
  } catch (error) {
    console.error('[emitPlatformStats] Failed to emit stats:', error);
  }
}

/**
 * Emit stake info update via realtime server
 */
async function emitStakeInfo(
  fightId: string,
  userId: string,
  stake: number,
  currentExposure: number,
  maxExposureUsed: number
) {
  try {
    const available = Math.max(0, stake - maxExposureUsed + currentExposure);
    await fetch(`${REALTIME_URL}/internal/stake-info`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Key': INTERNAL_API_KEY,
      },
      body: JSON.stringify({
        fightId,
        userId,
        stake,
        currentExposure,
        maxExposureUsed,
        available,
      }),
    });
  } catch (error) {
    console.error('[emitStakeInfo] Failed to emit stake info:', error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      account,
      symbol,
      side,
      type,
      amount,
      price,
      slippage_percent,
      reduce_only,
      post_only,
      tif,
      builder_code,
      take_profit,
      stop_loss,
      signature,
      timestamp,
      fight_id, // Optional: specific fight to apply this trade to
      leverage, // Optional: leverage used (stored in FightTrade for ROI calculation)
      is_pre_fight_flip, // Optional: if true, this is a flip of a pre-fight position (don't record)
    } = body;

    if (!account || !symbol || !side || !type || !amount || !signature || !timestamp) {
      throw new BadRequestError('account, symbol, side, type, amount, signature, and timestamp are required', ErrorCode.ERR_ORDER_MISSING_REQUIRED_FIELDS);
    }

    // Feature flag: Check if trading is enabled
    if (!FeatureFlags.isTradingEnabled()) {
      throw new ServiceUnavailableError('Trading is temporarily disabled', ErrorCode.ERR_ORDER_TRADING_DISABLED);
    }

    // Validate stake limit for users in active fights
    // Returns fight info if user is in a fight (used to update maxExposure after order)
    // If fight_id is provided, validates against that specific fight
    let fightValidation: Awaited<ReturnType<typeof validateStakeLimit>> = null;
    try {
      fightValidation = await validateStakeLimit(
        account,
        symbol,
        amount,
        price,
        type,
        reduce_only || false,
        fight_id || undefined // Pass specific fight ID if provided
      );
    } catch (error: any) {
      if (error.code === 'STAKE_LIMIT_EXCEEDED') {
        throw new StakeLimitError(error.message, error.details);
      }
      throw error;
    }

    // Check if symbol is blocked for this user in their active fight
    // Blocked symbols = symbols with pre-fight open positions (to avoid PnL contamination)
    if (fightValidation) {
      const connection = await prisma.pacificaConnection.findUnique({
        where: { accountAddress: account },
        select: { userId: true },
      });

      if (connection) {
        const participant = await prisma.fightParticipant.findFirst({
          where: {
            userId: connection.userId,
            fightId: fightValidation.fightId,
          },
        });

        // blockedSymbols is String[] - check if symbol is in the list
        // Allow pre-fight flip trades to bypass this check (they close pre-existing positions)
        const blockedSymbols = (participant as any)?.blockedSymbols as string[] | undefined;
        if (blockedSymbols?.includes(symbol) && !is_pre_fight_flip) {
          throw new BadRequestError(
            `Symbol ${symbol} is blocked for this fight. You had an open position in this symbol before the fight started. Close pre-fight positions before joining a fight to trade that symbol.`,
            ErrorCode.ERR_ORDER_SYMBOL_BLOCKED
          );
        }
      }
    }

    // Proxy to Pacifica API
    let endpoint;
    let requestBody: Record<string, any>;

    if (type === 'MARKET') {
      endpoint = `${PACIFICA_API_URL}/api/v1/orders/create_market`;
      requestBody = {
        account,
        symbol,
        side,
        amount,
        slippage_percent: slippage_percent || '0.5',
        reduce_only: reduce_only || false,
        signature,
        timestamp,
        expiry_window: 5000,
      };

      // Only include optional fields if they have values
      if (builder_code) requestBody.builder_code = builder_code;
      if (take_profit) requestBody.take_profit = take_profit;
      if (stop_loss) requestBody.stop_loss = stop_loss;
    } else {
      // LIMIT
      if (!price) {
        throw new BadRequestError('price is required for limit orders', ErrorCode.ERR_ORDER_PRICE_REQUIRED);
      }
      endpoint = `${PACIFICA_API_URL}/api/v1/orders/create`;
      // Note: post_only is NOT a valid Pacifica parameter for limit orders
      requestBody = {
        account,
        symbol,
        side,
        price,
        amount,
        tif: tif || 'GTC',
        reduce_only: reduce_only || false,
        signature,
        timestamp,
        expiry_window: 5000,
      };

      // Only include optional fields if they have values
      if (builder_code) requestBody.builder_code = builder_code;
      if (take_profit) requestBody.take_profit = take_profit;
      if (stop_loss) requestBody.stop_loss = stop_loss;
    }

    console.log('Sending order to Pacifica:', { endpoint, requestBody });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    console.log('Pacifica response:', { status: response.status, body: responseText });

    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      throw new Error(`Failed to parse Pacifica response: ${responseText}`);
    }

    if (!response.ok || !result.success) {
      const errorMessage = result.error || `Pacifica API error: ${response.status}`;
      console.error('Pacifica order error:', errorMessage);
      // Determine appropriate error class based on status code
      if (response.status === 504) {
        throw new GatewayTimeoutError(errorMessage, ErrorCode.ERR_EXTERNAL_PACIFICA_API);
      } else if (response.status >= 500) {
        throw new ServiceUnavailableError(errorMessage, ErrorCode.ERR_EXTERNAL_PACIFICA_API);
      } else {
        throw new BadRequestError(errorMessage, ErrorCode.ERR_EXTERNAL_PACIFICA_API);
      }
    }

    console.log('Order placed successfully', {
      account,
      symbol,
      side,
      type,
      amount,
      orderId: result.data?.order_id,
    });

    // Record ALL trades to the Trade table for platform metrics
    // Also record to FightTrade if user is in an active fight
    if (type === 'MARKET' && result.data?.order_id) {
      // Don't await - let it run in background
      recordAllTrades(account, symbol, side, amount, result.data.order_id, fight_id, leverage, is_pre_fight_flip).catch(err => {
        console.error('Failed to record trades:', err);
      });
    }

    // Record order action to TfcOrderAction table (non-blocking)
    recordOrderAction({
      walletAddress: account,
      actionType: type === 'MARKET' ? 'MARKET_ORDER' : 'LIMIT_ORDER',
      symbol,
      side,
      orderType: type,
      amount,
      price: type === 'LIMIT' ? price : undefined,
      takeProfit: take_profit?.stop_price,
      stopLoss: stop_loss?.stop_price,
      pacificaOrderId: result.data?.order_id,
      leverage,
      fightId: fight_id,
      success: true,
    }).catch(err => console.error('Failed to record order action:', err));

    // If TP/SL was included with the order, also record a SET_TPSL action
    // This allows Fight Only filter to find TP/SL orders by symbol
    if ((take_profit || stop_loss) && fight_id) {
      recordOrderAction({
        walletAddress: account,
        actionType: 'SET_TPSL',
        symbol,
        side,
        takeProfit: take_profit?.stop_price,
        stopLoss: stop_loss?.stop_price,
        fightId: fight_id,
        success: true,
      }).catch(err => console.error('Failed to record TP/SL action:', err));
    }

    return Response.json({ success: true, data: result.data });
  } catch (error) {
    return errorResponse(error);
  }
}

interface InitialPosition {
  symbol: string;
  amount: string;
  entry_price: string;
  side?: string; // 'bid' = LONG, 'ask' = SHORT (optional for backwards compatibility)
}

/**
 * Record ALL trades to Trade table and FightTrade table (if applicable)
 * Trade table: stores ALL trades for platform metrics
 * FightTrade table: stores only fight-relevant trades for fight scoring
 */
async function recordAllTrades(
  accountAddress: string,
  symbol: string,
  side: string,
  amount: string,
  orderId: number,
  specificFightId?: string,
  leverage?: number,
  isPreFightFlip?: boolean
) {
  // Find user by Pacifica account address
  const connection = await prisma.pacificaConnection.findUnique({
    where: { accountAddress },
    include: { user: true },
  });

  if (!connection) {
    console.log('[recordAllTrades] No user found for account:', accountAddress);
    return;
  }

  // Auto-detect active fight if not explicitly provided
  let resolvedFightId = specificFightId;
  let activeFightParticipant: { fightId: string; blockedSymbols: string[] } | null = null;
  if (!resolvedFightId) {
    activeFightParticipant = await prisma.fightParticipant.findFirst({
      where: {
        userId: connection.userId,
        fight: { status: FightStatus.LIVE },
      },
      select: { fightId: true, blockedSymbols: true },
    });
    if (activeFightParticipant) {
      resolvedFightId = activeFightParticipant.fightId;
      console.log('[recordAllTrades] Auto-detected active fight:', resolvedFightId);
    }
  }

  // Auto-detect if this is closing a pre-fight position
  // Use blockedSymbols from FightParticipant (set when user joined fight with open positions)
  let autoDetectedPreFightFlip = isPreFightFlip;

  if (!autoDetectedPreFightFlip && resolvedFightId && !leverage && activeFightParticipant?.blockedSymbols) {
    // This is a CLOSING trade (no leverage) during a fight
    // Check if this symbol is in the user's blockedSymbols list
    // blockedSymbols contains symbols with pre-fight positions (e.g., ["BTC-USD", "ETH-USD"])
    const normalizedSymbol = symbol.includes('-USD') ? symbol : `${symbol}-USD`;
    const blockedSymbols = activeFightParticipant.blockedSymbols;

    if (blockedSymbols.includes(normalizedSymbol)) {
      console.log('[recordAllTrades] Auto-detected pre-fight position close via blockedSymbols', {
        symbol,
        normalizedSymbol,
        userId: connection.userId,
        fightId: resolvedFightId,
        blockedSymbols,
      });
      autoDetectedPreFightFlip = true;
    }
  }

  const tradeSide = side === 'bid' ? 'BUY' : 'SELL';

  // Fetch trade history to get execution details (price, fee, pnl)
  // Retry up to 3 times with increasing delays since trade may not be immediately available
  let executionPrice = '0';
  let fee = '0';
  let pnl: string | null = null;
  let historyId = BigInt(Date.now() * 1000 + orderId);

  const MAX_RETRIES = 3;
  const RETRY_DELAYS = [500, 1000, 1500];

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt]));

    try {
      const tradeHistoryResponse = await fetch(
        `${PACIFICA_API_URL}/api/v1/trades/history?account=${accountAddress}&limit=10`
      );

      if (tradeHistoryResponse.ok) {
        const tradeData = await tradeHistoryResponse.json();
        if (tradeData.success && Array.isArray(tradeData.data)) {
          const trade = tradeData.data.find((t: any) => t.order_id === orderId);
          if (trade) {
            executionPrice = trade.price || '0';
            fee = trade.fee || '0';
            pnl = trade.pnl || null;
            historyId = BigInt(trade.history_id || historyId);

            console.log('[recordAllTrades] Found trade execution details:', {
              orderId,
              price: executionPrice,
              fee,
              pnl,
              historyId: historyId.toString(),
              attempt: attempt + 1,
            });
            break;
          }
        }
      }

      if (attempt < MAX_RETRIES - 1) {
        console.log(`[recordAllTrades] Trade not found in history yet, retrying... (attempt ${attempt + 1}/${MAX_RETRIES})`);
      }
    } catch (err) {
      console.error(`[recordAllTrades] Failed to fetch trade history (attempt ${attempt + 1}):`, err);
    }
  }

  // Save to Trade table (ALL trades for platform metrics)
  // Don't assign fightId if this is closing a pre-fight position
  // Pre-fight closes should not count as fight activity for anti-cheat validation
  const shouldAssignFightId = resolvedFightId && !autoDetectedPreFightFlip;

  try {
    const trade = await prisma.trade.create({
      data: {
        userId: connection.userId,
        pacificaHistoryId: historyId,
        pacificaOrderId: BigInt(orderId),
        symbol,
        side: tradeSide,
        amount,
        price: executionPrice,
        fee,
        pnl,
        leverage: leverage || null,
        fightId: shouldAssignFightId ? resolvedFightId : null,
        executedAt: new Date(),
      },
    });

    console.log('[recordAllTrades] Trade saved to Trade table:', {
      userId: connection.userId,
      symbol,
      side: tradeSide,
      amount,
      price: executionPrice,
      fee,
    });

    // Calculate referral commissions (non-blocking)
    // Use TFC fee (0.05% of trade value), not total Pacifica fee
    // This ensures referral commissions come from TFC's revenue
    const priceNum = parseFloat(executionPrice);
    const amountNum = parseFloat(amount);
    const tradeValue = priceNum * amountNum;
    const tfcFee = tradeValue * TFC_FEE_RATE;

    if (tfcFee > 0) {
      calculateReferralCommissions({
        tradeId: trade.id,
        traderId: connection.userId,
        symbol,
        tradeFee: tfcFee,
        tradeValue,
      }).catch(err => {
        console.error('[recordAllTrades] Failed to calculate referral commissions:', err);
      });
    }

    // Emit updated platform stats via WebSocket (non-blocking)
    emitPlatformStats().catch(err => {
      console.error('[recordAllTrades] Failed to emit platform stats:', err);
    });
  } catch (err: any) {
    // Ignore duplicate key errors (trade already recorded)
    if (err.code !== 'P2002') {
      console.error('[recordAllTrades] Failed to save trade:', err);
    }
  }

  // Record to FightTrade if user is in a fight and not a pre-fight flip
  // Pass the execution details we already fetched to avoid duplicate API calls
  if (!autoDetectedPreFightFlip) {
    await recordFightTradeWithDetails(
      accountAddress,
      symbol,
      side,
      amount,
      orderId,
      resolvedFightId,
      leverage,
      { executionPrice, fee, pnl, historyId }
    );
  }
}

interface ExecutionDetails {
  executionPrice: string;
  fee: string;
  pnl: string | null;
  historyId: bigint;
}

/**
 * Record a trade for a user in an active fight
 *
 * IMPORTANT: Only records the fight portion of trades:
 * - For BUY trades: Records full amount (opens new fight position)
 * - For SELL trades: Only records up to the amount bought during the fight
 *   (ignores the portion that closes pre-fight positions)
 *
 * @param specificFightId - Optional: if provided, only records to this specific fight
 * @param leverage - Optional: leverage used for this trade (for accurate ROI calculation)
 * @param execDetails - Optional: pre-fetched execution details (to avoid duplicate API calls)
 */
async function recordFightTradeWithDetails(
  accountAddress: string,
  symbol: string,
  side: string,
  amount: string,
  orderId: number,
  specificFightId?: string,
  leverage?: number,
  execDetails?: ExecutionDetails
) {
  // Find user by Pacifica account address
  const connection = await prisma.pacificaConnection.findUnique({
    where: { accountAddress },
    include: { user: true },
  });

  if (!connection) {
    console.log('No user found for account:', accountAddress);
    return;
  }

  // Find active fight this user is in
  // If specificFightId is provided, only look for that specific fight
  const whereClause = specificFightId
    ? {
        userId: connection.userId,
        fightId: specificFightId,
        fight: { status: FightStatus.LIVE },
      }
    : {
        userId: connection.userId,
        fight: { status: FightStatus.LIVE },
      };

  const activeFight = await prisma.fightParticipant.findFirst({
    where: whereClause,
    include: { fight: true },
  });

  if (!activeFight) {
    console.log('User not in active fight:', connection.userId, specificFightId ? `(fight: ${specificFightId})` : '');
    return;
  }

  const fight = activeFight.fight;
  const now = Date.now();

  // Verify trade is within fight window
  if (!fight.startedAt) return;
  const fightStart = fight.startedAt.getTime();
  const fightEnd = fightStart + fight.durationMinutes * 60 * 1000;

  if (now < fightStart || now > fightEnd) {
    console.log('Trade outside fight window');
    return;
  }

  let tradeAmount = parseFloat(amount);
  const tradeSide = side === 'bid' ? 'BUY' : 'SELL';

  // Get initial position info for this symbol
  const initialPositions = (activeFight.initialPositions as unknown as InitialPosition[]) || [];
  const baseSymbol = symbol.replace('-USD', ''); // Convert BTC-USD -> BTC
  const initialPos = initialPositions.find((ip: any) => ip.symbol === baseSymbol);

  // Log pre-fight position for debugging (not used in calculation - we use Pacifica API)
  if (initialPos) {
    const absAmount = parseFloat(initialPos.amount);
    console.log(`[FightTrade] Pre-fight position for ${baseSymbol}: ${initialPos.side === 'ask' ? 'SHORT' : 'LONG'} ${absAmount}`);
  }

  // Get all fight trades for this symbol
  const [fightBuysResult, fightSellsResult] = await Promise.all([
    prisma.fightTrade.aggregate({
      where: { fightId: fight.id, participantUserId: connection.userId, symbol, side: 'BUY' },
      _sum: { amount: true },
    }),
    prisma.fightTrade.aggregate({
      where: { fightId: fight.id, participantUserId: connection.userId, symbol, side: 'SELL' },
      _sum: { amount: true },
    }),
  ]);

  const totalBought = fightBuysResult._sum.amount ? parseFloat(fightBuysResult._sum.amount.toString()) : 0;
  const totalSold = fightSellsResult._sum.amount ? parseFloat(fightSellsResult._sum.amount.toString()) : 0;

  // TFC net position = totalBought - totalSold (BEFORE this trade)
  // Positive = LONG opened via TFC, Negative = SHORT opened via TFC
  const tfcNet = totalBought - totalSold;

  // ═══════════════════════════════════════════════════════════════════════════
  // RULE 35 FIX (SIMPLIFIED): Only record fight-relevant trades
  //
  // Core principle: fight_trades should ONLY contain trades that:
  // 1. Close positions opened via TFC during this fight
  // 2. Open new positions via TFC during this fight
  //
  // What should NOT be recorded:
  // - Closing pre-fight positions
  // - Closing positions bought on Pacifica directly (not via TFC)
  // ═══════════════════════════════════════════════════════════════════════════

  // Get current Pacifica position for this symbol (AFTER this trade executed)
  let pacificaPositionAfter: number | null = null;
  let pacificaFetchFailed = false;
  try {
    const { getPositions } = await import('@/lib/server/pacifica');
    const positions = await getPositions(accountAddress);
    const pos = positions.find((p: any) => p.symbol === symbol);
    if (pos) {
      const posAmount = parseFloat(pos.amount || '0');
      // Positive for LONG (bid), negative for SHORT (ask)
      pacificaPositionAfter = pos.side === 'ask' ? -posAmount : posAmount;
    } else {
      pacificaPositionAfter = 0; // No position found = flat
    }
    console.log('[RULE 35] Pacifica position after trade:', { symbol, pacificaPositionAfter });
  } catch (err) {
    console.error('[RULE 35] Failed to fetch Pacifica position:', err);
    pacificaFetchFailed = true;
  }

  // Calculate position BEFORE this trade executed
  // For SELL: positionBefore = positionAfter + sellAmount
  // For BUY: positionBefore = positionAfter - buyAmount
  let positionBefore: number;

  if (pacificaFetchFailed) {
    // FALLBACK: When Pacifica API fails, assume all positions are from TFC
    // This is conservative - it means we record the full trade as fight-relevant
    // rather than incorrectly excluding it
    console.warn('[RULE 35] Using TFC net as fallback for position calculation');
    // Use TFC net as the position before this trade
    positionBefore = tfcNet;
  } else {
    positionBefore = tradeSide === 'SELL'
      ? pacificaPositionAfter! + tradeAmount
      : pacificaPositionAfter! - tradeAmount;
  }

  console.log('[RULE 35] Position analysis:', {
    symbol,
    tradeSide,
    tradeAmount,
    positionBefore,
    pacificaPositionAfter,
    tfcNet,
    totalBought,
    totalSold,
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SELL LOGIC: Determine fight-relevant portion
  // ─────────────────────────────────────────────────────────────────────────
  if (tradeSide === 'SELL') {
    const tfcLong = Math.max(0, tfcNet); // TFC LONG position still open

    if (positionBefore <= 0) {
      // User was SHORT or flat before this SELL → This opens/adds to SHORT
      // All of it is fight-relevant (opening new position)
      console.log('[RULE 35] SELL opens/adds SHORT - recording full amount');
      // tradeAmount stays as is
    } else {
      // User was LONG before this SELL
      // Part 1: Closes TFC LONG (fight-relevant)
      const closesTfcLong = Math.min(tradeAmount, tfcLong);

      // Part 2: Opens SHORT if selling more than total position (fight-relevant)
      const opensShort = Math.max(0, tradeAmount - positionBefore);

      // Part 3: Closes external/pre-fight LONG (NOT fight-relevant) - this is the remainder
      const closesExternal = tradeAmount - closesTfcLong - opensShort;

      const fightRelevantAmount = closesTfcLong + opensShort;

      console.log('[RULE 35] SELL analysis:', {
        tfcLong,
        closesTfcLong,
        opensShort,
        closesExternal,
        fightRelevantAmount,
      });

      if (fightRelevantAmount <= 0.0000001) {
        console.log('[RULE 35] SELL only closes external/pre-fight LONG. Skipping FightTrade record.');
        return;
      }

      if (fightRelevantAmount < tradeAmount - 0.0000001) {
        console.log(`[RULE 35] Limiting SELL from ${tradeAmount} to ${fightRelevantAmount}`);
      }
      tradeAmount = fightRelevantAmount;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BUY LOGIC: Determine fight-relevant portion
  // ─────────────────────────────────────────────────────────────────────────
  if (tradeSide === 'BUY') {
    const tfcShort = Math.max(0, -tfcNet); // TFC SHORT position still open

    if (positionBefore >= 0) {
      // User was LONG or flat before this BUY → This opens/adds to LONG
      // All of it is fight-relevant (opening new position)
      console.log('[RULE 35] BUY opens/adds LONG - recording full amount');
      // tradeAmount stays as is
    } else {
      // User was SHORT before this BUY
      // Part 1: Closes TFC SHORT (fight-relevant)
      const closesTfcShort = Math.min(tradeAmount, tfcShort);

      // Part 2: Opens LONG if buying more than covers SHORT (fight-relevant)
      const opensLong = Math.max(0, tradeAmount - Math.abs(positionBefore));

      // Part 3: Closes external/pre-fight SHORT (NOT fight-relevant)
      const closesExternal = tradeAmount - closesTfcShort - opensLong;

      const fightRelevantAmount = closesTfcShort + opensLong;

      console.log('[RULE 35] BUY analysis:', {
        tfcShort,
        closesTfcShort,
        opensLong,
        closesExternal,
        fightRelevantAmount,
      });

      if (fightRelevantAmount <= 0.0000001) {
        console.log('[RULE 35] BUY only closes external/pre-fight SHORT. Skipping FightTrade record.');
        return;
      }

      if (fightRelevantAmount < tradeAmount - 0.0000001) {
        console.log(`[RULE 35] Limiting BUY from ${tradeAmount} to ${fightRelevantAmount}`);
      }
      tradeAmount = fightRelevantAmount;
    }
  }

  // Use pre-fetched execution details if available, otherwise fetch from Pacifica
  let executionPrice = execDetails?.executionPrice || '0';
  let fee = execDetails?.fee || '0';
  let pnl: string | null = execDetails?.pnl || null;
  let historyId = execDetails?.historyId || BigInt(Date.now() * 1000 + orderId);
  let executedAt: Date = new Date(); // Default to now, will be overwritten if we get real data

  // Only fetch if we don't have pre-fetched details
  if (!execDetails || executionPrice === '0') {
    const MAX_RETRIES = 3;
    const RETRY_DELAYS = [500, 1000, 1500]; // ms

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt]));

      try {
        const tradeHistoryResponse = await fetch(
          `${PACIFICA_API_URL}/api/v1/trades/history?account=${accountAddress}&limit=10`
        );

        if (tradeHistoryResponse.ok) {
          const tradeData = await tradeHistoryResponse.json();
          if (tradeData.success && Array.isArray(tradeData.data)) {
            // Find the trade with matching order_id
            const trade = tradeData.data.find((t: any) => t.order_id === orderId);
            if (trade) {
              executionPrice = trade.price || '0';
              fee = trade.fee || '0';
              pnl = trade.pnl || null;
              historyId = BigInt(trade.history_id || historyId);
              // Use actual execution time from Pacifica (created_at is in milliseconds)
              if (trade.created_at) {
                executedAt = new Date(trade.created_at);
              }

              console.log('Found trade execution details:', {
                orderId,
                price: executionPrice,
                fee,
                pnl,
                historyId: historyId.toString(),
                executedAt: executedAt.toISOString(),
                attempt: attempt + 1,
              });
              break; // Found the trade, exit retry loop
            }
          }
        }

        if (attempt < MAX_RETRIES - 1) {
          console.log(`Trade not found in history yet, retrying... (attempt ${attempt + 1}/${MAX_RETRIES})`);
        }
      } catch (err) {
        console.error(`Failed to fetch trade history (attempt ${attempt + 1}):`, err);
      }
    }

    if (executionPrice === '0') {
      console.warn(`Could not fetch execution price for order ${orderId} after ${MAX_RETRIES} attempts`);
    }
  }

  // Adjust fee and pnl proportionally if we're recording a partial trade
  const originalAmount = parseFloat(amount);
  const adjustmentRatio = tradeAmount / originalAmount;
  const adjustedFee = (parseFloat(fee) * adjustmentRatio).toString();
  const adjustedPnl = pnl ? (parseFloat(pnl) * adjustmentRatio).toString() : null;

  // Record the trade with real execution details (using adjusted amount for fight portion only)
  await prisma.fightTrade.create({
    data: {
      fightId: fight.id,
      participantUserId: connection.userId,
      pacificaHistoryId: historyId,
      pacificaOrderId: BigInt(orderId),
      symbol,
      side: tradeSide,
      amount: tradeAmount.toString(),
      price: executionPrice,
      fee: adjustedFee,
      pnl: adjustedPnl,
      leverage: leverage || null, // Store leverage for accurate ROI calculation
      executedAt, // Use actual execution time from Pacifica
    },
  });

  console.log('Fight trade recorded with details:', {
    fightId: fight.id,
    userId: connection.userId,
    symbol,
    side: tradeSide,
    originalAmount,
    fightAmount: tradeAmount,
    price: executionPrice,
    fee: adjustedFee,
    pnl: adjustedPnl,
    leverage,
  });

  // Update maxExposureUsed and emit stake info update via websocket
  try {
    // Calculate current exposure from ALL fight trades (now includes this new trade)
    const exposureResult = await calculateFightExposure(fight.id, connection.userId);
    const { currentExposure, cumulativeOpeningNotional, positionsBySymbol } = exposureResult;

    console.log(`[MaxExposure] Calculated exposure for fight ${fight.id}, user ${connection.userId}:`);
    console.log(`[MaxExposure]   currentExposure: ${currentExposure}`);
    console.log(`[MaxExposure]   cumulativeOpeningNotional: ${cumulativeOpeningNotional}`);
    console.log(`[MaxExposure]   positionsBySymbol:`, JSON.stringify(positionsBySymbol));

    // Get updated participant data
    const participant = await prisma.fightParticipant.findFirst({
      where: {
        fightId: fight.id,
        userId: connection.userId,
      },
      include: {
        fight: { select: { stakeUsdc: true } },
      },
    });

    if (participant) {
      const prevMaxExposure = parseFloat(participant.maxExposureUsed?.toString() || '0');

      console.log(`[MaxExposure] Participant ${participant.id}: prevMax=${prevMaxExposure}, cumulative=${cumulativeOpeningNotional}`);

      // Update maxExposureUsed with cumulative opening notional (total capital ever committed)
      // This is NOT the current open exposure, but the SUM of all capital used for OPENING positions
      // Example: Open $50 BTC, close it, open $30 ETH → maxExposureUsed = $80 (not $30)
      await updateMaxExposureIfHigher(participant.id, cumulativeOpeningNotional);

      // Verify the update worked by re-reading
      const updatedParticipant = await prisma.fightParticipant.findUnique({
        where: { id: participant.id },
        select: { maxExposureUsed: true },
      });
      console.log(`[MaxExposure] After update: maxExposureUsed = ${updatedParticipant?.maxExposureUsed}`);

      // Get the effective max exposure (cumulative, not just current open positions)
      const effectiveMaxExposure = Math.max(prevMaxExposure, cumulativeOpeningNotional);

      if (cumulativeOpeningNotional > prevMaxExposure) {
        console.log(`[MaxExposure] Updated: ${prevMaxExposure.toFixed(2)} -> ${cumulativeOpeningNotional.toFixed(2)} USDC (cumulative)`);
      }

      // Emit real-time stake info update
      // currentExposure = open positions value (for display)
      // effectiveMaxExposure = cumulative capital used (for stake limit calculation)
      await emitStakeInfo(
        fight.id,
        connection.userId,
        participant.fight.stakeUsdc,
        currentExposure,
        effectiveMaxExposure
      );
    } else {
      console.error(`[MaxExposure] No participant found for fight ${fight.id}, user ${connection.userId}`);
    }
  } catch (err) {
    console.error('Failed to update maxExposure/emit stake info:', err);
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const account = searchParams.get('account');
    const symbol = searchParams.get('symbol');
    const signature = searchParams.get('signature');
    const timestamp = searchParams.get('timestamp');

    if (!account || !signature || !timestamp) {
      throw new BadRequestError('account, signature, and timestamp are required', ErrorCode.ERR_ORDER_MISSING_REQUIRED_FIELDS);
    }

    const requestBody: Record<string, any> = {
      account,
      all_symbols: !symbol,
      exclude_reduce_only: false,
      signature,
      timestamp: parseInt(timestamp, 10),
      expiry_window: 5000,
    };

    // Only include symbol if provided
    if (symbol) {
      requestBody.symbol = symbol;
    }

    console.log('Cancelling all orders:', requestBody);

    // Proxy to Pacifica API
    const response = await fetch(`${PACIFICA_API_URL}/api/v1/orders/cancel_all`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    console.log('Pacifica cancel_all response:', { status: response.status, body: responseText });

    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      throw new Error(`Failed to parse Pacifica response: ${responseText}`);
    }

    if (!response.ok || !result.success) {
      const errorMessage = result.error || `Pacifica API error: ${response.status}`;
      console.error('Pacifica cancel error:', errorMessage);
      // Determine appropriate error class based on status code
      if (response.status === 504) {
        throw new GatewayTimeoutError(errorMessage, ErrorCode.ERR_EXTERNAL_PACIFICA_API);
      } else if (response.status >= 500) {
        throw new ServiceUnavailableError(errorMessage, ErrorCode.ERR_EXTERNAL_PACIFICA_API);
      } else {
        throw new BadRequestError(errorMessage, ErrorCode.ERR_EXTERNAL_PACIFICA_API);
      }
    }

    console.log('All orders cancelled', {
      account,
      symbol: symbol || 'all',
    });

    // Record cancel all action (non-blocking)
    recordOrderAction({
      walletAddress: account,
      actionType: 'CANCEL_ALL',
      symbol: symbol || 'ALL',
      success: true,
    }).catch(err => console.error('Failed to record cancel all action:', err));

    return Response.json({ success: true, data: result.data });
  } catch (error) {
    return errorResponse(error);
  }
}
