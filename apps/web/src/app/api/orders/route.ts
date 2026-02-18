/**
 * Orders endpoints
 * POST /api/orders - Place order (routes to exchange via ExchangeOrderRouter)
 * DELETE /api/orders - Cancel all orders
 */
import { errorResponse, BadRequestError, StakeLimitError, ServiceUnavailableError, GatewayTimeoutError } from '@/lib/server/errors';
import { ErrorCode } from '@/lib/server/error-codes';
import { validateStakeLimit } from '@/lib/server/orders';
import { recordOrderAction } from '@/lib/server/order-actions';
import { recordAllTrades } from '@/lib/server/trade-recording';
import { prisma } from '@tfc/db';
import { FeatureFlags } from '@/lib/server/feature-flags';
import { getOrderRouter } from '@/lib/server/exchanges/order-router';
import type { ExchangeType } from '@tfc/shared';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      exchange, // NEW: exchange type (defaults to 'pacifica')
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
      fight_id,
      leverage,
      is_pre_fight_flip,
    } = body;

    const exchangeType: ExchangeType = exchange || 'pacifica';
    const router = getOrderRouter(exchangeType);

    // For client-signed exchanges (Pacifica), signature + timestamp are required
    if (!router.signsServerSide) {
      if (!account || !symbol || !side || !type || !amount || !signature || !timestamp) {
        throw new BadRequestError('account, symbol, side, type, amount, signature, and timestamp are required', ErrorCode.ERR_ORDER_MISSING_REQUIRED_FIELDS);
      }
    } else {
      if (!account || !symbol || !side || !type || !amount) {
        throw new BadRequestError('account, symbol, side, type, and amount are required', ErrorCode.ERR_ORDER_MISSING_REQUIRED_FIELDS);
      }
    }

    // Feature flag: Check if trading is enabled
    if (!FeatureFlags.isTradingEnabled()) {
      throw new ServiceUnavailableError('Trading is temporarily disabled', ErrorCode.ERR_ORDER_TRADING_DISABLED);
    }

    // Validate stake limit for users in active fights
    let fightValidation: Awaited<ReturnType<typeof validateStakeLimit>> = null;
    try {
      fightValidation = await validateStakeLimit(
        account,
        symbol,
        amount,
        price,
        type,
        reduce_only || false,
        fight_id || undefined
      );
    } catch (error: any) {
      if (error.code === 'STAKE_LIMIT_EXCEEDED') {
        throw new StakeLimitError(error.message, error.details);
      }
      throw error;
    }

    // Check if symbol is blocked for this user in their active fight
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

        const blockedSymbols = (participant as any)?.blockedSymbols as string[] | undefined;
        if (blockedSymbols?.includes(symbol) && !is_pre_fight_flip) {
          throw new BadRequestError(
            `Symbol ${symbol} is blocked for this fight. You had an open position in this symbol before the fight started. Close pre-fight positions before joining a fight to trade that symbol.`,
            ErrorCode.ERR_ORDER_SYMBOL_BLOCKED
          );
        }
      }
    }

    // Route to the correct exchange
    const result = await router.createOrder({
      account, symbol, side, type, amount, price,
      slippage_percent, reduce_only, post_only, tif,
      builder_code, take_profit, stop_loss,
      signature, timestamp,
    });

    if (!result.success) {
      const errorMessage = result.error || 'Exchange API error';
      throw new BadRequestError(errorMessage, ErrorCode.ERR_EXTERNAL_PACIFICA_API);
    }

    console.log('Order placed successfully', {
      exchange: exchangeType,
      account, symbol, side, type, amount,
      orderId: result.data?.order_id,
    });

    // Record ALL trades to the Trade table for platform metrics
    if (type === 'MARKET' && result.data?.order_id) {
      recordAllTrades(account, symbol, side, amount, result.data.order_id as number, fight_id, leverage, is_pre_fight_flip).catch(err => {
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
      pacificaOrderId: result.data?.order_id as number,
      leverage,
      fightId: fight_id,
      success: true,
    }).catch(err => console.error('Failed to record order action:', err));

    // If TP/SL was included with the order, also record a SET_TPSL action
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

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const exchange = searchParams.get('exchange') as ExchangeType | null;
    const account = searchParams.get('account');
    const symbol = searchParams.get('symbol');
    const signature = searchParams.get('signature');
    const timestamp = searchParams.get('timestamp');

    const exchangeType: ExchangeType = exchange || 'pacifica';
    const router = getOrderRouter(exchangeType);

    if (!router.signsServerSide) {
      if (!account || !signature || !timestamp) {
        throw new BadRequestError('account, signature, and timestamp are required', ErrorCode.ERR_ORDER_MISSING_REQUIRED_FIELDS);
      }
    } else {
      if (!account) {
        throw new BadRequestError('account is required', ErrorCode.ERR_ORDER_MISSING_REQUIRED_FIELDS);
      }
    }

    const result = await router.cancelAllOrders({
      account: account!,
      symbol: symbol || undefined,
      signature: signature || undefined,
      timestamp: timestamp ? parseInt(timestamp, 10) : undefined,
    });

    if (!result.success) {
      const errorMessage = result.error || 'Exchange API error';
      throw new BadRequestError(errorMessage, ErrorCode.ERR_EXTERNAL_PACIFICA_API);
    }

    console.log('All orders cancelled', {
      exchange: exchangeType,
      account,
      symbol: symbol || 'all',
    });

    // Record cancel all action (non-blocking)
    recordOrderAction({
      walletAddress: account!,
      actionType: 'CANCEL_ALL',
      symbol: symbol || 'ALL',
      success: true,
    }).catch(err => console.error('Failed to record cancel all action:', err));

    return Response.json({ success: true, data: result.data });
  } catch (error) {
    return errorResponse(error);
  }
}
