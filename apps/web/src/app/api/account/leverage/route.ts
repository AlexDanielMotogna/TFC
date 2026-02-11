/**
 * Account Leverage endpoint
 * POST /api/account/leverage - Update leverage for a trading pair
 */
import { errorResponse, BadRequestError, ServiceUnavailableError } from '@/lib/server/errors';
import { ErrorCode } from '@/lib/server/error-codes';

const PACIFICA_API_URL = process.env.PACIFICA_API_URL || 'https://api.pacifica.fi';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { account, symbol, leverage, signature, timestamp } = body;

    if (!account || !symbol || !leverage || !signature || !timestamp) {
      throw new BadRequestError('account, symbol, leverage, signature, and timestamp are required', ErrorCode.ERR_VALIDATION_MISSING_FIELD);
    }

    console.log('Setting leverage:', { account, symbol, leverage });

    // Proxy to Pacifica API
    const response = await fetch(`${PACIFICA_API_URL}/api/v1/account/leverage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        account,
        symbol,
        leverage: parseInt(leverage),
        signature,
        timestamp,
        expiry_window: 5000,
      }),
    });

    const responseText = await response.text();
    console.log('Pacifica leverage response:', { status: response.status, body: responseText });

    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      throw new ServiceUnavailableError(`Failed to parse Pacifica response: ${responseText}`, ErrorCode.ERR_EXTERNAL_PACIFICA_API);
    }

    if (!response.ok || !result.success) {
      throw new ServiceUnavailableError(result.error || `Pacifica API error: ${response.status}`, ErrorCode.ERR_EXTERNAL_PACIFICA_API);
    }

    console.log('Leverage set successfully', { account, symbol, leverage });

    return Response.json({ success: true, data: result.data });
  } catch (error) {
    return errorResponse(error);
  }
}
