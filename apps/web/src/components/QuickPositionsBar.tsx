'use client';

import { useState, useRef, useEffect } from 'react';
import { useAccount } from '@/hooks/useAccount';
import { usePrices } from '@/hooks/usePrices';
import { getBaseToken } from '@tfc/shared';
import { QuickPositionModal } from './QuickPositionModal';
import ViewListIcon from '@mui/icons-material/ViewList';
import type { Position } from '@/lib/api';

/**
 * Format price for quick display with fixed width to prevent navbar jumping
 */
function formatQuickPrice(price: number): string {
  if (price >= 10000) {
    const k = price / 1000;
    return k >= 100 ? `${k.toFixed(0)}K` : `${k.toFixed(1)}K`;
  } else if (price >= 1000) {
    return price.toFixed(0);
  } else if (price >= 100) {
    return price.toFixed(1);
  } else if (price >= 10) {
    return price.toFixed(2);
  } else if (price >= 1) {
    return price.toFixed(3);
  } else {
    return price.toFixed(4);
  }
}

/**
 * Shared position rendering logic for both bar and dropdown
 */
function usePositionMetrics(position: Position) {
  const { getPrice } = usePrices();
  const priceData = getPrice(position.symbol);
  const entryPrice = parseFloat(position.entryPrice) || 0;
  const markPrice = priceData?.price || entryPrice;
  const sizeInToken = parseFloat(position.size) || 0;
  const leverage = position.leverage || 10;
  const margin = parseFloat(position.margin) || (sizeInToken * entryPrice) / leverage;

  // Use HL-provided PnL if available, else calculate
  const apiPnl = parseFloat(position.unrealizedPnl) || 0;
  let unrealizedPnl: number;
  if (apiPnl !== 0 || parseFloat(position.unrealizedPnl || '0') !== 0) {
    unrealizedPnl = parseFloat(position.unrealizedPnl || '0');
  } else {
    const priceDiff = position.side === 'LONG' ? markPrice - entryPrice : entryPrice - markPrice;
    unrealizedPnl = priceDiff * sizeInToken;
  }

  const apiRoe = parseFloat(position.unrealizedPnlPercent) || 0;
  const unrealizedPnlPercent =
    apiRoe !== 0 ? apiRoe : margin > 0 ? (unrealizedPnl / margin) * 100 : 0;

  return { markPrice, unrealizedPnl, unrealizedPnlPercent, side: position.side };
}

/**
 * QuickPositionsBar - Shows active positions carousel in navbar
 */
export function QuickPositionsBar() {
  const { positions, isLoading } = useAccount();
  const { getPrice } = usePrices();

  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [showModal, setShowModal] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  if (isLoading || positions.length === 0) {
    return null;
  }

  const handlePositionClick = (position: Position) => {
    if (!isDragging) {
      setSelectedPosition(position);
      setShowModal(true);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeft(scrollRef.current.scrollLeft);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 2;
    scrollRef.current.scrollLeft = scrollLeft - walk;
  };

  const handleMouseUp = () => setIsDragging(false);
  const handleMouseLeave = () => setIsDragging(false);

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedPosition(null);
  };

  return (
    <>
      <div
        ref={scrollRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        className="hidden lg:flex items-center gap-2 ml-6 mr-6 flex-1 overflow-x-auto scrollbar-hide cursor-grab active:cursor-grabbing"
      >
        {positions.map((position) => {
          const symbolBase = getBaseToken(position.symbol);
          const priceData = getPrice(position.symbol);
          const entryPrice = parseFloat(position.entryPrice) || 0;
          const markPrice = priceData?.price || entryPrice;
          const sizeInToken = parseFloat(position.size) || 0;
          const leverage = position.leverage || 10;
          const margin = parseFloat(position.margin) || (sizeInToken * entryPrice) / leverage;

          // Use HL-provided PnL if available, else calculate
          const apiPnl = parseFloat(position.unrealizedPnl) || 0;
          let unrealizedPnl: number;
          if (apiPnl !== 0 || parseFloat(position.unrealizedPnl || '0') !== 0) {
            unrealizedPnl = parseFloat(position.unrealizedPnl || '0');
          } else {
            const priceDiff =
              position.side === 'LONG' ? markPrice - entryPrice : entryPrice - markPrice;
            unrealizedPnl = priceDiff * sizeInToken;
          }

          const apiRoe = parseFloat(position.unrealizedPnlPercent) || 0;
          const unrealizedPnlPercent =
            apiRoe !== 0 ? apiRoe : margin > 0 ? (unrealizedPnl / margin) * 100 : 0;
          const isProfitable = unrealizedPnl >= 0;

          return (
            <button
              key={`${position.symbol}-${position.side}`}
              onClick={() => handlePositionClick(position)}
              className={`flex-shrink-0 flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors ${
                isProfitable
                  ? 'bg-win-500/10 hover:bg-win-500/15'
                  : 'bg-loss-500/10 hover:bg-loss-500/15'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-white font-mono text-sm font-medium">{symbolBase}</span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    position.side === 'LONG'
                      ? 'bg-win-500/30 text-win-400'
                      : 'bg-loss-500/30 text-loss-400'
                  }`}
                >
                  {position.side}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span
                  className={`text-xs font-mono font-medium min-w-[55px] text-right ${
                    isProfitable ? 'text-win-400' : 'text-loss-400'
                  }`}
                >
                  {isProfitable ? '+' : ''}
                  {unrealizedPnlPercent.toFixed(2)}%
                </span>
                <span className="text-xs text-surface-200 font-mono min-w-[60px] text-right">
                  ${formatQuickPrice(markPrice)}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {selectedPosition && (
        <QuickPositionModal
          position={selectedPosition}
          isOpen={showModal}
          onClose={handleCloseModal}
        />
      )}
    </>
  );
}

/**
 * QuickPositionsDropdown - Dropdown icon for navbar right section
 */
export function QuickPositionsDropdown() {
  const { positions, isLoading } = useAccount();
  const { getPrice } = usePrices();

  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (isLoading || positions.length === 0) {
    return null;
  }

  const handlePositionClick = (position: Position) => {
    setSelectedPosition(position);
    setShowModal(true);
    setShowDropdown(false);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedPosition(null);
  };

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="relative flex items-center justify-center px-2 py-1.5 bg-surface-800 hover:bg-surface-700 rounded transition-colors"
        >
          <ViewListIcon className="text-surface-400" sx={{ fontSize: 20 }} />
        </button>

        {showDropdown && (
          <div className="fixed sm:absolute left-4 sm:right-0 sm:left-auto top-14 sm:top-full sm:mt-2 w-[calc(100vw-32px)] sm:w-80 bg-surface-850 rounded-lg shadow-xl border border-surface-800 overflow-hidden z-50">
            {positions.map((position) => {
              const symbolBase = getBaseToken(position.symbol);
              const priceData = getPrice(position.symbol);
              const entryPrice = parseFloat(position.entryPrice) || 0;
              const markPrice = priceData?.price || entryPrice;
              const sizeInToken = parseFloat(position.size) || 0;
              const leverage = position.leverage || 10;
              const margin = parseFloat(position.margin) || (sizeInToken * entryPrice) / leverage;

              const apiPnl = parseFloat(position.unrealizedPnl) || 0;
              let unrealizedPnl: number;
              if (apiPnl !== 0 || parseFloat(position.unrealizedPnl || '0') !== 0) {
                unrealizedPnl = parseFloat(position.unrealizedPnl || '0');
              } else {
                const priceDiff =
                  position.side === 'LONG' ? markPrice - entryPrice : entryPrice - markPrice;
                unrealizedPnl = priceDiff * sizeInToken;
              }

              const apiRoe = parseFloat(position.unrealizedPnlPercent) || 0;
              const unrealizedPnlPercent =
                apiRoe !== 0 ? apiRoe : margin > 0 ? (unrealizedPnl / margin) * 100 : 0;
              const isProfitable = unrealizedPnl >= 0;

              return (
                <button
                  key={`${position.symbol}-${position.side}`}
                  onClick={() => handlePositionClick(position)}
                  className={`w-full flex items-center justify-between px-4 py-3 transition-colors ${
                    isProfitable
                      ? 'bg-win-500/10 hover:bg-win-500/15'
                      : 'bg-loss-500/10 hover:bg-loss-500/15'
                  } border-b border-surface-800 last:border-b-0`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-white font-mono text-sm font-medium">{symbolBase}</span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        position.side === 'LONG'
                          ? 'bg-win-500/30 text-win-400'
                          : 'bg-loss-500/30 text-loss-400'
                      }`}
                    >
                      {position.side}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs font-mono font-medium min-w-[55px] text-right ${
                        isProfitable ? 'text-win-400' : 'text-loss-400'
                      }`}
                    >
                      {isProfitable ? '+' : ''}
                      {unrealizedPnlPercent.toFixed(2)}%
                    </span>
                    <span className="text-xs text-surface-200 font-mono min-w-[60px] text-right">
                      ${formatQuickPrice(markPrice)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selectedPosition && (
        <QuickPositionModal
          position={selectedPosition}
          isOpen={showModal}
          onClose={handleCloseModal}
        />
      )}
    </>
  );
}
