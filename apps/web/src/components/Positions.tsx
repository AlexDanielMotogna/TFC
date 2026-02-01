'use client';

import { useState } from 'react';
import { LimitCloseModal } from './LimitCloseModal';
import { FlipPositionModal } from './FlipPositionModal';
import { MarketCloseModal, type MarketCloseParams } from './MarketCloseModal';
import { TpSlModal, type TpSlParams } from './TpSlModal';

// TP/SL order attached to a position
export interface TpSlOrder {
  orderId: string;
  type: 'TP' | 'SL';
  triggerPrice: number;
  amount: number; // Size in token units
  orderType: 'market' | 'limit';
  limitPrice?: number;
}

export interface Position {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  size: number; // Position value in USD
  sizeInToken: number; // Size in token units (e.g., 0.00011 BTC)
  entryPrice: number;
  markPrice: number;
  leverage: number;
  liquidationPrice: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number; // ROI %
  margin: number;
  marginType: 'Cross' | 'Isolated';
  funding: number;
  // Legacy single TP/SL (for backward compatibility, uses first order if exists)
  takeProfit?: number;
  stopLoss?: number;
  // Multiple TP/SL orders support
  tpOrders?: TpSlOrder[];
  slOrders?: TpSlOrder[];
}

export interface LimitCloseParams {
  positionId: string;
  price: string;
  amount: string;
  percentage: number;
}

export { type MarketCloseParams };
export { type TpSlParams };

interface PositionsProps {
  positions: Position[];
  onClosePosition?: (positionId: string, closeType?: 'market' | 'limit' | 'flip', params?: LimitCloseParams | MarketCloseParams) => void;
  onSetTpSl?: (params: TpSlParams) => Promise<void>;
  onCancelOrder?: (orderId: string, symbol: string, orderType: string) => Promise<void>;
  /** Close all positions at once */
  onCloseAll?: () => Promise<void>;
  /** Whether close all is in progress */
  isClosingAll?: boolean;
  /** When true, hides close buttons and shows info banner (for fight-only view) */
  readOnly?: boolean;
  /** Optional message to show when in read-only mode */
  readOnlyMessage?: string;
}

export function Positions({ positions, onClosePosition, onSetTpSl, onCancelOrder, onCloseAll, isClosingAll, readOnly = false, readOnlyMessage }: PositionsProps) {
  const [closingId, setClosingId] = useState<string | null>(null);
  const [closingType, setClosingType] = useState<'market' | 'limit' | 'flip' | null>(null);
  const [marketClosePosition, setMarketClosePosition] = useState<Position | null>(null);
  const [limitClosePosition, setLimitClosePosition] = useState<Position | null>(null);
  const [flipPosition, setFlipPosition] = useState<Position | null>(null);
  const [tpSlPosition, setTpSlPosition] = useState<Position | null>(null);
  const [isSubmittingMarket, setIsSubmittingMarket] = useState(false);
  const [isSubmittingLimit, setIsSubmittingLimit] = useState(false);
  const [isSubmittingFlip, setIsSubmittingFlip] = useState(false);
  const [isSubmittingTpSl, setIsSubmittingTpSl] = useState(false);

  const handleClose = async (positionId: string, closeType: 'market' | 'limit' | 'flip' = 'market') => {
    // For market close, show modal with percentage slider
    if (closeType === 'market') {
      const position = positions.find(p => p.id === positionId);
      if (position) {
        setMarketClosePosition(position);
      }
      return;
    }

    // For limit close, show modal instead of executing directly
    if (closeType === 'limit') {
      const position = positions.find(p => p.id === positionId);
      if (position) {
        setLimitClosePosition(position);
      }
      return;
    }

    // For flip, show confirmation modal
    if (closeType === 'flip') {
      const position = positions.find(p => p.id === positionId);
      if (position) {
        setFlipPosition(position);
      }
      return;
    }

    setClosingId(positionId);
    setClosingType(closeType);
    try {
      await onClosePosition?.(positionId, closeType);
    } finally {
      setClosingId(null);
      setClosingType(null);
    }
  };

  const handleMarketCloseConfirm = async (amount: string, percentage: number) => {
    if (!marketClosePosition) return;

    setIsSubmittingMarket(true);
    try {
      await onClosePosition?.(marketClosePosition.id, 'market', {
        positionId: marketClosePosition.id,
        amount,
        percentage,
      });
      setMarketClosePosition(null);
    } finally {
      setIsSubmittingMarket(false);
    }
  };

  const handleFlipConfirm = async () => {
    if (!flipPosition) return;

    setIsSubmittingFlip(true);
    try {
      await onClosePosition?.(flipPosition.id, 'flip');
      setFlipPosition(null);
    } finally {
      setIsSubmittingFlip(false);
    }
  };

  const handleLimitCloseConfirm = async (price: string, amount: string, percentage: number) => {
    if (!limitClosePosition) return;

    setIsSubmittingLimit(true);
    try {
      await onClosePosition?.(limitClosePosition.id, 'limit', {
        positionId: limitClosePosition.id,
        price,
        amount,
        percentage,
      });
      setLimitClosePosition(null);
    } finally {
      setIsSubmittingLimit(false);
    }
  };

  const handleTpSlConfirm = async (params: TpSlParams) => {
    if (!tpSlPosition || !onSetTpSl) return;

    setIsSubmittingTpSl(true);
    try {
      await onSetTpSl(params);
      setTpSlPosition(null);
    } finally {
      setIsSubmittingTpSl(false);
    }
  };

  // Helper to format token symbol (remove -USD suffix)
  const getTokenSymbol = (symbol: string) => symbol.replace('-USD', '');

  // Helper to format price with appropriate decimals
  const formatPrice = (price: number) => {
    if (price >= 10000) return price.toLocaleString(undefined, { maximumFractionDigits: 0 });
    if (price >= 100) return price.toLocaleString(undefined, { maximumFractionDigits: 2 });
    if (price >= 1) return price.toLocaleString(undefined, { maximumFractionDigits: 4 });
    return price.toLocaleString(undefined, { maximumFractionDigits: 6 });
  };

  // Helper to format token amount
  const formatTokenAmount = (amount: number, symbol: string) => {
    const token = getTokenSymbol(symbol);
    if (amount < 0.0001) return `${amount.toFixed(8)} ${token}`;
    if (amount < 0.01) return `${amount.toFixed(6)} ${token}`;
    if (amount < 1) return `${amount.toFixed(4)} ${token}`;
    return `${amount.toFixed(2)} ${token}`;
  };

  if (positions.length === 0) {
    return (
      // Use min-h-full to fill container and prevent layout shift when positions load
      <div className="flex items-center justify-center min-h-full text-surface-500">
        <div className="text-center">
          <p>No open positions</p>
          {readOnly && readOnlyMessage && (
            <p className="text-xs mt-2 text-surface-400">{readOnlyMessage}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    // contain: layout prevents internal layout changes from affecting parent/page scroll
    <div className="flex flex-col h-full" style={{ contain: 'layout' }}>
      {/* Info banner for read-only mode */}
      {readOnly && readOnlyMessage && (
        <div className="mb-3 px-3 py-2 bg-primary-500/10 border border-primary-500/20 rounded-lg text-sm text-primary-300 flex items-center gap-2 flex-shrink-0">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{readOnlyMessage}</span>
        </div>
      )}
      {/* Table with horizontal scroll - grows to fill space, overscroll containment prevents scroll chaining on mobile */}
      <div className="overflow-x-auto overflow-y-auto overscroll-y-contain flex-1">
      <table className="w-full text-xs min-w-[900px]">
        <thead>
          <tr className="text-xs text-surface-400">
            <th className="text-left py-2 px-2 font-medium whitespace-nowrap">Token</th>
            <th className="text-right py-2 px-2 font-medium whitespace-nowrap">Size</th>
            <th className="text-right py-2 px-2 font-medium whitespace-nowrap">Pos Value</th>
            <th className="text-right py-2 px-2 font-medium whitespace-nowrap">Entry</th>
            <th className="text-right py-2 px-2 font-medium whitespace-nowrap">Mark</th>
            <th className="text-right py-2 px-2 font-medium whitespace-nowrap">PnL (ROI%)</th>
            <th className="text-right py-2 px-2 font-medium whitespace-nowrap">Liq Price</th>
            <th className="text-right py-2 px-2 font-medium whitespace-nowrap">Margin</th>
            <th className="text-right py-2 px-2 font-medium whitespace-nowrap">Funding</th>
            <th className="text-center py-2 px-2 font-medium whitespace-nowrap">TP/SL</th>
            {!readOnly && <th className="text-center py-2 px-2 font-medium whitespace-nowrap">Close</th>}
          </tr>
        </thead>
        <tbody>
          {positions.map((pos) => (
            <tr
              key={pos.id}
              className="border-t border-surface-800/50 hover:bg-surface-800/30"
            >
              {/* Token - Symbol with leverage badge */}
              <td className="py-3 px-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-white">{getTokenSymbol(pos.symbol)}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-xs font-semibold ${
                      pos.side === 'LONG'
                        ? 'bg-win-500/20 text-win-400'
                        : 'bg-loss-500/20 text-loss-400'
                    }`}
                  >
                    {pos.leverage}x {pos.side === 'LONG' ? 'Long' : 'Short'}
                  </span>
                </div>
              </td>

              {/* Size in token */}
              <td className="py-3 px-2 text-right font-mono text-white">
                {formatTokenAmount(pos.sizeInToken, pos.symbol)}
              </td>

              {/* Position Value in USD */}
              <td className="py-3 px-2 text-right font-mono text-surface-300">
                ${pos.size.toFixed(2)}
              </td>

              {/* Entry Price */}
              <td className="py-3 px-2 text-right font-mono text-surface-300">
                {formatPrice(pos.entryPrice)}
              </td>

              {/* Mark Price */}
              <td className="py-3 px-2 text-right font-mono text-surface-300">
                {formatPrice(pos.markPrice)}
              </td>

              {/* PnL with ROI% */}
              <td className="py-3 px-2 text-right">
                <div
                  className={`font-mono font-medium ${
                    pos.unrealizedPnl >= 0 ? 'text-win-400' : 'text-loss-400'
                  }`}
                >
                  {pos.unrealizedPnl >= 0 ? '+' : '-'}${pos.unrealizedPnl < 1 && pos.unrealizedPnl > -1
                    ? `${Math.abs(pos.unrealizedPnl).toFixed(4)}`
                    : `${Math.abs(pos.unrealizedPnl).toFixed(2)}`}
                  <span className="ml-1">
                    ({pos.unrealizedPnlPercent >= 0 ? '+' : ''}
                    {pos.unrealizedPnlPercent.toFixed(2)}%)
                  </span>
                </div>
              </td>

              {/* Liquidation Price */}
              <td className="py-3 px-2 text-right font-mono text-loss-400">
                {formatPrice(pos.liquidationPrice)}
              </td>

              {/* Margin with type */}
              <td className="py-3 px-2 text-right">
                <div className="font-mono text-white">
                  ${pos.margin.toFixed(2)}
                </div>
                <div className="text-xs text-surface-400">
                  {pos.marginType}
                </div>
              </td>

              {/* Funding */}
              <td className="py-3 px-2 text-right">
                <span className={`font-mono ${pos.funding >= 0 ? 'text-win-400' : 'text-loss-400'}`}>
                  {pos.funding >= 0 ? '+' : '-'}${pos.funding < 0.01 && pos.funding > -0.01
                    ? `${Math.abs(pos.funding).toFixed(4)}`
                    : `${Math.abs(pos.funding).toFixed(2)}`}
                </span>
              </td>

              {/* TP/SL */}
              <td className="py-3 px-2 text-center">
                {(() => {
                  const tpCount = pos.tpOrders?.length || 0;
                  const slCount = pos.slOrders?.length || 0;
                  const hasMultiple = tpCount > 1 || slCount > 1;

                  // Display content based on number of orders
                  const displayContent = hasMultiple ? (
                    // Show counts when multiple orders exist (like Pacifica)
                    <span className="font-mono">
                      <span className={tpCount > 0 ? 'text-win-400' : 'text-surface-500'}>
                        {tpCount > 0 ? `${tpCount} TP${tpCount > 1 ? 's' : ''}` : '-'}
                      </span>
                      <span className="text-surface-500 mx-1">/</span>
                      <span className={slCount > 0 ? 'text-loss-400' : 'text-surface-500'}>
                        {slCount > 0 ? `${slCount} SL${slCount > 1 ? 's' : ''}` : '-'}
                      </span>
                    </span>
                  ) : (
                    // Show single price when only one order each (or none)
                    <span className="font-mono">
                      <span className={pos.takeProfit ? 'text-win-400' : 'text-surface-500'}>
                        {pos.takeProfit ? formatPrice(pos.takeProfit) : '-'}
                      </span>
                      <span className="text-surface-500 mx-1">/</span>
                      <span className={pos.stopLoss ? 'text-loss-400' : 'text-surface-500'}>
                        {pos.stopLoss ? formatPrice(pos.stopLoss) : '-'}
                      </span>
                    </span>
                  );

                  return !readOnly && onSetTpSl ? (
                    <button
                      onClick={() => setTpSlPosition(pos)}
                      className="inline-flex items-center gap-1.5 text-xs hover:bg-surface-700/50 rounded px-2 py-1 transition-colors group"
                      title="Set TP/SL"
                    >
                      {displayContent}
                      {/* Edit icon */}
                      <svg
                        className="w-3.5 h-3.5 text-surface-500 group-hover:text-primary-400 transition-colors"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  ) : (
                    <div className="inline-flex items-center gap-1.5 text-xs">
                      {displayContent}
                    </div>
                  );
                })()}
              </td>

              {/* Close actions - hidden in read-only mode */}
              {!readOnly && (
                <td className="py-3 px-2">
                  <div className="flex items-center justify-center gap-1.5">
                    <button
                      onClick={() => handleClose(pos.id, 'market')}
                      disabled={closingId === pos.id}
                      className="px-2 py-1 text-xs font-medium bg-surface-700 hover:bg-surface-600 rounded transition-colors disabled:opacity-50"
                    >
                      {closingId === pos.id && closingType === 'market' ? '...' : 'Market'}
                    </button>
                    <button
                      onClick={() => handleClose(pos.id, 'limit')}
                      disabled={closingId === pos.id}
                      className="px-2 py-1 text-xs font-medium bg-surface-700 hover:bg-surface-600 rounded transition-colors disabled:opacity-50"
                    >
                      {closingId === pos.id && closingType === 'limit' ? '...' : 'Limit'}
                    </button>
                    <button
                      onClick={() => handleClose(pos.id, 'flip')}
                      disabled={closingId === pos.id}
                      className="px-2 py-1 text-xs font-medium bg-primary-500/20 text-primary-400 hover:bg-primary-500/30 rounded transition-colors disabled:opacity-50"
                    >
                      {closingId === pos.id && closingType === 'flip' ? '...' : 'Flip'}
                    </button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      {/* Summary - fixed at bottom */}
      <div className="mt-auto pt-3 border-t border-surface-800 flex items-center gap-4 px-2 flex-shrink-0">
        <div className="text-xs text-surface-400">
          Positions: <span className="text-white">{positions.length}</span>
        </div>
        <div className="text-xs text-surface-400">
          Total Value: <span className="text-white font-mono">${positions.reduce((sum, p) => sum + p.size, 0).toFixed(2)}</span>
        </div>
        <div className="text-xs">
          <span className="text-surface-400">Total PnL: </span>
          <span
            className={`font-mono font-medium ${
              positions.reduce((sum, p) => sum + p.unrealizedPnl, 0) >= 0
                ? 'text-win-400'
                : 'text-loss-400'
            }`}
          >
            {positions.reduce((sum, p) => sum + p.unrealizedPnl, 0) >= 0 ? '+' : '-'}${Math.abs(positions.reduce((sum, p) => sum + p.unrealizedPnl, 0)).toFixed(4)}
          </span>
        </div>
      </div>

      {/* Market Close Modal */}
      {marketClosePosition && (
        <MarketCloseModal
          position={marketClosePosition}
          onClose={() => setMarketClosePosition(null)}
          onConfirm={handleMarketCloseConfirm}
          isSubmitting={isSubmittingMarket}
        />
      )}

      {/* Limit Close Modal */}
      {limitClosePosition && (
        <LimitCloseModal
          position={limitClosePosition}
          onClose={() => setLimitClosePosition(null)}
          onConfirm={handleLimitCloseConfirm}
          isSubmitting={isSubmittingLimit}
        />
      )}

      {/* Flip Position Modal */}
      {flipPosition && (
        <FlipPositionModal
          position={flipPosition}
          onClose={() => setFlipPosition(null)}
          onConfirm={handleFlipConfirm}
          isSubmitting={isSubmittingFlip}
        />
      )}

      {/* TP/SL Modal */}
      {tpSlPosition && (
        <TpSlModal
          position={tpSlPosition}
          onClose={() => setTpSlPosition(null)}
          onConfirm={handleTpSlConfirm}
          onCancelOrder={onCancelOrder}
          isSubmitting={isSubmittingTpSl}
        />
      )}
    </div>
  );
}
