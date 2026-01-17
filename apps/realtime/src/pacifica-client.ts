/**
 * Pacifica API client for realtime server
 * Simple HTTP client to fetch positions and prices
 */

const API_URL = process.env.PACIFICA_API_URL || 'https://api.pacifica.fi';
const API_KEY = process.env.PACIFICA_API_KEY;

// Cache for prices (shared across all calls)
let pricesCache: { data: MarketPrice[]; timestamp: number } | null = null;
const PRICES_CACHE_TTL = 2000; // 2 seconds

// Cache for positions per account
const positionsCache = new Map<string, { data: Position[]; timestamp: number }>();
const POSITIONS_CACHE_TTL = 3000; // 3 seconds

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  if (API_KEY) {
    headers['PF-API-KEY'] = API_KEY;
  }

  return headers;
}

export interface Position {
  symbol: string;
  side: string;
  amount: string;
  entry_price: string;
  margin: string;
  funding: string;
  isolated: boolean;
  created_at: number;
  updated_at: number;
}

export interface MarketPrice {
  symbol: string;
  funding: string;
  mark: string;
  mid: string;
  next_funding: string;
  open_interest: string;
  oracle: string;
  timestamp: number;
  volume_24h: string;
  yesterday_price: string;
}

interface PacificaResponse<T> {
  success: boolean;
  data: T;
  error: string | null;
  code: number | null;
}

/**
 * Get all market prices (cached)
 */
export async function getPrices(): Promise<MarketPrice[]> {
  const now = Date.now();

  // Check cache
  if (pricesCache && now - pricesCache.timestamp < PRICES_CACHE_TTL) {
    return pricesCache.data;
  }

  try {
    const response = await fetch(`${API_URL}/api/v1/info/prices`, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (!response.ok) {
      console.error('Pacifica prices API error:', response.status);
      return pricesCache?.data || [];
    }

    const json = (await response.json()) as PacificaResponse<MarketPrice[]>;

    if (!json.success) {
      console.error('Pacifica prices API failed:', json.error);
      return pricesCache?.data || [];
    }

    // Update cache
    pricesCache = { data: json.data, timestamp: now };
    return json.data;
  } catch (error) {
    console.error('Failed to fetch Pacifica prices:', error);
    return pricesCache?.data || [];
  }
}

/**
 * Get positions for an account (cached)
 */
export async function getPositions(accountAddress: string): Promise<Position[]> {
  const now = Date.now();
  const cached = positionsCache.get(accountAddress);

  // Check cache
  if (cached && now - cached.timestamp < POSITIONS_CACHE_TTL) {
    return cached.data;
  }

  try {
    const response = await fetch(`${API_URL}/api/v1/positions?account=${accountAddress}`, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (!response.ok) {
      console.error('Pacifica positions API error:', response.status, accountAddress);
      return cached?.data || [];
    }

    const json = (await response.json()) as PacificaResponse<Position[]>;

    if (!json.success) {
      console.error('Pacifica positions API failed:', json.error);
      return cached?.data || [];
    }

    // Update cache
    positionsCache.set(accountAddress, { data: json.data, timestamp: now });
    return json.data;
  } catch (error) {
    console.error('Failed to fetch Pacifica positions:', error);
    return cached?.data || [];
  }
}

/**
 * Clear all caches (useful for testing)
 */
export function clearCache(): void {
  pricesCache = null;
  positionsCache.clear();
}

// ─────────────────────────────────────────────────────────────
// Trade History (for external trades detection)
// ─────────────────────────────────────────────────────────────

export interface TradeHistoryEntry {
  history_id: number;
  order_id: number;
  client_order_id: string | null;
  symbol: string;
  amount: string;
  price: string;
  entry_price: string;
  fee: string;
  pnl: string | null;
  event_type: string;
  side: string;
  created_at: number;
  cause: string;
}

/**
 * Get trade history for an account within a time window
 * Used to detect trades made outside TradeFightClub
 */
export async function getTradeHistory(params: {
  accountAddress: string;
  startTime?: number; // Unix timestamp in seconds
  endTime?: number; // Unix timestamp in seconds
  limit?: number;
}): Promise<TradeHistoryEntry[]> {
  const { accountAddress, startTime, endTime, limit = 100 } = params;

  try {
    let url = `${API_URL}/api/v1/trades/history?account=${accountAddress}&limit=${limit}`;

    if (startTime) {
      url += `&start_time=${startTime}`;
    }
    if (endTime) {
      url += `&end_time=${endTime}`;
    }

    console.log('[getTradeHistory] Fetching:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: getHeaders(),
    });

    console.log('[getTradeHistory] Response status:', response.status);

    if (!response.ok) {
      const text = await response.text();
      console.error('[getTradeHistory] API error:', response.status, text);
      return [];
    }

    const json = (await response.json()) as PacificaResponse<TradeHistoryEntry[]>;

    console.log('[getTradeHistory] Response success:', json.success, 'count:', json.data?.length || 0);

    if (!json.success) {
      console.error('[getTradeHistory] API failed:', json.error);
      return [];
    }

    return json.data;
  } catch (error) {
    console.error('[getTradeHistory] Exception:', error);
    return [];
  }
}
