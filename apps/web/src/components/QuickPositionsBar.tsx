'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { usePositions, useAccountSettings } from '@/hooks/usePositions';
import { usePrices } from '@/hooks/usePrices';
import { QuickPositionModal } from './QuickPositionModal';
import type { Position } from '@/hooks/useExchangeWebSocket';
import ViewListIcon from '@mui/icons-material/ViewList';
import { calculatePositionMetrics } from '@/lib/trading/utils';

/**
 * Format price for quick display with fixed width to prevent navbar jumping
 * Rounds to appropriate precision based on price magnitude
 */
function formatQuickPrice(price: number): string {
  if (price >= 10000) {
    // For prices >= 10k: show as "12.3K" or "123K"
    const k = price / 1000;
    return k >= 100 ? `${k.toFixed(0)}K` : `${k.toFixed(1)}K`;
  } else if (price >= 1000) {
    // For prices 1k-10k: show as "1,234" (no decimals)
    return price.toFixed(0);
  } else if (price >= 100) {
    // For prices 100-1k: show as "123.4" (1 decimal)
    return price.toFixed(1);
  } else if (price >= 10) {
    // For prices 10-100: show as "12.34" (2 decimals)
    return price.toFixed(2);
  } else if (price >= 1) {
    // For prices 1-10: show as "1.234" (3 decimals)
    return price.toFixed(3);
  } else {
    // For prices < 1: show as "0.1234" (4 decimals)
    return price.toFixed(4);
  }
}

// Max leverage per symbol (from useAccount.ts)
const MAX_LEVERAGE: Record<string, number> = {
  BTC: 50, ETH: 50, SOL: 20, HYPE: 20, XRP: 20, DOGE: 20, LINK: 20, AVAX: 20,
  SUI: 10, BNB: 10, AAVE: 10, ARB: 10, OP: 10, APT: 10, INJ: 10, TIA: 10,
  SEI: 10, WIF: 10, JUP: 10, PENDLE: 10, RENDER: 10, FET: 10, ZEC: 10,
  PAXG: 10, ENA: 10, KPEPE: 10, XMR: 10, LTC: 10, LIT: 10, FARTCOIN: 10,
  XAG: 10, NVDA: 10, BCH: 10, WLFI: 10, XPL: 10, TAO: 10, ADA: 10, CL: 10,
  UNI: 10, VIRTUAL: 10, ICP: 10, KBONK: 10, ASTER: 10, TRUMP: 10, LDO: 10,
  PENGU: 10, NEAR: 10, ZK: 10, WLD: 10, PIPPIN: 10, ZZ: 10, STRK: 10,
  CRV: 10, MON: 10, PUMP: 10, '1000PEPE': 10, '1000BONK': 10,
};

/**
 * QuickPositionsBar - Shows active positions carousel in navbar
 */
export function QuickPositionsBar() {
  const { data: positions, isLoading } = usePositions();
  const { prices, getPrice } = usePrices();
  const { data: accountSettings } = useAccountSettings();

  // Build leverage map (same as useAccount.ts)
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

  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [showModal, setShowModal] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  // Don't show anything if no positions or loading
  if (isLoading || !positions || positions.length === 0) {
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
    const walk = (x - startX) * 2; // Scroll speed multiplier
    scrollRef.current.scrollLeft = scrollLeft - walk;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedPosition(null);
  };

  return (
    <>
      {/* Desktop with slider: Only show carousel on large screens (above 1024x841) */}
      <div
        ref={scrollRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        className="hidden lg:flex items-center gap-2 ml-6 mr-6 flex-1 overflow-x-auto scrollbar-hide cursor-grab active:cursor-grabbing"
      >
        {positions.map((position: Position) => {
          const symbol = position.symbol;
          const symbolBase = symbol.replace('-USD', '');
          const priceData = getPrice(`${symbolBase}-USD`);
          const markPrice = priceData?.price || parseFloat(position.entry_price);

          // Get leverage from settings or default
          const leverage = leverageMap[symbolBase] || MAX_LEVERAGE[symbolBase] || 10;

          // Use centralized calculation (handles cross margin correctly)
          const metrics = calculatePositionMetrics({
            position,
            markPrice,
            leverage,
          });

          const isProfitable = metrics.unrealizedPnl >= 0;

          return (
            <button
              key={`${symbol}-${position.side}`}
              onClick={() => handlePositionClick(position)}
              className={`flex-shrink-0 flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors ${
                isProfitable
                  ? 'bg-win-500/10 hover:bg-win-500/15'
                  : 'bg-loss-500/10 hover:bg-loss-500/15'
              }`}
            >
              <div className="flex items-center gap-2">
                {/* Symbol + Side Badge */}
                <span className="text-white font-mono text-sm font-medium">
                  {symbolBase}
                </span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  metrics.side === 'LONG'
                    ? 'bg-win-500/30 text-win-400'
                    : 'bg-loss-500/30 text-loss-400'
                }`}>
                  {metrics.side}
                </span>
              </div>

              <div className="flex items-center gap-3">
                {/* PnL */}
                <span className={`text-xs font-mono font-medium min-w-[55px] text-right ${
                  isProfitable ? 'text-win-400' : 'text-loss-400'
                }`}>
                  {isProfitable ? '+' : ''}{metrics.unrealizedPnlPercent.toFixed(2)}%
                </span>

                {/* Current Price */}
                <span className="text-xs text-surface-200 font-mono min-w-[60px] text-right">
                  ${formatQuickPrice(markPrice)}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Quick Action Modal */}
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
  const { data: positions, isLoading } = usePositions();
  const { prices, getPrice } = usePrices();
  const { data: accountSettings } = useAccountSettings();

  // Build leverage map (same as useAccount.ts)
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

  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Don't show anything if no positions or loading
  if (isLoading || !positions || positions.length === 0) {
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
      {/* Dropdown button */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="relative flex items-center justify-center px-2 py-1.5 bg-surface-800 hover:bg-surface-700 rounded transition-colors"
        >
          <ViewListIcon className="text-surface-400" sx={{ fontSize: 20 }} />
        </button>

        {/* Dropdown menu */}
        {showDropdown && (
          <div className="fixed sm:absolute left-4 sm:right-0 sm:left-auto top-14 sm:top-full sm:mt-2 w-[calc(100vw-32px)] sm:w-80 bg-surface-850 rounded-lg shadow-xl border border-surface-800 overflow-hidden z-50">
            {positions.map((position: Position) => {
              const symbol = position.symbol;
              const symbolBase = symbol.replace('-USD', '');
              const priceData = getPrice(`${symbolBase}-USD`);
              const markPrice = priceData?.price || parseFloat(position.entry_price);

              // Get leverage from settings or default
              const leverage = leverageMap[symbolBase] || MAX_LEVERAGE[symbolBase] || 10;

              // Use centralized calculation (handles cross margin correctly)
              const metrics = calculatePositionMetrics({
                position,
                markPrice,
                leverage,
              });

              const isProfitable = metrics.unrealizedPnl >= 0;

              return (
                <button
                  key={`${symbol}-${position.side}`}
                  onClick={() => handlePositionClick(position)}
                  className={`w-full flex items-center justify-between px-4 py-3 transition-colors ${
                    isProfitable
                      ? 'bg-win-500/10 hover:bg-win-500/15'
                      : 'bg-loss-500/10 hover:bg-loss-500/15'
                  } border-b border-surface-800 last:border-b-0`}
                >
                  <div className="flex items-center gap-2">
                    {/* Symbol + Side Badge */}
                    <span className="text-white font-mono text-sm font-medium">
                      {symbolBase}
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      metrics.side === 'LONG'
                        ? 'bg-win-500/30 text-win-400'
                        : 'bg-loss-500/30 text-loss-400'
                    }`}>
                      {metrics.side}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* PnL */}
                    <span className={`text-xs font-mono font-medium min-w-[55px] text-right ${
                      isProfitable ? 'text-win-400' : 'text-loss-400'
                    }`}>
                      {isProfitable ? '+' : ''}{metrics.unrealizedPnlPercent.toFixed(2)}%
                    </span>

                    {/* Current Price */}
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

      {/* Quick Action Modal */}
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
