/**
 * Pacifica API client
 *
 * This client communicates directly with Pacifica Exchange API.
 * All operations require wallet signatures for authentication.
 */

const PACIFICA_API_URL = process.env.NEXT_PUBLIC_PACIFICA_API_URL || 'https://api.pacifica.fi';

interface PacificaApiResponse<T = any> {
  success: boolean;
  data: T;
  error?: string;
}

/**
 * Create a market order on Pacifica
 */
export async function createMarketOrder(
  account: string,
  params: {
    symbol: string;
    side: 'bid' | 'ask';
    amount: string;
    slippage_percent: string;
    reduce_only: boolean;
    builder_code?: string;
    take_profit?: { stop_price: string };
    stop_loss?: { stop_price: string };
  },
  signature: string,
  timestamp: number
): Promise<PacificaApiResponse> {
  const response = await fetch(`${PACIFICA_API_URL}/api/v1/orders/create_market`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      account,
      ...params,
      signature,
      timestamp,
      expiry_window: 5000,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Create a limit order on Pacifica
 */
export async function createLimitOrder(
  account: string,
  params: {
    symbol: string;
    side: 'bid' | 'ask';
    price: string;
    amount: string;
    tif: 'GTC' | 'IOC' | 'ALO' | 'TOB';
    reduce_only: boolean;
    post_only: boolean;
    builder_code?: string;
  },
  signature: string,
  timestamp: number
): Promise<PacificaApiResponse> {
  const response = await fetch(`${PACIFICA_API_URL}/api/v1/orders/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      account,
      ...params,
      signature,
      timestamp,
      expiry_window: 5000,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Edit an existing limit order (modify price and/or size)
 * Note: Editing cancels the original order and creates a new one
 */
export async function editOrder(
  account: string,
  params: {
    symbol: string;
    price: string;
    amount: string;
    order_id?: number;
    client_order_id?: string;
  },
  signature: string,
  timestamp: number
): Promise<PacificaApiResponse> {
  const response = await fetch(`${PACIFICA_API_URL}/api/v1/orders/edit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      account,
      ...params,
      signature,
      timestamp,
      expiry_window: 5000,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Cancel a specific order
 */
export async function cancelOrder(
  account: string,
  params: {
    symbol: string;
    order_id?: number;
    client_order_id?: string;
  },
  signature: string,
  timestamp: number
): Promise<PacificaApiResponse> {
  const response = await fetch(`${PACIFICA_API_URL}/api/v1/orders/cancel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      account,
      ...params,
      signature,
      timestamp,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Cancel all orders
 */
export async function cancelAllOrders(
  account: string,
  params: {
    all_symbols: boolean;
    exclude_reduce_only: boolean;
    symbol?: string;
  },
  signature: string,
  timestamp: number
): Promise<PacificaApiResponse> {
  const response = await fetch(`${PACIFICA_API_URL}/api/v1/orders/cancel_all`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      account,
      ...params,
      signature,
      timestamp,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Set leverage for a symbol
 */
export async function setLeverage(
  account: string,
  params: {
    symbol: string;
    leverage: string;
  },
  signature: string,
  timestamp: number
): Promise<PacificaApiResponse> {
  const response = await fetch(`${PACIFICA_API_URL}/api/v1/account/update_leverage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      account,
      ...params,
      signature,
      timestamp,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Set TP/SL for a position
 */
export async function setPositionTpSl(
  account: string,
  params: {
    symbol: string;
    side: 'bid' | 'ask';
    take_profit?: { stop_price: string } | null;
    stop_loss?: { stop_price: string } | null;
  },
  signature: string,
  timestamp: number
): Promise<PacificaApiResponse> {
  const response = await fetch(`${PACIFICA_API_URL}/api/v1/positions/tpsl`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      account,
      ...params,
      signature,
      timestamp,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Get account positions
 */
export async function getPositions(account: string): Promise<PacificaApiResponse> {
  const response = await fetch(`${PACIFICA_API_URL}/api/v1/positions?account=${account}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  // Pacifica API already returns {success, data, error, code}
  return response.json();
}

/**
 * Get account info (balance, equity, etc.)
 */
export async function getAccountInfo(account: string): Promise<PacificaApiResponse> {
  const response = await fetch(`${PACIFICA_API_URL}/api/v1/account?account=${account}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  // Pacifica API already returns {success, data, error, code}
  return response.json();
}

/**
 * Get account settings (leverage per symbol)
 */
export async function getAccountSettings(account: string): Promise<PacificaApiResponse> {
  const response = await fetch(`${PACIFICA_API_URL}/api/v1/account/settings?account=${account}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  // Pacifica API already returns {success, data, error, code}
  return response.json();
}

/**
 * Get open orders
 */
export async function getOpenOrders(account: string, symbol?: string): Promise<PacificaApiResponse> {
  const url = symbol
    ? `${PACIFICA_API_URL}/api/v1/orders?account=${account}&symbol=${symbol}`
    : `${PACIFICA_API_URL}/api/v1/orders?account=${account}`;

  const response = await fetch(url);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  // Pacifica API already returns {success, data, error, code}
  return response.json();
}

/**
 * Get markets info
 * Uses /api/v1/info endpoint which returns market info including symbols, leverage, tick/lot sizes
 */
export async function getMarkets(): Promise<PacificaApiResponse> {
  const response = await fetch(`${PACIFICA_API_URL}/api/v1/info`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  // Pacifica API returns {success, data: [...markets]}
  // Each market has: symbol, max_leverage, tick_size, lot_size, etc.
  return response.json();
}

/**
 * Create a stop order (for partial TP/SL)
 * Unlike set_position_tpsl, this endpoint allows specifying a custom amount
 * and creates a separate stop order without overwriting existing ones
 */
export async function createStopOrder(
  account: string,
  params: {
    symbol: string;
    side: 'bid' | 'ask'; // bid = buy, ask = sell
    reduce_only: boolean;
    stop_order: {
      stop_price: string;
      limit_price?: string;
      amount: string;
    };
  },
  signature: string,
  timestamp: number
): Promise<PacificaApiResponse> {
  const response = await fetch(`${PACIFICA_API_URL}/api/v1/orders/stop/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      account,
      ...params,
      signature,
      timestamp,
      expiry_window: 5000,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Get mark prices for all symbols
 */
export async function getPrices(): Promise<PacificaApiResponse> {
  const response = await fetch(`${PACIFICA_API_URL}/api/v1/markets/prices`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  // Pacifica API already returns {success, data, error, code}
  return response.json();
}

/**
 * Get trade history (filled orders)
 * Endpoint: GET /api/v1/trades/history
 */
export async function getTradeHistory(
  account: string,
  params?: {
    symbol?: string;
    start_time?: number;
    end_time?: number;
    limit?: number;
    cursor?: string;
  }
): Promise<PacificaApiResponse> {
  const queryParams = new URLSearchParams({ account });
  if (params?.symbol) queryParams.append('symbol', params.symbol);
  if (params?.start_time) queryParams.append('start_time', params.start_time.toString());
  if (params?.end_time) queryParams.append('end_time', params.end_time.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.cursor) queryParams.append('cursor', params.cursor);

  const response = await fetch(`${PACIFICA_API_URL}/api/v1/trades/history?${queryParams}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Get order history (all orders including cancelled and filled)
 * Endpoint: GET /api/v1/orders/history
 */
export async function getOrderHistory(
  account: string,
  params?: {
    symbol?: string;
    start_time?: number;
    end_time?: number;
    limit?: number;
    cursor?: string;
  }
): Promise<PacificaApiResponse> {
  const queryParams = new URLSearchParams({ account });
  if (params?.symbol) queryParams.append('symbol', params.symbol);
  if (params?.start_time) queryParams.append('start_time', params.start_time.toString());
  if (params?.end_time) queryParams.append('end_time', params.end_time.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.cursor) queryParams.append('cursor', params.cursor);

  const response = await fetch(`${PACIFICA_API_URL}/api/v1/orders/history?${queryParams}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}
