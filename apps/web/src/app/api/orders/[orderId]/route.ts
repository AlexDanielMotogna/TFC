/**
 * Cancel order endpoint
 * DELETE /api/orders/[orderId]
 */
import { errorResponse, BadRequestError } from '@/lib/server/errors';

const PACIFICA_API_URL = process.env.PACIFICA_API_URL || 'https://api.pacifica.fi';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    const { searchParams } = new URL(request.url);
    const account = searchParams.get('account');
    const symbol = searchParams.get('symbol');
    const signature = searchParams.get('signature');
    const timestamp = searchParams.get('timestamp');

    if (!account || !symbol || !signature || !timestamp) {
      throw new BadRequestError('account, symbol, signature, and timestamp are required');
    }

    const requestBody = {
      account,
      symbol,
      order_id: parseInt(orderId, 10),
      signature,
      timestamp: parseInt(timestamp, 10),
    };

    console.log('Cancelling order:', requestBody);

    // Proxy to Pacifica API
    const response = await fetch(`${PACIFICA_API_URL}/api/v1/orders/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    console.log('Pacifica cancel response:', { status: response.status, body: responseText });

    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      throw new Error(`Failed to parse Pacifica response: ${responseText}`);
    }

    if (!response.ok || !result.success) {
      throw new Error(result.error || `Pacifica API error: ${response.status}`);
    }

    console.log('Order cancelled', {
      account,
      symbol,
      orderId,
    });

    return Response.json({ success: true, data: result.data });
  } catch (error) {
    return errorResponse(error);
  }
}
