/**
 * Edit Order endpoint
 * POST /api/orders/edit - Edit limit order price/amount (proxies to Pacifica)
 */
import { errorResponse, BadRequestError, StakeLimitError, ServiceUnavailableError } from '@/lib/server/errors';
import { ErrorCode } from '@/lib/server/error-codes';
import { recordOrderAction } from '@/lib/server/order-actions';
import { validateStakeLimit, assertSymbolNotBlocked } from '@/lib/server/orders';
import { getOpenOrders } from '@/lib/server/pacifica';
import { emitStakeInfoForUser } from '@/lib/server/trade-recording';

const PACIFICA_API_URL = process.env.PACIFICA_API_URL || 'https://api.pacifica.fi';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      account,
      symbol,
      price,
      amount,
      order_id,
      client_order_id,
      signature,
      timestamp,
    } = body;

    if (!account || !symbol || !price || !amount || !signature || !timestamp) {
      throw new BadRequestError('account, symbol, price, amount, signature, and timestamp are required', ErrorCode.ERR_VALIDATION_MISSING_FIELD);
    }

    if (!order_id && !client_order_id) {
      throw new BadRequestError('Either order_id or client_order_id is required', ErrorCode.ERR_VALIDATION_MISSING_FIELD);
    }

    // Look up the existing order from Pacifica so we can compute the notional delta.
    // If the symbol is blocked or the new size exceeds available capital, reject before
    // touching Pacifica — without this, edit silently bypassed all fight enforcement.
    let oldNotional = 0;
    let oldReduceOnly = false;
    let oldSide: 'bid' | 'ask' | undefined;
    let fightIdFromBody: string | undefined = body.fight_id;
    try {
      const openOrders = await getOpenOrders(account);
      const target = openOrders.find(
        o => o.order_id?.toString() === String(order_id) ||
             (client_order_id && (o as any).client_order_id?.toString() === String(client_order_id))
      );
      if (target) {
        const remaining = Math.max(
          0,
          parseFloat(target.initial_amount) -
            parseFloat(target.filled_amount) -
            parseFloat(target.cancelled_amount || '0')
        );
        const tgtPrice = parseFloat(target.price) || parseFloat((target as any).stop_price || '0');
        oldNotional = remaining * tgtPrice;
        oldReduceOnly = !!target.reduce_only;
        oldSide = target.side === 'bid' || target.side === 'ask' ? target.side : undefined;
      }
    } catch (err) {
      console.error('[orders/edit] Failed to read old order from Pacifica:', err);
      // Fail closed: without the old order we cannot compute a safe delta.
      throw new ServiceUnavailableError(
        'Could not verify existing order before edit; please cancel and re-create',
        ErrorCode.ERR_EXTERNAL_PACIFICA_API
      );
    }

    const newNotional = parseFloat(amount) * parseFloat(price);
    const deltaNotional = Math.max(0, newNotional - oldNotional);

    if (!oldReduceOnly) {
      // Symbol-blocked check (skip for reduce-only edits, which only close positions).
      try {
        await assertSymbolNotBlocked(account, symbol, fightIdFromBody, false);
      } catch (error: any) {
        if (error.code === 'SYMBOL_BLOCKED') {
          throw new BadRequestError(error.message, ErrorCode.ERR_ORDER_SYMBOL_BLOCKED);
        }
        throw error;
      }

      // Stake-limit check only on the INCREASE in notional. Edits that shrink the order
      // or leave size unchanged but reprice cannot consume additional capital.
      if (deltaNotional > 0) {
        try {
          await validateStakeLimit(
            account,
            symbol,
            (deltaNotional / parseFloat(price)).toString(),
            price,
            'LIMIT',
            false,
            fightIdFromBody,
            oldSide
          );
        } catch (error: any) {
          if (error.code === 'STAKE_LIMIT_EXCEEDED') {
            throw new StakeLimitError(error.message, error.details);
          }
          throw error;
        }
      }
    }

    // Build request body for Pacifica
    // NOTE: expiry_window must match what was signed (5000ms in signing.ts)
    const requestBody: Record<string, any> = {
      account,
      symbol,
      price,
      amount,
      signature,
      timestamp,
      expiry_window: 5000,
    };

    if (order_id) requestBody.order_id = order_id;
    if (client_order_id) requestBody.client_order_id = client_order_id;

    console.log('Editing order on Pacifica:', { endpoint: `${PACIFICA_API_URL}/api/v1/orders/edit`, requestBody });

    // Proxy to Pacifica API
    const response = await fetch(`${PACIFICA_API_URL}/api/v1/orders/edit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    console.log('Pacifica edit response:', { status: response.status, body: responseText });

    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      throw new ServiceUnavailableError(`Failed to parse Pacifica response: ${responseText}`, ErrorCode.ERR_EXTERNAL_PACIFICA_API);
    }

    if (!response.ok || !result.success) {
      const errorMessage = result.error || `Pacifica API error: ${response.status}`;
      console.error('Pacifica edit error:', errorMessage);
      throw new ServiceUnavailableError(errorMessage, ErrorCode.ERR_EXTERNAL_PACIFICA_API);
    }

    console.log('Order edited successfully', {
      account,
      symbol,
      orderId: order_id,
      newPrice: price,
      newAmount: amount,
      newOrderId: result.data?.order_id,
    });

    // Record order action (non-blocking)
    recordOrderAction({
      walletAddress: account,
      actionType: 'EDIT_ORDER',
      symbol,
      orderType: 'LIMIT',
      amount,
      price,
      pacificaOrderId: result.data?.order_id,
      success: true,
    }).catch(err => console.error('Failed to record edit order action:', err));

    // Push a fresh STAKE_INFO so the UI updates available capital immediately
    emitStakeInfoForUser(account, fightIdFromBody).catch(err =>
      console.error('Failed to emit stake info after edit:', err)
    );

    return Response.json({ success: true, data: result.data });
  } catch (error) {
    return errorResponse(error);
  }
}
