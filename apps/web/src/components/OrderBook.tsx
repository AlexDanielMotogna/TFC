'use client';

import { useMemo, useState } from 'react';
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

// Valid agg_level values per docs: 1, 2, 5, 10, 100, 1000
const AGG_LEVELS: AggLevel[] = [1, 2, 5, 10, 100, 1000];

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

// Format size/total with commas and 2 decimals (like Pacifica)
const formatSize = (size: number): string => {
  if (size === 0) return '0.00';

  return size.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export function OrderBook({ symbol, currentPrice, tickSize = 0.01, onPriceClick }: OrderBookProps) {
  const baseToken = getBaseToken(symbol);

  // Aggregation level (server-side) - valid values: 1, 2, 5, 10, 100, 1000
  const [aggLevel, setAggLevel] = useState<AggLevel>(1);

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

  // Fetch orderbook with server-side aggregation
  const { orderBook, isLoading } = useOrderBook(symbol, aggLevel);

  // Process order book data
  const { processedAsks, processedBids, maxTotal, bidTotal, askTotal, spread, spreadPercent } = useMemo(() => {
    if (!orderBook || (orderBook.bids.length === 0 && orderBook.asks.length === 0)) {
      return { processedAsks: [], processedBids: [], maxTotal: 0, bidTotal: 0, askTotal: 0, spread: 0, spreadPercent: 0 };
    }

    // Take up to 20 levels for each side (will scroll if needed)
    let askRunningTotal = 0;
    const asks = orderBook.asks.slice(0, 20).map((level) => {
      const displaySize = sizeMode === 'USD' ? level.size * level.price : level.size;
      askRunningTotal += displaySize;
      return { ...level, displaySize, total: askRunningTotal };
    });

    let bidRunningTotal = 0;
    const bids = orderBook.bids.slice(0, 20).map((level) => {
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
    <div className="h-full flex flex-col text-xs overflow-hidden">
      {/* Header with agg level and size mode selector */}
      <div className="flex-shrink-0 flex items-center justify-between px-2 py-1.5 border-b border-surface-700">
        {/* Aggregation level selector (server-side) - shows actual tick values */}
        <div className="relative">
          <select
            value={aggLevel}
            onChange={(e) => setAggLevel(Number(e.target.value) as AggLevel)}
            className="bg-surface-800 border border-surface-600 rounded px-2 py-0.5 text-xs text-surface-300 cursor-pointer hover:border-surface-500"
          >
            {aggOptions.map((opt) => (
              <option key={opt.level} value={opt.level}>
                {opt.displayValue}
              </option>
            ))}
          </select>
        </div>

        {/* Size mode selector (USD/Token) - hidden on narrow screens where Size column is hidden */}
        <div className="relative hidden sm:block">
          <select
            value={sizeMode}
            onChange={(e) => setSizeMode(e.target.value as 'USD' | 'TOKEN')}
            className="bg-surface-800 border border-surface-600 rounded px-2 py-0.5 text-xs text-surface-300 cursor-pointer hover:border-surface-500"
          >
            <option value="USD">USD</option>
            <option value="TOKEN">{baseToken}</option>
          </select>
        </div>
      </div>

      {/* Column headers - responsive: hide Size on narrow screens */}
      <div className="flex-shrink-0 grid grid-cols-2 sm:grid-cols-3 text-[10px] text-surface-400 px-2 py-1 border-b border-surface-700 uppercase">
        <span>Price</span>
        <span className="hidden sm:block text-right">Size({sizeMode === 'USD' ? 'USD' : baseToken})</span>
        <span className="text-right">Total</span>
      </div>

      {/* Asks (sells) - show from bottom, no extra space */}
      <div className="flex flex-col justify-end gap-0.5">
        {processedAsks.map((level) => (
          <div
            key={`ask-${level.price}`}
            className="relative grid grid-cols-2 sm:grid-cols-3 text-xs px-2 py-0.5 cursor-pointer hover:bg-surface-700/30"
            onClick={() => onPriceClick?.(level.price)}
          >
            <div
              className="absolute inset-y-0 right-0 bg-gradient-to-l from-loss-500/30 to-loss-600/10 transition-[width] duration-[50ms] ease-out"
              style={{ width: `${(level.total / maxTotal) * 100}%` }}
            />
            <span className="relative text-loss-400 tabular-nums tracking-tight">
              {formatPrice(level.price)}
            </span>
            <span className="relative hidden sm:block text-right text-surface-300 tabular-nums tracking-tight">
              {formatSize(level.displaySize)}
            </span>
            <span className="relative text-right text-surface-400 tabular-nums tracking-tight">
              {formatSize(level.total)}
            </span>
          </div>
        ))}
      </div>

      {/* Spread */}
      <div className="flex-shrink-0 px-2 py-1 border-y border-surface-700 bg-surface-800/30 flex justify-between text-[10px] text-surface-400">
        <span>Spread</span>
        <span className="tabular-nums tracking-tight">{spread > 0 ? formatPrice(spread) : '-'}</span>
        <span className="tabular-nums tracking-tight">{spread > 0 ? spreadPercent.toFixed(3) + '%' : '-'}</span>
      </div>

      {/* Bids (buys) */}
      <div className="flex flex-col gap-0.5">
        {processedBids.map((level) => (
          <div
            key={`bid-${level.price}`}
            className="relative grid grid-cols-2 sm:grid-cols-3 text-xs px-2 py-0.5 cursor-pointer hover:bg-surface-700/30"
            onClick={() => onPriceClick?.(level.price)}
          >
            <div
              className="absolute inset-y-0 right-0 bg-gradient-to-l from-win-500/30 to-win-600/10 transition-[width] duration-[50ms] ease-out"
              style={{ width: `${(level.total / maxTotal) * 100}%` }}
            />
            <span className="relative text-win-400 tabular-nums tracking-tight">
              {formatPrice(level.price)}
            </span>
            <span className="relative hidden sm:block text-right text-surface-300 tabular-nums tracking-tight">
              {formatSize(level.displaySize)}
            </span>
            <span className="relative text-right text-surface-400 tabular-nums tracking-tight">
              {formatSize(level.total)}
            </span>
          </div>
        ))}
      </div>

      {/* Buy/Sell percentage bar */}
      <div className="flex-shrink-0 px-2 py-1.5 border-t border-surface-700">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-win-400 font-medium tabular-nums">
            {buyPercent.toFixed(1)}%
          </span>
          <div className="flex-1 h-1.5 bg-surface-800 rounded-full overflow-hidden flex">
            <div
              className="bg-win-500 transition-all duration-300"
              style={{ width: `${buyPercent}%` }}
            />
            <div
              className="bg-loss-500 transition-all duration-300"
              style={{ width: `${sellPercent}%` }}
            />
          </div>
          <span className="text-[10px] text-loss-400 font-medium tabular-nums">
            {sellPercent.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
}
