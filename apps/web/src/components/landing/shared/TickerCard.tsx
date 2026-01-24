'use client';

import { MiniChart } from './MiniChart';
import { useKlineData } from '@/hooks/useKlineData';
import { TokenIcon } from '@/components/TokenIcon';

interface TickerCardProps {
  symbol: string;
  tokenInfo: {
    name: string;
    fullName: string;
  };
  priceData: {
    price: number;
    change24h: number;
  } | undefined;
}

export function TickerCard({ symbol, tokenInfo, priceData }: TickerCardProps) {
  const { data: klineData, isLoading } = useKlineData(symbol, '1h', 48);

  const isPositive = priceData ? priceData.change24h >= 0 : true;
  const priceChange = priceData ? (priceData.price * priceData.change24h / 100) : 0;

  return (
    <div className="rounded-xl bg-surface-850/80 backdrop-blur-sm border border-surface-700/50 p-5 hover:border-surface-600 transition-all">
      {/* Header - Token info */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <TokenIcon symbol={symbol} size="lg" />
          <span className="font-medium text-white">{tokenInfo.fullName}</span>
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
        {isLoading ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-surface-600 border-t-primary-500 rounded-full animate-spin" />
          </div>
        ) : (
          <MiniChart
            data={klineData.length > 1 ? klineData : [100]}
            width={320}
            height={128}
            strokeWidth={1.5}
            positive={isPositive}
          />
        )}

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
}
