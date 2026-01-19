/**
 * Hooks for fetching trading positions and account info
 * Now with WebSocket support for real-time updates
 */

import { useQuery } from '@tanstack/react-query';
import { useWallet } from '@solana/wallet-adapter-react';
import * as PacificaAPI from '@/lib/pacifica/api-client';
import { usePacificaWsStore } from './usePacificaWebSocket';

/**
 * Hook to fetch user positions from Pacifica
 * Uses WebSocket for real-time updates with HTTP polling as fallback
 */
export function usePositions() {
  const { publicKey, connected } = useWallet();
  const wsConnected = usePacificaWsStore((state) => state.isConnected);
  const wsPositions = usePacificaWsStore((state) => state.positions);

  const query = useQuery({
    queryKey: ['positions', publicKey?.toBase58()],
    queryFn: async () => {
      if (!publicKey) {
        throw new Error('Wallet not connected');
      }

      const account = publicKey.toBase58();
      const response = await PacificaAPI.getPositions(account);

      console.log('usePositions: Raw Pacifica response:', response);

      // Pacifica returns { success, data: [...positions], error, code }
      // data is directly an array of positions, NOT data.positions
      const positions = Array.isArray(response.data) ? response.data : [];
      console.log('usePositions: Extracted positions:', positions);

      return positions;
    },
    enabled: connected && !!publicKey,
    // Use longer polling interval when WebSocket is connected
    refetchInterval: wsConnected ? 30000 : 10000,
    staleTime: wsConnected ? 25000 : 8000,
    retry: 1,
    retryDelay: 2000,
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
      })),
      isLoading: false,
    };
  }

  return query;
}

/**
 * Hook to fetch account info (balance, equity, margin)
 */
export function useAccountInfo() {
  const { publicKey, connected } = useWallet();

  return useQuery({
    queryKey: ['account', publicKey?.toBase58()],
    queryFn: async () => {
      if (!publicKey) {
        throw new Error('Wallet not connected');
      }

      const account = publicKey.toBase58();
      const response = await PacificaAPI.getAccountInfo(account);

      // Pacifica API returns {success, data, error, code}
      return response.data;
    },
    enabled: connected && !!publicKey,
    refetchInterval: 15000, // Poll every 15 seconds (reduced to avoid rate limits)
    staleTime: 10000,
    retry: 1,
    retryDelay: 2000,
  });
}

/**
 * Hook to fetch account settings (leverage per symbol)
 */
export function useAccountSettings() {
  const { publicKey, connected } = useWallet();

  return useQuery({
    queryKey: ['account-settings', publicKey?.toBase58()],
    queryFn: async () => {
      if (!publicKey) {
        throw new Error('Wallet not connected');
      }

      const account = publicKey.toBase58();
      const response = await PacificaAPI.getAccountSettings(account);

      return response.data;
    },
    enabled: connected && !!publicKey,
    refetchInterval: 30000, // Poll every 30 seconds
    staleTime: 20000,
  });
}

/**
 * Hook to fetch open orders
 * Uses WebSocket for real-time updates with HTTP polling as fallback
 */
export function useOpenOrders(symbol?: string) {
  const { publicKey, connected } = useWallet();
  const wsConnected = usePacificaWsStore((state) => state.isConnected);
  const wsOrders = usePacificaWsStore((state) => state.orders);

  const query = useQuery({
    queryKey: ['orders', publicKey?.toBase58(), symbol],
    queryFn: async () => {
      if (!publicKey) {
        throw new Error('Wallet not connected');
      }

      const account = publicKey.toBase58();
      const response = await PacificaAPI.getOpenOrders(account, symbol);

      console.log('useOpenOrders: Raw Pacifica response:', response);

      // Pacifica returns { success, data: [...orders] } - data is directly an array
      const orders = Array.isArray(response.data) ? response.data : [];
      console.log('useOpenOrders: Extracted orders:', orders);

      return orders;
    },
    enabled: connected && !!publicKey,
    // Use longer polling interval when WebSocket is connected
    refetchInterval: wsConnected ? 30000 : 10000,
    staleTime: wsConnected ? 25000 : 8000,
    retry: 1,
    retryDelay: 2000,
  });

  // If WebSocket is connected and has data, merge with HTTP data
  // WebSocket provides real-time updates but may be missing some fields (like stop_price)
  // HTTP provides complete data, so we merge to preserve fields WebSocket might not have
  if (wsConnected && wsOrders.length > 0) {
    // Filter by symbol if provided
    const filteredOrders = symbol
      ? wsOrders.filter(o => o.symbol === symbol)
      : wsOrders;

    // Create a map of HTTP orders by order_id for quick lookup
    const httpOrdersMap = new Map<number, any>();
    if (query.data && Array.isArray(query.data)) {
      query.data.forEach((order: any) => {
        if (order.order_id) {
          httpOrdersMap.set(order.order_id, order);
        }
      });
    }

    return {
      ...query,
      data: filteredOrders.map(o => {
        // Get corresponding HTTP order data if available
        const httpOrder = httpOrdersMap.get(o.order_id);

        return {
          order_id: o.order_id,
          client_order_id: o.client_order_id,
          symbol: o.symbol,
          side: o.side,
          price: o.price,
          initial_amount: o.initial_amount,
          amount: o.initial_amount, // Also provide as 'amount' for compatibility
          filled_amount: o.filled_amount,
          cancelled_amount: o.cancelled_amount,
          order_type: o.order_type,
          // Prefer WebSocket stop_price, fall back to HTTP if WebSocket has null
          stop_price: o.stop_price || httpOrder?.stop_price || null,
          reduce_only: o.reduce_only,
          created_at: o.created_at,
          updated_at: o.created_at,
        };
      }),
      isLoading: false,
    };
  }

  return query;
}

/**
 * Hook to fetch market info
 */
export function useMarkets() {
  return useQuery({
    queryKey: ['markets'],
    queryFn: async () => {
      const response = await PacificaAPI.getMarkets();
      return response.data?.markets || [];
    },
    staleTime: 60000, // Cache for 1 minute
    refetchInterval: 60000,
  });
}

/**
 * Hook to fetch a specific market by symbol
 */
export function useMarket(symbol: string) {
  const { data: markets } = useMarkets();

  return markets?.find((m: any) => m.symbol === symbol);
}

/**
 * Hook to fetch trade history (filled orders)
 * Uses WebSocket for real-time updates with HTTP polling as fallback
 * Endpoint: GET /api/v1/trades/history
 */
export function useTradeHistory(symbol?: string) {
  const { publicKey, connected } = useWallet();
  const wsConnected = usePacificaWsStore((state) => state.isConnected);
  const wsTrades = usePacificaWsStore((state) => state.trades);

  const query = useQuery({
    queryKey: ['trade-history', publicKey?.toBase58(), symbol],
    queryFn: async () => {
      if (!publicKey) {
        throw new Error('Wallet not connected');
      }

      const account = publicKey.toBase58();
      const response = await PacificaAPI.getTradeHistory(account, {
        symbol,
        limit: 50,
      });

      console.log('useTradeHistory: Raw Pacifica response:', response);

      // Pacifica returns { success, data: [...trades] }
      const trades = Array.isArray(response.data) ? response.data : [];
      return trades;
    },
    enabled: connected && !!publicKey,
    // Use longer polling interval when WebSocket is connected
    refetchInterval: wsConnected ? 30000 : 10000,
    staleTime: wsConnected ? 25000 : 5000,
  });

  // If WebSocket is connected and has trades, merge with HTTP data
  if (wsConnected && wsTrades.length > 0) {
    // Filter by symbol if provided
    const filteredTrades = symbol
      ? wsTrades.filter(t => t.symbol === symbol)
      : wsTrades;

    // Merge WS trades with HTTP trades, preferring newer data
    const httpTrades = query.data || [];
    const tradeMap = new Map<number, any>();

    // Add HTTP trades first
    httpTrades.forEach((t: any) => tradeMap.set(t.history_id, t));

    // Add/override with WS trades (more recent)
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

    // Sort by timestamp descending
    const mergedTrades = Array.from(tradeMap.values())
      .sort((a, b) => b.created_at - a.created_at)
      .slice(0, 50);

    return {
      ...query,
      data: mergedTrades,
      isLoading: false,
    };
  }

  return query;
}

/**
 * Hook to fetch order history
 * Endpoint: GET /api/v1/orders/history
 */
export function useOrderHistory(symbol?: string) {
  const { publicKey, connected } = useWallet();

  return useQuery({
    queryKey: ['order-history', publicKey?.toBase58(), symbol],
    queryFn: async () => {
      if (!publicKey) {
        throw new Error('Wallet not connected');
      }

      const account = publicKey.toBase58();
      const response = await PacificaAPI.getOrderHistory(account, {
        symbol,
        limit: 50,
      });

      console.log('useOrderHistory: Raw Pacifica response:', response);

      // Pacifica returns { success, data: [...orders] }
      const orders = Array.isArray(response.data) ? response.data : [];
      return orders;
    },
    enabled: connected && !!publicKey,
    refetchInterval: 10000, // Poll every 10 seconds
    staleTime: 5000,
  });
}
