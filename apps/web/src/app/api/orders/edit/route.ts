/**
 * Edit Order endpoint
 * POST /api/orders/edit - Edit limit order price/amount (proxies to Pacifica)
 */
import { errorResponse, BadRequestError, ServiceUnavailableError } from '@/lib/server/errors';
import { ErrorCode } from '@/lib/server/error-codes';
import { recordOrderAction } from '@/lib/server/order-actions';

const PACIFICA_API_URL = process.env.PACIFICA_API_URL || 'https://api.pacifica.fi';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      account,
      symbol,
      price,
      amount,
      order_id,
      client_order_id,
      signature,
      timestamp,
    } = body;

    if (!account || !symbol || !price || !amount || !signature || !timestamp) {
      throw new BadRequestError('account, symbol, price, amount, signature, and timestamp are required', ErrorCode.ERR_VALIDATION_MISSING_FIELD);
    }

    if (!order_id && !client_order_id) {
      throw new BadRequestError('Either order_id or client_order_id is required', ErrorCode.ERR_VALIDATION_MISSING_FIELD);
    }

    // Build request body for Pacifica
    // NOTE: expiry_window must match what was signed (5000ms in signing.ts)
    const requestBody: Record<string, any> = {
      account,
      symbol,
      price,
      amount,
      signature,
      timestamp,
      expiry_window: 5000,
    };

    if (order_id) requestBody.order_id = order_id;
    if (client_order_id) requestBody.client_order_id = client_order_id;

    console.log('Editing order on Pacifica:', { endpoint: `${PACIFICA_API_URL}/api/v1/orders/edit`, requestBody });

    // Proxy to Pacifica API
    const response = await fetch(`${PACIFICA_API_URL}/api/v1/orders/edit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    console.log('Pacifica edit response:', { status: response.status, body: responseText });

    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      throw new ServiceUnavailableError(`Failed to parse Pacifica response: ${responseText}`, ErrorCode.ERR_EXTERNAL_PACIFICA_API);
    }

    if (!response.ok || !result.success) {
      const errorMessage = result.error || `Pacifica API error: ${response.status}`;
      console.error('Pacifica edit error:', errorMessage);
      throw new ServiceUnavailableError(errorMessage, ErrorCode.ERR_EXTERNAL_PACIFICA_API);
    }

    console.log('Order edited successfully', {
      account,
      symbol,
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
      pacificaOrderId: result.data?.order_id,
      success: true,
    }).catch(err => console.error('Failed to record edit order action:', err));

    return Response.json({ success: true, data: result.data });
  } catch (error) {
    return errorResponse(error);
  }
}
