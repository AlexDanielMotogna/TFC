/**
 * Batch Orders endpoint
 * POST /api/orders/batch - Execute multiple order actions atomically
 *
 * Each action is individually signed. Max 10 actions per batch.
 * Actions execute in order; if one fails, subsequent actions are still attempted.
 */
import { errorResponse, BadRequestError, ServiceUnavailableError } from '@/lib/server/errors';
import { ErrorCode } from '@/lib/server/error-codes';
import { getOrderRouter } from '@/lib/server/exchanges/order-router';
import type { ExchangeType } from '@tfc/shared';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { exchange, actions } = body;

    const exchangeType: ExchangeType = exchange || 'pacifica';
    const router = getOrderRouter(exchangeType);

    if (!actions || !Array.isArray(actions) || actions.length === 0) {
      throw new BadRequestError('actions array is required and must not be empty', ErrorCode.ERR_VALIDATION_MISSING_FIELD);
    }

    if (actions.length > 10) {
      throw new BadRequestError('Batch cannot exceed 10 actions', ErrorCode.ERR_VALIDATION_INVALID_PARAMETER);
    }

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      if (!action.type || !action.data) {
        throw new BadRequestError(`Action ${i} missing type or data`, ErrorCode.ERR_VALIDATION_MISSING_FIELD);
      }
      if (action.type !== 'Create' && action.type !== 'Cancel') {
        throw new BadRequestError(`Action ${i} has invalid type: ${action.type}`, ErrorCode.ERR_VALIDATION_INVALID_PARAMETER);
      }
      // For client-signed exchanges, each action needs signature
      if (!router.signsServerSide) {
        if (!action.data.account || !action.data.signature || !action.data.timestamp) {
          throw new BadRequestError(`Action ${i} missing account, signature, or timestamp`, ErrorCode.ERR_VALIDATION_MISSING_FIELD);
        }
      } else {
        if (!action.data.account) {
          throw new BadRequestError(`Action ${i} missing account`, ErrorCode.ERR_VALIDATION_MISSING_FIELD);
        }
      }
    }

    console.log('Sending batch order:', {
      exchange: exchangeType,
      actionCount: actions.length,
      actionTypes: actions.map((a: { type: string }) => a.type),
    });

    // Route to the correct exchange
    const result = await router.batchOrders({ account: actions[0].data.account, actions });

    if (!result.success) {
      throw new ServiceUnavailableError(result.error || 'Exchange API error', ErrorCode.ERR_EXTERNAL_PACIFICA_API);
    }

    console.log('Batch executed successfully', {
      exchange: exchangeType,
      results: result.data?.results,
    });

    return Response.json({ success: true, data: result.data });
  } catch (error) {
    return errorResponse(error);
  }
}
