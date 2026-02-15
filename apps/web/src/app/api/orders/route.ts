/**
 * Orders endpoints
 * POST /api/orders - Place order (proxies to Pacifica)
 * DELETE /api/orders - Cancel all orders (proxies to Pacifica)
 */
import { errorResponse, BadRequestError, StakeLimitError, ServiceUnavailableError, GatewayTimeoutError } from '@/lib/server/errors';
import { ErrorCode } from '@/lib/server/error-codes';
import { validateStakeLimit } from '@/lib/server/orders';
import { recordOrderAction } from '@/lib/server/order-actions';
import { recordAllTrades } from '@/lib/server/trade-recording';
import { prisma } from '@tfc/db';
import { FeatureFlags } from '@/lib/server/feature-flags';

const PACIFICA_API_URL = process.env.PACIFICA_API_URL || 'https://api.pacifica.fi';

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
