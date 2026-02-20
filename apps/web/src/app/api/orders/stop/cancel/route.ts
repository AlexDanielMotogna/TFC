/**
 * Cancel stop order endpoint (TP/SL orders)
 * POST /api/orders/stop/cancel
 */
import { errorResponse, BadRequestError, ServiceUnavailableError } from '@/lib/server/errors';
import { ErrorCode } from '@/lib/server/error-codes';
import { recordOrderAction } from '@/lib/server/order-actions';
import { getOrderRouter } from '@/lib/server/exchanges/order-router';
import type { ExchangeType } from '@tfc/shared';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { exchange, account, symbol, order_id, signature, timestamp } = body;

    const exchangeType: ExchangeType = exchange || 'pacifica';
    const router = getOrderRouter(exchangeType);

    if (!router.signsServerSide) {
      if (!account || !symbol || !order_id || !signature || !timestamp) {
        throw new BadRequestError('account, symbol, order_id, signature, and timestamp are required', ErrorCode.ERR_VALIDATION_MISSING_FIELD);
      }
    } else {
      if (!account || !symbol || !order_id) {
        throw new BadRequestError('account, symbol, and order_id are required', ErrorCode.ERR_VALIDATION_MISSING_FIELD);
      }
    }

    // Route to the correct exchange
    const result = await router.cancelStopOrder({
      account, symbol, order_id, signature, timestamp,
    });

    if (!result.success) {
      throw new ServiceUnavailableError(result.error || 'Exchange API error', ErrorCode.ERR_EXTERNAL_PACIFICA_API);
    }

    console.log('Stop order cancelled', {
      exchange: exchangeType,
      account, symbol, order_id,
    });

    // Record cancel stop action (non-blocking)
    recordOrderAction({
      walletAddress: account,
      actionType: 'CANCEL_STOP',
      symbol,
      pacificaOrderId: order_id,
      success: true,
    }).catch(err => console.error('Failed to record cancel stop action:', err));

    return Response.json({ success: true, data: result.data });
  } catch (error) {
    return errorResponse(error);
  }
}
