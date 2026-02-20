/**
 * Account Leverage endpoint
 * POST /api/account/leverage - Update leverage for a trading pair
 */
import { errorResponse, BadRequestError, ServiceUnavailableError } from '@/lib/server/errors';
import { ErrorCode } from '@/lib/server/error-codes';
import { getOrderRouter } from '@/lib/server/exchanges/order-router';
import type { ExchangeType } from '@tfc/shared';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { exchange, account, symbol, leverage, signature, timestamp } = body;

    const exchangeType: ExchangeType = exchange || 'pacifica';
    const router = getOrderRouter(exchangeType);

    if (!router.signsServerSide) {
      if (!account || !symbol || !leverage || !signature || !timestamp) {
        throw new BadRequestError('account, symbol, leverage, signature, and timestamp are required', ErrorCode.ERR_VALIDATION_MISSING_FIELD);
      }
    } else {
      if (!account || !symbol || !leverage) {
        throw new BadRequestError('account, symbol, and leverage are required', ErrorCode.ERR_VALIDATION_MISSING_FIELD);
      }
    }

    console.log('Setting leverage:', { exchange: exchangeType, account, symbol, leverage });

    // Route to the correct exchange
    const result = await router.setLeverage({
      account, symbol,
      leverage: parseInt(leverage),
      signature, timestamp,
    });

    if (!result.success) {
      throw new ServiceUnavailableError(result.error || 'Exchange API error', ErrorCode.ERR_EXTERNAL_PACIFICA_API);
    }

    console.log('Leverage set successfully', { exchange: exchangeType, account, symbol, leverage });

    return Response.json({ success: true, data: result.data });
  } catch (error) {
    return errorResponse(error);
  }
}
