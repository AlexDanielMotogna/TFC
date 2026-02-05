'use client';

import { useState } from 'react';
import { Trade } from '@/hooks/useUserTrades';

interface TradesHistoryTableProps {
  trades: Trade[];
  userId: string;
}

type SortField = 'executedAt' | 'symbol' | 'side' | 'amount' | 'price' | 'fee' | 'pnl';
type SortDirection = 'asc' | 'desc';

export default function TradesHistoryTable({ trades, userId }: TradesHistoryTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>('executedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const TRADES_PER_PAGE = 20;

  // Handle sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Sort trades
  const sortedTrades = [...trades].sort((a, b) => {
    let aValue: any;
    let bValue: any;

    switch (sortField) {
      case 'executedAt':
        aValue = new Date(a.executedAt).getTime();
        bValue = new Date(b.executedAt).getTime();
        break;
      case 'symbol':
        aValue = a.symbol;
        bValue = b.symbol;
        break;
      case 'side':
        aValue = a.side;
        bValue = b.side;
        break;
      case 'amount':
        aValue = parseFloat(a.amount);
        bValue = parseFloat(b.amount);
        break;
      case 'price':
        aValue = parseFloat(a.price);
        bValue = parseFloat(b.price);
        break;
      case 'fee':
        aValue = parseFloat(a.fee);
        bValue = parseFloat(b.fee);
        break;
      case 'pnl':
        aValue = a.pnl ? parseFloat(a.pnl) : -Infinity;
        bValue = b.pnl ? parseFloat(b.pnl) : -Infinity;
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Calculate pagination
  const totalPages = Math.ceil(sortedTrades.length / TRADES_PER_PAGE);
  const paginatedTrades = sortedTrades.slice(
    (currentPage - 1) * TRADES_PER_PAGE,
    currentPage * TRADES_PER_PAGE
  );

  // Format date helper - matches Pacifica format: "Feb 5, 16:39:31"
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const day = date.getDate();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${month} ${day}, ${hours}:${minutes}:${seconds}`;
  };

  // Calculate trade value (size * price)
  const calculateTradeValue = (amount: string, price: string): number => {
    return parseFloat(amount) * parseFloat(price);
  };

  // Empty state
  if (trades.length === 0) {
    return (
      <div className="card">
        <div className="p-8 text-center">
          <p className="text-surface-400 text-lg">No individual trades yet.</p>
          <p className="text-surface-500 text-sm mt-2">
            Start trading outside of fights to see your trade history here!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="p-4 sm:p-6">
        <h2 className="text-lg sm:text-xl font-bold mb-4">Trade History</h2>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-surface-400 capitalize tracking-wider bg-surface-850">
                <th
                  className="text-left py-3 px-2 sm:px-4 font-medium cursor-pointer hover:text-surface-300 transition-colors"
                  onClick={() => handleSort('executedAt')}
                >
                  <div className="flex items-center gap-1">
                    Date
                    {sortField === 'executedAt' && (
                      <span className="text-primary-400">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  className="text-center py-3 px-2 sm:px-4 font-medium cursor-pointer hover:text-surface-300 transition-colors"
                  onClick={() => handleSort('symbol')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Symbol
                    {sortField === 'symbol' && (
                      <span className="text-primary-400">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  className="text-center py-3 px-2 sm:px-4 font-medium cursor-pointer hover:text-surface-300 transition-colors"
                  onClick={() => handleSort('side')}
                >
                  <div className="flex items-center justify-center gap-1">
                    Side
                    {sortField === 'side' && (
                      <span className="text-primary-400">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  className="text-right py-3 px-2 sm:px-4 font-medium cursor-pointer hover:text-surface-300 transition-colors"
                  onClick={() => handleSort('amount')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Size
                    {sortField === 'amount' && (
                      <span className="text-primary-400">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  className="text-right py-3 px-2 sm:px-4 font-medium cursor-pointer hover:text-surface-300 transition-colors"
                  onClick={() => handleSort('price')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Price
                    {sortField === 'price' && (
                      <span className="text-primary-400">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th className="text-right py-3 px-2 sm:px-4 font-medium">Trade Value</th>
                <th className="text-center py-3 px-2 sm:px-4 font-medium">Position</th>
                <th
                  className="text-right py-3 px-2 sm:px-4 font-medium cursor-pointer hover:text-surface-300 transition-colors"
                  onClick={() => handleSort('fee')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Fees
                    {sortField === 'fee' && (
                      <span className="text-primary-400">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  className="text-right py-3 px-2 sm:px-4 font-medium cursor-pointer hover:text-surface-300 transition-colors"
                  onClick={() => handleSort('pnl')}
                >
                  <div className="flex items-center justify-end gap-1">
                    PnL
                    {sortField === 'pnl' && (
                      <span className="text-primary-400">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedTrades.map((trade, index) => {
                const pnlValue = trade.pnl ? parseFloat(trade.pnl) : null;
                const pnlIsPositive = pnlValue !== null && pnlValue >= 0;
                const amount = parseFloat(trade.amount);
                const price = parseFloat(trade.price);
                const tradeValue = calculateTradeValue(trade.amount, trade.price);
                const fee = parseFloat(trade.fee);

                return (
                  <tr key={trade.id} className={`transition-colors ${index % 2 === 0 ? 'bg-surface-800/30' : ''} hover:bg-surface-800/50`}>
                    <td className="py-3 px-2 sm:px-4 text-surface-400 whitespace-nowrap">{formatDate(trade.executedAt)}</td>
                    <td className="py-3 px-2 sm:px-4 text-center font-mono text-white">{trade.symbol}</td>
                    <td className="py-3 px-2 sm:px-4 text-center">
                      <span className={`px-2 py-1 rounded text-xs ${
                        trade.position.includes('close')
                          ? 'text-[#2dd4bf]' // Teal color like Pacifica
                          : 'text-surface-400'
                      }`}>
                        {trade.position.includes('close') ? 'Close' : 'Open'} {trade.position.includes('short') ? 'Short' : 'Long'}
                      </span>
                    </td>
                    <td className="py-3 px-2 sm:px-4 text-right text-white">{amount.toFixed(4)} {trade.symbol}</td>
                    <td className="py-3 px-2 sm:px-4 text-right text-white">{price.toFixed(3)}</td>
                    <td className="py-3 px-2 sm:px-4 text-right text-white">${tradeValue.toFixed(2)}</td>
                    <td className="py-3 px-2 sm:px-4 text-center">
                      <span className={`px-2 py-1 rounded text-xs ${
                        trade.position.includes('long')
                          ? 'bg-win-500/20 text-win-400'
                          : 'bg-loss-500/20 text-loss-400'
                      }`}>
                        {trade.position.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-2 sm:px-4 text-right text-surface-400">${fee.toFixed(2)}</td>
                    <td className="py-3 px-2 sm:px-4 text-right">
                      {pnlValue !== null ? (
                        <span className={pnlIsPositive ? 'text-win-400' : 'text-loss-400'}>
                          {pnlIsPositive ? '+' : ''}${pnlValue.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-surface-500">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 mt-6">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-lg bg-surface-800 text-surface-400 hover:bg-surface-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>

            <div className="flex gap-1">
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-3 py-1.5 rounded-lg transition-colors ${
                      currentPage === pageNum
                        ? 'bg-primary-500 text-white'
                        : 'bg-surface-800 text-surface-400 hover:bg-surface-700'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 rounded-lg bg-surface-800 text-surface-400 hover:bg-surface-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        )}

        {/* Page info */}
        <div className="text-center mt-4 text-sm text-surface-500">
          Showing {(currentPage - 1) * TRADES_PER_PAGE + 1} -{' '}
          {Math.min(currentPage * TRADES_PER_PAGE, trades.length)} of {trades.length} trades
        </div>
      </div>
    </div>
  );
}
