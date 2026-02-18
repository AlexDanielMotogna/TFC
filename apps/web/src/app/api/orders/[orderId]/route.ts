/**
 * Cancel order endpoint
 * DELETE /api/orders/[orderId]
 */
import { errorResponse, BadRequestError, ServiceUnavailableError } from '@/lib/server/errors';
import { ErrorCode } from '@/lib/server/error-codes';
import { recordOrderAction } from '@/lib/server/order-actions';
import { getOrderRouter } from '@/lib/server/exchanges/order-router';
import type { ExchangeType } from '@tfc/shared';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    const { searchParams } = new URL(request.url);
    const exchange = searchParams.get('exchange') as ExchangeType | null;
    const account = searchParams.get('account');
    const symbol = searchParams.get('symbol');
    const signature = searchParams.get('signature');
    const timestamp = searchParams.get('timestamp');

    const exchangeType: ExchangeType = exchange || 'pacifica';
    const router = getOrderRouter(exchangeType);

    if (!router.signsServerSide) {
      if (!account || !symbol || !signature || !timestamp) {
        throw new BadRequestError('account, symbol, signature, and timestamp are required', ErrorCode.ERR_VALIDATION_MISSING_FIELD);
      }
    } else {
      if (!account || !symbol) {
        throw new BadRequestError('account and symbol are required', ErrorCode.ERR_VALIDATION_MISSING_FIELD);
      }
    }

    // Route to the correct exchange
    const result = await router.cancelOrder({
      account: account!,
      order_id: orderId,
      symbol: symbol!,
      signature: signature || undefined,
      timestamp: timestamp ? parseInt(timestamp, 10) : undefined,
    });

    if (!result.success) {
      throw new ServiceUnavailableError(result.error || 'Exchange API error', ErrorCode.ERR_EXTERNAL_PACIFICA_API);
    }

    console.log('Order cancelled', {
      exchange: exchangeType,
      account, symbol, orderId,
    });

    // Record cancel action (non-blocking)
    recordOrderAction({
      walletAddress: account!,
      actionType: 'CANCEL_ORDER',
      symbol: symbol!,
      pacificaOrderId: parseInt(orderId, 10),
      success: true,
    }).catch(err => console.error('Failed to record cancel action:', err));

    return Response.json({ success: true, data: result.data });
  } catch (error) {
    return errorResponse(error);
  }
}
