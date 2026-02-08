'use client';

import { useState, useEffect } from 'react';
import { useCreateMarketOrder, useSetPositionTpSl } from '@/hooks/useOrders';
import { usePrices } from '@/hooks/usePrices';
import type { Position } from '@/hooks/usePacificaWebSocket';
import CloseIcon from '@mui/icons-material/Close';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import {
  calculateTpPrice,
  calculateSlPrice,
  calculatePositionMetrics,
  roundToLotSize,
  type PositionInfo,
  type RawPosition
} from '@/lib/trading/utils';

interface QuickPositionModalProps {
  position: Position;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * QuickPositionModal - Quick actions for positions
 * - Close position (market order)
 * - Set stop loss
 * - Set take profit
 * - Flip position (close and reverse)
 */
export function QuickPositionModal({ position, isOpen, onClose }: QuickPositionModalProps) {
  const { getPrice } = usePrices();
  const createMarketOrder = useCreateMarketOrder();
  const setTpSl = useSetPositionTpSl();

  const [activeTab, setActiveTab] = useState<'close' | 'tpsl' | 'flip'>('close');
  const [closeAmount, setCloseAmount] = useState('100'); // Percentage
  const [stopLossPrice, setStopLossPrice] = useState('');
  const [takeProfitPrice, setTakeProfitPrice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const symbol = position.symbol;
  const symbolBase = symbol.replace('-USD', '');
  const priceData = getPrice(`${symbolBase}-USD`);
  const markPrice = priceData?.price || parseFloat(position.entry_price);
  const leverage = priceData?.maxLeverage || 10; // Default leverage

  // Use centralized calculation (same as QuickPositionsBar and Terminal)
  const metrics = calculatePositionMetrics({
    position,
    markPrice,
    leverage,
  });

  // Extract calculated values
  const { entryPrice, amount: positionSize, side, margin, unrealizedPnl: pnl, unrealizedPnlPercent: pnlPercent } = metrics;
  const currentPrice = markPrice;
  const isLong = side === 'LONG';
  const isProfitable = pnl >= 0;

  // Get lot size and tick size from price data
  const lotSize = priceData?.lotSize || 0.00001;
  const tickSize = priceData?.tickSize || 0.01;

  // Position info for TP/SL calculations (margin-based)
  const positionInfo: PositionInfo = {
    side,
    entryPrice,
    margin,
    sizeInToken: positionSize,
  };

  // Calculate close amount in tokens and round to lot size using centralized function
  const closePercentage = parseFloat(closeAmount) || 100;
  const rawCloseAmount = (positionSize * closePercentage) / 100;
  const closeAmountTokens = parseFloat(roundToLotSize(rawCloseAmount, lotSize));

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setCloseAmount('100');
      setStopLossPrice('');
      setTakeProfitPrice('');
      setActiveTab('close');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClose = async () => {
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);

      await createMarketOrder.mutateAsync({
        symbol: symbol,
        side: isLong ? 'ask' : 'bid', // Opposite side to close
        amount: closeAmountTokens.toFixed(8),
        reduceOnly: true,
        slippage_percent: '1',
      });

      onClose();
    } catch (error) {
      console.error('Failed to close position:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetTpSl = async () => {
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);

      const takeProfit = takeProfitPrice
        ? { stop_price: takeProfitPrice }
        : null;

      const stopLoss = stopLossPrice
        ? { stop_price: stopLossPrice }
        : null;

      await setTpSl.mutateAsync({
        symbol: symbol,
        side: isLong ? 'LONG' : 'SHORT',
        size: position.amount,
        take_profit: takeProfit,
        stop_loss: stopLoss,
      });

      onClose();
    } catch (error) {
      console.error('Failed to set TP/SL:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFlip = async () => {
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);

      // Flip = close current position + open opposite with same size
      // Round to lot size to avoid errors
      const rawDoubleAmount = positionSize * 2;
      const doubleAmount = Math.floor(rawDoubleAmount / lotSize) * lotSize;

      await createMarketOrder.mutateAsync({
        symbol: symbol,
        side: isLong ? 'ask' : 'bid', // Opposite side to flip
        amount: doubleAmount.toFixed(8),
        reduceOnly: false,
        slippage_percent: '1',
      });

      onClose();
    } catch (error) {
      console.error('Failed to flip position:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-surface-850 border border-surface-800 rounded-t-xl sm:rounded-xl shadow-2xl w-full sm:max-w-md sm:mx-4 overflow-hidden flex flex-col max-h-[85vh] sm:max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-800">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-white font-mono text-lg font-bold">
                {symbol}
              </span>
              <span className={`text-xs font-bold px-2 py-1 rounded ${
                isLong
                  ? 'bg-win-500/30 text-win-400'
                  : 'bg-loss-500/30 text-loss-400'
              }`}>
                {isLong ? 'LONG' : 'SHORT'}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-surface-400 hover:text-white transition-colors p-1 hover:bg-surface-800 rounded"
          >
            <CloseIcon sx={{ fontSize: 20 }} />
          </button>
        </div>

        {/* Position Info - Compact layout for mobile */}
        <div className="px-4 py-3 bg-surface-900/50 border-b border-surface-800">
          <div className="grid grid-cols-3 gap-x-3 gap-y-2">
            <div className="text-center">
              <div className="text-[10px] text-surface-500">Entry</div>
              <div className="text-xs text-white font-mono">
                ${entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 3 })}
              </div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-surface-500">Mark</div>
              <div className="text-xs text-white font-mono">
                ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 3 })}
              </div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-surface-500 flex items-center justify-center gap-0.5">
                <TrendingDownIcon sx={{ fontSize: 10 }} className="text-loss-400" />
                Liq
              </div>
              <div className="text-xs text-loss-400 font-mono">
                ${position.liq_price ? parseFloat(position.liq_price).toLocaleString() : 'N/A'}
              </div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-surface-500">Size</div>
              <div className="text-xs text-white font-mono">
                ${(positionSize * currentPrice).toFixed(2)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-surface-500">Margin</div>
              <div className="text-xs text-white font-mono">
                ${margin.toFixed(2)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-surface-500">PnL</div>
              <div className={`text-xs font-mono ${
                isProfitable ? 'text-win-400' : 'text-loss-400'
              }`}>
                {isProfitable ? '+' : ''}{pnlPercent.toFixed(2)}% (${pnl.toFixed(2)})
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-surface-800">
          <button
            onClick={() => setActiveTab('close')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'close'
                ? 'bg-surface-800 text-white border-b-2 border-primary-500'
                : 'text-surface-400 hover:text-white hover:bg-surface-800/50'
            }`}
          >
            <CloseIcon sx={{ fontSize: 16 }} />
            Close
          </button>
          <button
            onClick={() => setActiveTab('tpsl')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'tpsl'
                ? 'bg-surface-800 text-white border-b-2 border-primary-500'
                : 'text-surface-400 hover:text-white hover:bg-surface-800/50'
            }`}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            TP/SL
          </button>
          <button
            onClick={() => setActiveTab('flip')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'flip'
                ? 'bg-surface-800 text-white border-b-2 border-primary-500'
                : 'text-surface-400 hover:text-white hover:bg-surface-800/50'
            }`}
          >
            <SwapVertIcon sx={{ fontSize: 16 }} />
            Flip
          </button>
        </div>

        {/* Tab Content - Scrollable, adapts to available space */}
        <div className="px-4 py-3 overflow-y-auto flex-1 min-h-0">
          {activeTab === 'close' && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-surface-400">
                    Close Amount
                  </label>
                  <span className="text-sm font-mono font-medium text-white">
                    {closePercentage.toFixed(0)}%
                  </span>
                </div>

                {/* Quick percentage buttons */}
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {[25, 50, 75, 100].map((pct) => (
                    <button
                      key={pct}
                      onClick={() => setCloseAmount(pct.toString())}
                      className={`py-1.5 px-3 text-xs font-medium rounded transition-colors ${
                        closePercentage === pct
                          ? 'bg-primary-500 text-white'
                          : 'bg-surface-800 text-surface-400 hover:bg-surface-700 hover:text-white'
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>

                <input
                  type="range"
                  min="1"
                  max="100"
                  value={closeAmount}
                  onChange={(e) => setCloseAmount(e.target.value)}
                  className="w-full h-2 bg-surface-700 rounded-lg appearance-none cursor-pointer accent-primary-500"
                  style={{
                    background: `linear-gradient(to right, #f97316 0%, #f97316 ${closePercentage}%, #27272a ${closePercentage}%, #27272a 100%)`
                  }}
                />
                <div className="text-xs text-surface-500 mt-2">
                  {closeAmountTokens.toFixed(8)} {symbol} (${(closeAmountTokens * currentPrice).toFixed(2)})
                </div>
              </div>
            </div>
          )}

          {activeTab === 'tpsl' && (
            <div className="space-y-4">
              {/* Take Profit */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-surface-400">TP Price</label>
                  {takeProfitPrice && (() => {
                    const tp = parseFloat(takeProfitPrice);
                    const tpGain = isLong
                      ? (tp - entryPrice) * positionSize
                      : (entryPrice - tp) * positionSize;
                    const tpPercent = margin > 0 ? (tpGain / margin) * 100 : 0;
                    return (
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
                    );
                  })()}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={takeProfitPrice}
                    onChange={(e) => setTakeProfitPrice(e.target.value)}
                    placeholder="0.00"
                    className="flex-1 bg-surface-900 border border-surface-800 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-primary-500"
                  />
                  <span className="text-surface-400 text-sm">USD</span>
                </div>
                <div className="flex gap-2">
                  {[25, 50, 75, 100].map((pct) => {
                    // Pass position size as third parameter (same as TpSlModal)
                    const tpPrice = calculateTpPrice(pct, positionInfo, positionSize);
                    return (
                      <button
                        key={pct}
                        onClick={() => setTakeProfitPrice(tpPrice.toFixed(2))}
                        className="flex-1 py-1.5 rounded text-xs font-medium bg-surface-700 text-surface-300 hover:bg-surface-600 hover:text-white transition-colors"
                      >
                        {pct}%
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Stop Loss */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-surface-400">SL Price</label>
                  {stopLossPrice && (() => {
                    const sl = parseFloat(stopLossPrice);
                    const slLoss = isLong
                      ? (sl - entryPrice) * positionSize
                      : (entryPrice - sl) * positionSize;
                    const slPercent = margin > 0 ? (slLoss / margin) * 100 : 0;
                    return (
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
                    );
                  })()}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={stopLossPrice}
                    onChange={(e) => setStopLossPrice(e.target.value)}
                    placeholder="0.00"
                    className="flex-1 bg-surface-900 border border-surface-800 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-primary-500"
                  />
                  <span className="text-surface-400 text-sm">USD</span>
                </div>
                <div className="flex gap-2">
                  {[-25, -50, -75, -100].map((pct) => {
                    // Pass position size as third parameter (same as TpSlModal)
                    const slPrice = calculateSlPrice(pct, positionInfo, positionSize);
                    return (
                      <button
                        key={pct}
                        onClick={() => setStopLossPrice(slPrice.toFixed(2))}
                        className="flex-1 py-1.5 rounded text-xs font-medium bg-surface-700 text-surface-300 hover:bg-surface-600 hover:text-white transition-colors"
                      >
                        {pct}%
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

          {activeTab === 'flip' && (
            <div className="space-y-4">
              <div className="bg-surface-900/50 border border-surface-800 rounded-lg p-4">
                <div className="text-sm text-surface-400 mb-2">
                  Flipping will close your current position and open a new position in the opposite direction with the same size.
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-surface-400">Current:</span>
                  <span className={`font-medium ${isLong ? 'text-win-400' : 'text-loss-400'}`}>
                    {positionSize.toFixed(6)} {symbol} {isLong ? 'LONG' : 'SHORT'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm mt-2">
                  <span className="text-surface-400">After flip:</span>
                  <span className={`font-medium ${!isLong ? 'text-win-400' : 'text-loss-400'}`}>
                    {positionSize.toFixed(6)} {symbol} {!isLong ? 'LONG' : 'SHORT'}
                  </span>
                </div>
              </div>

            </div>
          )}
        </div>

        {/* Modal Footer - Action Buttons */}
        <div className="px-4 py-3 border-t border-surface-800 bg-surface-900/30 space-y-2">
          {activeTab === 'close' && (
            <>
              <button
                onClick={handleClose}
                disabled={isSubmitting || closeAmountTokens === 0}
                className="w-full bg-loss-500 hover:bg-loss-600 disabled:bg-surface-700 disabled:text-surface-500 text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
              >
                {isSubmitting ? 'Closing Position...' : `Close ${closePercentage.toFixed(0)}% at Market`}
              </button>
              <button
                onClick={() => {
                  window.location.href = `/trade?symbol=${symbolBase}`;
                }}
                className="w-full bg-surface-800 hover:bg-surface-700 text-surface-300 hover:text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
              >
                Go to Terminal
              </button>
            </>
          )}

          {activeTab === 'tpsl' && (
            <>
              <button
                onClick={handleSetTpSl}
                disabled={isSubmitting || (!takeProfitPrice && !stopLossPrice)}
                className="w-full bg-primary-500 hover:bg-primary-600 disabled:bg-surface-700 disabled:text-surface-500 text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
              >
                {isSubmitting ? 'Setting TP/SL...' : 'Set TP/SL'}
              </button>
              <button
                onClick={() => {
                  window.location.href = `/trade?symbol=${symbolBase}`;
                }}
                className="w-full bg-surface-800 hover:bg-surface-700 text-surface-300 hover:text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
              >
                Go to Terminal
              </button>
            </>
          )}

          {activeTab === 'flip' && (
            <>
              <button
                onClick={handleFlip}
                disabled={isSubmitting}
                className="w-full bg-primary-500 hover:bg-primary-600 disabled:bg-surface-700 disabled:text-surface-500 text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
              >
                {isSubmitting ? 'Flipping Position...' : `Flip to ${!isLong ? 'LONG' : 'SHORT'}`}
              </button>
              <button
                onClick={() => {
                  window.location.href = `/trade?symbol=${symbolBase}`;
                }}
                className="w-full bg-surface-800 hover:bg-surface-700 text-surface-300 hover:text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
              >
                Go to Terminal
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
