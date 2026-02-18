/**
 * Position TP/SL endpoint
 * POST /api/positions/tpsl - Set take profit and stop loss for existing position
 */
import { errorResponse, BadRequestError, ServiceUnavailableError } from '@/lib/server/errors';
import { ErrorCode } from '@/lib/server/error-codes';
import { recordOrderAction } from '@/lib/server/order-actions';
import { getOrderRouter } from '@/lib/server/exchanges/order-router';
import type { ExchangeType } from '@tfc/shared';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      exchange,
      account,
      symbol,
      side,
      size,
      take_profit,
      stop_loss,
      signature,
      timestamp,
      builder_code,
      fight_id,
    } = body;

    const exchangeType: ExchangeType = exchange || 'pacifica';
    const router = getOrderRouter(exchangeType);

    if (!router.signsServerSide) {
      if (!account || !symbol || !side || !signature || !timestamp) {
        throw new BadRequestError('account, symbol, side, signature, and timestamp are required', ErrorCode.ERR_VALIDATION_MISSING_FIELD);
      }
    } else {
      if (!account || !symbol || !side) {
        throw new BadRequestError('account, symbol, and side are required', ErrorCode.ERR_VALIDATION_MISSING_FIELD);
      }
    }

    // At least one of take_profit or stop_loss must be provided (can be null to remove)
    if (take_profit === undefined && stop_loss === undefined) {
      throw new BadRequestError('At least one of take_profit or stop_loss is required', ErrorCode.ERR_VALIDATION_MISSING_FIELD);
    }

    // Route to the correct exchange
    const result = await router.setTpSl({
      account, symbol, side,
      take_profit, stop_loss,
      size, builder_code,
      signature, timestamp,
    });

    if (!result.success) {
      throw new ServiceUnavailableError(result.error || 'Exchange API error', ErrorCode.ERR_EXTERNAL_PACIFICA_API);
    }

    console.log('TP/SL set successfully', {
      exchange: exchangeType,
      account, symbol, side,
      take_profit: take_profit?.stop_price,
      stop_loss: stop_loss?.stop_price,
    });

    // Record TP/SL action (non-blocking)
    recordOrderAction({
      walletAddress: account,
      actionType: 'SET_TPSL',
      symbol,
      side,
      takeProfit: take_profit?.stop_price,
      stopLoss: stop_loss?.stop_price,
      fightId: fight_id,
      success: true,
    }).catch(err => console.error('Failed to record TP/SL action:', err));

    return Response.json({ success: true, data: result.data });
  } catch (error) {
    return errorResponse(error);
  }
}
