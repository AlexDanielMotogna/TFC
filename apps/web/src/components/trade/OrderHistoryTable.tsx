'use client';

import { useState } from 'react';
import { getBaseToken } from '@tfc/shared';

// ── Types ──

interface HistoryOrder {
  order_id?: string | number;
  symbol?: string;
  side?: string;
  order_type?: string;
  amount?: string;
  filled_amount?: string;
  initial_price?: string;
  price?: string;
  stop_price?: string;
  average_filled_price?: string;
  order_status?: string;
  created_at?: string;
  [key: string]: unknown;
}

interface OrderHistoryTableProps {
  orders: HistoryOrder[];
  emptyMessage?: string;
}

// ── Helpers ──

function toggleSort(
  current: { col: string; desc: boolean },
  setter: (val: { col: string; desc: boolean }) => void,
  column: string
) {
  if (current.col === column) {
    setter({ col: column, desc: !current.desc });
  } else {
    setter({ col: column, desc: true });
  }
}

function getSortValue(order: HistoryOrder, col: string): string | number {
  switch (col) {
    case 'time':
      return order.created_at || 0;
    case 'token':
      return order.symbol || '';
    case 'side':
      return order.side || '';
    case 'type':
      return order.order_type || '';
    case 'originalSize':
      return parseFloat(order.amount || '0') || 0;
    case 'filledSize':
      return parseFloat(order.filled_amount || '0') || 0;
    case 'initialPrice':
      return parseFloat(order.initial_price || order.stop_price || '0') || 0;
    case 'avgPrice':
      return parseFloat(order.average_filled_price || '0') || 0;
    case 'value': {
      const f = parseFloat(order.filled_amount || '0') || 0;
      const p = parseFloat(order.average_filled_price || '0') || 0;
      return f * p;
    }
    case 'status':
      return order.order_status || '';
    case 'orderId':
      return order.order_id || 0;
    default:
      return 0;
  }
}

function sortOrders(orders: HistoryOrder[], sort: { col: string; desc: boolean }): HistoryOrder[] {
  return [...orders].sort((a, b) => {
    const valA = getSortValue(a, sort.col);
    const valB = getSortValue(b, sort.col);
    if (typeof valA === 'string' && typeof valB === 'string') {
      return sort.desc ? valB.localeCompare(valA) : valA.localeCompare(valB);
    }
    return sort.desc ? (valB as number) - (valA as number) : (valA as number) - (valB as number);
  });
}

function formatHistPrice(price: number): string {
  if (price === 0) return 'N/A';
  if (price >= 1000) return price.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (price >= 1) return price.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return price.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function formatStatus(rawStatus: string): string {
  if (!rawStatus) return 'Open';
  switch (rawStatus.toLowerCase()) {
    case 'open':
      return 'Open';
    case 'partially_filled':
      return 'Partial';
    case 'filled':
      return 'Filled';
    case 'cancelled':
    case 'canceled':
      return 'Cancelled';
    case 'triggered':
      return 'Triggered';
    case 'rejected':
      return 'Rejected';
    case 'margincanceled':
      return 'Margin Cancel';
    default:
      return rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1).toLowerCase();
  }
}

function statusClasses(status: string): string {
  if (status === 'Filled' || status === 'Triggered') return 'bg-win-500/20 text-win-400';
  if (status === 'Cancelled' || status === 'Margin Cancel')
    return 'bg-surface-600/50 text-surface-400';
  if (status === 'Partial') return 'bg-yellow-500/20 text-yellow-400';
  return 'bg-surface-500/20 text-surface-300';
}

// ── Component ──

export function OrderHistoryTable({
  orders,
  emptyMessage = 'No order history',
}: OrderHistoryTableProps) {
  const [sort, setSort] = useState<{ col: string; desc: boolean }>({ col: 'time', desc: true });

  if (orders.length === 0) {
    return <div className="text-center py-4 text-surface-500 text-xs">{emptyMessage}</div>;
  }

  const sorted = sortOrders(orders, sort).slice(0, 150);

  const SortHeader = ({ col, label }: { col: string; label: string }) => (
    <th
      className="text-left py-2 px-2 font-medium cursor-pointer hover:text-surface-200 select-none whitespace-nowrap"
      onClick={() => toggleSort(sort, setSort, col)}
    >
      {label} {sort.col === col && (sort.desc ? '\u2193' : '\u2191')}
    </th>
  );

  return (
    <div>
      {/* Mobile card view */}
      <div className="max-[1199px]:block hidden space-y-2 px-1">
        {sorted.map((order, index) => {
          const orderSide =
            order.side === 'bid' ||
            order.side === 'BUY' ||
            order.side === 'LONG' ||
            order.side?.includes('long')
              ? 'Long'
              : 'Short';
          const rawOrderType = order.order_type || 'limit';
          const orderType = rawOrderType
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (c: string) => c.toUpperCase());
          const filledAmount = parseFloat(order.filled_amount || '0');
          const initialAmount = parseFloat(order.amount || '0');
          const avgFilledPrice = parseFloat(order.average_filled_price || '0');
          const stopPrice = parseFloat(order.stop_price || '0');
          const initialPrice = parseFloat(order.initial_price || order.price || '0');
          const isTpSlOrder =
            rawOrderType.includes('stop_loss') || rawOrderType.includes('take_profit');
          const isRegularMarketOrder = rawOrderType === 'market';
          const isStopOrder = rawOrderType.includes('stop') && !isTpSlOrder;
          const orderValue =
            filledAmount > 0 && avgFilledPrice > 0 ? filledAmount * avgFilledPrice : 0;
          const status = formatStatus(order.order_status || '');
          const timestamp = order.created_at ? new Date(order.created_at) : null;

          return (
            <div
              key={order.order_id || index}
              className="border border-surface-800/50 rounded-lg bg-surface-900/50 px-3 py-2.5"
            >
              {/* Header */}
              <div className="flex items-center gap-2 mb-2.5">
                <span className="font-medium text-white text-sm">
                  {order.symbol ? getBaseToken(order.symbol) : ''}
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${orderSide === 'Long' ? 'bg-win-500/20 text-win-400' : 'bg-loss-500/20 text-loss-400'}`}
                >
                  {orderSide}
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-surface-700 text-surface-300">
                  {orderType}
                </span>
                <span
                  className={`text-xs px-1.5 py-0.5 rounded font-semibold ${statusClasses(status)}`}
                >
                  {status}
                </span>
              </div>
              {/* Data grid */}
              <div className="grid grid-cols-3 gap-x-3 gap-y-2.5 text-[11px]">
                <div>
                  <div className="text-surface-500">Time</div>
                  <div className="tabular-nums tracking-tight text-surface-300">
                    {timestamp
                      ? `${timestamp.toLocaleDateString('en-GB', { day: 'numeric', month: 'numeric', year: 'numeric' })}, ${timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}`
                      : '-'}
                  </div>
                </div>
                <div>
                  <div className="text-surface-500">Original Size</div>
                  <div className="tabular-nums tracking-tight text-surface-200">
                    {initialAmount > 0 ? initialAmount.toFixed(5) : 'N/A'}
                  </div>
                </div>
                <div>
                  <div className="text-surface-500">Filled Size</div>
                  <div className="tabular-nums tracking-tight text-surface-200">
                    {filledAmount > 0 ? filledAmount.toFixed(5) : 'N/A'}
                  </div>
                </div>
                <div>
                  <div className="text-surface-500">
                    {isTpSlOrder || isStopOrder ? 'Trigger Price' : 'Price'}
                  </div>
                  <div className="tabular-nums tracking-tight text-surface-200">
                    {isTpSlOrder || isStopOrder
                      ? stopPrice > 0
                        ? formatHistPrice(stopPrice)
                        : formatHistPrice(initialPrice)
                      : isRegularMarketOrder
                        ? 'Market'
                        : formatHistPrice(initialPrice)}
                  </div>
                </div>
                <div>
                  <div className="text-surface-500">Avg Filled Price</div>
                  <div className="tabular-nums tracking-tight text-surface-200">
                    {avgFilledPrice > 0 ? formatHistPrice(avgFilledPrice) : 'N/A'}
                  </div>
                </div>
                <div>
                  <div className="text-surface-500">Order Value</div>
                  <div className="tabular-nums tracking-tight text-win-400">
                    {orderValue > 0 ? `$${orderValue.toFixed(2)}` : 'N/A'}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {/* Desktop table view */}
      <div className="overflow-x-auto max-[1199px]:hidden">
        <table className="w-full text-xs min-w-[900px]">
          <thead>
            <tr className="text-surface-400 text-xs">
              <SortHeader col="time" label="Time" />
              <SortHeader col="token" label="Token" />
              <SortHeader col="side" label="Side" />
              <SortHeader col="type" label="Order Type" />
              <SortHeader col="originalSize" label="Original Size" />
              <SortHeader col="filledSize" label="Filled Size" />
              <SortHeader col="initialPrice" label="Initial Price" />
              <SortHeader col="avgPrice" label="Avg Filled Price" />
              <SortHeader col="value" label="Order Value" />
              <SortHeader col="status" label="Status" />
              <SortHeader col="orderId" label="Order ID" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((order, index) => {
              const orderSide =
                order.side === 'bid' ||
                order.side === 'BUY' ||
                order.side === 'LONG' ||
                order.side?.includes('long')
                  ? 'Long'
                  : 'Short';
              const rawOrderType = order.order_type || 'limit';
              const orderType = rawOrderType
                .replace(/_/g, ' ')
                .replace(/\b\w/g, (c: string) => c.toUpperCase());
              const filledAmount = parseFloat(order.filled_amount || '0');
              const initialAmount = parseFloat(order.amount || '0');
              const avgFilledPrice = parseFloat(order.average_filled_price || '0');
              const stopPrice = parseFloat(order.stop_price || '0');
              const initialPrice = parseFloat(order.initial_price || order.price || '0');
              const isTpSlOrder =
                rawOrderType.includes('stop_loss') || rawOrderType.includes('take_profit');
              const isRegularMarketOrder = rawOrderType === 'market';
              const isStopOrder = rawOrderType.includes('stop') && !isTpSlOrder;
              const orderValue =
                filledAmount > 0 && avgFilledPrice > 0 ? filledAmount * avgFilledPrice : 0;
              const status = formatStatus(order.order_status || '');
              return (
                <tr
                  key={order.order_id || index}
                  className="border-surface-800/50 hover:bg-surface-800/30"
                >
                  <td className="py-px px-2 text-surface-300 tabular-nums tracking-tight whitespace-nowrap">
                    {order.created_at
                      ? `${new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${new Date(order.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}`
                      : '-'}
                  </td>
                  <td className="py-px px-2 font-medium text-white">
                    {order.symbol ? getBaseToken(order.symbol) : ''}
                  </td>
                  <td
                    className={`py-px px-2 font-medium ${orderSide === 'Long' ? 'text-win-400' : 'text-loss-400'}`}
                  >
                    {orderSide}
                  </td>
                  <td className="py-px px-2 text-surface-300">{orderType}</td>
                  <td className="py-px px-2 tabular-nums tracking-tight text-surface-200 whitespace-nowrap">
                    {initialAmount > 0 ? initialAmount.toFixed(5) : 'N/A'}
                  </td>
                  <td className="py-px px-2 tabular-nums tracking-tight text-surface-200 whitespace-nowrap">
                    {filledAmount > 0 ? filledAmount.toFixed(5) : 'N/A'}
                  </td>
                  <td className="py-px px-2 tabular-nums tracking-tight text-surface-200">
                    {isTpSlOrder || isStopOrder
                      ? stopPrice > 0
                        ? formatHistPrice(stopPrice)
                        : formatHistPrice(initialPrice)
                      : isRegularMarketOrder
                        ? 'Market'
                        : formatHistPrice(initialPrice)}
                  </td>
                  <td className="py-px px-2 tabular-nums tracking-tight text-surface-200">
                    {avgFilledPrice > 0 ? formatHistPrice(avgFilledPrice) : 'N/A'}
                  </td>
                  <td className="py-px px-2 tabular-nums tracking-tight text-win-400">
                    {orderValue > 0 ? `$${orderValue.toFixed(2)}` : 'N/A'}
                  </td>
                  <td className="py-px px-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${statusClasses(status)}`}>
                      {status}
                    </span>
                  </td>
                  <td className="py-px px-2 tabular-nums tracking-tight text-surface-400">
                    {order.order_id || '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
