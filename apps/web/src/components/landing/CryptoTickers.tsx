'use client';

import { usePrices } from '@/hooks/usePrices';
import { MiniChart } from './shared/MiniChart';
import { TokenIcon } from '@/components/TokenIcon';

// Token data for display names
const TOKEN_DATA: Record<string, { name: string; fullName: string }> = {
  'BTC-USD': {
    name: 'Bitcoin',
    fullName: 'Bitcoin / U.S. Dollar',
  },
  'ETH-USD': {
    name: 'Ethereum',
    fullName: 'Ethereum / U.S. Dollar',
  },
  'SOL-USD': {
    name: 'Solana',
    fullName: 'Solana / U.S. Dollar',
  },
};

// Generate stable chart data based on symbol and trend direction
function generateStableChartData(symbol: string, positive: boolean): number[] {
  // Use symbol as seed for consistent data per token
  const seed = symbol.charCodeAt(0) + symbol.charCodeAt(1);
  const base = 100;
  const data: number[] = [];
  let current = base;

  for (let i = 0; i < 50; i++) {
    // Pseudo-random but deterministic based on seed and index
    const pseudoRandom = Math.sin(seed * i * 0.1) * 0.5 + 0.5;
    const change = (pseudoRandom - 0.5) * 3;
    const trend = positive ? 0.2 : -0.2;
    current = current + change + trend;
    data.push(current);
  }
  return data;
}

export function CryptoTickers() {
  const { prices, isConnected } = usePrices({
    symbols: ['BTC-USD', 'ETH-USD', 'SOL-USD']
  });

  const symbols = ['BTC-USD', 'ETH-USD', 'SOL-USD'];

  // Generate stable chart data once per symbol (based on trend direction)
  const getChartData = (symbol: string, isPositive: boolean) => {
    return generateStableChartData(symbol, isPositive);
  };

  return (
    <section className="py-8 lg:py-12 border-t border-surface-800/50">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <div className="grid md:grid-cols-3 gap-4 lg:gap-6">
          {symbols.map((symbol) => {
            const priceData = prices[symbol];
            const tokenInfo = TOKEN_DATA[symbol];
            const isPositive = priceData ? priceData.change24h >= 0 : true;

            // Calculate price change value
            const priceChange = priceData
              ? (priceData.price * priceData.change24h / 100)
              : 0;

            return (
              <div
                key={symbol}
                className="rounded-xl bg-surface-850 border border-surface-800 p-5 hover:border-surface-600 transition-all"
              >
                {/* Header - Token info */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <TokenIcon symbol={symbol} size="lg" />
                    <span className="font-medium text-white">{tokenInfo?.fullName}</span>
                  </div>
                  <span className={`w-2.5 h-2.5 rounded-full ${isPositive ? 'bg-green-500' : 'bg-red-500'}`} />
                </div>

                {/* Price */}
                <div className="mb-1">
                  <span className="text-3xl font-bold text-white">
                    {priceData
                      ? priceData.price >= 1000
                        ? priceData.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        : priceData.price >= 1
                          ? priceData.price.toFixed(2)
                          : priceData.price.toFixed(4)
                      : '---.--'
                    }
                  </span>
                  <span className="text-sm text-surface-500 ml-1">USD</span>
                </div>

                {/* Price Change */}
                <div className="flex items-center gap-2 mb-4">
                  <span className={`text-sm font-medium ${isPositive ? 'text-win-500' : 'text-loss-500'}`}>
                    {priceData
                      ? `${isPositive ? '+' : ''}${Math.abs(priceChange) >= 1 ? priceChange.toFixed(2) : priceChange.toFixed(4)}`
                      : '--'
                    }
                  </span>
                  <span className={`text-sm font-medium ${isPositive ? 'text-win-500' : 'text-loss-500'}`}>
                    {priceData
                      ? `${isPositive ? '+' : ''}${priceData.change24h.toFixed(2)}%`
                      : '--.--%'
                    }
                  </span>
                  <span className="text-xs text-surface-500">24h</span>
                </div>

                {/* Large Chart */}
                <div className="h-32 w-full relative">
                  <MiniChart
                    data={getChartData(symbol, isPositive)}
                    width={320}
                    height={128}
                    strokeWidth={1.5}
                    positive={isPositive}
                  />

                  {/* TradingView-style label */}
                  <div className={`absolute bottom-2 right-0 px-2 py-0.5 text-[10px] font-medium rounded ${
                    isPositive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                  }`}>
                    PACIFICA:{symbol.replace('-USD', 'USD')}
                  </div>

                  {/* TradingView logo */}
                  <div className="absolute bottom-2 left-0">
                    <svg className="w-6 h-6 text-surface-600" viewBox="0 0 36 28" fill="currentColor">
                      <path d="M14 22H7V11H0V4h14v18zM28 22h-8l7.5-18h8L28 22z" />
                    </svg>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Connection Status */}
        <div className="flex items-center justify-center gap-2 mt-6 text-xs text-surface-500">
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-yellow-500'} animate-pulse`} />
          <span>{isConnected ? 'Live prices from Pacifica' : 'Connecting...'}</span>
        </div>
      </div>
    </section>
  );
}
