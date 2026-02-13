/**
 * Account Margin Mode endpoint
 * POST /api/account/margin - Switch between cross and isolated margin for a trading pair
 */
import { errorResponse, BadRequestError, ServiceUnavailableError } from '@/lib/server/errors';
import { ErrorCode } from '@/lib/server/error-codes';

const PACIFICA_API_URL = process.env.PACIFICA_API_URL || 'https://api.pacifica.fi';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { account, symbol, is_isolated, signature, timestamp } = body;

    if (!account || !symbol || is_isolated === undefined || !signature || !timestamp) {
      throw new BadRequestError('account, symbol, is_isolated, signature, and timestamp are required', ErrorCode.ERR_VALIDATION_MISSING_FIELD);
    }

    console.log('Setting margin mode:', { account, symbol, is_isolated });

    // Proxy to Pacifica API
    const response = await fetch(`${PACIFICA_API_URL}/api/v1/account/margin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        account,
        symbol,
        is_isolated,
        signature,
        timestamp,
        expiry_window: 5000,
      }),
    });

    const responseText = await response.text();
    console.log('Pacifica margin mode response:', { status: response.status, body: responseText });

    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      throw new ServiceUnavailableError(`Failed to parse Pacifica response: ${responseText}`, ErrorCode.ERR_EXTERNAL_PACIFICA_API);
    }

    if (!response.ok || !result.success) {
      throw new ServiceUnavailableError(result.error || `Pacifica API error: ${response.status}`, ErrorCode.ERR_EXTERNAL_PACIFICA_API);
    }

    console.log('Margin mode set successfully', { account, symbol, is_isolated });

    return Response.json({ success: true, data: result.data });
  } catch (error) {
    return errorResponse(error);
  }
}
