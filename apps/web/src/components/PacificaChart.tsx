'use client';

import { useEffect, useRef, memo, useMemo, useCallback, useState } from 'react';
import {
  createChart,
  ColorType,
  CandlestickSeries,
  HistogramSeries,
} from 'lightweight-charts';
import type {
  IChartApi,
  ISeriesApi,
  CandlestickData,
  HistogramData,
  Time,
  MouseEventParams,
  IPriceLine,
} from 'lightweight-charts';
import { useCandles } from '@/hooks/useCandles';

// Drawing tools types
type DrawingTool = 'cursor' | 'hline';

interface HorizontalLine {
  id: string;
  price: number;
  color: string;
  lineWidth: 1 | 2 | 3 | 4;
  lineStyle: 0 | 1 | 2 | 3; // Solid, Dotted, Dashed, LargeDashed
  label: string;
}

interface PacificaChartProps {
  symbol: string;
  interval?: '1m' | '3m' | '5m' | '15m' | '30m' | '1h' | '2h' | '4h' | '8h' | '12h' | '1d';
  height?: number;
  entryPrice?: number;
  takeProfit?: number;
  stopLoss?: number;
}

function PacificaChartComponent({
  symbol,
  interval = '5m',
  height = 400,
  entryPrice,
  takeProfit,
  stopLoss,
}: PacificaChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const hasInitiallyScrolled = useRef(false);

  // Drawing state
  const [activeTool, setActiveTool] = useState<DrawingTool>('cursor');
  const [horizontalLines, setHorizontalLines] = useState<HorizontalLine[]>([]);
  const [previewPrice, setPreviewPrice] = useState<number | null>(null);

  // Track price line references for proper removal
  const userPriceLinesRef = useRef<Map<string, IPriceLine>>(new Map());
  const positionPriceLinesRef = useRef<IPriceLine[]>([]);
  const previewLineRef = useRef<IPriceLine | null>(null);

  // Crosshair data for OHLCV display
  const [crosshairData, setCrosshairData] = useState<{
    time: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    change: number;
    changePercent: number;
  } | null>(null);

  const { candles, isConnected, isLoading, isLoadingMore, loadMoreHistory } = useCandles(symbol, interval);

  // Convert candles to chart format with deduplication using Map
  const { candleData, volumeData } = useMemo(() => {
    if (!candles || candles.length === 0) {
      return { candleData: [], volumeData: [] };
    }

    // Deduplicate by timestamp using Map (keeps last occurrence)
    const uniqueCandles = Array.from(
      new Map(candles.map((candle) => [candle.time, candle])).values()
    ).sort((a, b) => a.time - b.time);

    const candleChartData: CandlestickData<Time>[] = uniqueCandles.map((candle) => ({
      time: candle.time as Time,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    }));

    const volumeChartData: HistogramData<Time>[] = uniqueCandles.map((candle) => ({
      time: candle.time as Time,
      value: candle.volume,
      color: candle.close >= candle.open
        ? 'rgba(34, 197, 94, 0.5)'   // Green for bullish
        : 'rgba(239, 68, 68, 0.5)',  // Red for bearish
    }));

    return { candleData: candleChartData, volumeData: volumeChartData };
  }, [candles]);

  // Initialize chart
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: height,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      crosshair: {
        mode: 1, // Normal
        vertLine: {
          color: '#6366f1',
          labelBackgroundColor: '#6366f1',
        },
        horzLine: {
          color: '#6366f1',
          labelBackgroundColor: '#6366f1',
        },
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        scaleMargins: {
          top: 0.1,
          bottom: 0.2, // Make room for volume
        },
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 12,
        barSpacing: 6,
        minBarSpacing: 2,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    });

    // Candlestick series
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    // Volume series (histogram at bottom)
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: '', // Overlay on main chart
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 }, // Volume takes bottom 20%
    });

    chartRef.current = chart;
    candleSeriesRef.current = candlestickSeries;
    volumeSeriesRef.current = volumeSeries;

    // Crosshair move handler for OHLCV display
    chart.subscribeCrosshairMove((param: MouseEventParams) => {
      if (!param.time || !param.seriesData) {
        setCrosshairData(null);
        return;
      }

      const candleData = param.seriesData.get(candlestickSeries) as CandlestickData<Time> | undefined;
      const volumeData = param.seriesData.get(volumeSeries) as HistogramData<Time> | undefined;

      if (candleData && 'open' in candleData) {
        const change = candleData.close - candleData.open;
        const changePercent = (change / candleData.open) * 100;

        // Format time
        const date = new Date((param.time as number) * 1000);
        const timeStr = date.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });

        setCrosshairData({
          time: timeStr,
          open: candleData.open,
          high: candleData.high,
          low: candleData.low,
          close: candleData.close,
          volume: volumeData?.value || 0,
          change,
          changePercent,
        });
      }
    });

    // Handle resize
    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight || height,
        });
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Call immediately

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, [height]);

  // Update chart data
  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current || !chartRef.current) return;
    if (candleData.length === 0) return;

    candleSeriesRef.current.setData(candleData);
    volumeSeriesRef.current.setData(volumeData);

    // Scroll to latest candle on initial load
    if (!hasInitiallyScrolled.current && candleData.length > 0) {
      chartRef.current.timeScale().scrollToPosition(5, false);
      hasInitiallyScrolled.current = true;
    }
  }, [candleData, volumeData]);

  // Reset scroll flag when symbol or interval changes
  useEffect(() => {
    hasInitiallyScrolled.current = false;
  }, [symbol, interval]);

  // Add position price lines (Entry, TP, SL)
  useEffect(() => {
    if (!candleSeriesRef.current) return;

    const series = candleSeriesRef.current;

    // Remove existing position price lines first
    positionPriceLinesRef.current.forEach((priceLine) => {
      series.removePriceLine(priceLine);
    });
    positionPriceLinesRef.current = [];

    // Add entry price line
    if (entryPrice) {
      const line = series.createPriceLine({
        price: entryPrice,
        color: '#6366f1',
        lineWidth: 1,
        lineStyle: 2, // Dashed
        axisLabelVisible: true,
        title: 'Entry',
      });
      positionPriceLinesRef.current.push(line);
    }

    // Add take profit line
    if (takeProfit) {
      const line = series.createPriceLine({
        price: takeProfit,
        color: '#22c55e',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'TP',
      });
      positionPriceLinesRef.current.push(line);
    }

    // Add stop loss line
    if (stopLoss) {
      const line = series.createPriceLine({
        price: stopLoss,
        color: '#ef4444',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'SL',
      });
      positionPriceLinesRef.current.push(line);
    }
  }, [entryPrice, takeProfit, stopLoss]);

  // Add user horizontal lines
  useEffect(() => {
    if (!candleSeriesRef.current) return;

    const series = candleSeriesRef.current;

    // Get current line IDs
    const currentLineIds = new Set(horizontalLines.map((l) => l.id));

    // Remove lines that are no longer in state
    userPriceLinesRef.current.forEach((priceLine, id) => {
      if (!currentLineIds.has(id)) {
        series.removePriceLine(priceLine);
        userPriceLinesRef.current.delete(id);
      }
    });

    // Add new lines (those not already tracked)
    horizontalLines.forEach((line) => {
      if (!userPriceLinesRef.current.has(line.id)) {
        const priceLine = series.createPriceLine({
          price: line.price,
          color: line.color,
          lineWidth: line.lineWidth,
          lineStyle: line.lineStyle,
          axisLabelVisible: true,
          title: line.label,
        });
        userPriceLinesRef.current.set(line.id, priceLine);
      }
    });
  }, [horizontalLines]);

  // Infinite scroll - load more history when user scrolls left
  useEffect(() => {
    if (!chartRef.current) return;

    const chart = chartRef.current;

    const handleRangeChange = () => {
      const logicalRange = chart.timeScale().getVisibleLogicalRange();

      if (logicalRange !== null) {
        // If user scrolled near the left edge (< 50 bars from start), load more
        if (logicalRange.from < 50 && !isLoadingMore) {
          loadMoreHistory();
        }
      }
    };

    chart.timeScale().subscribeVisibleLogicalRangeChange(handleRangeChange);

    return () => {
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleRangeChange);
    };
  }, [loadMoreHistory, isLoadingMore]);

  // Handle chart click for drawing tools
  const handleChartClick = useCallback((e: React.MouseEvent) => {
    if (!chartRef.current || !candleSeriesRef.current || activeTool === 'cursor') return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const y = e.clientY - rect.top;

    // Convert pixel coordinate to price
    const priceCoord = candleSeriesRef.current.coordinateToPrice(y);

    if (priceCoord === null) return;

    if (activeTool === 'hline') {
      // Add horizontal line at clicked price
      const newLine: HorizontalLine = {
        id: `hline-${Date.now()}`,
        price: priceCoord,
        color: '#f59e0b',
        lineWidth: 1,
        lineStyle: 0, // Solid
        label: `$${priceCoord.toFixed(2)}`,
      };
      setHorizontalLines((prev) => [...prev, newLine]);
      setActiveTool('cursor'); // Reset to cursor after drawing
    }
  }, [activeTool]);

  // Clear all drawings
  const clearAllDrawings = useCallback(() => {
    // Remove all user price lines from chart
    if (candleSeriesRef.current) {
      userPriceLinesRef.current.forEach((priceLine) => {
        candleSeriesRef.current?.removePriceLine(priceLine);
      });
      userPriceLinesRef.current.clear();
    }
    setHorizontalLines([]);
  }, []);

  // Format price for display
  const formatPrice = (price: number) => {
    if (price >= 10000) return price.toFixed(0);
    if (price >= 100) return price.toFixed(2);
    if (price >= 1) return price.toFixed(4);
    return price.toFixed(6);
  };

  // Format volume for display
  const formatVolume = (vol: number) => {
    if (vol >= 1e9) return `${(vol / 1e9).toFixed(2)}B`;
    if (vol >= 1e6) return `${(vol / 1e6).toFixed(2)}M`;
    if (vol >= 1e3) return `${(vol / 1e3).toFixed(2)}K`;
    return vol.toFixed(2);
  };

  return (
    <div className="relative w-full h-full">
      {/* Toolbar */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1 bg-surface-800/90 rounded-lg p-1 border border-surface-700">
        <button
          onClick={() => setActiveTool('cursor')}
          className={`p-1.5 rounded transition-colors ${
            activeTool === 'cursor' ? 'bg-primary-500 text-white' : 'text-surface-400 hover:text-white hover:bg-surface-700'
          }`}
          title="Cursor"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
          </svg>
        </button>
        <button
          onClick={() => setActiveTool('hline')}
          className={`p-1.5 rounded transition-colors ${
            activeTool === 'hline' ? 'bg-primary-500 text-white' : 'text-surface-400 hover:text-white hover:bg-surface-700'
          }`}
          title="Horizontal Line"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12h16" />
          </svg>
        </button>
        <div className="w-px h-4 bg-surface-600 mx-1" />
        <button
          onClick={clearAllDrawings}
          className="p-1.5 rounded text-surface-400 hover:text-loss-400 hover:bg-surface-700 transition-colors"
          title="Clear All"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {/* OHLCV Display */}
      {crosshairData && (
        <div className="absolute top-2 left-2 z-10 flex items-center gap-3 bg-surface-800/90 rounded-lg px-3 py-1.5 border border-surface-700 text-xs font-mono">
          <span className="text-surface-400">{crosshairData.time}</span>
          <span className="text-surface-500">O</span>
          <span className="text-white">{formatPrice(crosshairData.open)}</span>
          <span className="text-surface-500">H</span>
          <span className="text-white">{formatPrice(crosshairData.high)}</span>
          <span className="text-surface-500">L</span>
          <span className="text-white">{formatPrice(crosshairData.low)}</span>
          <span className="text-surface-500">C</span>
          <span className={crosshairData.change >= 0 ? 'text-win-400' : 'text-loss-400'}>
            {formatPrice(crosshairData.close)}
          </span>
          <span className={`${crosshairData.change >= 0 ? 'text-win-400' : 'text-loss-400'}`}>
            {crosshairData.change >= 0 ? '+' : ''}{crosshairData.changePercent.toFixed(2)}%
          </span>
          <span className="text-surface-500">Vol</span>
          <span className="text-surface-300">{formatVolume(crosshairData.volume)}</span>
        </div>
      )}

      {/* Connection status - moved down when OHLCV is showing */}
      {!crosshairData && (
        <div className="absolute top-2 left-2 flex items-center gap-2 text-xs">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-win-400' : 'bg-loss-400'}`} />
          <span className="text-surface-400">
            {isConnected ? 'Live' : 'Connecting...'}
          </span>
          {isLoadingMore && (
            <>
              <span className="text-surface-500">|</span>
              <span className="text-surface-400">Loading more...</span>
            </>
          )}
        </div>
      )}

      {/* Drawing mode indicator */}
      {activeTool === 'hline' && (
        <div className="absolute bottom-2 left-2 z-10 bg-primary-500/20 border border-primary-500/50 rounded px-2 py-1 text-xs text-primary-400">
          Click to place horizontal line
        </div>
      )}

      {/* Chart container */}
      <div
        ref={containerRef}
        className="w-full"
        style={{ height: `${height}px`, cursor: activeTool !== 'cursor' ? 'crosshair' : 'default' }}
        onClick={handleChartClick}
      />

      {/* Loading state */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface-900/80">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full mx-auto mb-2" />
            <p className="text-surface-400 text-sm">Loading chart data...</p>
          </div>
        </div>
      )}
    </div>
  );
}

export const PacificaChart = memo(PacificaChartComponent);
