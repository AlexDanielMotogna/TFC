'use client';

import { useEffect, useRef, memo, useState } from 'react';
import { PacificaDatafeed, intervalToResolution, resolutionToInterval } from '@/lib/tradingview/PacificaDatafeed';
import { Spinner } from './Spinner';

interface TradingViewChartAdvancedProps {
  symbol: string;
  interval?: string;
  height?: number;
  currentPrice?: number;
  onSymbolChange?: (symbol: string) => void;
  onIntervalChange?: (interval: string) => void;
  onQuickOrder?: (price: number, side: 'LONG' | 'SHORT', clickY?: number) => void;
  onWidgetReady?: (widget: ChartWidget) => void;
}

// Context menu item returned by onContextMenu callback
interface ContextMenuItem {
  position: 'top' | 'bottom';
  text: string;
  click: () => void;
}

// Subscription interface from TradingView
interface ISubscription<T> {
  subscribe: (context: null, callback: T) => void;
  unsubscribe: (context: null, callback: T) => void;
}

// Chart widget instance type
export interface ChartWidget {
  onChartReady: (callback: () => void) => void;
  setSymbol: (symbol: string, resolution: string, callback?: () => void) => void;
  remove: () => void;
  subscribe: (event: string, callback: (...args: unknown[]) => void) => void;
  save: (callback: (state: object) => void) => void;
  onContextMenu: (callback: (unixTime: number, price: number) => ContextMenuItem[]) => void;
  activeChart: () => {
    createStudy: (name: string, forceOverlay: boolean, lock: boolean, inputs?: unknown[], overrides?: Record<string, unknown>) => Promise<unknown>;
    crossHairMoved: () => ISubscription<(params: { time: number; price: number }) => void>;
    // Shape drawing API (TradingView Advanced Charting Library)
    createShape: (point: { time: number; price: number }, options: Record<string, unknown>) => unknown;
    removeShape: (shapeId: unknown) => void;
    removeEntity: (entityId: unknown) => void;
    removeAllShapes: () => void;
  };
}

function TradingViewChartAdvancedComponent({
  symbol,
  interval = '5m',
  height = 460,
  currentPrice = 0,
  onSymbolChange,
  onIntervalChange,
  onQuickOrder,
  onWidgetReady,
}: TradingViewChartAdvancedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<ChartWidget | null>(null);
  const isReadyRef = useRef(false);
  const onQuickOrderRef = useRef(onQuickOrder);
  const onWidgetReadyRef = useRef(onWidgetReady);
  const currentPriceRef = useRef(currentPrice);
  currentPriceRef.current = currentPrice;
  onQuickOrderRef.current = onQuickOrder;
  onWidgetReadyRef.current = onWidgetReady;
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [isChartReady, setIsChartReady] = useState(false);

  // Floating "+" button — uses direct DOM manipulation for instant response (no re-renders).
  const plusBtnRef = useRef<HTMLElement>(null);
  const crosshairPriceRef = useRef(0);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Convert app interval to TradingView resolution
  const tvResolution = intervalToResolution(interval);

  // Attach mouse tracking to iframe contentDocument for Y position.
  // crossHairMoved gives us the price; iframe mousemove gives us the pixel Y.
  // All updates go directly to the DOM element (no setState = no lag).
  useEffect(() => {
    if (!isChartReady || !containerRef.current) return;

    const container = containerRef.current;
    const btn = plusBtnRef.current;
    if (!btn) return;

    const cleanups: (() => void)[] = [];

    // Show/hide/position the "+" button + update side color.
    const updateButton = (y: number) => {
      if (!onQuickOrderRef.current || y < 30 || y > (height - 30)) {
        btn.style.display = 'none';
        return;
      }
      btn.style.display = 'flex';
      btn.style.top = `${y}px`;

      // Update side color based on price vs current price
      const price = crosshairPriceRef.current;
      const cp = currentPriceRef.current;
      if (price > 0 && cp > 0) {
        const isLong = price < cp;
        btn.style.backgroundColor = isLong ? 'rgba(38, 166, 154, 0.85)' : 'rgba(239, 83, 80, 0.85)';
      }

      // Reset hide timeout
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = setTimeout(() => { btn.style.display = 'none'; }, 2000);
    };
    const hideButton = () => {
      btn.style.display = 'none';
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };

    // Track mouse Y from iframe contentDocument (same-origin).
    // Button has pointer-events:none so mouse always reaches the iframe,
    // keeping crossHairMoved alive even when cursor is "over" the button.
    const iframe = container.querySelector('iframe');
    if (iframe) {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (iframeDoc) {
          const onIframeMove = (e: MouseEvent) => {
            const iframeRect = iframe.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            const y = e.clientY + (iframeRect.top - containerRect.top);
            updateButton(y);
          };
          const onIframeLeave = () => {
            if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
            hideTimeoutRef.current = setTimeout(() => { btn.style.display = 'none'; }, 200);
          };
          // Detect clicks in the button zone from the iframe
          const onIframeClick = (e: MouseEvent) => {
            if (btn.style.display === 'none') return;
            const iframeRect = iframe.getBoundingClientRect();
            const btnRect = btn.getBoundingClientRect();
            // Convert iframe-local coords to page coords
            const pageX = e.clientX + iframeRect.left;
            const pageY = e.clientY + iframeRect.top;
            if (pageX >= btnRect.left && pageX <= btnRect.right &&
                pageY >= btnRect.top && pageY <= btnRect.bottom) {
              const price = crosshairPriceRef.current;
              const cp = currentPriceRef.current;
              if (price && cp && onQuickOrderRef.current) {
                const side: 'LONG' | 'SHORT' = price < cp ? 'LONG' : 'SHORT';
                // Pass Y relative to the container so the overlay can position near the click
                const containerRect = container.getBoundingClientRect();
                const clickY = e.clientY + iframeRect.top - containerRect.top;
                onQuickOrderRef.current(price, side, clickY);
              }
            }
          };
          iframeDoc.addEventListener('mousemove', onIframeMove);
          iframeDoc.addEventListener('mouseleave', onIframeLeave);
          iframeDoc.addEventListener('click', onIframeClick);
          cleanups.push(() => {
            try {
              iframeDoc.removeEventListener('mousemove', onIframeMove);
              iframeDoc.removeEventListener('mouseleave', onIframeLeave);
              iframeDoc.removeEventListener('click', onIframeClick);
            } catch { /* ignore */ }
          });
        }
      } catch { /* cross-origin — fallback below */ }
    }

    // Fallback: listen on main document (for non-iframe rendering)
    const onDocMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      if (e.clientX >= rect.left && e.clientX <= rect.right &&
          e.clientY >= rect.top && e.clientY <= rect.bottom) {
        updateButton(e.clientY - rect.top);
      } else {
        hideButton();
      }
    };
    document.addEventListener('mousemove', onDocMove);
    cleanups.push(() => document.removeEventListener('mousemove', onDocMove));

    return () => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
      cleanups.forEach((fn) => fn());
    };
  }, [isChartReady, height]);

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

    // Persist chart drawings/studies to localStorage
    const CHART_STATE_KEY = 'tfc_tv_chart_state';

    // Restore saved chart state (drawings, indicators, etc.)
    let savedState: object | undefined;
    try {
      const raw = localStorage.getItem(CHART_STATE_KEY);
      if (raw) {
        savedState = JSON.parse(raw);
        console.log('[TradingView] Restoring saved chart state from localStorage', Object.keys(savedState || {}));
      } else {
        console.log('[TradingView] No saved chart state found in localStorage');
      }
    } catch (e) { console.warn('[TradingView] Failed to parse saved state:', e); }

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
      auto_save_delay: 3,
      saved_data: savedState,
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
        'paneProperties.separatorColor': '#111113',
        'paneProperties.crossHairProperties.color': '#9ca3af',
        'scalesProperties.textColor': '#9ca3af',
        'scalesProperties.backgroundColor': '#111113',
        'scalesProperties.lineColor': '#111113',
        'scalesProperties.fontSize': 11,
        'scalesProperties.showSeriesBorderLine': false,
        'scalesProperties.showStudyBorderLine': false,
        'scalesProperties.showPriceScaleBorderLine': false,
        'scalesProperties.showTimeScaleBorderLine': false,
        'mainSeriesProperties.candleStyle.upColor': '#26A69A',
        'mainSeriesProperties.candleStyle.downColor': '#EF5350',
        'mainSeriesProperties.candleStyle.borderUpColor': '#26A69A',
        'mainSeriesProperties.candleStyle.borderDownColor': '#EF5350',
        'mainSeriesProperties.candleStyle.wickUpColor': '#26A69A',
        'mainSeriesProperties.candleStyle.wickDownColor': '#EF5350',
      },

      studies_overrides: {
        'volume.volume.color.0': 'rgba(239, 83, 80, 0.5)',
        'volume.volume.color.1': 'rgba(38, 166, 154, 0.5)',
        'volume.volume ma.color': '#FF6D00',
        'volume.volume ma.visible': false,
      },

      // Custom font
      custom_font_family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif",

      disabled_features: [
        'header_symbol_search',
        'header_compare',
        'header_undo_redo',
        'header_screenshot',
        'control_bar',
        'timeframes_toolbar',
        'symbol_info',
        'symbol_search_hot_key',
        'popup_hints',
        'create_volume_indicator_by_default',
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const widget = new window.TradingView.widget(widgetOptions as any) as unknown as ChartWidget;
      widgetRef.current = widget;

      widget.onChartReady(() => {
        console.log('[TradingView] Chart ready');
        isReadyRef.current = true;
        setIsChartReady(true);

        // Force initial canvas paint even if behind a z-index overlay (e.g., fight video).
        // TradingView defers canvas rendering when occluded; a resize forces it to draw.
        setTimeout(() => window.dispatchEvent(new Event('resize')), 100);

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

        // Add default indicators only on first load (no saved state)
        if (!savedState) {
          const chart = widget.activeChart();

          // Volume as overlay on main chart (compact, no separate panel)
          chart.createStudy('Volume', true, false, [], {
            'volume.color.0': 'rgba(239, 83, 80, 0.35)',
            'volume.color.1': 'rgba(38, 166, 154, 0.35)',
            'volume ma.visible': false,
          });

          // EMA indicators
          const emas = [
            { length: 5, color: '#FF6D00' },
            { length: 10, color: '#2962FF' },
            { length: 30, color: '#E91E63' },
            { length: 60, color: '#9C27B0' },
          ];
          emas.forEach(({ length, color }) => {
            chart.createStudy('Moving Average Exponential', true, false, [length], {
              'Plot.color': color,
              'Plot.linewidth': 1,
            });
          });
        }

        // Auto-save chart state (drawings, studies, etc.) to localStorage
        widget.subscribe('onAutoSaveNeeded', () => {
          console.log('[TradingView] Auto-save triggered');
          widget.save((state: object) => {
            try {
              const json = JSON.stringify(state);
              localStorage.setItem(CHART_STATE_KEY, json);
              console.log('[TradingView] Chart state saved to localStorage', (json.length / 1024).toFixed(1) + 'KB');
            } catch (e) { console.warn('[TradingView] Failed to save chart state:', e); }
          });
        });

        // Quick order via right-click context menu
        widget.onContextMenu((_unixTime: number, price: number) => {
          const formattedPrice = price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          const items: ContextMenuItem[] = [];
          if (onQuickOrderRef.current && currentPriceRef.current > 0) {
            if (price < currentPriceRef.current) {
              // Below current price → Limit Buy
              items.push({
                position: 'top',
                text: `Limit Buy at $${formattedPrice}`,
                click: () => onQuickOrderRef.current?.(price, 'LONG'),
              });
            } else {
              // Above current price → Limit Sell
              items.push({
                position: 'top',
                text: `Limit Sell at $${formattedPrice}`,
                click: () => onQuickOrderRef.current?.(price, 'SHORT'),
              });
            }
          }
          return items;
        });

        // Track crosshair price for floating "+" button (ref only, no re-renders).
        // Also live-update the price label on the button.
        try {
          const chart = widget.activeChart();
          chart.crossHairMoved().subscribe(null, (params: { time: number; price: number }) => {
            if (params.price > 0) {
              crosshairPriceRef.current = params.price;
              // Live-update side color on the floating button if visible
              const btn = plusBtnRef.current;
              if (btn && btn.style.display !== 'none') {
                const cp = currentPriceRef.current;
                if (cp > 0) {
                  const isLong = params.price < cp;
                  btn.style.backgroundColor = isLong ? 'rgba(38, 166, 154, 0.85)' : 'rgba(239, 83, 80, 0.85)';
                }
              }
            }
          });
        } catch (e) {
          console.warn('[TradingView] crossHairMoved not available:', e);
        }

        // Notify external consumers that the widget is ready for drawing
        onWidgetReadyRef.current?.(widget);

      });
    } catch (error) {
      console.error('[TradingView] Failed to create widget:', error);
    }

    return () => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
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

      {/* Floating "+" button with price — pointer-events:none so mouse passes to iframe */}
      {onQuickOrder && (
        <div
          ref={plusBtnRef as React.RefObject<HTMLDivElement>}
          className="absolute flex items-center justify-center w-5 h-5 rounded-full text-white select-none pointer-events-none"
          style={{
            display: 'none',
            right: 58,
            top: 0,
            transform: 'translateY(-50%)',
            zIndex: 10,
            backgroundColor: 'rgba(75, 85, 99, 0.85)',
          }}
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </div>
      )}

      {/* TFC watermark logo */}
      {isChartReady && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[1]">
          <img
            src="/images/logos/favicon-white-192.png"
            alt=""
            className="w-24 h-24 opacity-[0.04] select-none"
            draggable={false}
          />
        </div>
      )}

      {!isChartReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#111113]">
          <div className="flex flex-col items-center gap-3">
            <Spinner size="md" />
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
