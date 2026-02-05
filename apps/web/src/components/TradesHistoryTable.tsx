'use client';

import { useState } from 'react';
import { Trade } from '@/hooks/useUserTrades';

interface TradesHistoryTableProps {
  trades: Trade[];
  userId: string;
}

export default function TradesHistoryTable({ trades, userId }: TradesHistoryTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const TRADES_PER_PAGE = 20;

  // Calculate pagination
  const totalPages = Math.ceil(trades.length / TRADES_PER_PAGE);
  const paginatedTrades = trades.slice(
    (currentPage - 1) * TRADES_PER_PAGE,
    currentPage * TRADES_PER_PAGE
  );

  // Format date helper
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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
          <table className="table-pro w-full">
            <thead>
              <tr>
                <th>Date</th>
                <th>Symbol</th>
                <th>Side</th>
                <th>Amount</th>
                <th>Price</th>
                <th>Leverage</th>
                <th>Fee</th>
                <th>PnL</th>
              </tr>
            </thead>
            <tbody>
              {paginatedTrades.map((trade) => (
                <tr key={trade.id}>
                  <td className="whitespace-nowrap">{formatDate(trade.executedAt)}</td>
                  <td className="font-mono">{trade.symbol}</td>
                  <td>
                    <span
                      className={`badge ${
                        trade.side === 'BUY' ? 'badge-success' : 'badge-danger'
                      }`}
                    >
                      {trade.side}
                    </span>
                  </td>
                  <td>{parseFloat(trade.amount).toFixed(4)}</td>
                  <td>${parseFloat(trade.price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td>{trade.leverage ? `${trade.leverage}x` : '-'}</td>
                  <td className="text-surface-400">
                    ${parseFloat(trade.fee).toFixed(2)}
                  </td>
                  <td>
                    {trade.pnl ? (
                      <span
                        className={parseFloat(trade.pnl) >= 0 ? 'pnl-positive' : 'pnl-negative'}
                      >
                        {parseFloat(trade.pnl) >= 0 ? '+' : ''}$
                        {parseFloat(trade.pnl).toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-surface-500">-</span>
                    )}
                  </td>
                </tr>
              ))}
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
