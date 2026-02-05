/**
 * Create stop order endpoint (for partial TP/SL)
 * POST /api/orders/stop/create
 *
 * Unlike set_position_tpsl, this creates a separate stop order
 * without overwriting existing TP/SL orders
 */
import { errorResponse, BadRequestError, ServiceUnavailableError } from '@/lib/server/errors';
import { ErrorCode } from '@/lib/server/error-codes';
import { recordOrderAction } from '@/lib/server/order-actions';

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
      throw new ServiceUnavailableError(result.error || `Pacifica API error: ${response.status}`, ErrorCode.ERR_EXTERNAL_PACIFICA_API);
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
      side: side === 'ask' ? 'LONG' : 'SHORT', // Position side being closed
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
