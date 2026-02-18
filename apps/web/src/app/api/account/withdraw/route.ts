/**
 * Account Withdraw endpoint
 * POST /api/account/withdraw - Request withdrawal of funds
 */
import { errorResponse, BadRequestError, ServiceUnavailableError } from '@/lib/server/errors';
import { ErrorCode } from '@/lib/server/error-codes';
import { getOrderRouter } from '@/lib/server/exchanges/order-router';
import type { ExchangeType } from '@tfc/shared';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { exchange, account, amount, signature, timestamp } = body;

    const exchangeType: ExchangeType = exchange || 'pacifica';
    const router = getOrderRouter(exchangeType);

    if (!router.signsServerSide) {
      if (!account || !amount || !signature || !timestamp) {
        throw new BadRequestError('account, amount, signature, and timestamp are required', ErrorCode.ERR_VALIDATION_MISSING_FIELD);
      }
    } else {
      if (!account || !amount) {
        throw new BadRequestError('account and amount are required', ErrorCode.ERR_VALIDATION_MISSING_FIELD);
      }
    }

    // Validate amount is a positive number
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      throw new BadRequestError('amount must be a positive number', ErrorCode.ERR_ORDER_INVALID_AMOUNT);
    }

    console.log('Requesting withdrawal:', { exchange: exchangeType, account, amount });

    // Route to the correct exchange
    const result = await router.withdraw({
      account, amount, signature, timestamp,
    });

    if (!result.success) {
      throw new ServiceUnavailableError(result.error || 'Exchange API error', ErrorCode.ERR_EXTERNAL_PACIFICA_API);
    }

    console.log('Withdrawal requested successfully', { exchange: exchangeType, account, amount });

    return Response.json({ success: true, data: result.data });
  } catch (error) {
    return errorResponse(error);
  }
}
