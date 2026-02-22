/**
 * Hooks for fetching trading positions and account info
 * Exchange-aware: routes through backend API with exchange param
 * Uses WebSocket (via useExchangeWsStore) for real-time updates
 */

import { useQuery } from '@tanstack/react-query';
import { useExchangeContext } from '@/contexts/ExchangeContext';
import { useAuthStore } from '@/lib/store';
import { useExchangeWsStore } from './useExchangeWebSocket';
import { usePrices } from './usePrices';

// ─── Helper: authenticated fetch with exchange param ─────────

async function fetchWithAuth(path: string, token: string, exchange: string) {
  const separator = path.includes('?') ? '&' : '?';
  const response = await fetch(`${path}${separator}exchange=${exchange}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(err.error || err.message || `HTTP ${response.status}`);
  }
  const json = await response.json();
  // withAuth wraps response in { success, data }, unwrap it
  return json.data ?? json;
}

// ─── usePositions ────────────────────────────────────────────

export function usePositions() {
  const { exchangeType, isExchangeConnected } = useExchangeContext();
  const token = useAuthStore((s) => s.token);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const wsConnected = useExchangeWsStore((state) => state.isConnected);
  const wsPositions = useExchangeWsStore((state) => state.positions);

  const query = useQuery({
    queryKey: ['positions', exchangeType, token],
    queryFn: async () => {
      if (!token) throw new Error('Not authenticated');
      return fetchWithAuth('/api/account/positions', token, exchangeType);
    },
    enabled: isAuthenticated && !!token && isExchangeConnected,
    refetchInterval: wsConnected ? 30000 : 15000,
    staleTime: wsConnected ? 20000 : 10000,
    retry: 1,
    retryDelay: 3000,
  });

  // If WebSocket is connected and has data, prefer it
  if (wsConnected && wsPositions.length > 0) {
    return {
      ...query,
      data: wsPositions.map(p => ({
        symbol: p.symbol,
        side: p.side,
        amount: p.amount,
        entry_price: p.entry_price,
        margin: p.margin,
        funding: p.funding,
        isolated: p.isolated,
        liq_price: p.liq_price,
        updated_at: p.updated_at,
        // HL-specific fields (undefined for Pacifica)
        leverage: p.leverage,
        leverage_type: p.leverage_type,
        unrealized_pnl: p.unrealized_pnl,
        return_on_equity: p.return_on_equity,
        position_value: p.position_value,
      })),
      isLoading: false,
    };
  }

  return query;
}

// ─── useAccountInfo ──────────────────────────────────────────

export function useAccountInfo() {
  const { exchangeType, isExchangeConnected } = useExchangeContext();
  const token = useAuthStore((s) => s.token);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: ['account', exchangeType, token],
    queryFn: async () => {
      if (!token) throw new Error('Not authenticated');
      return fetchWithAuth('/api/account/summary', token, exchangeType);
    },
    enabled: isAuthenticated && !!token && isExchangeConnected,
    refetchInterval: 15000,
    staleTime: 10000,
    retry: 1,
    retryDelay: 2000,
  });
}

// ─── useAccountSettings ──────────────────────────────────────

export function useAccountSettings() {
  const { exchangeType, isExchangeConnected } = useExchangeContext();
  const token = useAuthStore((s) => s.token);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: ['account-settings', exchangeType, token],
    queryFn: async () => {
      if (!token) throw new Error('Not authenticated');
      return fetchWithAuth('/api/account/settings', token, exchangeType);
    },
    enabled: isAuthenticated && !!token && isExchangeConnected,
    refetchInterval: 60000,
    staleTime: 45000,
  });
}

// ─── useOpenOrders ───────────────────────────────────────────

export function useOpenOrders(symbol?: string) {
  const { exchangeType, isExchangeConnected } = useExchangeContext();
  const token = useAuthStore((s) => s.token);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const wsConnected = useExchangeWsStore((state) => state.isConnected);
  const wsOrders = useExchangeWsStore((state) => state.orders);

  const query = useQuery({
    queryKey: ['orders', exchangeType, token, symbol],
    queryFn: async () => {
      if (!token) throw new Error('Not authenticated');
      return fetchWithAuth('/api/account/orders/open', token, exchangeType);
    },
    enabled: isAuthenticated && !!token && isExchangeConnected,
    refetchInterval: wsConnected ? 30000 : 15000,
    staleTime: wsConnected ? 20000 : 10000,
    retry: 1,
    retryDelay: 3000,
  });

  // If WebSocket is connected, merge with HTTP data
  if (wsConnected) {
    const filteredWsOrders = symbol
      ? wsOrders.filter(o => o.symbol === symbol)
      : wsOrders;

    const httpOrders = query.data && Array.isArray(query.data)
      ? (symbol ? query.data.filter((o: any) => o.symbol === symbol) : query.data)
      : [];

    const mergedOrders: any[] = [];
    const seenOrderIds = new Set<string>();

    // Helper to normalize an order from either WS (snake_case) or REST (camelCase) format
    const normalizeOrderFields = (o: any) => ({
      order_id: o.order_id ?? o.orderId,
      client_order_id: o.client_order_id ?? o.clientOrderId ?? null,
      symbol: o.symbol,
      side: o.side === 'BUY' ? 'bid' : o.side === 'SELL' ? 'ask' : o.side,
      price: o.price,
      initial_amount: o.initial_amount || o.amount || o.origSz || '0',
      amount: o.initial_amount || o.amount || o.origSz || '0',
      filled_amount: o.filled_amount || o.filled || '0',
      cancelled_amount: o.cancelled_amount || '0',
      order_type: o.order_type || (o.type ? o.type.toLowerCase() : 'limit'),
      stop_price: o.stop_price ?? o.metadata?.stopPrice ?? o.metadata?.triggerPx ?? null,
      stop_type: o.stop_type ?? null,
      reduce_only: o.reduce_only ?? o.reduceOnly ?? false,
      created_at: o.created_at ?? o.createdAt ?? Date.now(),
      updated_at: o.updated_at ?? o.updatedAt ?? o.created_at ?? o.createdAt ?? Date.now(),
    });

    filteredWsOrders.forEach(o => {
      const oid = String(o.order_id);
      const httpOrder = httpOrders.find((h: any) => String(h.order_id ?? h.orderId) === oid);
      seenOrderIds.add(oid);
      const normalized = normalizeOrderFields(o);
      // Enrich with HTTP data if available (e.g. stop_price)
      if (httpOrder) {
        const httpNorm = normalizeOrderFields(httpOrder);
        normalized.stop_price = normalized.stop_price || httpNorm.stop_price;
      }
      mergedOrders.push(normalized);
    });

    httpOrders.forEach((httpOrder: any) => {
      const oid = String(httpOrder.order_id ?? httpOrder.orderId);
      if (!seenOrderIds.has(oid)) {
        mergedOrders.push(normalizeOrderFields(httpOrder));
      }
    });

    return {
      ...query,
      data: mergedOrders,
      isLoading: false,
    };
  }

  return query;
}

// ─── useMarkets ──────────────────────────────────────────────
// Now exchange-aware via usePrices (which uses WS adapter per exchange)

export function useMarkets() {
  const { markets } = usePrices();
  return {
    data: markets,
    isLoading: markets.length === 0,
  };
}

export function useMarket(symbol: string) {
  const { data: markets } = useMarkets();
  return markets?.find((m: any) => m.symbol === symbol);
}

// ─── Normalization helper ────────────────────────────────────
// The backend adapter returns camelCase TradeHistoryItem, but the rendering
// expects the old Pacifica snake_case format. Also normalizes side values:
// adapter returns 'BUY'/'SELL', WS returns 'open_long'/'close_short' etc.,
// rendering needs a consistent format.

function normalizeTradeItem(t: any): any {
  // Already in snake_case format (from WS or direct Pacifica) — pass through
  if (t.history_id !== undefined && t.created_at !== undefined) {
    return t;
  }

  // Map adapter camelCase → snake_case for rendering compatibility
  // Side mapping: adapter 'BUY'/'SELL' → directional format
  let side = t.side;
  if (side === 'BUY') side = 'open_long';
  else if (side === 'SELL') side = 'open_short';
  // If metadata.dir or metadata.position has the original direction, prefer it
  const dir = t.metadata?.dir || t.metadata?.position;
  if (dir) side = dir.toLowerCase().replace(/ /g, '_');

  return {
    history_id: t.historyId || t.history_id || t.tid,
    order_id: t.orderId || t.order_id,
    client_order_id: t.clientOrderId || t.client_order_id || null,
    symbol: t.symbol,
    price: t.price,
    entry_price: t.metadata?.entryPrice || t.entry_price || t.price,
    amount: t.amount,
    side,
    fee: t.fee,
    pnl: t.pnl,
    created_at: t.executedAt || t.created_at || Date.now(),
    // Order history fields (may not exist for fills)
    order_type: t.order_type || t.orderType || 'limit',
    filled_amount: t.filled_amount || t.filledAmount || t.amount || '0',
    initial_price: t.initial_price || t.initialPrice || t.price || '0',
    average_filled_price: t.average_filled_price || t.averageFilledPrice || t.price || '0',
    order_status: t.order_status || t.orderStatus || t.status || 'filled',
    stop_price: t.stop_price || t.stopPrice || null,
  };
}

// ─── useTradeHistory ─────────────────────────────────────────

export function useTradeHistory(symbol?: string) {
  const { exchangeType, isExchangeConnected } = useExchangeContext();
  const token = useAuthStore((s) => s.token);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const wsConnected = useExchangeWsStore((state) => state.isConnected);
  const wsTrades = useExchangeWsStore((state) => state.trades);

  const query = useQuery({
    queryKey: ['trade-history', exchangeType, token, symbol],
    queryFn: async () => {
      if (!token) throw new Error('Not authenticated');
      const data = await fetchWithAuth('/api/account/trade-history', token, exchangeType);
      // Normalize adapter camelCase format to snake_case for rendering
      return Array.isArray(data) ? data.map(normalizeTradeItem) : data;
    },
    enabled: isAuthenticated && !!token && isExchangeConnected,
    refetchInterval: wsConnected ? 60000 : 30000,
    staleTime: wsConnected ? 45000 : 20000,
  });

  const httpTrades = Array.isArray(query.data) ? query.data : [];

  // If WebSocket is connected and has trades, merge
  if (wsConnected && wsTrades.length > 0) {
    const filteredTrades = symbol
      ? wsTrades.filter(t => t.symbol === symbol)
      : wsTrades;

    const tradeMap = new Map<number, any>();
    httpTrades.forEach((t: any) => tradeMap.set(t.history_id || t.tid, t));
    filteredTrades.forEach(t => tradeMap.set(t.history_id, {
      history_id: t.history_id,
      order_id: t.order_id,
      client_order_id: t.client_order_id,
      symbol: t.symbol,
      price: t.price,
      entry_price: t.entry_price,
      amount: t.amount,
      side: t.side,
      fee: t.fee,
      pnl: t.pnl,
      created_at: t.created_at,
    }));

    const mergedTrades = Array.from(tradeMap.values())
      .sort((a, b) => b.created_at - a.created_at);

    return {
      data: mergedTrades,
      isLoading: false,
      isFetching: query.isFetching,
      refetch: query.refetch,
    };
  }

  return {
    data: httpTrades,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    refetch: query.refetch,
  };
}

// ─── useOrderHistory ─────────────────────────────────────────

/** Normalize order history items from the adapter to snake_case for rendering.
 *  Handles two shapes:
 *  - OrderHistoryItem (HL historicalOrders): has `filled`, `type`, `status`, `statusTimestamp`
 *  - TradeHistoryItem (Pacifica fallback):   has `historyId`, `executedAt`, `fee`, `pnl`
 */
function normalizeOrderItem(o: any): any {
  // Already in snake_case format — pass through
  if (o.order_id !== undefined && o.created_at !== undefined) {
    return o;
  }

  // Detect if this is a TradeHistoryItem (Pacifica fallback) vs OrderHistoryItem (HL)
  const isTradeItem = o.historyId !== undefined || o.executedAt !== undefined;

  // Side mapping: prefer metadata.position (Pacifica original dir like "open_long")
  let side = o.side;
  const dir = o.metadata?.dir || o.metadata?.position;
  if (dir) {
    side = dir.toLowerCase().replace(/ /g, '_');
  } else if (side === 'BUY') {
    side = 'open_long';
  } else if (side === 'SELL') {
    side = 'open_short';
  }

  // Map HL type to display-friendly format (preserve Pacifica distinction)
  const typeMap: Record<string, string> = {
    LIMIT: 'limit',
    MARKET: 'market',
    STOP_MARKET: 'stop_market',
    STOP_LIMIT: 'stop_limit',
    STOP_LOSS_MARKET: 'stop_loss_market',
    STOP_LOSS_LIMIT: 'stop_loss_limit',
    TAKE_PROFIT_MARKET: 'take_profit_market',
    TAKE_PROFIT_LIMIT: 'take_profit_limit',
  };

  if (isTradeItem) {
    // TradeHistoryItem (Pacifica fills): fill-level data, no order type info
    // cause values are "normal"/"market_liquidation" — NOT order types
    return {
      order_id: o.orderId || o.order_id || o.historyId,
      client_order_id: o.metadata?.clientOrderId || o.client_order_id || null,
      symbol: o.symbol,
      side,
      price: o.price,
      amount: o.amount,
      filled_amount: o.amount,                    // fill = full amount
      initial_price: o.price,
      average_filled_price: o.price,              // fill price = avg price
      order_type: 'market',                       // fills don't carry order type
      order_status: 'filled',                     // fills are always completed
      stop_price: null,
      reduce_only: false,
      created_at: o.executedAt || o.created_at || Date.now(),
      updated_at: o.executedAt || o.created_at || Date.now(),
      fee: o.fee,
      pnl: o.pnl,
      metadata: o.metadata || {},
    };
  }

  // HL OrderHistoryItem: proper order-level data
  const limitPx = o.metadata?.limitPx || o.price || '0';
  const filledAmt = o.filled || o.filled_amount || '0';
  const isFilled = (o.status || o.order_status || '').toLowerCase() === 'filled';
  const avgPrice = o.average_filled_price || o.averageFilledPrice
    || (isFilled ? limitPx : '0');

  return {
    order_id: o.orderId || o.order_id,
    client_order_id: o.clientOrderId || o.client_order_id || null,
    symbol: o.symbol,
    side,
    price: o.price,
    amount: o.amount,
    filled_amount: filledAmt,
    initial_price: limitPx,
    average_filled_price: avgPrice,
    order_type: typeMap[o.type] || o.order_type || o.type?.toLowerCase() || 'limit',
    order_status: o.status || o.order_status || 'filled',
    stop_price: o.metadata?.triggerPx || o.stop_price || null,
    reduce_only: o.reduceOnly ?? o.reduce_only ?? false,
    created_at: o.createdAt || o.created_at || Date.now(),
    updated_at: o.statusTimestamp || o.updated_at || o.createdAt || o.created_at || Date.now(),
    metadata: o.metadata || {},
  };
}

export function useOrderHistory(symbol?: string) {
  const { exchangeType, isExchangeConnected } = useExchangeContext();
  const token = useAuthStore((s) => s.token);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: ['order-history', exchangeType, token, symbol],
    queryFn: async () => {
      if (!token) throw new Error('Not authenticated');
      const data = await fetchWithAuth('/api/account/order-history', token, exchangeType);
      return Array.isArray(data) ? data.map(normalizeOrderItem) : data;
    },
    enabled: isAuthenticated && !!token && isExchangeConnected,
    refetchInterval: 60000,
    staleTime: 45000,
  });
}
