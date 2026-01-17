'use client';

import { useEffect, useRef, memo } from 'react';

interface TradingViewChartProps {
  symbol: string;
  interval?: string;
  theme?: 'dark' | 'light';
  height?: number;
}

// Convert app intervals to TradingView format
// App uses: '1m', '5m', '15m', '1h', '4h', '1d'
// TradingView uses: '1', '5', '15', '60', '240', 'D'
const intervalMap: Record<string, string> = {
  '1m': '1',
  '3m': '3',
  '5m': '5',
  '15m': '15',
  '30m': '30',
  '1h': '60',
  '2h': '120',
  '4h': '240',
  '8h': '480',
  '12h': '720',
  '1d': 'D',
  '1w': 'W',
};

function TradingViewChartComponent({
  symbol,
  interval = '5m',
  theme = 'dark',
  height = 400,
}: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear previous widget
    if (widgetRef.current) {
      containerRef.current.innerHTML = '';
    }

    // Convert interval to TradingView format
    const tvInterval = intervalMap[interval] || interval;

    // Map Pacifica symbols to TradingView perpetual symbols
    const tvSymbolMap: Record<string, string> = {
      'BTC-USD': 'BINANCE:BTCUSDT.P',
      'ETH-USD': 'BINANCE:ETHUSDT.P',
      'SOL-USD': 'BINANCE:SOLUSDT.P',
      'HYPE-USD': 'BYBIT:HYPEUSDT.P',
      'XRP-USD': 'BINANCE:XRPUSDT.P',
      'DOGE-USD': 'BINANCE:DOGEUSDT.P',
      'LINK-USD': 'BINANCE:LINKUSDT.P',
      'AVAX-USD': 'BINANCE:AVAXUSDT.P',
      'SUI-USD': 'BINANCE:SUIUSDT.P',
      'BNB-USD': 'BINANCE:BNBUSDT.P',
      'AAVE-USD': 'BINANCE:AAVEUSDT.P',
      'ARB-USD': 'BINANCE:ARBUSDT.P',
      'OP-USD': 'BINANCE:OPUSDT.P',
      'APT-USD': 'BINANCE:APTUSDT.P',
      'INJ-USD': 'BINANCE:INJUSDT.P',
      'TIA-USD': 'BINANCE:TIAUSDT.P',
      'SEI-USD': 'BINANCE:SEIUSDT.P',
      'WIF-USD': 'BINANCE:WIFUSDT.P',
      'JUP-USD': 'BYBIT:JUPUSDT.P',
      'PENDLE-USD': 'BINANCE:PENDLEUSDT.P',
      'RENDER-USD': 'BINANCE:RENDERUSDT.P',
      'FET-USD': 'BINANCE:FETUSDT.P',
      'ZEC-USD': 'BINANCE:ZECUSDT.P',
      'PAXG-USD': 'BINANCE:PAXGUSDT',
      'ENA-USD': 'BINANCE:ENAUSDT.P',
      'KPEPE-USD': 'BINANCE:1000PEPEUSDT.P',
      'WLD-USD': 'BINANCE:WLDUSDT.P',
      'STX-USD': 'BINANCE:STXUSDT.P',
      'IMX-USD': 'BINANCE:IMXUSDT.P',
    };

    const tvSymbol = tvSymbolMap[symbol] || 'BINANCE:BTCUSDT.P';

    // Create TradingView widget
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: tvSymbol,
      interval: tvInterval,
      timezone: 'Etc/UTC',
      theme: theme,
      style: '1',
      locale: 'en',
      enable_publishing: false,
      backgroundColor: theme === 'dark' ? 'rgba(10, 10, 15, 1)' : 'rgba(255, 255, 255, 1)',
      gridColor: theme === 'dark' ? 'rgba(28, 28, 40, 0.5)' : 'rgba(200, 200, 200, 0.5)',
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: false,
      hide_volume: false,
      support_host: 'https://www.tradingview.com',
    });

    const container = document.createElement('div');
    container.className = 'tradingview-widget-container__widget';
    container.style.height = `${height}px`;
    container.style.width = '100%';

    containerRef.current.appendChild(container);
    container.appendChild(script);

    widgetRef.current = container;

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [symbol, interval, theme, height]);

  return (
    <div
      ref={containerRef}
      className="tradingview-widget-container"
      style={{ height: `${height}px`, width: '100%' }}
    />
  );
}

export const TradingViewChart = memo(TradingViewChartComponent);
