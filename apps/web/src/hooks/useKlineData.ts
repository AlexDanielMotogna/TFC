'use client';

import { useState, useEffect } from 'react';

const PACIFICA_API_BASE = 'https://api.pacifica.fi';

// Map our symbol format (BTC-USD) to Pacifica format (BTC)
const symbolToPacifica = (symbol: string): string => {
  if (symbol === 'KPEPE-USD') return '1000PEPE';
  return symbol.replace('-USD', '');
};

interface PacificaKlineResponse {
  success: boolean;
  data: Array<{
    t: number;   // open time ms
    c: string;   // close price
  }>;
  error: string | null;
}

/**
 * Simple hook to fetch kline close prices for mini charts
 * Returns an array of close prices for the last N periods
 */
export function useKlineData(symbol: string, interval: '1h' | '4h' | '1d' = '1h', periods: number = 50) {
  const [data, setData] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const pacificaSymbol = symbolToPacifica(symbol);
    let isCancelled = false;

    const fetchKlines = async () => {
      setIsLoading(true);
      setError(null);

      const now = Date.now();
      // Calculate how much time we need based on interval and periods
      const intervalMs = interval === '1h' ? 60 * 60 * 1000 : interval === '4h' ? 4 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
      const startTime = now - (periods * intervalMs);

      try {
        const response = await fetch(
          `${PACIFICA_API_BASE}/api/v1/kline?symbol=${pacificaSymbol}&interval=${interval}&start_time=${startTime}&end_time=${now}`
        );

        if (isCancelled) return;

        if (!response.ok) {
          throw new Error(`Failed to fetch klines: ${response.status}`);
        }

        const result: PacificaKlineResponse = await response.json();

        if (isCancelled) return;

        if (result.success && result.data && result.data.length > 0) {
          // Sort by time and extract close prices
          const sortedData = result.data.sort((a, b) => a.t - b.t);
          const closePrices = sortedData.map(k => parseFloat(k.c));
          setData(closePrices);
        }
      } catch (err) {
        console.error('Failed to fetch kline data:', err);
        if (!isCancelled) {
          setError('Failed to load chart data');
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchKlines();

    return () => {
      isCancelled = true;
    };
  }, [symbol, interval, periods]);

  return { data, isLoading, error };
}
