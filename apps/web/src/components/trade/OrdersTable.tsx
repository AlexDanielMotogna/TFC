'use client';

import { useState } from 'react';
import { getBaseToken } from '@tfc/shared';

// ── Types ──

interface OpenOrder {
  id: string;
  symbol: string;
  side: string;
  type: string;
  price: string;
  size: string;
  filled: string;
  reduceOnly?: boolean;
  stopPrice?: string | null;
  createdAt?: string | number;
}

interface OrdersTableProps {
  orders: OpenOrder[];
  onCancelOrder: (orderId: string, symbol: string, orderType?: string) => void;
  onCancelAll: () => void;
  onEditOrder: (order: {
    id: string;
    symbol: string;
    side: string;
    price: string;
    size: string;
    type: string;
  }) => void;
  isCancelling: boolean;
  isCancellingStop: boolean;
  isCancellingAll: boolean;
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

function getSortValue(order: OpenOrder, col: string): string | number {
  switch (col) {
    case 'time':
      return order.createdAt ? new Date(order.createdAt).getTime() : 0;
    case 'type':
      return order.type || '';
    case 'token':
      return order.symbol || '';
    case 'side':
      return order.side || '';
    case 'originalSize':
      return parseFloat(order.size) || 0;
    case 'filledSize':
      return parseFloat(order.filled) || 0;
    case 'price':
      return parseFloat(order.price) || 0;
    case 'value':
      return (parseFloat(order.size) || 0) * (parseFloat(order.price) || 0);
    case 'reduceOnly':
      return order.reduceOnly ? 1 : 0;
    case 'trigger':
      return order.stopPrice ? parseFloat(order.stopPrice) : 0;
    default:
      return 0;
  }
}

function sortOrders(orders: OpenOrder[], sort: { col: string; desc: boolean }): OpenOrder[] {
  return [...orders].sort((a, b) => {
    const valA = getSortValue(a, sort.col);
    const valB = getSortValue(b, sort.col);
    if (typeof valA === 'string' && typeof valB === 'string') {
      return sort.desc ? valB.localeCompare(valA) : valA.localeCompare(valB);
    }
    return sort.desc ? (valB as number) - (valA as number) : (valA as number) - (valB as number);
  });
}

function formatSize(size: number): string {
  if (size === 0) return '0';
  if (size >= 1) return size.toFixed(2).replace(/\.?0+$/, '');
  const str = size.toPrecision(4);
  return parseFloat(str).toString();
}

/** Classify an order as TP/SL and compute its display type label */
function classifyOrder(order: OpenOrder) {
  const orderTypeLower = order.type.toLowerCase();
  const isNativeTpSl =
    order.type.includes('TP') ||
    order.type.includes('SL') ||
    orderTypeLower.includes('take_profit') ||
    orderTypeLower.includes('stop_loss') ||
    orderTypeLower.includes('take profit') ||
    orderTypeLower.includes('stop loss');
  const isHybridTp = !isNativeTpSl && order.reduceOnly && order.type.toUpperCase() === 'LIMIT';
  const isHybridSl = !isNativeTpSl && order.reduceOnly && order.type.toUpperCase().includes('STOP');
  const isTpSl = isNativeTpSl || isHybridTp || isHybridSl;

  let displayType = order.type;
  if (order.type === 'TP_MARKET' || (order.type.includes('TP') && !order.type.includes('LIMIT')))
    displayType = 'Take Profit Market';
  else if (order.type === 'TP_LIMIT' || (order.type.includes('TP') && order.type.includes('LIMIT')))
    displayType = 'Take Profit Limit';
  else if (
    order.type === 'SL_MARKET' ||
    (order.type.includes('SL') && !order.type.includes('LIMIT'))
  )
    displayType = 'Stop Market';
  else if (order.type === 'SL_LIMIT' || (order.type.includes('SL') && order.type.includes('LIMIT')))
    displayType = 'Stop Limit';
  else if (orderTypeLower.includes('take_profit') || orderTypeLower.includes('take profit'))
    displayType = 'Take Profit Market';
  else if (orderTypeLower.includes('stop_loss') || orderTypeLower.includes('stop loss'))
    displayType = 'Stop Loss Market';
  else if (isHybridTp) displayType = 'TP (Partial)';
  else if (isHybridSl) displayType = 'SL (Partial)';
  else if (order.type === 'LIMIT') displayType = 'Limit';
  else if (order.type === 'MARKET') displayType = 'Market';
  else if (order.type === 'STOP_LIMIT') displayType = 'Stop Limit';
  else if (order.type === 'STOP_MARKET') displayType = 'Stop Market';
  else displayType = order.type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());

  return { isTpSl, displayType, isNativeTpSl };
}

// ── Component ──

export function OrdersTable({
  orders,
  onCancelOrder,
  onCancelAll,
  onEditOrder,
  isCancelling,
  isCancellingStop,
  isCancellingAll,
  emptyMessage = 'No open orders',
}: OrdersTableProps) {
  const [sort, setSort] = useState<{ col: string; desc: boolean }>({ col: 'time', desc: true });

  if (orders.length === 0) {
    return <div className="text-center py-4 text-surface-500 text-xs">{emptyMessage}</div>;
  }

  const sorted = sortOrders(orders, sort);

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
        <div className="flex justify-end mb-1">
          <button
            onClick={onCancelAll}
            disabled={isCancellingAll}
            className="text-surface-300 hover:text-white transition-colors disabled:opacity-50 text-xs"
          >
            Cancel All
          </button>
        </div>
        {sorted.map((order) => {
          const price = parseFloat(order.price) || 0;
          const originalSize = parseFloat(order.size) || 0;
          const filledSize = parseFloat(order.filled) || 0;
          const timestamp = order.createdAt ? new Date(order.createdAt) : new Date();
          const { isTpSl, displayType } = classifyOrder(order);
          const stopPrice = order.stopPrice ? parseFloat(order.stopPrice) : null;
          const orderValue = originalSize * (price || stopPrice || 0);

          return (
            <div
              key={order.id}
              className="border border-surface-800/50 rounded-lg bg-surface-900/50 px-3 py-2.5"
            >
              {/* Header */}
              <div className="flex items-center gap-2 mb-2.5">
                <span className="font-medium text-white text-sm">{getBaseToken(order.symbol)}</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                    isTpSl
                      ? displayType.includes('Take Profit') || displayType.includes('TP')
                        ? 'bg-win-500/20 text-win-400'
                        : 'bg-loss-500/20 text-loss-400'
                      : 'bg-surface-700 text-surface-300'
                  }`}
                >
                  {displayType}
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${order.side === 'LONG' ? 'bg-win-500/20 text-win-400' : 'bg-loss-500/20 text-loss-400'}`}
                >
                  {order.side === 'LONG' ? 'Long' : 'Short'}
                </span>
              </div>
              {/* Data grid */}
              <div className="grid grid-cols-3 gap-x-3 gap-y-2.5 text-[11px]">
                <div>
                  <div className="text-surface-500">Time</div>
                  <div className="tabular-nums tracking-tight text-surface-300">
                    {timestamp.toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'numeric',
                      year: 'numeric',
                    })}
                    ,{' '}
                    {timestamp.toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: false,
                    })}
                  </div>
                </div>
                <div>
                  <div className="text-surface-500">Original Size</div>
                  <div className="tabular-nums tracking-tight text-white">
                    {formatSize(originalSize)}
                  </div>
                </div>
                <div>
                  <div className="text-surface-500">Filled Size</div>
                  <div className="tabular-nums tracking-tight text-surface-300">{filledSize}</div>
                </div>
                <div>
                  <div className="text-surface-500">Price</div>
                  <div className="tabular-nums tracking-tight text-surface-300">
                    {isTpSl
                      ? 'Market'
                      : order.type.includes('STOP') && !price
                        ? 'Market'
                        : price.toLocaleString(undefined, {
                            maximumFractionDigits: price < 1 ? 6 : 2,
                          })}
                  </div>
                </div>
                <div>
                  <div className="text-surface-500">Order Value</div>
                  <div className="tabular-nums tracking-tight text-surface-300">
                    ${orderValue.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-surface-500">Reduce Only</div>
                  <div className="text-surface-300">{order.reduceOnly ? 'Yes' : 'No'}</div>
                </div>
                {stopPrice && (
                  <div>
                    <div className="text-surface-500">Trigger Condition</div>
                    <div className="tabular-nums tracking-tight text-surface-300">
                      ${stopPrice.toLocaleString()} / Last
                    </div>
                  </div>
                )}
              </div>
              {/* Cancel button */}
              <div className="mt-2.5 pt-2 border-t border-surface-800/50">
                <button
                  onClick={() => onCancelOrder(order.id, order.symbol, order.type)}
                  disabled={isCancelling || isCancellingStop}
                  className="text-surface-300 hover:text-white transition-colors disabled:opacity-50 text-xs"
                >
                  {isTpSl ? 'Remove' : 'Cancel'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {/* Desktop table view */}
      <div className="overflow-x-auto max-[1199px]:hidden">
        <table className="w-full text-xs min-w-[900px]">
          <thead>
            <tr className="text-xs text-surface-400 tracking-wider">
              <SortHeader col="time" label="Time" />
              <SortHeader col="type" label="Order Type" />
              <SortHeader col="token" label="Token" />
              <SortHeader col="side" label="Side" />
              <SortHeader col="originalSize" label="Original Size" />
              <SortHeader col="filledSize" label="Filled Size" />
              <SortHeader col="price" label="Price" />
              <SortHeader col="value" label="Order Value" />
              <SortHeader col="reduceOnly" label="Reduce Only" />
              <SortHeader col="trigger" label="Trigger" />
              <th className="text-left py-2 px-2 font-medium">
                <button
                  onClick={onCancelAll}
                  disabled={isCancellingAll}
                  className="text-surface-300 hover:text-white transition-colors disabled:opacity-50"
                >
                  Cancel All
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((order) => {
              const price = parseFloat(order.price) || 0;
              const originalSize = parseFloat(order.size) || 0;
              const filledSize = parseFloat(order.filled) || 0;
              const timestamp = order.createdAt ? new Date(order.createdAt) : new Date();
              const { isTpSl, displayType } = classifyOrder(order);
              const stopPrice = order.stopPrice ? parseFloat(order.stopPrice) : null;
              const orderValue = originalSize * (price || stopPrice || 0);
              const tokenSymbol = getBaseToken(order.symbol);
              return (
                <tr key={order.id} className="border-surface-800/50 hover:bg-surface-800/30">
                  <td className="py-px px-2 text-surface-300 whitespace-nowrap tabular-nums tracking-tight">
                    {timestamp.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })},{' '}
                    {timestamp.toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: false,
                    })}
                  </td>
                  <td className="py-px px-2 text-surface-300">{displayType}</td>
                  <td className="py-px px-2">
                    <span className="text-surface-300">{tokenSymbol}</span>
                  </td>
                  <td className="py-px px-2">
                    <span
                      className={`font-medium ${order.side === 'LONG' ? 'text-win-400' : 'text-loss-400'}`}
                    >
                      {order.side === 'LONG' ? 'Long' : 'Short'}
                    </span>
                  </td>
                  <td className="py-px px-2 tabular-nums tracking-tight text-white">
                    {formatSize(originalSize)}
                  </td>
                  <td className="py-px px-2 tabular-nums tracking-tight text-surface-400">
                    {filledSize}
                  </td>
                  <td className="py-px px-2 tabular-nums tracking-tight text-surface-300">
                    {isTpSl && displayType.includes('Market') ? (
                      'Market'
                    ) : isTpSl && displayType.includes('Limit') ? (
                      price.toLocaleString(undefined, { maximumFractionDigits: price < 1 ? 6 : 2 })
                    ) : order.type.includes('STOP') && !price ? (
                      'Market'
                    ) : order.type.includes('STOP') ? (
                      price.toLocaleString(undefined, { maximumFractionDigits: price < 1 ? 6 : 2 })
                    ) : (
                      <button
                        onClick={() =>
                          onEditOrder({
                            id: order.id,
                            symbol: order.symbol,
                            side: order.side,
                            price: order.price,
                            size: order.size,
                            type: order.type,
                          })
                        }
                        className="inline-flex items-center gap-1 hover:text-white transition-colors group"
                        title="Edit order price"
                      >
                        {price.toLocaleString(undefined, {
                          maximumFractionDigits: price < 1 ? 6 : 2,
                        })}
                        <svg
                          className="w-3 h-3 text-surface-500 group-hover:text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
                          />
                        </svg>
                      </button>
                    )}
                  </td>
                  <td className="py-px px-2 tabular-nums tracking-tight text-surface-300">
                    ${orderValue.toFixed(2)}
                  </td>
                  <td className="py-px px-2 text-surface-300">{order.reduceOnly ? 'Yes' : 'No'}</td>
                  <td className="py-px px-2 text-surface-400">
                    {stopPrice ? `$${stopPrice.toLocaleString()}` : 'N/A'}
                  </td>
                  <td className="py-px px-2">
                    <button
                      onClick={() => onCancelOrder(order.id, order.symbol, order.type)}
                      disabled={isCancelling || isCancellingStop}
                      className="text-surface-300 hover:text-white transition-colors disabled:opacity-50"
                    >
                      {isTpSl ? 'Remove' : 'Cancel'}
                    </button>
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
