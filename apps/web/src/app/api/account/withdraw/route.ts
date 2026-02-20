/**
 * Account Withdraw endpoint
 * POST /api/account/withdraw - Request withdrawal of funds
 */
import { errorResponse, BadRequestError, ServiceUnavailableError } from '@/lib/server/errors';
import { ErrorCode } from '@/lib/server/error-codes';

const PACIFICA_API_URL = process.env.PACIFICA_API_URL || 'https://api.pacifica.fi';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { account, amount, signature, timestamp } = body;

    if (!account || !amount || !signature || !timestamp) {
      throw new BadRequestError('account, amount, signature, and timestamp are required', ErrorCode.ERR_VALIDATION_MISSING_FIELD);
    }

    // Validate amount is a positive number
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      throw new BadRequestError('amount must be a positive number', ErrorCode.ERR_ORDER_INVALID_AMOUNT);
    }

    console.log('Requesting withdrawal:', { account, amount });

    // Proxy to Pacifica API
    const response = await fetch(`${PACIFICA_API_URL}/api/v1/account/withdraw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        account,
        amount,
        signature,
        timestamp,
        expiry_window: 5000,
      }),
    });

    const responseText = await response.text();
    console.log('Pacifica withdraw response:', { status: response.status, body: responseText });

    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      throw new ServiceUnavailableError(`Failed to parse Pacifica response: ${responseText}`, ErrorCode.ERR_EXTERNAL_PACIFICA_API);
    }

    if (!response.ok || !result.success) {
      throw new ServiceUnavailableError(result.error || `Pacifica API error: ${response.status}`, ErrorCode.ERR_EXTERNAL_PACIFICA_API);
    }

    console.log('Withdrawal requested successfully', { account, amount });

    return Response.json({ success: true, data: result.data });
  } catch (error) {
    return errorResponse(error);
  }
}
