/**
 * Cancel stop order endpoint (TP/SL orders)
 * POST /api/orders/stop/cancel
 */
import { errorResponse, BadRequestError } from '@/lib/server/errors';
import { recordOrderAction } from '@/lib/server/order-actions';

const PACIFICA_API_URL = process.env.PACIFICA_API_URL || 'https://api.pacifica.fi';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { account, symbol, order_id, signature, timestamp } = body;

    if (!account || !symbol || !order_id || !signature || !timestamp) {
      throw new BadRequestError('account, symbol, order_id, signature, and timestamp are required');
    }

    const requestBody = {
      account,
      symbol,
      order_id,
      signature,
      timestamp,
    };

    console.log('Cancelling stop order:', requestBody);

    // Proxy to Pacifica API - use stop/cancel endpoint
    const response = await fetch(`${PACIFICA_API_URL}/api/v1/orders/stop/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    console.log('Pacifica cancel stop order response:', { status: response.status, body: responseText });

    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      throw new Error(`Failed to parse Pacifica response: ${responseText}`);
    }

    if (!response.ok || !result.success) {
      throw new Error(result.error || `Pacifica API error: ${response.status}`);
    }

    console.log('Stop order cancelled', {
      account,
      symbol,
      order_id,
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
