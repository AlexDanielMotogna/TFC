/**
 * Create stop order endpoint (for partial TP/SL)
 * POST /api/orders/stop/create
 *
 * Unlike set_position_tpsl, this creates a separate stop order
 * without overwriting existing TP/SL orders
 */
import { errorResponse, BadRequestError, StakeLimitError, ServiceUnavailableError } from '@/lib/server/errors';
import { ErrorCode } from '@/lib/server/error-codes';
import { recordOrderAction } from '@/lib/server/order-actions';
import { validateStakeLimit } from '@/lib/server/orders';

const PACIFICA_API_URL = process.env.PACIFICA_API_URL || 'https://api.pacifica.fi';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { account, symbol, side, reduce_only, stop_order, signature, timestamp, fight_id } = body;

    if (!account || !symbol || !side || reduce_only === undefined || !stop_order || !signature || !timestamp) {
      throw new BadRequestError('account, symbol, side, reduce_only, stop_order, signature, and timestamp are required', ErrorCode.ERR_VALIDATION_MISSING_FIELD);
    }

    if (!stop_order.stop_price || !stop_order.amount) {
      throw new BadRequestError('stop_order must contain stop_price and amount', ErrorCode.ERR_VALIDATION_MISSING_FIELD);
    }

    // Validate stake limit for users in active fights (stop orders can open positions)
    if (!reduce_only) {
      try {
        await validateStakeLimit(
          account,
          symbol,
          stop_order.amount,
          stop_order.stop_price,
          'LIMIT', // Treat stop orders like limit orders for notional calculation
          false,
          fight_id || undefined
        );
      } catch (error: any) {
        if (error.code === 'STAKE_LIMIT_EXCEEDED') {
          throw new StakeLimitError(error.message, error.details);
        }
        throw error;
      }
    }

    const requestBody = {
      account,
      symbol,
      side, // 'bid' or 'ask'
      reduce_only,
      stop_order: {
        stop_price: stop_order.stop_price,
        amount: stop_order.amount,
        ...(stop_order.limit_price && { limit_price: stop_order.limit_price }),
      },
      signature,
      timestamp,
      expiry_window: 5000,
    };

    console.log('Creating stop order:', requestBody);

    // Proxy to Pacifica API
    const response = await fetch(`${PACIFICA_API_URL}/api/v1/orders/stop/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    console.log('Pacifica create stop order response:', { status: response.status, body: responseText });

    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      throw new ServiceUnavailableError(`Failed to parse Pacifica response: ${responseText}`, ErrorCode.ERR_EXTERNAL_PACIFICA_API);
    }

    if (!response.ok || !result.success) {
      console.error('Pacifica create_stop_order failed:', {
        status: response.status,
        error: result.error,
        code: result.code,
        fullResponse: result,
        request: requestBody,
      });

      // Provide better error messages for common Pacifica stop order errors
      let errorMessage = result.error || `Pacifica API error: ${response.status}`;
      if (errorMessage.includes('Invalid stop tick')) {
        // Pacifica rejects stop orders where the trigger price is on the wrong side of current market
        // Buy stop: trigger must be ABOVE current price; Sell stop: trigger must be BELOW
        errorMessage = side === 'bid'
          ? 'Buy stop trigger price must be above the current market price. Use a limit order to buy below market.'
          : 'Sell stop trigger price must be below the current market price. Use a limit order to sell above market.';
      }

      throw new ServiceUnavailableError(errorMessage, ErrorCode.ERR_EXTERNAL_PACIFICA_API);
    }

    console.log('Stop order created', {
      account,
      symbol,
      side,
      stop_price: stop_order.stop_price,
      amount: stop_order.amount,
      order_id: result.order_id || result.data?.order_id,
    });

    // Record stop order creation (non-blocking)
    // For reduce_only: ask = closing LONG, bid = closing SHORT
    recordOrderAction({
      walletAddress: account,
      actionType: 'CREATE_STOP',
      symbol,
      side: reduce_only
        ? (side === 'ask' ? 'LONG' : 'SHORT')   // closing: ask closes LONG, bid closes SHORT
        : (side === 'bid' ? 'LONG' : 'SHORT'),  // opening: bid=LONG, ask=SHORT
      price: stop_order.stop_price,
      size: stop_order.amount,
      reduceOnly: reduce_only,
      pacificaOrderId: result.order_id || result.data?.order_id,
      fightId: fight_id,
      success: true,
    }).catch(err => console.error('Failed to record create stop action:', err));

    return Response.json({ success: true, data: result.data || result });
  } catch (error) {
    return errorResponse(error);
  }
}
