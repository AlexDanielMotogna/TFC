'use client';

import { useEffect, useRef, memo, useState } from 'react';
import { PacificaDatafeed, intervalToResolution, resolutionToInterval } from '@/lib/tradingview/PacificaDatafeed';

interface TradingViewChartAdvancedProps {
  symbol: string;
  interval?: string;
  height?: number;
  onSymbolChange?: (symbol: string) => void;
  onIntervalChange?: (interval: string) => void;
}

// Chart widget instance type
interface ChartWidget {
  onChartReady: (callback: () => void) => void;
  setSymbol: (symbol: string, resolution: string, callback?: () => void) => void;
  remove: () => void;
  subscribe: (event: string, callback: (...args: unknown[]) => void) => void;
}

function TradingViewChartAdvancedComponent({
  symbol,
  interval = '5m',
  height = 460,
  onSymbolChange,
  onIntervalChange,
}: TradingViewChartAdvancedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<ChartWidget | null>(null);
  const isReadyRef = useRef(false);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [isChartReady, setIsChartReady] = useState(false);

  // Convert app interval to TradingView resolution
  const tvResolution = intervalToResolution(interval);

  // Load TradingView script
  useEffect(() => {
    if (window.TradingView) {
      setIsScriptLoaded(true);
      return;
    }

    const existingScript = document.querySelector('script[src*="charting_library"]');
    if (existingScript) {
      const checkLoaded = setInterval(() => {
        if (window.TradingView) {
          setIsScriptLoaded(true);
          clearInterval(checkLoaded);
        }
      }, 100);
      return () => clearInterval(checkLoaded);
    }

    const script = document.createElement('script');
    script.src = '/charting_library/charting_library.standalone.js';
    script.async = true;
    script.onload = () => {
      console.log('[TradingView] Script loaded');
      setIsScriptLoaded(true);
    };
    script.onerror = (error) => {
      console.error('[TradingView] Failed to load script:', error);
    };
    document.head.appendChild(script);

    return () => {};
  }, []);

  // Initialize widget after script loads
  useEffect(() => {
    if (!isScriptLoaded || !containerRef.current) return;

    if (!window.TradingView) {
      console.error('[TradingView] Library not available after script load');
      return;
    }

    const widgetOptions = {
      container: containerRef.current,
      library_path: '/charting_library/',
      datafeed: new PacificaDatafeed(),
      symbol: symbol,
      interval: tvResolution,
      locale: 'en',
      timezone: 'Etc/UTC',
      theme: 'dark',
      fullscreen: false,
      autosize: true,
      debug: false,
      toolbar_bg: '#111113',
      custom_css_url: '/tradingview-custom.css',
      loading_screen: {
        backgroundColor: '#111113',
        foregroundColor: '#6366f1',
      },

      overrides: {
        'paneProperties.background': '#111113',
        'paneProperties.backgroundGradientStartColor': '#111113',
        'paneProperties.backgroundGradientEndColor': '#111113',
        'paneProperties.backgroundType': 'solid',
        'paneProperties.vertGridProperties.color': 'rgba(255, 255, 255, 0.05)',
        'paneProperties.horzGridProperties.color': 'rgba(255, 255, 255, 0.05)',
        'paneProperties.separatorColor': '#1f1f23',
        'scalesProperties.textColor': '#9ca3af',
        'scalesProperties.backgroundColor': '#111113',
        'scalesProperties.lineColor': '#1f1f23',
        'scalesProperties.fontSize': 11,
        'mainSeriesProperties.candleStyle.upColor': '#26A69A',
        'mainSeriesProperties.candleStyle.downColor': '#EF5350',
        'mainSeriesProperties.candleStyle.borderUpColor': '#26A69A',
        'mainSeriesProperties.candleStyle.borderDownColor': '#EF5350',
        'mainSeriesProperties.candleStyle.wickUpColor': '#26A69A',
        'mainSeriesProperties.candleStyle.wickDownColor': '#EF5350',
      },

      // Custom font
      custom_font_family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif",

      disabled_features: [
        'header_symbol_search',
        'header_compare',
        'header_undo_redo',
        'header_screenshot',
        'header_fullscreen_button',
        'control_bar',
        'volume_force_overlay',
        'symbol_info',
        'symbol_search_hot_key',
        'popup_hints',
      ],

      enabled_features: [
        'hide_left_toolbar_by_default',
        'move_logo_to_main_pane',
        'dont_show_boolean_study_arguments',
        'hide_last_na_study_output',
      ],
    };

    try {
      console.log('[TradingView] Creating widget...');
      const widget = new window.TradingView.widget(widgetOptions) as unknown as ChartWidget;
      widgetRef.current = widget;

      widget.onChartReady(() => {
        console.log('[TradingView] Chart ready');
        isReadyRef.current = true;
        setIsChartReady(true);

        widget.subscribe('onSymbolChanged', (...args: unknown[]) => {
          const symbolData = args[0] as { name?: string } | undefined;
          if (symbolData?.name && onSymbolChange) {
            onSymbolChange(symbolData.name);
          }
        });

        widget.subscribe('onIntervalChanged', (...args: unknown[]) => {
          const newResolution = args[0] as string | undefined;
          if (newResolution && onIntervalChange) {
            onIntervalChange(resolutionToInterval(newResolution));
          }
        });
      });
    } catch (error) {
      console.error('[TradingView] Failed to create widget:', error);
    }

    return () => {
      if (widgetRef.current) {
        try {
          widgetRef.current.remove();
        } catch { /* ignore */ }
        widgetRef.current = null;
      }
      isReadyRef.current = false;
      setIsChartReady(false);
    };
  }, [isScriptLoaded]);

  // Update symbol/interval when props change
  useEffect(() => {
    if (!widgetRef.current || !isReadyRef.current) return;

    try {
      widgetRef.current.setSymbol(symbol, tvResolution, () => {
        console.log(`[TradingView] Changed to ${symbol} ${tvResolution}`);
      });
    } catch (error) {
      console.error('[TradingView] Failed to change symbol:', error);
    }
  }, [symbol, tvResolution]);

  return (
    <div
      className="relative w-full"
      style={{ height }}
    >
      <div
        ref={containerRef}
        className="absolute inset-0"
        style={{ background: '#111113' }}
      />

      {!isChartReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#111113]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-surface-600 border-t-primary-500 rounded-full animate-spin" />
            <span className="text-sm text-surface-400">
              {!isScriptLoaded ? 'Loading TradingView...' : 'Initializing chart...'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export const TradingViewChartAdvanced = memo(TradingViewChartAdvancedComponent);
