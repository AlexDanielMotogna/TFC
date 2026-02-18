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
import { getOrderRouter } from '@/lib/server/exchanges/order-router';
import type { ExchangeType } from '@tfc/shared';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { exchange, account, symbol, side, reduce_only, stop_order, signature, timestamp, fight_id } = body;

    const exchangeType: ExchangeType = exchange || 'pacifica';
    const router = getOrderRouter(exchangeType);

    if (!router.signsServerSide) {
      if (!account || !symbol || !side || reduce_only === undefined || !stop_order || !signature || !timestamp) {
        throw new BadRequestError('account, symbol, side, reduce_only, stop_order, signature, and timestamp are required', ErrorCode.ERR_VALIDATION_MISSING_FIELD);
      }
    } else {
      if (!account || !symbol || !side || reduce_only === undefined || !stop_order) {
        throw new BadRequestError('account, symbol, side, reduce_only, and stop_order are required', ErrorCode.ERR_VALIDATION_MISSING_FIELD);
      }
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
          'LIMIT',
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

    // Route to the correct exchange
    const result = await router.createStopOrder({
      account, symbol, side, reduce_only,
      stop_order, signature, timestamp,
    });

    if (!result.success) {
      let errorMessage = result.error || 'Exchange API error';
      // Provide better error messages for common stop order errors
      if (errorMessage.includes('Invalid stop tick')) {
        errorMessage = side === 'bid'
          ? 'Buy stop trigger price must be above the current market price. Use a limit order to buy below market.'
          : 'Sell stop trigger price must be below the current market price. Use a limit order to sell above market.';
      }
      throw new ServiceUnavailableError(errorMessage, ErrorCode.ERR_EXTERNAL_PACIFICA_API);
    }

    console.log('Stop order created', {
      exchange: exchangeType,
      account, symbol, side,
      stop_price: stop_order.stop_price,
      amount: stop_order.amount,
      order_id: result.data?.order_id,
    });

    // Record stop order creation (non-blocking)
    recordOrderAction({
      walletAddress: account,
      actionType: 'CREATE_STOP',
      symbol,
      side: reduce_only
        ? (side === 'ask' ? 'LONG' : 'SHORT')
        : (side === 'bid' ? 'LONG' : 'SHORT'),
      price: stop_order.stop_price,
      size: stop_order.amount,
      reduceOnly: reduce_only,
      pacificaOrderId: result.data?.order_id as number,
      fightId: fight_id,
      success: true,
    }).catch(err => console.error('Failed to record create stop action:', err));

    return Response.json({ success: true, data: result.data });
  } catch (error) {
    return errorResponse(error);
  }
}
