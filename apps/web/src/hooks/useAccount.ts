'use client';

import { useMemo } from 'react';
import { useAccountInfo, usePositions, useOpenOrders, useAccountSettings } from './usePositions';
import type { Position, OpenOrder } from '@/lib/api';

// Max leverage per symbol (from Pacifica /api/v1/info)
const MAX_LEVERAGE: Record<string, number> = {
  BTC: 50, ETH: 50, SOL: 20, HYPE: 20, XRP: 20, DOGE: 20, LINK: 20, AVAX: 20,
  SUI: 10, BNB: 10, AAVE: 10, ARB: 10, OP: 10, APT: 10, INJ: 10, TIA: 10,
  SEI: 10, WIF: 10, JUP: 10, PENDLE: 10, RENDER: 10, FET: 10, ZEC: 10,
  PAXG: 10, ENA: 10, KPEPE: 10,
};

export interface AccountSummary {
  balance: string;
  equity: string;
  accountEquity: string; // Same as equity, but kept for component compatibility
  unrealizedPnl: string;
  marginUsed: string;
  availableBalance: string;
  totalMarginUsed: string;
  availableToSpend: string;
  feeLevel?: number;
  crossMmr?: string;
}

interface UseAccountReturn {
  account: AccountSummary | null;
  positions: Position[];
  openOrders: OpenOrder[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Unified hook to get account data from Pacifica
 * Now uses the new hooks that query Pacifica directly
 */
export function useAccount(): UseAccountReturn {
  const { data: accountInfo, isLoading: accountLoading, refetch: refetchAccount } = useAccountInfo();
  const { data: positionsData, isLoading: positionsLoading } = usePositions();
  const { data: ordersData, isLoading: ordersLoading } = useOpenOrders();
  const { data: accountSettings } = useAccountSettings();

  const account = useMemo(() => {
    if (!accountInfo) {
      console.log('useAccount: accountInfo is null');
      return null;
    }

    console.log('useAccount: Raw accountInfo from Pacifica:', accountInfo);

    // Pacifica API doesn't return unrealized_pnl directly
    // Calculate it: unrealized_pnl = account_equity - balance
    const balance = parseFloat(accountInfo.balance || '0');
    const accountEquity = parseFloat(accountInfo.account_equity || accountInfo.equity || '0');
    const unrealizedPnl = accountEquity - balance;

    const mapped = {
      balance: accountInfo.balance || '0',
      equity: accountInfo.account_equity || accountInfo.equity || '0',
      accountEquity: accountInfo.account_equity || accountInfo.equity || '0', // Duplicate for compatibility
      unrealizedPnl: unrealizedPnl.toString(), // Calculated: account_equity - balance
      marginUsed: accountInfo.total_margin_used || accountInfo.margin_used || '0',
      availableBalance: accountInfo.available_to_spend || accountInfo.available_balance || '0',
      totalMarginUsed: accountInfo.total_margin_used || accountInfo.margin_used || '0',
      availableToSpend: accountInfo.available_to_spend || accountInfo.available_balance || '0',
      feeLevel: accountInfo.fee_level,
      crossMmr: accountInfo.cross_mmr,
    };

    console.log('useAccount: Mapped account data:', mapped);
    return mapped;
  }, [accountInfo]);

  // Build a map of symbol -> leverage from account settings
  const leverageMap = useMemo(() => {
    const map: Record<string, number> = {};
    if (accountSettings && Array.isArray(accountSettings)) {
      accountSettings.forEach((setting: any) => {
        if (setting.symbol && setting.leverage) {
          map[setting.symbol] = setting.leverage;
        }
      });
    }
    return map;
  }, [accountSettings]);

  const positions: Position[] = useMemo(() => {
    if (!positionsData || positionsData.length === 0) {
      console.log('useAccount: No positions data');
      return [];
    }

    console.log('useAccount: Raw positions from Pacifica:', positionsData);
    console.log('useAccount: Leverage map from settings:', leverageMap);

    // Transform Pacifica positions to our format
    // Pacifica /positions returns: symbol, side (bid/ask), amount, entry_price, margin, funding, isolated
    // NOTE: mark_price, liquidation_price, unrealized_pnl are NOT returned by the REST API
    // NOTE: leverage is NOT returned - must be fetched from /account/settings
    // If not in settings, default is MAX leverage for that symbol
    return positionsData.map((pos: any) => {
      // Pacifica returns symbol without -USD suffix (e.g., "BTC" not "BTC-USD")
      const rawSymbol = pos.symbol || '';
      const symbol = rawSymbol.includes('-') ? rawSymbol : `${rawSymbol}-USD`;

      // Get leverage: first check account settings, then use max leverage for symbol
      const leverage = leverageMap[rawSymbol] || MAX_LEVERAGE[rawSymbol] || 10;

      // For now, we don't have real-time mark price from REST API
      // The trade page will inject current price from usePrices hook
      return {
        symbol,
        side: pos.side === 'bid' ? 'LONG' : 'SHORT',
        size: pos.amount || '0',
        entryPrice: pos.entry_price || '0',
        markPrice: pos.entry_price || '0', // Will be updated by trade page with live price
        liquidationPrice: '0', // Not provided by REST API, will be calculated
        unrealizedPnl: '0', // Will be calculated by trade page
        unrealizedPnlPercent: '0',
        leverage: leverage,
        margin: pos.margin || '0', // For cross margin, this is "0" from API
        funding: pos.funding || '0',
        isolated: pos.isolated ?? false,
      };
    });
  }, [positionsData, leverageMap]);

  const openOrders: OpenOrder[] = useMemo(() => {
    if (!ordersData) return [];

    console.log('useAccount: Raw orders from Pacifica:', ordersData);
    // Debug: Log all field names from first order
    if (ordersData.length > 0) {
      console.log('useAccount: First order fields:', Object.keys(ordersData[0]));
      console.log('useAccount: First order full data:', JSON.stringify(ordersData[0], null, 2));
    }

    // Transform Pacifica orders to our format
    // Pacifica fields: order_id, symbol, side, price, initial_amount, filled_amount,
    // cancelled_amount, order_type (limit, take_profit_market, stop_loss_market),
    // stop_price, reduce_only, created_at
    return ordersData.map((order: any) => {
      // Order type display
      let typeDisplay = 'LIMIT';
      if (order.order_type === 'limit') typeDisplay = 'LIMIT';
      else if (order.order_type === 'market') typeDisplay = 'MARKET';
      else if (order.order_type === 'take_profit_market') typeDisplay = 'TP MARKET';
      else if (order.order_type === 'stop_loss_market') typeDisplay = 'SL MARKET';
      else if (order.order_type === 'take_profit_limit') typeDisplay = 'TP LIMIT';
      else if (order.order_type === 'stop_loss_limit') typeDisplay = 'SL LIMIT';
      else if (order.order_type) typeDisplay = order.order_type.toUpperCase();

      // Debug: log the size field resolution
      const resolvedSize = order.initial_amount || order.amount || order.size || '0';
      console.log(`useAccount: Order ${order.order_id} size resolution:`, {
        initial_amount: order.initial_amount,
        amount: order.amount,
        size: order.size,
        resolved: resolvedSize,
      });

      return {
        id: order.order_id?.toString() || '',
        symbol: order.symbol,
        side: order.side === 'bid' ? 'LONG' : 'SHORT',
        type: typeDisplay,
        size: resolvedSize,
        price: order.stop_price || order.price || '0', // Use stop_price for TP/SL orders
        filled: order.filled_amount || '0',
        status: order.reduce_only ? 'REDUCE_ONLY' : 'OPEN',
        reduceOnly: order.reduce_only || false,
        stopPrice: order.stop_price,
        createdAt: order.created_at || Date.now(),
      };
    });
  }, [ordersData]);

  const isLoading = accountLoading || positionsLoading || ordersLoading;
  const error = null; // Individual hooks handle their own errors

  return {
    account,
    positions,
    openOrders,
    isLoading,
    error,
    refetch: refetchAccount as () => Promise<void>,
  };
}
