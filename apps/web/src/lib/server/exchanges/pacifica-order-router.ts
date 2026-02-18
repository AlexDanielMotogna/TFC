/**
 * Pacifica Order Router
 *
 * Proxies client-signed requests to the Pacifica API.
 * Backend does NOT sign — it simply forwards the user's wallet signature.
 */

import type {
  ExchangeOrderRouter,
  OrderResult,
  CreateOrderParams,
  CancelOrderParams,
  CancelAllOrdersParams,
  StopOrderParams,
  CancelStopOrderParams,
  EditOrderParams,
  BatchOrderParams,
  SetTpSlParams,
  SetLeverageParams,
  SetMarginParams,
  WithdrawParams,
} from './order-router';

const PACIFICA_API_URL = process.env.PACIFICA_API_URL || 'https://api.pacifica.fi';
const EXPIRY_WINDOW = 5000;

/**
 * Send a request to the Pacifica API and return a normalized result.
 */
async function pacificaFetch(
  endpoint: string,
  body: Record<string, unknown>,
): Promise<OrderResult> {
  console.log(`[PacificaRouter] ${endpoint}`, body);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const responseText = await response.text();
  console.log(`[PacificaRouter] Response:`, { status: response.status, body: responseText });

  let result;
  try {
    result = JSON.parse(responseText);
  } catch {
    return { success: false, error: `Failed to parse Pacifica response: ${responseText}` };
  }

  if (!response.ok || !result.success) {
    const errorMessage = result.error || `Pacifica API error: ${response.status}`;
    return { success: false, error: errorMessage };
  }

  return { success: true, data: result.data };
}

export class PacificaOrderRouter implements ExchangeOrderRouter {
  readonly exchangeType = 'pacifica' as const;
  readonly signsServerSide = false;

  async createOrder(params: CreateOrderParams): Promise<OrderResult> {
    const {
      account, symbol, side, type, amount, price,
      slippage_percent, reduce_only, tif,
      builder_code, take_profit, stop_loss,
      signature, timestamp,
    } = params;

    let endpoint: string;
    let requestBody: Record<string, unknown>;

    if (type === 'MARKET') {
      endpoint = `${PACIFICA_API_URL}/api/v1/orders/create_market`;
      requestBody = {
        account, symbol, side, amount,
        slippage_percent: slippage_percent || '0.5',
        reduce_only: reduce_only || false,
        signature, timestamp,
        expiry_window: EXPIRY_WINDOW,
      };
      if (builder_code) requestBody.builder_code = builder_code;
      if (take_profit) requestBody.take_profit = take_profit;
      if (stop_loss) requestBody.stop_loss = stop_loss;
    } else {
      endpoint = `${PACIFICA_API_URL}/api/v1/orders/create`;
      requestBody = {
        account, symbol, side, price, amount,
        tif: tif || 'GTC',
        reduce_only: reduce_only || false,
        signature, timestamp,
        expiry_window: EXPIRY_WINDOW,
      };
      if (builder_code) requestBody.builder_code = builder_code;
      if (take_profit) requestBody.take_profit = take_profit;
      if (stop_loss) requestBody.stop_loss = stop_loss;
    }

    return pacificaFetch(endpoint, requestBody);
  }

  async cancelOrder(params: CancelOrderParams): Promise<OrderResult> {
    const { account, order_id, symbol, signature, timestamp } = params;
    return pacificaFetch(`${PACIFICA_API_URL}/api/v1/orders/cancel`, {
      account, order_id, symbol,
      signature, timestamp,
      expiry_window: EXPIRY_WINDOW,
    });
  }

  async cancelAllOrders(params: CancelAllOrdersParams): Promise<OrderResult> {
    const { account, symbol, signature, timestamp } = params;
    const body: Record<string, unknown> = {
      account,
      all_symbols: !symbol,
      exclude_reduce_only: false,
      signature,
      timestamp: typeof timestamp === 'string' ? parseInt(timestamp as string, 10) : timestamp,
      expiry_window: EXPIRY_WINDOW,
    };
    if (symbol) body.symbol = symbol;
    return pacificaFetch(`${PACIFICA_API_URL}/api/v1/orders/cancel_all`, body);
  }

  async createStopOrder(params: StopOrderParams): Promise<OrderResult> {
    const { account, symbol, side, reduce_only, stop_order, signature, timestamp } = params;
    return pacificaFetch(`${PACIFICA_API_URL}/api/v1/orders/stop/create`, {
      account, symbol, side, reduce_only,
      stop_order,
      signature, timestamp,
      expiry_window: EXPIRY_WINDOW,
    });
  }

  async cancelStopOrder(params: CancelStopOrderParams): Promise<OrderResult> {
    const { account, symbol, order_id, signature, timestamp } = params;
    return pacificaFetch(`${PACIFICA_API_URL}/api/v1/orders/stop/cancel`, {
      account, symbol, order_id,
      signature, timestamp,
      expiry_window: EXPIRY_WINDOW,
    });
  }

  async editOrder(params: EditOrderParams): Promise<OrderResult> {
    const { account, symbol, price, amount, order_id, client_order_id, signature, timestamp } = params;
    const body: Record<string, unknown> = {
      account, symbol, price, amount,
      signature, timestamp,
      expiry_window: EXPIRY_WINDOW,
    };
    if (order_id) body.order_id = order_id;
    if (client_order_id) body.client_order_id = client_order_id;
    return pacificaFetch(`${PACIFICA_API_URL}/api/v1/orders/edit`, body);
  }

  async batchOrders(params: BatchOrderParams): Promise<OrderResult> {
    const { actions } = params;
    return pacificaFetch(`${PACIFICA_API_URL}/api/v1/orders/batch`, { actions });
  }

  async setTpSl(params: SetTpSlParams): Promise<OrderResult> {
    const { account, symbol, side, take_profit, stop_loss, size, builder_code, signature, timestamp } = params;
    const body: Record<string, unknown> = {
      account, symbol, side,
      signature, timestamp,
      expiry_window: EXPIRY_WINDOW,
    };
    // Include TP/SL — null means "remove", undefined means "don't change"
    if (take_profit !== undefined) body.take_profit = take_profit;
    if (stop_loss !== undefined) body.stop_loss = stop_loss;
    if (size) body.size = size;
    if (builder_code) body.builder_code = builder_code;
    return pacificaFetch(`${PACIFICA_API_URL}/api/v1/positions/tpsl`, body);
  }

  async setLeverage(params: SetLeverageParams): Promise<OrderResult> {
    const { account, symbol, leverage, signature, timestamp } = params;
    return pacificaFetch(`${PACIFICA_API_URL}/api/v1/account/leverage`, {
      account, symbol,
      leverage: parseInt(String(leverage), 10),
      signature, timestamp,
      expiry_window: EXPIRY_WINDOW,
    });
  }

  async setMargin(params: SetMarginParams): Promise<OrderResult> {
    const { account, symbol, is_isolated, signature, timestamp } = params;
    return pacificaFetch(`${PACIFICA_API_URL}/api/v1/account/margin`, {
      account, symbol, is_isolated,
      signature, timestamp,
      expiry_window: EXPIRY_WINDOW,
    });
  }

  async withdraw(params: WithdrawParams): Promise<OrderResult> {
    const { account, amount, signature, timestamp } = params;
    return pacificaFetch(`${PACIFICA_API_URL}/api/v1/account/withdraw`, {
      account, amount,
      signature, timestamp,
      expiry_window: EXPIRY_WINDOW,
    });
  }
}
