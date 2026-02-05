/**
 * Builder Code endpoints
 * GET /api/builder-code - Check if user has approved the builder code
 * POST /api/builder-code - Approve the builder code for trading
 */
import { errorResponse, BadRequestError, ServiceUnavailableError } from '@/lib/server/errors';
import { ErrorCode } from '@/lib/server/error-codes';

const PACIFICA_API_URL = process.env.PACIFICA_API_URL || 'https://api.pacifica.fi';
const BUILDER_CODE = process.env.PACIFICA_BUILDER_CODE || 'TradeClub';

/**
 * Check if user has approved the TradeFightClub builder code
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const account = searchParams.get('account');

    if (!account) {
      throw new BadRequestError('account is required', ErrorCode.ERR_VALIDATION_MISSING_FIELD);
    }

    // Query Pacifica for user's approved builder codes
    const response = await fetch(
      `${PACIFICA_API_URL}/api/v1/account/builder_codes/approvals?account=${account}`
    );

    const responseText = await response.text();
    console.log('Pacifica approvals response:', { status: response.status, body: responseText });

    if (!response.ok) {
      // 404 means no approvals yet
      if (response.status === 404) {
        return Response.json({
          success: true,
          data: {
            approved: false,
            builderCode: BUILDER_CODE,
          },
        });
      }
      let error;
      try {
        error = JSON.parse(responseText);
      } catch {
        error = { error: responseText };
      }
      throw new ServiceUnavailableError(error.error || `Pacifica API error: ${response.status}`, ErrorCode.ERR_EXTERNAL_PACIFICA_API);
    }

    let approvals;
    try {
      approvals = JSON.parse(responseText);
    } catch {
      throw new ServiceUnavailableError(`Failed to parse Pacifica response: ${responseText}`, ErrorCode.ERR_EXTERNAL_PACIFICA_API);
    }

    // Pacifica may return {success, data} or just an array
    const approvalList = approvals.data || approvals;

    // Check if our builder code is in the list
    const ourApproval = Array.isArray(approvalList)
      ? approvalList.find((a: any) => a.builder_code === BUILDER_CODE)
      : null;

    console.log('Builder code check:', {
      builderCode: BUILDER_CODE,
      found: !!ourApproval,
      approvalList: approvalList
    });

    return Response.json({
      success: true,
      data: {
        approved: !!ourApproval,
        builderCode: BUILDER_CODE,
        approval: ourApproval || null,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * Approve the TradeFightClub builder code
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { account, signature, timestamp, max_fee_rate } = body;

    if (!account || !signature || !timestamp) {
      throw new BadRequestError('account, signature, and timestamp are required', ErrorCode.ERR_VALIDATION_MISSING_FIELD);
    }

    // Proxy to Pacifica API
    const requestBody = {
      account,
      agent_wallet: null,
      signature,
      timestamp,
      expiry_window: 5000,
      builder_code: BUILDER_CODE,
      max_fee_rate: max_fee_rate || '0.0005', // Default 0.05% max fee rate
    };

    console.log('Approving builder code:', { account, builder_code: BUILDER_CODE });

    const response = await fetch(`${PACIFICA_API_URL}/api/v1/account/builder_codes/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    console.log('Pacifica builder approval response:', { status: response.status, body: responseText });

    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      throw new ServiceUnavailableError(`Failed to parse Pacifica response: ${responseText}`, ErrorCode.ERR_EXTERNAL_PACIFICA_API);
    }

    if (!response.ok) {
      // Provide more helpful error messages
      if (response.status === 404 || (result.error && result.error.includes('not found'))) {
        throw new ServiceUnavailableError(`Builder code "${BUILDER_CODE}" is not registered with Pacifica. Please contact the TradeFightClub team.`, ErrorCode.ERR_EXTERNAL_PACIFICA_API);
      }
      throw new ServiceUnavailableError(result.error || `Pacifica API error: ${response.status}`, ErrorCode.ERR_EXTERNAL_PACIFICA_API);
    }

    console.log('Builder code approved successfully', {
      account,
      builder_code: BUILDER_CODE,
    });

    return Response.json({
      success: true,
      data: {
        approved: true,
        builderCode: BUILDER_CODE,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
