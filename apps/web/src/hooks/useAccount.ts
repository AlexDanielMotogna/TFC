'use client';

import { useMemo } from 'react';
import { useAccountInfo, usePositions, useOpenOrders, useAccountSettings } from './usePositions';
import { useExchangeWsStore } from './useExchangeWebSocket';
import type { Position, OpenOrder } from '@/lib/api';

export interface AccountSummary {
  balance: string;
  equity: string;
  accountEquity: string; // Same as equity, but kept for component compatibility
  unrealizedPnl: string;
  marginUsed: string;
  availableBalance: string;
  totalMarginUsed: string;
  availableToSpend: string;
  availableToWithdraw: string;
  feeLevel?: number;
  crossMmr?: string;
  // Dynamic fees from Pacifica API (these change monthly)
  makerFee?: string;  // e.g., "0.000575" = 0.0575%
  takerFee?: string;  // e.g., "0.0007" = 0.07%
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
  // Real-time leverage from WS account_leverage channel
  const wsLeverageMap = useExchangeWsStore((s) => s.leverageMap);

  const account = useMemo(() => {
    if (!accountInfo) {
      return null;
    }

    // Calculate unrealized PnL: equity - balance
    const balance = parseFloat(accountInfo.balance || '0');
    // Backend returns camelCase (accountEquity) from adapter path
    const equity = accountInfo.accountEquity || accountInfo.account_equity || accountInfo.equity || '0';
    const accountEquity = parseFloat(equity);
    const unrealizedPnl = accountEquity - balance;

    return {
      balance: accountInfo.balance || '0',
      equity,
      accountEquity: equity,
      unrealizedPnl: unrealizedPnl.toString(),
      marginUsed: accountInfo.totalMarginUsed || accountInfo.total_margin_used || '0',
      availableBalance: accountInfo.availableToSpend || accountInfo.available_to_spend || '0',
      totalMarginUsed: accountInfo.totalMarginUsed || accountInfo.total_margin_used || '0',
      availableToSpend: accountInfo.availableToSpend || accountInfo.available_to_spend || '0',
      availableToWithdraw: accountInfo.availableToWithdraw || accountInfo.available_to_withdraw || '0',
      feeLevel: accountInfo.feeLevel ?? accountInfo.fee_level,
      crossMmr: accountInfo.crossMmr || accountInfo.cross_mmr,
      makerFee: accountInfo.makerFee || accountInfo.maker_fee,
      takerFee: accountInfo.takerFee || accountInfo.taker_fee,
    };
  }, [accountInfo]);

  // Build a map of symbol -> leverage from account settings (REST)
  // Index by both formats: 'AVAX-USD' (adapter) and 'AVAX' (raw)
  const settingsLeverageMap = useMemo(() => {
    const map: Record<string, number> = {};
    if (accountSettings && Array.isArray(accountSettings)) {
      accountSettings.forEach((setting: any) => {
        if (setting.symbol && setting.leverage) {
          map[setting.symbol] = setting.leverage;
          // Ensure both 'AVAX' and 'AVAX-USD' keys exist
          const base = setting.symbol.replace('-USD', '');
          if (base !== setting.symbol) {
            map[base] = setting.leverage;
          }
        }
      });
    }
    return map;
  }, [accountSettings]);

  const positions: Position[] = useMemo(() => {
    if (!positionsData || !Array.isArray(positionsData) || positionsData.length === 0) {
      return [];
    }

    return positionsData.map((pos: any) => {
      const rawSymbol = pos.symbol || '';
      const symbol = rawSymbol.includes('-') ? rawSymbol : `${rawSymbol}-USD`;
      const coinSymbol = rawSymbol.replace('-USD', '');

      // Normalize side: WS uses bid/ask, REST adapter uses LONG/SHORT
      let side: 'LONG' | 'SHORT';
      if (pos.side === 'bid' || pos.side === 'LONG') {
        side = 'LONG';
      } else {
        side = 'SHORT';
      }

      // Entry price: WS uses snake_case, REST uses camelCase
      const entryPrice = pos.entry_price || pos.entryPrice || '0';

      // Leverage priority:
      // 1. Position data (HL provides directly via WS/REST; Pacifica REST includes leverage)
      // 2. WS account_leverage (real-time from Pacifica WS)
      // 3. Account settings (REST /api/v1/account/settings)
      // 4. Default fallback (10)
      const posLeverage = pos.leverage ? parseFloat(String(pos.leverage)) : 0;
      const leverage = posLeverage > 0
        ? posLeverage
        : (wsLeverageMap[symbol] || wsLeverageMap[coinSymbol]
          || settingsLeverageMap[coinSymbol] || settingsLeverageMap[rawSymbol]
          || 10);

      // Liq price: WS uses snake_case, REST uses camelCase
      const liqPrice = pos.liq_price || pos.liquidationPrice || '0';

      // Unrealized PnL: HL provides directly via WS and REST
      const unrealizedPnl = pos.unrealized_pnl || pos.unrealizedPnl || '0';

      // ROE%: HL provides returnOnEquity (WS) or metadata.returnOnEquity (REST)
      const roe = pos.return_on_equity || pos.metadata?.returnOnEquity;
      const unrealizedPnlPercent = roe
        ? (parseFloat(roe) * 100).toString()
        : '0';

      return {
        symbol,
        side,
        size: pos.amount || '0',
        entryPrice,
        markPrice: entryPrice, // Updated by trade page with live price
        liquidationPrice: liqPrice,
        unrealizedPnl,
        unrealizedPnlPercent,
        leverage,
        margin: pos.margin || '0',
        funding: pos.funding || '0',
        isolated: pos.isolated ?? (pos.metadata?.leverageType === 'isolated' || false),
        positionValue: pos.position_value || pos.metadata?.positionValue,
      };
    });
  }, [positionsData, wsLeverageMap, settingsLeverageMap]);

  const openOrders: OpenOrder[] = useMemo(() => {
    if (!ordersData || !Array.isArray(ordersData)) return [];

    // Transform Pacifica orders to our format
    // Pacifica fields: order_id, symbol, side, price, initial_amount, filled_amount,
    // cancelled_amount, order_type (limit, take_profit_market, stop_loss_market),
    // stop_price, reduce_only, created_at
    const mapped = ordersData.map((order: any) => {
      // Order type display
      // WS adapter uses order_type (lowercase), REST adapter uses type (UPPERCASE)
      const rawOrderType = (order.order_type || order.type || 'limit').toLowerCase();
      const stopType = (order.stop_type || '').toLowerCase();
      let typeDisplay = 'LIMIT';
      // Detect order category from order_type and stop_type fields
      // WS may send order_type='market' + stop_type='stop_market' for stop orders
      const isTP = rawOrderType.includes('take_profit') || rawOrderType.includes('take profit')
        || stopType.includes('take_profit');
      const isSL = rawOrderType.includes('stop_loss') || rawOrderType.includes('stop loss')
        || stopType.includes('stop_loss');
      // Standalone stop orders: stop_market/stop_limit but NOT TP/SL
      const isStopOrder = !isTP && !isSL && (
        rawOrderType.includes('stop_market') || rawOrderType.includes('stop_limit')
        || rawOrderType === 'stop market' || rawOrderType === 'stop limit'
        || stopType === 'stop_market' || stopType === 'stop_limit'
      );
      const isTpSlOrder = isTP || isSL;
      if (isTP) {
        typeDisplay = (rawOrderType + stopType).includes('limit') ? 'TP_LIMIT' : 'TP_MARKET';
      } else if (isSL) {
        typeDisplay = (rawOrderType + stopType).includes('limit') ? 'SL_LIMIT' : 'SL_MARKET';
      } else if (isStopOrder) {
        typeDisplay = (rawOrderType + stopType).includes('limit') ? 'STOP_LIMIT' : 'STOP_MARKET';
      } else if (rawOrderType === 'market') {
        typeDisplay = 'MARKET';
      } else if (rawOrderType === 'limit') {
        typeDisplay = 'LIMIT';
      } else typeDisplay = rawOrderType.toUpperCase();

      // Get size from order data
      let resolvedSize = order.initial_amount || order.amount || order.size || '0';

      // For TP/SL orders, if size is 0, try to get it from the matching position
      // TP/SL orders have opposite side: LONG position → ask orders, SHORT position → bid orders
      if (isTpSlOrder && (!resolvedSize || resolvedSize === '0' || parseFloat(resolvedSize) === 0)) {
        // Find matching position: same symbol, opposite side
        // Order side 'ask' = selling = closing a LONG position
        // Order side 'bid' = buying = closing a SHORT position
        const positionSide = order.side === 'ask' ? 'bid' : 'ask';
        const orderSymbol = order.symbol?.includes('-') ? order.symbol.replace('-USD', '') : order.symbol;

        const matchingPosition = positionsData?.find((pos: any) => {
          const posSymbol = pos.symbol?.includes('-') ? pos.symbol.replace('-USD', '') : pos.symbol;
          return posSymbol === orderSymbol && pos.side === positionSide;
        });

        if (matchingPosition) {
          resolvedSize = matchingPosition.amount || '0';
        }
      }

      // Normalize side: WS uses bid/ask, REST adapter uses BUY/SELL
      const rawSide = order.side;
      const normalizedSide: 'LONG' | 'SHORT' =
        rawSide === 'bid' || rawSide === 'BUY' || rawSide === 'LONG' ? 'LONG' : 'SHORT';

      return {
        id: (order.order_id ?? order.orderId)?.toString() || '',
        symbol: order.symbol,
        side: normalizedSide,
        type: typeDisplay,
        size: resolvedSize,
        price: (isTpSlOrder || isStopOrder)
          ? (typeDisplay.includes('LIMIT')
            ? (order.price || order.metadata?.limitPx || order.stop_price || '0')
            : (order.stop_price || order.metadata?.stopPrice || order.triggerPx || order.price || '0'))
          : (order.price || '0'),
        filled: order.filled_amount || order.filled || '0',
        status: (order.reduce_only ?? order.reduceOnly) ? 'REDUCE_ONLY' : 'OPEN',
        reduceOnly: order.reduce_only ?? order.reduceOnly ?? false,
        stopPrice: order.stop_price ?? order.metadata?.stopPrice ?? order.triggerPx ?? order.metadata?.triggerPx ?? null,
        createdAt: order.created_at ?? order.createdAt ?? Date.now(),
      };
    });

    // Deduplicate by id (HL can return the same oid for parent + child orders)
    const seen = new Set<string>();
    return mapped.filter((o) => {
      const key = `${o.id}:${o.type}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [ordersData, positionsData]);

  const isLoading = accountLoading || positionsLoading || ordersLoading;
  const error = null; // Individual hooks handle their own errors

  return {
    account,
    positions,
    openOrders,
    isLoading,
    error,
    refetch: refetchAccount as unknown as () => Promise<void>,
  };
}
