'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { usePrices } from '@/hooks/usePrices';
import { Portal } from './Portal';
import { Slider } from './Slider';
import { Spinner } from './Spinner';
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
  // Forex pairs
  USDJPY: 0.001,
  EURUSD: 0.001,
  GBPUSD: 0.001,
};

interface LimitCloseModalProps {
  position: Position;
  onClose: () => void;
  onConfirm: (price: string, amount: string, percentage: number) => void;
  isSubmitting?: boolean;
}

export function LimitCloseModal({ position, onClose, onConfirm, isSubmitting = false }: LimitCloseModalProps) {
  const [price, setPrice] = useState('');
  const [amount, setAmount] = useState('');
  const [percentage, setPercentage] = useState(0);

  // Get token symbol without -USD
  const tokenSymbol = position.symbol.replace('-USD', '');
  const lotSize = LOT_SIZES[tokenSymbol] || 0.00001;

  // Get live mark price from WebSocket
  const { getPrice } = usePrices();
  const livePrice = getPrice(position.symbol)?.price || position.markPrice;

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
    if (p >= 10000) return p.toFixed(0);
    if (p >= 100) return p.toFixed(2);
    if (p >= 1) return p.toFixed(4);
    return p.toFixed(6);
  };

  // Initialize with mid price (mark price)
  useEffect(() => {
    setPrice(formatPrice(position.markPrice));
  }, [position.markPrice]);

  // Update amount when percentage changes
  const handlePercentageChange = useCallback((pct: number) => {
    setPercentage(pct);
    const rawAmount = position.sizeInToken * pct / 100;
    // Round to lot size to ensure valid order
    const roundedAmount = roundToLotSize(rawAmount);
    setAmount(formatAmount(roundedAmount));
  }, [position.sizeInToken, roundToLotSize, formatAmount]);

  // Update percentage when amount changes manually
  const handleAmountChange = (value: string) => {
    // Allow user to type freely, but calculate percentage from raw value
    setAmount(value);
    const numAmount = parseFloat(value) || 0;
    const pct = position.sizeInToken > 0 ? Math.min(100, (numAmount / position.sizeInToken) * 100) : 0;
    setPercentage(pct);
  };

  // Round amount on blur to ensure it's a valid lot size
  const handleAmountBlur = () => {
    const numAmount = parseFloat(amount) || 0;
    if (numAmount > 0) {
      const roundedAmount = roundToLotSize(numAmount);
      setAmount(formatAmount(roundedAmount));
      // Update percentage based on rounded amount
      const pct = position.sizeInToken > 0 ? Math.min(100, (roundedAmount / position.sizeInToken) * 100) : 0;
      setPercentage(pct);
    }
  };

  // Calculate estimated PnL
  const calculateEstimatedPnl = () => {
    const closePrice = parseFloat(price) || 0;
    const closeAmount = parseFloat(amount) || 0;
    if (!closePrice || !closeAmount) return 0;

    const priceDiff = position.side === 'LONG'
      ? closePrice - position.entryPrice
      : position.entryPrice - closePrice;

    return priceDiff * closeAmount;
  };

  const estimatedPnl = calculateEstimatedPnl();

  const handleConfirm = () => {
    if (!price || !amount || parseFloat(amount) <= 0) return;
    onConfirm(price, amount, percentage);
  };

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <Portal>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        onClick={handleBackdropClick}
      >
        <div className="bg-surface-900 rounded-2xl w-full max-w-md mx-4">
          {/* Header */}
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold text-sm text-white">Limit Close</h2>
            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
              position.side === 'LONG'
                ? 'bg-win-500/20 text-win-400'
                : 'bg-loss-500/20 text-loss-400'
            }`}>
              {position.leverage}x {position.side === 'LONG' ? 'Long' : 'Short'}
            </span>
            <span className="text-white font-mono">{position.sizeInToken.toFixed(6)} {tokenSymbol}</span>
          </div>
          <button
            onClick={onClose}
            className="text-surface-500 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          <p className="text-sm text-surface-400">Send limit order to close position.</p>

          {/* Live Price Display */}
          <div className="flex items-center justify-between bg-surface-900/50 rounded-lg px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="text-white font-mono text-lg tabular-nums">{formatPrice(livePrice)}</span>
              <span className="text-surface-500 text-sm">USD</span>
            </div>
            <span className="text-[10px] text-win-400 bg-win-500/20 px-1.5 py-0.5 rounded font-medium animate-pulse">
              LIVE
            </span>
          </div>

          {/* Price Input */}
          <div>
            <label className="block text-sm text-surface-400 mb-2">Price</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="flex-1 bg-surface-800 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:ring-1 focus:ring-surface-600"
                placeholder="0.00"
              />
              <button
                onClick={() => setPrice(formatPrice(livePrice))}
                className="px-3 py-2 text-sm text-surface-300 hover:text-white transition-colors"
              >
                Mid
              </button>
              <span className="text-surface-400">USD</span>
            </div>
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-sm text-surface-400 mb-2">Amount</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                onBlur={handleAmountBlur}
                className="flex-1 bg-surface-800 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:ring-1 focus:ring-surface-600"
                placeholder="0.00"
              />
              <span className="text-surface-400">{tokenSymbol}</span>
              <input
                type="text"
                value={amount ? (parseFloat(amount) * (parseFloat(price) || position.markPrice)).toFixed(2) : ''}
                readOnly
                className="w-24 bg-surface-800 rounded-lg px-3 py-2 text-surface-400 font-mono text-right"
                placeholder="0.00"
              />
              <span className="text-surface-400">USD</span>
            </div>
          </div>

          {/* Percentage Slider */}
          <div>
            <Slider
              min={0}
              max={100}
              value={percentage}
              onChange={handlePercentageChange}
            />
            <div className="flex justify-between mt-2">
              <span className="text-xs text-surface-500">{percentage.toFixed(0)}%</span>
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
                    ? 'bg-surface-700 text-white'
                    : 'bg-surface-800 text-surface-400 hover:bg-surface-700'
                }`}
              >
                {pct}%
              </button>
            ))}
          </div>

          {/* Estimated PnL */}
          <div className="flex justify-end items-center gap-2 text-sm">
            <span className="text-surface-500">Est. PnL</span>
            <span className={`font-mono font-semibold ${
              estimatedPnl >= 0 ? 'text-win-400' : 'text-loss-400'
            }`}>
              {estimatedPnl >= 0 ? '+' : '-'}${Math.abs(estimatedPnl).toFixed(4)}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4">
          <button
            onClick={handleConfirm}
            disabled={isSubmitting || !price || !amount || parseFloat(amount) <= 0}
            className="w-full py-2.5 rounded-lg font-medium bg-white text-black hover:bg-surface-200 transition-colors disabled:bg-surface-700 disabled:text-surface-500 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <Spinner size="xs" variant="white" />
                Submitting...
              </span>
            ) : (
              'Limit Close'
            )}
          </button>
        </div>
      </div>
    </div>
    </Portal>
  );
}
