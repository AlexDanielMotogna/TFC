/**
 * Position TP/SL endpoint
 * POST /api/positions/tpsl - Set take profit and stop loss for existing position
 */
import { errorResponse, BadRequestError, ServiceUnavailableError } from '@/lib/server/errors';
import { ErrorCode } from '@/lib/server/error-codes';
import { recordOrderAction } from '@/lib/server/order-actions';

const PACIFICA_API_URL = process.env.PACIFICA_API_URL || 'https://api.pacifica.fi';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
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

    if (!account || !symbol || !side || !signature || !timestamp) {
      throw new BadRequestError('account, symbol, side, signature, and timestamp are required', ErrorCode.ERR_VALIDATION_MISSING_FIELD);
    }

    // At least one of take_profit or stop_loss must be provided (can be null to remove)
    if (take_profit === undefined && stop_loss === undefined) {
      throw new BadRequestError('At least one of take_profit or stop_loss is required', ErrorCode.ERR_VALIDATION_MISSING_FIELD);
    }

    // Build request body for Pacifica
    // NOTE: size is NOT included for full position TP/SL (per Pacifica API)
    const requestBody: Record<string, any> = {
      account,
      symbol,
      side,
      signature,
      timestamp,
      expiry_window: 5000,
    };

    // Only include size if provided (for partial TP/SL)
    if (size) {
      requestBody.size = size;
    }

    // Handle take_profit: null = remove, object = set, undefined = don't include
    if (take_profit === null) {
      requestBody.take_profit = null;
    } else if (take_profit) {
      requestBody.take_profit = {
        stop_price: take_profit.stop_price,
      };
      if (take_profit.limit_price) {
        requestBody.take_profit.limit_price = take_profit.limit_price;
      }
    }

    // Handle stop_loss: null = remove, object = set, undefined = don't include
    if (stop_loss === null) {
      requestBody.stop_loss = null;
    } else if (stop_loss) {
      requestBody.stop_loss = {
        stop_price: stop_loss.stop_price,
      };
      if (stop_loss.limit_price) {
        requestBody.stop_loss.limit_price = stop_loss.limit_price;
      }
    }

    // Add builder code if provided
    if (builder_code) {
      requestBody.builder_code = builder_code;
    }

    console.log('Setting position TP/SL:', { account, symbol, side, size, take_profit, stop_loss });
    console.log('Full request body to Pacifica:', JSON.stringify(requestBody, null, 2));

    // Proxy to Pacifica API
    const response = await fetch(`${PACIFICA_API_URL}/api/v1/positions/tpsl`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    console.log('Pacifica TP/SL response:', { status: response.status, body: responseText });

    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      throw new ServiceUnavailableError(`Failed to parse Pacifica response: ${responseText}`, ErrorCode.ERR_EXTERNAL_PACIFICA_API);
    }

    if (!response.ok || !result.success) {
      throw new ServiceUnavailableError(result.error || `Pacifica API error: ${response.status}`, ErrorCode.ERR_EXTERNAL_PACIFICA_API);
    }

    console.log('TP/SL set successfully', {
      account,
      symbol,
      side,
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
