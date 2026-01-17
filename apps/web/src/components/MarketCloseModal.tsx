'use client';

import { useState, useCallback, useMemo } from 'react';
import type { Position } from './Positions';

// Lot sizes per symbol (from Pacifica)
const LOT_SIZES: Record<string, number> = {
  BTC: 0.00001,
  ETH: 0.0001,
  SOL: 0.01,
  HYPE: 0.01,
  XRP: 0.1,
  DOGE: 1,
  LINK: 0.01,
  AVAX: 0.01,
  SUI: 0.1,
  BNB: 0.001,
  AAVE: 0.001,
  ARB: 0.1,
  OP: 0.1,
  APT: 0.01,
  INJ: 0.01,
  TIA: 0.01,
  SEI: 0.1,
  WIF: 0.1,
  JUP: 0.1,
  PENDLE: 0.1,
  RENDER: 0.1,
  FET: 0.1,
  ZEC: 0.001,
  PAXG: 0.0001,
  ENA: 0.1,
  KPEPE: 1,
};

export interface MarketCloseParams {
  positionId: string;
  amount: string;
  percentage: number;
}

interface MarketCloseModalProps {
  position: Position;
  onClose: () => void;
  onConfirm: (amount: string, percentage: number) => void;
  isSubmitting?: boolean;
}

export function MarketCloseModal({ position, onClose, onConfirm, isSubmitting = false }: MarketCloseModalProps) {
  const [amount, setAmount] = useState(position.sizeInToken.toString());
  const [percentage, setPercentage] = useState(100);

  // Get token symbol without -USD
  const tokenSymbol = position.symbol.replace('-USD', '');
  const lotSize = LOT_SIZES[tokenSymbol] || 0.00001;

  // Memoize helper functions
  const { roundToLotSize, formatAmount } = useMemo(() => ({
    roundToLotSize: (value: number): number => {
      return Math.floor(value / lotSize) * lotSize;
    },
    formatAmount: (value: number): string => {
      const decimals = Math.max(0, -Math.floor(Math.log10(lotSize)));
      return value.toFixed(decimals);
    },
  }), [lotSize]);

  // Format price with appropriate decimals
  const formatPrice = (p: number) => {
    if (p >= 10000) return p.toFixed(2);
    if (p >= 100) return p.toFixed(2);
    if (p >= 1) return p.toFixed(4);
    return p.toFixed(6);
  };

  // Calculate USD value
  const usdValue = useMemo(() => {
    const numAmount = parseFloat(amount) || 0;
    return numAmount * position.markPrice;
  }, [amount, position.markPrice]);

  // Update amount when percentage changes
  const handlePercentageChange = useCallback((pct: number) => {
    setPercentage(pct);
    const rawAmount = position.sizeInToken * pct / 100;
    const roundedAmount = roundToLotSize(rawAmount);
    setAmount(formatAmount(roundedAmount));
  }, [position.sizeInToken, roundToLotSize, formatAmount]);

  // Update percentage when amount changes manually
  const handleAmountChange = (value: string) => {
    setAmount(value);
    const numAmount = parseFloat(value) || 0;
    const pct = position.sizeInToken > 0 ? Math.min(100, (numAmount / position.sizeInToken) * 100) : 0;
    setPercentage(pct);
  };

  // Round amount on blur to ensure it's a valid lot size
  const handleAmountBlur = () => {
    const numAmount = parseFloat(amount) || 0;
    if (numAmount > 0) {
      const roundedAmount = Math.min(roundToLotSize(numAmount), position.sizeInToken);
      setAmount(formatAmount(roundedAmount));
      const pct = position.sizeInToken > 0 ? Math.min(100, (roundedAmount / position.sizeInToken) * 100) : 0;
      setPercentage(pct);
    }
  };

  // Calculate estimated PnL based on amount being closed
  const estimatedPnl = useMemo(() => {
    const closeAmount = parseFloat(amount) || 0;
    if (!closeAmount) return 0;

    const priceDiff = position.side === 'LONG'
      ? position.markPrice - position.entryPrice
      : position.entryPrice - position.markPrice;

    return priceDiff * closeAmount;
  }, [amount, position]);

  const handleConfirm = () => {
    if (!amount || parseFloat(amount) <= 0) return;
    onConfirm(amount, percentage);
  };

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="bg-surface-800 rounded-xl shadow-xl w-full max-w-md mx-4 border border-surface-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-surface-700">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-white">Market Close</h2>
            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
              position.side === 'LONG'
                ? 'bg-win-500/20 text-win-400'
                : 'bg-loss-500/20 text-loss-400'
            }`}>
              {position.leverage}x {position.side === 'LONG' ? 'Long' : 'Short'}
            </span>
            <span className="text-white font-mono">{position.sizeInToken.toFixed(8)} {tokenSymbol}</span>
          </div>
          <button
            onClick={onClose}
            className="text-surface-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          <p className="text-sm text-surface-400">Attempt to close position immediately.</p>

          {/* Mark Price Display */}
          <div className="flex items-center justify-between">
            <span className="text-surface-400 font-mono">{formatPrice(position.markPrice)}</span>
            <span className="text-surface-500">USD</span>
          </div>

          {/* Amount Input */}
          <div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                onBlur={handleAmountBlur}
                className="flex-1 bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-primary-500"
                placeholder="0.00"
              />
              <span className="text-surface-400 min-w-[40px]">{tokenSymbol}</span>
              <input
                type="text"
                value={usdValue.toFixed(2)}
                readOnly
                className="w-24 bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-surface-400 font-mono text-right"
              />
              <span className="text-surface-400">USD</span>
            </div>
          </div>

          {/* Percentage Slider */}
          <div className="pt-2">
            <div className="relative">
              <input
                type="range"
                min="0"
                max="100"
                value={percentage}
                onChange={(e) => handlePercentageChange(parseInt(e.target.value))}
                className="w-full h-2 bg-surface-700 rounded-lg appearance-none cursor-pointer accent-primary-500"
                style={{
                  background: `linear-gradient(to right, #22d3ee 0%, #22d3ee ${percentage}%, #374151 ${percentage}%, #374151 100%)`
                }}
              />
            </div>
            <div className="flex justify-end mt-2">
              <span className="text-surface-300 font-mono">{percentage.toFixed(0)}</span>
              <span className="text-surface-500 ml-1">%</span>
            </div>
          </div>

          {/* Quick Percentage Buttons */}
          <div className="flex gap-2">
            {[25, 50, 75, 100].map((pct) => (
              <button
                key={pct}
                onClick={() => handlePercentageChange(pct)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  Math.abs(percentage - pct) < 1
                    ? 'bg-surface-600 text-white'
                    : 'bg-surface-700 text-surface-300 hover:bg-surface-600'
                }`}
              >
                {pct}%
              </button>
            ))}
          </div>

          {/* Estimated PnL */}
          <div className="flex justify-end items-center gap-2 text-sm">
            <span className="text-surface-400">Estimated PnL:</span>
            <span className={`font-mono font-semibold ${
              estimatedPnl >= 0 ? 'text-win-400' : 'text-loss-400'
            }`}>
              {estimatedPnl >= 0 ? '+' : '-'}${Math.abs(estimatedPnl).toFixed(2)}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-surface-700">
          <button
            onClick={handleConfirm}
            disabled={isSubmitting || !amount || parseFloat(amount) <= 0}
            className="w-full py-3 rounded-lg font-semibold bg-primary-500 hover:bg-primary-400 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Closing...
              </span>
            ) : (
              'Market Close'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
