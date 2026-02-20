/**
 * Edit Order endpoint
 * POST /api/orders/edit - Edit limit order price/amount
 */
import { errorResponse, BadRequestError, ServiceUnavailableError } from '@/lib/server/errors';
import { ErrorCode } from '@/lib/server/error-codes';
import { recordOrderAction } from '@/lib/server/order-actions';
import { getOrderRouter } from '@/lib/server/exchanges/order-router';
import type { ExchangeType } from '@tfc/shared';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      exchange,
      account,
      symbol,
      price,
      amount,
      order_id,
      client_order_id,
      signature,
      timestamp,
    } = body;

    const exchangeType: ExchangeType = exchange || 'pacifica';
    const router = getOrderRouter(exchangeType);

    if (!router.signsServerSide) {
      if (!account || !symbol || !price || !amount || !signature || !timestamp) {
        throw new BadRequestError('account, symbol, price, amount, signature, and timestamp are required', ErrorCode.ERR_VALIDATION_MISSING_FIELD);
      }
    } else {
      if (!account || !symbol || !price || !amount) {
        throw new BadRequestError('account, symbol, price, and amount are required', ErrorCode.ERR_VALIDATION_MISSING_FIELD);
      }
    }

    if (!order_id && !client_order_id) {
      throw new BadRequestError('Either order_id or client_order_id is required', ErrorCode.ERR_VALIDATION_MISSING_FIELD);
    }

    // Route to the correct exchange
    const result = await router.editOrder({
      account, symbol, price, amount,
      order_id, client_order_id,
      signature, timestamp,
    });

    if (!result.success) {
      throw new ServiceUnavailableError(result.error || 'Exchange API error', ErrorCode.ERR_EXTERNAL_PACIFICA_API);
    }

    console.log('Order edited successfully', {
      exchange: exchangeType,
      account, symbol,
      orderId: order_id,
      newPrice: price,
      newAmount: amount,
      newOrderId: result.data?.order_id,
    });

    // Record order action (non-blocking)
    recordOrderAction({
      walletAddress: account,
      actionType: 'EDIT_ORDER',
      symbol,
      orderType: 'LIMIT',
      amount,
      price,
      pacificaOrderId: result.data?.order_id as number,
      success: true,
    }).catch(err => console.error('Failed to record edit order action:', err));

    return Response.json({ success: true, data: result.data });
  } catch (error) {
    return errorResponse(error);
  }
}
