'use client';

import { useState } from 'react';
import { getBaseToken } from '@tfc/shared';

// ── Types ──

interface Trade {
  history_id?: string;
  symbol?: string;
  side?: string;
  price?: string;
  amount?: string;
  fee?: string;
  pnl?: string;
  created_at?: string;
  [key: string]: unknown;
}

interface TradeHistoryTableProps {
  trades: Trade[];
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

function getSortValue(trade: Trade, col: string): string | number {
  switch (col) {
    case 'time':
      return trade.created_at || 0;
    case 'token':
      return trade.symbol ? getBaseToken(trade.symbol) : '';
    case 'side':
      return trade.side || '';
    case 'size':
      return parseFloat(trade.amount || '0') || 0;
    case 'price':
      return parseFloat(trade.price || '0') || 0;
    case 'value':
      return (parseFloat(trade.price || '0') || 0) * (parseFloat(trade.amount || '0') || 0);
    case 'fee':
      return parseFloat(trade.fee || '0') || 0;
    case 'pnl':
      return parseFloat(trade.pnl || '0') || 0;
    default:
      return 0;
  }
}

function sortTrades(trades: Trade[], sort: { col: string; desc: boolean }): Trade[] {
  return [...trades].sort((a, b) => {
    const valA = getSortValue(a, sort.col);
    const valB = getSortValue(b, sort.col);
    if (typeof valA === 'string' && typeof valB === 'string') {
      return sort.desc ? valB.localeCompare(valA) : valA.localeCompare(valB);
    }
    return sort.desc ? (valB as number) - (valA as number) : (valA as number) - (valB as number);
  });
}

// ── Component ──

export function TradeHistoryTable({
  trades,
  emptyMessage = 'No trade history',
}: TradeHistoryTableProps) {
  const [sort, setSort] = useState<{ col: string; desc: boolean }>({ col: 'time', desc: true });

  if (trades.length === 0) {
    return <div className="text-center py-4 text-surface-500 text-xs">{emptyMessage}</div>;
  }

  const sorted = sortTrades(trades, sort);

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
        {sorted.map((trade, index) => {
          const price = parseFloat(trade.price || '0') || 0;
          const amount = parseFloat(trade.amount || '0') || 0;
          const realizedPnl = parseFloat(trade.pnl || '0') || 0;
          const fee = parseFloat(trade.fee || '0') || 0;
          const tradeValue = price * amount;
          const timestamp = trade.created_at ? new Date(trade.created_at) : new Date();
          const sideFormatted =
            trade.side?.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) || '';
          const isLong = trade.side?.includes('long');
          const isClose = trade.side?.includes('close');
          const sideColor = isClose
            ? realizedPnl >= 0
              ? 'text-win-400'
              : 'text-loss-400'
            : isLong
              ? 'text-win-400'
              : 'text-loss-400';
          const token = trade.symbol ? getBaseToken(trade.symbol) : '';

          return (
            <div
              key={trade.history_id || index}
              className="border border-surface-800/50 rounded-lg bg-surface-900/50 px-3 py-2.5"
            >
              {/* Header */}
              <div className="flex items-center gap-2 mb-2.5">
                <span className="font-medium text-white text-sm">{token}</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${sideColor} ${isClose ? (realizedPnl >= 0 ? 'bg-win-500/20' : 'bg-loss-500/20') : isLong ? 'bg-win-500/20' : 'bg-loss-500/20'}`}
                >
                  {sideFormatted}
                </span>
                <span
                  className={`tabular-nums tracking-tight text-xs font-medium ${realizedPnl >= 0 ? 'text-win-400' : 'text-loss-400'}`}
                >
                  {realizedPnl >= 0 ? '+' : '-'}${Math.abs(realizedPnl).toFixed(2)}
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
                  <div className="text-surface-500">Side</div>
                  <div className={`font-medium ${sideColor}`}>{sideFormatted}</div>
                </div>
                <div>
                  <div className="text-surface-500">Order Type</div>
                  <div className="text-surface-300">Fulfill Taker</div>
                </div>
                <div>
                  <div className="text-surface-500">Size</div>
                  <div className="tabular-nums tracking-tight text-white">
                    {amount.toFixed(amount < 0.01 ? 5 : 4)}
                  </div>
                </div>
                <div>
                  <div className="text-surface-500">Price</div>
                  <div className="tabular-nums tracking-tight text-surface-300">
                    $
                    {price >= 1000
                      ? price.toLocaleString(undefined, { maximumFractionDigits: 2 })
                      : price >= 1
                        ? price.toFixed(2)
                        : price.toFixed(4)}
                  </div>
                </div>
                <div>
                  <div className="text-surface-500">Trade Value</div>
                  <div className="tabular-nums tracking-tight text-surface-300">
                    ${tradeValue.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-surface-500">Fees</div>
                  <div className="tabular-nums tracking-tight text-surface-300">
                    ${fee.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {/* Desktop table view */}
      <div className="overflow-x-auto max-[1199px]:hidden">
        <table className="w-full text-xs min-w-[800px]">
          <thead>
            <tr className="text-xs text-surface-400 tracking-wider">
              <SortHeader col="time" label="Time" />
              <SortHeader col="token" label="Token" />
              <SortHeader col="side" label="Side" />
              <th className="text-left py-2 px-2 font-medium whitespace-nowrap">Order Type</th>
              <SortHeader col="size" label="Size" />
              <SortHeader col="price" label="Price" />
              <SortHeader col="value" label="Trade Value" />
              <SortHeader col="fee" label="Fees" />
              <SortHeader col="pnl" label="Realized PnL" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((trade, index) => {
              const price = parseFloat(trade.price || '0') || 0;
              const amount = parseFloat(trade.amount || '0') || 0;
              const realizedPnl = parseFloat(trade.pnl || '0') || 0;
              const fee = parseFloat(trade.fee || '0') || 0;
              const tradeValue = price * amount;
              const timestamp = trade.created_at ? new Date(trade.created_at) : new Date();
              const sideFormatted =
                trade.side?.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) ||
                '';
              const isLong = trade.side?.includes('long');
              const isClose = trade.side?.includes('close');
              const sideColor = isClose
                ? realizedPnl >= 0
                  ? 'text-win-400'
                  : 'text-loss-400'
                : isLong
                  ? 'text-win-400'
                  : 'text-loss-400';
              const token = trade.symbol ? getBaseToken(trade.symbol) : '';
              return (
                <tr
                  key={trade.history_id || index}
                  className="border-surface-800/50 hover:bg-surface-800/30"
                >
                  <td className="py-px px-2 text-surface-300 whitespace-nowrap tabular-nums tracking-tight">
                    {timestamp.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })},{' '}
                    {timestamp.toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: false,
                    })}
                  </td>
                  <td className="py-px px-2 text-surface-300">{token}</td>
                  <td className="py-px px-2">
                    <span className={`font-medium ${sideColor}`}>{sideFormatted}</span>
                  </td>
                  <td className="py-px px-2 text-surface-300">Fulfill Taker</td>
                  <td className="py-px px-2 tabular-nums tracking-tight text-surface-300 whitespace-nowrap">
                    {amount.toFixed(amount < 0.01 ? 5 : 4)}
                  </td>
                  <td className="py-px px-2 tabular-nums tracking-tight text-surface-300">
                    $
                    {price >= 1000
                      ? price.toLocaleString(undefined, { maximumFractionDigits: 2 })
                      : price >= 1
                        ? price.toFixed(2)
                        : price.toFixed(4)}
                  </td>
                  <td className="py-px px-2 tabular-nums tracking-tight text-surface-300">
                    ${tradeValue.toFixed(2)}
                  </td>
                  <td className="py-px px-2 tabular-nums tracking-tight text-surface-300">
                    ${fee.toFixed(2)}
                  </td>
                  <td className="py-px px-2">
                    <span
                      className={`tabular-nums tracking-tight ${realizedPnl >= 0 ? 'text-win-400' : 'text-loss-400'}`}
                    >
                      {realizedPnl >= 0 ? '+' : '-'}${Math.abs(realizedPnl).toFixed(2)}
                    </span>
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
