/**
 * Orders endpoints
 * POST /api/orders - Place order (proxies to Pacifica)
 * DELETE /api/orders - Cancel all orders (proxies to Pacifica)
 */
import { errorResponse, BadRequestError, StakeLimitError } from '@/lib/server/errors';
import { validateStakeLimit, calculateFightExposure } from '@/lib/server/orders';
import { prisma, FightStatus } from '@tfc/db';
import { FeatureFlags } from '@/lib/server/feature-flags';

const PACIFICA_API_URL = process.env.PACIFICA_API_URL || 'https://api.pacifica.fi';
const REALTIME_URL = process.env.REALTIME_URL || 'http://localhost:3002';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'dev-internal-key';

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
      throw new BadRequestError('account, symbol, side, type, amount, signature, and timestamp are required');
    }

    // Feature flag: Check if trading is enabled
    if (!FeatureFlags.isTradingEnabled()) {
      throw new BadRequestError('Trading is temporarily disabled');
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
        throw new BadRequestError('price is required for limit orders');
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
      throw new Error(result.error || `Pacifica API error: ${response.status}`);
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
  try {
    await prisma.trade.create({
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
        fightId: specificFightId || null,
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
  if (!isPreFightFlip) {
    await recordFightTradeWithDetails(
      accountAddress,
      symbol,
      side,
      amount,
      orderId,
      specificFightId,
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

  // Make initialAmount signed: positive = LONG (bid), negative = SHORT (ask)
  // This is critical for correctly calculating which trades close pre-fight positions
  let initialAmount = 0;
  if (initialPos) {
    const absAmount = parseFloat(initialPos.amount);
    // If side is 'ask' (SHORT), make it negative. Default to LONG for backwards compatibility.
    initialAmount = initialPos.side === 'ask' ? -absAmount : absAmount;
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

  // For SELL trades, determine how much is:
  // 1. Closing pre-fight LONG (don't record)
  // 2. Closing fight LONG (record)
  // 3. Opening new SHORT (record)
  if (tradeSide === 'SELL') {
    // Pre-fight LONG that was open (positive initialAmount = LONG)
    const initialLong = Math.max(0, initialAmount);

    // Calculate how much of the pre-fight LONG is still open
    // SELLs close the pre-fight LONG first, before opening SHORTs
    // We need to figure out how much of the pre-fight LONG has already been closed by previous SELLs
    //
    // Total LONG available = initialLong + totalBought (from fight)
    // Total LONG closed = totalSold (previous sells)
    // Remaining LONG = Total LONG available - Total LONG closed
    const totalLongAvailable = initialLong + totalBought;
    const remainingLong = Math.max(0, totalLongAvailable - totalSold);

    // How much of this SELL closes remaining LONG vs opens SHORT
    const closesLong = Math.min(tradeAmount, remainingLong);
    const opensShort = tradeAmount - closesLong;

    // Of the portion that closes LONG, how much is pre-fight vs fight?
    // Pre-fight LONG still open = initialLong - (totalSold that went to pre-fight)
    // SELLs close pre-fight first, then fight
    const preFightLongAlreadyClosed = Math.min(initialLong, totalSold);
    const remainingPreFightLong = Math.max(0, initialLong - preFightLongAlreadyClosed);

    // This SELL: first closes remaining pre-fight LONG, then closes fight LONG, then opens SHORT
    const closesPreFightLong = Math.min(tradeAmount, remainingPreFightLong);
    const afterPreFight = tradeAmount - closesPreFightLong;

    // Fight LONG currently open = totalBought - (totalSold - preFightLongAlreadyClosed)
    // But simpler: remainingLong - remainingPreFightLong
    const currentFightLong = Math.max(0, remainingLong - remainingPreFightLong);
    const closesFightLong = Math.min(afterPreFight, currentFightLong);
    const opensNewShort = afterPreFight - closesFightLong;

    // Fight-relevant = closes fight LONG + opens new SHORT
    const fightRelevantAmount = closesFightLong + opensNewShort;

    console.log('SELL analysis:', {
      symbol,
      initialLong,
      totalBought,
      totalSold,
      remainingPreFightLong,
      currentFightLong,
      tradeAmount,
      closesPreFightLong,
      closesFightLong,
      opensNewShort,
      fightRelevantAmount,
    });

    if (fightRelevantAmount <= 0.0000001) {
      console.log('SELL entirely closes pre-fight LONG. Skipping trade record.');
      return;
    }

    if (fightRelevantAmount < tradeAmount - 0.0000001) {
      console.log(`Limiting SELL from ${tradeAmount} to ${fightRelevantAmount} (fight portion only)`);
    }
    tradeAmount = fightRelevantAmount;
  }

  // For BUY trades, determine how much is:
  // 1. Closing pre-fight SHORT (don't record)
  // 2. Closing fight SHORT (record)
  // 3. Opening new LONG (record)
  if (tradeSide === 'BUY') {
    // Pre-fight SHORT that was open (negative initialAmount = SHORT)
    const initialShort = Math.abs(Math.min(0, initialAmount));

    // Calculate how much of the pre-fight SHORT is still open
    // BUYs close the pre-fight SHORT first, before opening LONGs
    const totalShortAvailable = initialShort + totalSold;
    const remainingShort = Math.max(0, totalShortAvailable - totalBought);

    // How much of this BUY closes remaining SHORT vs opens LONG
    const closesShort = Math.min(tradeAmount, remainingShort);
    const opensLong = tradeAmount - closesShort;

    // Pre-fight SHORT still open
    const preFightShortAlreadyClosed = Math.min(initialShort, totalBought);
    const remainingPreFightShort = Math.max(0, initialShort - preFightShortAlreadyClosed);

    // This BUY: first closes remaining pre-fight SHORT, then closes fight SHORT, then opens LONG
    const closesPreFightShort = Math.min(tradeAmount, remainingPreFightShort);
    const afterPreFight = tradeAmount - closesPreFightShort;

    // Fight SHORT currently open
    const currentFightShort = Math.max(0, remainingShort - remainingPreFightShort);
    const closesFightShort = Math.min(afterPreFight, currentFightShort);
    const opensNewLong = afterPreFight - closesFightShort;

    // Fight-relevant = closes fight SHORT + opens new LONG
    const fightRelevantAmount = closesFightShort + opensNewLong;

    console.log('BUY analysis:', {
      symbol,
      initialShort,
      totalBought,
      totalSold,
      remainingPreFightShort,
      currentFightShort,
      tradeAmount,
      closesPreFightShort,
      closesFightShort,
      opensNewLong,
      fightRelevantAmount,
    });

    if (fightRelevantAmount <= 0.0000001) {
      console.log('BUY entirely closes pre-fight SHORT. Skipping trade record.');
      return;
    }

    if (fightRelevantAmount < tradeAmount - 0.0000001) {
      console.log(`Limiting BUY from ${tradeAmount} to ${fightRelevantAmount} (fight portion only)`);
    }
    tradeAmount = fightRelevantAmount;
  }

  // Use pre-fetched execution details if available, otherwise fetch from Pacifica
  let executionPrice = execDetails?.executionPrice || '0';
  let fee = execDetails?.fee || '0';
  let pnl: string | null = execDetails?.pnl || null;
  let historyId = execDetails?.historyId || BigInt(Date.now() * 1000 + orderId);

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

              console.log('Found trade execution details:', {
                orderId,
                price: executionPrice,
                fee,
                pnl,
                historyId: historyId.toString(),
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
      executedAt: new Date(),
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
    const currentExposure = await calculateFightExposure(fight.id, connection.userId);

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
      let maxExposureUsed = parseFloat(participant.maxExposureUsed?.toString() || '0');

      // Update maxExposureUsed if current exposure is higher (water mark)
      if (currentExposure > maxExposureUsed) {
        await prisma.fightParticipant.update({
          where: { id: participant.id },
          data: { maxExposureUsed: currentExposure },
        });
        console.log(`[MaxExposure] Updated: ${maxExposureUsed.toFixed(2)} -> ${currentExposure.toFixed(2)} USDC`);
        maxExposureUsed = currentExposure;
      }

      // Emit real-time stake info update
      await emitStakeInfo(
        fight.id,
        connection.userId,
        participant.fight.stakeUsdc,
        currentExposure,
        maxExposureUsed
      );
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
      throw new BadRequestError('account, signature, and timestamp are required');
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
      throw new Error(result.error || `Pacifica API error: ${response.status}`);
    }

    console.log('All orders cancelled', {
      account,
      symbol: symbol || 'all',
    });

    return Response.json({ success: true, data: result.data });
  } catch (error) {
    return errorResponse(error);
  }
}
