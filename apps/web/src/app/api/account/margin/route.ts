/**
 * Account Margin Mode endpoint
 * POST /api/account/margin - Switch between cross and isolated margin for a trading pair
 */
import { errorResponse, BadRequestError, ServiceUnavailableError } from '@/lib/server/errors';
import { ErrorCode } from '@/lib/server/error-codes';
import { getOrderRouter } from '@/lib/server/exchanges/order-router';
import type { ExchangeType } from '@tfc/shared';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { exchange, account, symbol, is_isolated, signature, timestamp } = body;

    const exchangeType: ExchangeType = exchange || 'pacifica';
    const router = getOrderRouter(exchangeType);

    if (!router.signsServerSide) {
      if (!account || !symbol || is_isolated === undefined || !signature || !timestamp) {
        throw new BadRequestError('account, symbol, is_isolated, signature, and timestamp are required', ErrorCode.ERR_VALIDATION_MISSING_FIELD);
      }
    } else {
      if (!account || !symbol || is_isolated === undefined) {
        throw new BadRequestError('account, symbol, and is_isolated are required', ErrorCode.ERR_VALIDATION_MISSING_FIELD);
      }
    }

    console.log('Setting margin mode:', { exchange: exchangeType, account, symbol, is_isolated });

    // Route to the correct exchange
    const result = await router.setMargin({
      account, symbol, is_isolated,
      signature, timestamp,
    });

    if (!result.success) {
      throw new ServiceUnavailableError(result.error || 'Exchange API error', ErrorCode.ERR_EXTERNAL_PACIFICA_API);
    }

    console.log('Margin mode set successfully', { exchange: exchangeType, account, symbol, is_isolated });

    return Response.json({ success: true, data: result.data });
  } catch (error) {
    return errorResponse(error);
  }
}
