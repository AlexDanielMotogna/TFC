'use client';

import { useState, useMemo } from 'react';
import type { Position } from './Positions';

export interface TpSlParams {
  positionId: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  takeProfit?: {
    stopPrice: string;
    limitPrice?: string;
  } | null; // null to remove TP
  stopLoss?: {
    stopPrice: string;
    limitPrice?: string;
  } | null; // null to remove SL
  isPartial: boolean;
  partialAmount?: string;
}

interface TpSlModalProps {
  position: Position;
  onClose: () => void;
  onConfirm: (params: TpSlParams) => void;
  isSubmitting?: boolean;
}

export function TpSlModal({ position, onClose, onConfirm, isSubmitting = false }: TpSlModalProps) {
  const [isPartial, setIsPartial] = useState(false);
  const [tpPrice, setTpPrice] = useState('');
  const [slPrice, setSlPrice] = useState('');
  const [useLimitPrice, setUseLimitPrice] = useState(false);
  const [removeTP, setRemoveTP] = useState(false);
  const [removeSL, setRemoveSL] = useState(false);

  const tokenSymbol = position.symbol.replace('-USD', '');

  // Format price with appropriate decimals
  const formatPrice = (p: number) => {
    if (p >= 10000) return p.toFixed(0);
    if (p >= 100) return p.toFixed(2);
    if (p >= 1) return p.toFixed(4);
    return p.toFixed(6);
  };

  // Calculate TP price based on percentage gain
  const calculateTpPrice = (gainPercent: number) => {
    const margin = position.margin;
    const gainAmount = (margin * gainPercent) / 100;

    if (position.side === 'LONG') {
      // For LONG: TP is above entry, gain = (tp - entry) * size
      // gainAmount = (tpPrice - entryPrice) * sizeInToken
      // tpPrice = entryPrice + (gainAmount / sizeInToken)
      return position.entryPrice + (gainAmount / position.sizeInToken);
    } else {
      // For SHORT: TP is below entry, gain = (entry - tp) * size
      // tpPrice = entryPrice - (gainAmount / sizeInToken)
      return position.entryPrice - (gainAmount / position.sizeInToken);
    }
  };

  // Calculate SL price based on percentage loss
  const calculateSlPrice = (lossPercent: number) => {
    const margin = position.margin;
    const lossAmount = (margin * Math.abs(lossPercent)) / 100;

    if (position.side === 'LONG') {
      // For LONG: SL is below entry, loss = (entry - sl) * size
      // slPrice = entryPrice - (lossAmount / sizeInToken)
      return position.entryPrice - (lossAmount / position.sizeInToken);
    } else {
      // For SHORT: SL is above entry, loss = (sl - entry) * size
      // slPrice = entryPrice + (lossAmount / sizeInToken)
      return position.entryPrice + (lossAmount / position.sizeInToken);
    }
  };

  // Calculate estimated gain/loss for display
  const tpGain = useMemo(() => {
    const tp = parseFloat(tpPrice);
    if (!tp || !position.sizeInToken) return 0;

    if (position.side === 'LONG') {
      return (tp - position.entryPrice) * position.sizeInToken;
    } else {
      return (position.entryPrice - tp) * position.sizeInToken;
    }
  }, [tpPrice, position]);

  const slLoss = useMemo(() => {
    const sl = parseFloat(slPrice);
    if (!sl || !position.sizeInToken) return 0;

    if (position.side === 'LONG') {
      return (sl - position.entryPrice) * position.sizeInToken;
    } else {
      return (position.entryPrice - sl) * position.sizeInToken;
    }
  }, [slPrice, position]);

  // Calculate percentage of margin
  const tpPercent = position.margin > 0 ? (tpGain / position.margin) * 100 : 0;
  const slPercent = position.margin > 0 ? (slLoss / position.margin) * 100 : 0;

  const handleTpPercentClick = (percent: number) => {
    const price = calculateTpPrice(percent);
    setTpPrice(formatPrice(price));
  };

  const handleSlPercentClick = (percent: number) => {
    const price = calculateSlPrice(percent);
    setSlPrice(formatPrice(price));
  };

  const handleConfirm = () => {
    const params: TpSlParams = {
      positionId: position.id,
      symbol: position.symbol,
      side: position.side,
      isPartial,
    };

    // Handle TP: null = remove, object = set, undefined = no change
    if (removeTP) {
      params.takeProfit = null;
    } else if (tpPrice && parseFloat(tpPrice) > 0) {
      params.takeProfit = {
        stopPrice: tpPrice,
        limitPrice: useLimitPrice ? tpPrice : undefined,
      };
    }

    // Handle SL: null = remove, object = set, undefined = no change
    if (removeSL) {
      params.stopLoss = null;
    } else if (slPrice && parseFloat(slPrice) > 0) {
      params.stopLoss = {
        stopPrice: slPrice,
        limitPrice: useLimitPrice ? slPrice : undefined,
      };
    }

    onConfirm(params);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Valid if setting new TP/SL or removing existing ones
  const hasValidInput = (tpPrice && parseFloat(tpPrice) > 0) ||
                       (slPrice && parseFloat(slPrice) > 0) ||
                       removeTP ||
                       removeSL;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="bg-surface-800 rounded-xl shadow-xl w-full max-w-md mx-4 border border-surface-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-surface-700">
          <h2 className="text-lg font-semibold text-white">TP/SL for Position</h2>
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
          {/* Position Info */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-surface-400">Symbol</span>
              <span className="text-white font-medium">{tokenSymbol}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-400">Position</span>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                  position.side === 'LONG'
                    ? 'bg-win-500/20 text-win-400'
                    : 'bg-loss-500/20 text-loss-400'
                }`}>
                  {position.leverage}x {position.side === 'LONG' ? 'Long' : 'Short'}
                </span>
                <span className="text-white font-mono">{position.sizeInToken.toFixed(5)} {tokenSymbol}</span>
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-400">Entry Price</span>
              <span className="text-white font-mono">${formatPrice(position.entryPrice)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-400">Mark Price</span>
              <span className="text-white font-mono">${formatPrice(position.markPrice)}</span>
            </div>
          </div>

          {/* Full Position / Partial Toggle */}
          <div className="flex border border-surface-700 rounded-lg overflow-hidden">
            <button
              onClick={() => setIsPartial(false)}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                !isPartial
                  ? 'bg-surface-700 text-white'
                  : 'bg-surface-800 text-surface-400 hover:text-white'
              }`}
            >
              Full Position
            </button>
            <button
              onClick={() => setIsPartial(true)}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                isPartial
                  ? 'bg-surface-700 text-white'
                  : 'bg-surface-800 text-surface-400 hover:text-white'
              }`}
            >
              Partial
            </button>
          </div>

          {/* Take Profit */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <label className="text-sm text-surface-400">TP Price</label>
                {position.takeProfit && (
                  <span className="text-xs text-win-400/70">
                    (Current: ${formatPrice(position.takeProfit)})
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-surface-500">Gain</span>
                <span className={`font-mono ${tpGain >= 0 ? 'text-win-400' : 'text-loss-400'}`}>
                  ${tpGain.toFixed(2)}
                </span>
                <span className="text-surface-600">|</span>
                <span className={`font-mono ${tpPercent >= 0 ? 'text-win-400' : 'text-loss-400'}`}>
                  {tpPercent >= 0 ? '+' : ''}{tpPercent.toFixed(0)}%
                </span>
              </div>
            </div>
            {removeTP ? (
              <div className="flex items-center justify-between p-3 bg-loss-500/10 border border-loss-500/30 rounded-lg">
                <span className="text-sm text-loss-400">Take Profit will be removed</span>
                <button
                  onClick={() => setRemoveTP(false)}
                  className="text-xs text-surface-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={tpPrice}
                    onChange={(e) => setTpPrice(e.target.value)}
                    placeholder="0.00"
                    className="flex-1 bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-primary-500"
                  />
                  <span className="text-surface-400 text-sm">USD</span>
                </div>
                <div className="flex gap-2">
                  {[25, 50, 75, 100].map((pct) => (
                    <button
                      key={pct}
                      onClick={() => handleTpPercentClick(pct)}
                      className="flex-1 py-1.5 rounded text-xs font-medium bg-surface-700 text-surface-300 hover:bg-surface-600 hover:text-white transition-colors"
                    >
                      {pct}%
                    </button>
                  ))}
                  {position.takeProfit && (
                    <button
                      onClick={() => {
                        setRemoveTP(true);
                        setTpPrice('');
                      }}
                      className="py-1.5 px-2 rounded text-xs font-medium bg-loss-500/20 text-loss-400 hover:bg-loss-500/30 transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Stop Loss */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <label className="text-sm text-surface-400">SL Price</label>
                {position.stopLoss && (
                  <span className="text-xs text-loss-400/70">
                    (Current: ${formatPrice(position.stopLoss)})
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-surface-500">Loss</span>
                <span className={`font-mono ${slLoss <= 0 ? 'text-loss-400' : 'text-win-400'}`}>
                  ${slLoss.toFixed(2)}
                </span>
                <span className="text-surface-600">|</span>
                <span className={`font-mono ${slPercent <= 0 ? 'text-loss-400' : 'text-win-400'}`}>
                  {slPercent.toFixed(0)}%
                </span>
              </div>
            </div>
            {removeSL ? (
              <div className="flex items-center justify-between p-3 bg-loss-500/10 border border-loss-500/30 rounded-lg">
                <span className="text-sm text-loss-400">Stop Loss will be removed</span>
                <button
                  onClick={() => setRemoveSL(false)}
                  className="text-xs text-surface-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={slPrice}
                    onChange={(e) => setSlPrice(e.target.value)}
                    placeholder="0.00"
                    className="flex-1 bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-primary-500"
                  />
                  <span className="text-surface-400 text-sm">USD</span>
                </div>
                <div className="flex gap-2">
                  {[-25, -50, -75, -100].map((pct) => (
                    <button
                      key={pct}
                      onClick={() => handleSlPercentClick(pct)}
                      className="flex-1 py-1.5 rounded text-xs font-medium bg-surface-700 text-surface-300 hover:bg-surface-600 hover:text-white transition-colors"
                    >
                      {pct}%
                    </button>
                  ))}
                  {position.stopLoss && (
                    <button
                      onClick={() => {
                        setRemoveSL(true);
                        setSlPrice('');
                      }}
                      className="py-1.5 px-2 rounded text-xs font-medium bg-loss-500/20 text-loss-400 hover:bg-loss-500/30 transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Limit Price Toggle */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setUseLimitPrice(!useLimitPrice)}
              className={`w-10 h-5 rounded-full transition-colors relative ${
                useLimitPrice ? 'bg-primary-500' : 'bg-surface-600'
              }`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  useLimitPrice ? 'left-5' : 'left-0.5'
                }`}
              />
            </button>
            <span className="text-sm text-surface-300">Limit Price</span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-surface-700">
          <button
            onClick={handleConfirm}
            disabled={isSubmitting || !hasValidInput}
            className="w-full py-3 rounded-lg font-semibold bg-primary-500 hover:bg-primary-400 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Submitting...
              </span>
            ) : (
              'Confirm'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
