'use client';

import { useMemo, useState, useRef, useEffect } from 'react';
import { useOrderBook, type AggLevel } from '@/hooks/useOrderBook';

interface OrderBookProps {
  symbol: string;
  currentPrice: number;
  oraclePrice?: number;
  tickSize?: number;
  onPriceClick?: (price: number) => void;
}

// Extract base token from symbol (BTC-USD -> BTC)
const getBaseToken = (symbol: string): string => {
  if (symbol === 'KPEPE-USD') return '1KPEPE';
  return symbol.replace('-USD', '');
};

// Valid agg_level values - matches Pacifica's pattern (powers of 10)
const AGG_LEVELS: AggLevel[] = [1, 10, 100, 1000, 10000];

// Format tick value for display (remove trailing zeros)
const formatTickValue = (value: number): string => {
  if (value >= 1) {
    return value.toFixed(0);
  }
  // For decimals, show appropriate precision without trailing zeros
  const str = value.toFixed(8);
  return str.replace(/\.?0+$/, '');
};

// Format price with commas and appropriate decimals (like Pacifica)
const formatPrice = (price: number): string => {
  if (price === 0) return '0';

  // Determine decimal places based on price magnitude
  let decimals: number;
  if (price >= 10000) decimals = 0;      // BTC: 97,000
  else if (price >= 1000) decimals = 0;  // ETH: 3,500
  else if (price >= 100) decimals = 1;   // SOL: 195.5
  else if (price >= 10) decimals = 2;    // 45.23
  else if (price >= 1) decimals = 3;     // 1.234
  else if (price >= 0.1) decimals = 4;   // 0.1234
  else if (price >= 0.01) decimals = 5;  // 0.01234
  else if (price >= 0.001) decimals = 6; // 0.001234
  else decimals = 8;                     // memecoins

  return price.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

// Format size/total with appropriate decimals
// USD mode: always 2 decimals
// TOKEN mode: 5 decimals for high value tokens (BTC/ETH), dynamic for memecoins
const formatSize = (size: number, isUsdMode: boolean, isHighValueToken: boolean = true): string => {
  if (size === 0) return '0.00';

  // USD mode: always 2 decimals
  if (isUsdMode) {
    return size.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  // TOKEN mode: For high value tokens (BTC, ETH, SOL), show 5 decimals like Pacifica
  if (isHighValueToken) {
    return size.toLocaleString('en-US', {
      minimumFractionDigits: 5,
      maximumFractionDigits: 5,
    });
  }

  // TOKEN mode: For memecoins, show fewer decimals based on magnitude
  if (size >= 1000) {
    return size.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  } else if (size >= 1) {
    return size.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } else {
    return size.toLocaleString('en-US', {
      minimumFractionDigits: 5,
      maximumFractionDigits: 5,
    });
  }
};

export function OrderBook({ symbol, currentPrice, tickSize = 0.01, onPriceClick }: OrderBookProps) {
  const baseToken = getBaseToken(symbol);

  // Aggregation level (server-side) - valid values: 1, 2, 5, 10, 100, 1000
  const [aggLevel, setAggLevel] = useState<AggLevel>(1);

  // Dropdown open states
  const [aggDropdownOpen, setAggDropdownOpen] = useState(false);
  const [sizeModeDropdownOpen, setSizeModeDropdownOpen] = useState(false);
  const aggDropdownRef = useRef<HTMLDivElement>(null);
  const sizeModeDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    if (!aggDropdownOpen && !sizeModeDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (aggDropdownOpen && aggDropdownRef.current && !aggDropdownRef.current.contains(e.target as Node)) {
        setAggDropdownOpen(false);
      }
      if (sizeModeDropdownOpen && sizeModeDropdownRef.current && !sizeModeDropdownRef.current.contains(e.target as Node)) {
        setSizeModeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [aggDropdownOpen, sizeModeDropdownOpen]);

  // Calculate aggregation options based on tickSize
  // agg_level is a multiplier of tick_size (e.g., tickSize=0.01, agg_level=10 → 0.10)
  const aggOptions = useMemo(() => {
    return AGG_LEVELS.map((level) => ({
      level,
      displayValue: formatTickValue(tickSize * level),
    }));
  }, [tickSize]);

  // Size display mode: 'USD' or token symbol
  const [sizeMode, setSizeMode] = useState<'USD' | 'TOKEN'>('TOKEN');

  // Determine if this is a high-value token (BTC, ETH, SOL) for decimal formatting
  // High value tokens show 5 decimals, low value (memecoins) show fewer
  const isHighValueToken = currentPrice >= 10;

  // Fetch orderbook with server-side aggregation
  const { orderBook, isLoading } = useOrderBook(symbol, aggLevel);

  // Process order book data
  const { processedAsks, processedBids, maxTotal, bidTotal, askTotal, spread, spreadPercent } = useMemo(() => {
    if (!orderBook || (orderBook.bids.length === 0 && orderBook.asks.length === 0)) {
      return { processedAsks: [], processedBids: [], maxTotal: 0, bidTotal: 0, askTotal: 0, spread: 0, spreadPercent: 0 };
    }

    // Take up to 10 levels for each side
    let askRunningTotal = 0;
    const asks = orderBook.asks.slice(0, 10).map((level) => {
      const displaySize = sizeMode === 'USD' ? level.size * level.price : level.size;
      askRunningTotal += displaySize;
      return { ...level, displaySize, total: askRunningTotal };
    });

    let bidRunningTotal = 0;
    const bids = orderBook.bids.slice(0, 10).map((level) => {
      const displaySize = sizeMode === 'USD' ? level.size * level.price : level.size;
      bidRunningTotal += displaySize;
      return { ...level, displaySize, total: bidRunningTotal };
    });

    // Calculate spread
    const bestBid = orderBook.bids[0]?.price || 0;
    const bestAsk = orderBook.asks[0]?.price || 0;
    const spreadValue = bestAsk > 0 && bestBid > 0 ? bestAsk - bestBid : 0;
    const spreadPct = bestBid > 0 ? (spreadValue / bestBid) * 100 : 0;

    return {
      processedAsks: asks.reverse(), // Show highest ask at top
      processedBids: bids,
      maxTotal: Math.max(askRunningTotal, bidRunningTotal),
      bidTotal: bidRunningTotal,
      askTotal: askRunningTotal,
      spread: spreadValue,
      spreadPercent: spreadPct,
    };
  }, [orderBook, sizeMode]);

  // Calculate buy/sell percentages
  const totalVolume = bidTotal + askTotal;
  const buyPercent = totalVolume > 0 ? (bidTotal / totalVolume) * 100 : 50;
  const sellPercent = totalVolume > 0 ? (askTotal / totalVolume) * 100 : 50;

  if (isLoading && !orderBook) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-surface-400 text-sm">Loading order book...</div>
      </div>
    );
  }

  // If no data after loading
  if (!orderBook || (processedAsks.length === 0 && processedBids.length === 0)) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-surface-400 text-sm">No order book data</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col text-xs overflow-hidden" style={{ contain: 'layout' }}>
      {/* Header with agg level and size mode selector */}
      <div className="flex-shrink-0 flex items-center justify-between px-2 py-1.5 border-surface-800">
        {/* Aggregation level — custom dropdown */}
        <div className="relative" ref={aggDropdownRef}>
          <button
            onClick={() => setAggDropdownOpen(!aggDropdownOpen)}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-surface-300 hover:text-white hover:bg-surface-800 transition-colors"
          >
            {aggOptions.find(o => o.level === aggLevel)?.displayValue ?? String(aggLevel)}
            <svg className={`w-3 h-3 text-surface-500 transition-transform ${aggDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {aggDropdownOpen && (
            <div className="absolute left-0 top-full mt-1 min-w-[72px] bg-surface-850 rounded-lg shadow-xl overflow-hidden z-50 py-1">
              {aggOptions.map((opt) => (
                <button
                  key={opt.level}
                  onClick={() => { setAggLevel(opt.level); setAggDropdownOpen(false); }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 text-xs transition-colors ${
                    aggLevel === opt.level
                      ? 'text-white bg-surface-700/50'
                      : 'text-surface-400 hover:text-white hover:bg-surface-800'
                  }`}
                >
                  <span>{opt.displayValue}</span>
                  {aggLevel === opt.level && (
                    <svg className="w-3 h-3 text-primary-400 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Size mode (USD/Token) — custom dropdown */}
        <div className="relative" ref={sizeModeDropdownRef}>
          <button
            onClick={() => setSizeModeDropdownOpen(!sizeModeDropdownOpen)}
            className="flex items-center gap-1  py-0.5 rounded text-xs text-surface-300 hover:text-white hover:bg-surface-800 transition-colors"
          >
            {sizeMode === 'USD' ? 'USD' : baseToken}
            <svg className={`w-3 h-3 text-surface-500 transition-transform ${sizeModeDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {sizeModeDropdownOpen && (
            <div className="absolute right-0 top-full mt-1 min-w-[72px] bg-surface-850 rounded-lg shadow-xl overflow-hidden z-50 py-1">
              {([{ value: 'USD' as const, label: 'USD' }, { value: 'TOKEN' as const, label: baseToken }]).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setSizeMode(opt.value); setSizeModeDropdownOpen(false); }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 text-xs transition-colors ${
                    sizeMode === opt.value
                      ? 'text-white bg-surface-700/50'
                      : 'text-surface-400 hover:text-white hover:bg-surface-800'
                  }`}
                >
                  <span>{opt.label}</span>
                  {sizeMode === opt.value && (
                    <svg className="w-3 h-3 text-primary-400 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Column headers - responsive: hide Size on narrow screens */}
      <div className="flex-shrink-0 grid grid-cols-2 sm:grid-cols-3 text-[10px] text-surface-400 px-2 py-1 border-surface-800 uppercase">
        <span>Price</span>
        <span className="hidden sm:block text-right">Size({sizeMode === 'USD' ? 'USD' : baseToken})</span>
        <span className="text-right">Total</span>
      </div>

      {/* Asks (sells) - flex-1 to fill available space, rows distribute evenly */}
      <div className="flex-1 flex flex-col justify-end overflow-hidden">
        {/* Empty placeholder rows to maintain stable layout */}
        {Array(Math.max(0, 10 - processedAsks.length)).fill(null).map((_, i) => (
          <div key={`ask-empty-${i}`} className="flex-1" />
        ))}
        {processedAsks.map((level) => (
          <div
            key={`ask-${level.price}`}
            className="relative flex-1 min-h-[28px] grid grid-cols-2 sm:grid-cols-3 text-xs px-2 cursor-pointer hover:bg-surface-700/30 items-center"
            onClick={() => onPriceClick?.(level.price)}
          >
            <div
              className="absolute inset-y-0 right-0 bg-gradient-to-l from-loss-500/30 to-loss-600/10 transition-[width] duration-300 ease-out"
              style={{ width: `${(level.total / maxTotal) * 100}%` }}
            />
            <span className="relative text-loss-400 tabular-nums tracking-tight">
              {formatPrice(level.price)}
            </span>
            <span className="relative hidden sm:block text-right text-surface-200 tabular-nums tracking-tight">
              {formatSize(level.displaySize, sizeMode === 'USD', isHighValueToken)}
            </span>
            <span className="relative text-right text-surface-200 tabular-nums tracking-tight">
              {formatSize(level.total, sizeMode === 'USD', isHighValueToken)}
            </span>
          </div>
        ))}
      </div>

      {/* Spread */}
      <div className="flex-shrink-0 px-2 py-1 border-surface-800 bg-surface-800/30 flex justify-between text-[10px] text-surface-400">
        <span>Spread</span>
        <span className="tabular-nums tracking-tight">{spread > 0 ? formatPrice(spread) : '-'}</span>
        <span className="tabular-nums tracking-tight">{spread > 0 ? spreadPercent.toFixed(3) + '%' : '-'}</span>
      </div>

      {/* Bids (buys) - flex-1 to fill available space, rows distribute evenly */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {processedBids.map((level) => (
          <div
            key={`bid-${level.price}`}
            className="relative flex-1 min-h-[28px] grid grid-cols-2 sm:grid-cols-3 text-xs px-2 cursor-pointer hover:bg-surface-700/30 items-center"
            onClick={() => onPriceClick?.(level.price)}
          >
            <div
              className="absolute inset-y-0 right-0 bg-gradient-to-l from-win-500/30 to-win-600/10 transition-[width] duration-300 ease-out"
              style={{ width: `${(level.total / maxTotal) * 100}%` }}
            />
            <span className="relative text-win-400 tabular-nums tracking-tight">
              {formatPrice(level.price)}
            </span>
            <span className="relative hidden sm:block text-right text-surface-200 tabular-nums tracking-tight">
              {formatSize(level.displaySize, sizeMode === 'USD', isHighValueToken)}
            </span>
            <span className="relative text-right text-surface-200 tabular-nums tracking-tight">
              {formatSize(level.total, sizeMode === 'USD', isHighValueToken)}
            </span>
          </div>
        ))}
        {/* Empty placeholder rows to maintain stable layout */}
        {Array(Math.max(0, 10 - processedBids.length)).fill(null).map((_, i) => (
          <div key={`bid-empty-${i}`} className="flex-1" />
        ))}
      </div>

      {/* Buy/Sell ratio bar — labels embedded in the bar */}
      <div className="flex-shrink-0 py-1.5 border-t border-surface-800">
        <div className="relative h-5 flex overflow-hidden">
          {/* Buy side */}
          <div
            className="h-full flex items-center bg-gradient-to-r from-win-500/30 to-win-600/10 transition-all duration-500 ease-out"
            style={{ width: `${buyPercent}%` }}
          >
            <span className="pl-1.5 text-[10px] text-win-400 font-semibold tabular-nums whitespace-nowrap">
              B {buyPercent.toFixed(0)}%
            </span>
          </div>
          {/* Sell side */}
          <div
            className="h-full flex items-center justify-end bg-gradient-to-l from-loss-500/30 to-loss-600/10 transition-all duration-500 ease-out"
            style={{ width: `${sellPercent}%` }}
          >
            <span className="pr-1.5 text-[10px] text-loss-400 font-semibold tabular-nums whitespace-nowrap">
              {sellPercent.toFixed(0)}% S
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
