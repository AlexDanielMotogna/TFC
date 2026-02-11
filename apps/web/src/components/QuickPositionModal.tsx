'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useCreateMarketOrder, useCreateLimitOrder, useSetPositionTpSl } from '@/hooks/useOrders';
import { usePrices } from '@/hooks/usePrices';
import type { Position } from '@/hooks/usePacificaWebSocket';
import CloseIcon from '@mui/icons-material/Close';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import {
  calculateTpPrice,
  calculateSlPrice,
  calculatePositionMetrics,
  roundToLotSize,
  roundToTickSize,
  formatPrice,
  type PositionInfo,
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
  const createLimitOrder = useCreateLimitOrder();
  const setTpSl = useSetPositionTpSl();

  const [activeTab, setActiveTab] = useState<'close' | 'limit' | 'tpsl' | 'flip'>('close');
  const [closeAmount, setCloseAmount] = useState('100'); // Percentage
  const [stopLossPrice, setStopLossPrice] = useState('');
  const [takeProfitPrice, setTakeProfitPrice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Limit close state
  const [limitPrice, setLimitPrice] = useState('');
  const [limitCloseAmount, setLimitCloseAmount] = useState('');
  const [limitClosePercentage, setLimitClosePercentage] = useState(0);

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

  // Get lot size and tick size from price data (same source as TpSlModal)
  const lotSize = priceData?.lotSize || 0.00001;
  const tickSize = priceData?.tickSize || 0.01;

  // Memoized formatting helpers (same as TpSlModal and MarketCloseModal)
  const { formatAmount } = useMemo(() => {
    const decimals = Math.max(0, -Math.floor(Math.log10(lotSize)));
    return {
      formatAmount: (value: number): string => value.toFixed(decimals),
    };
  }, [lotSize]);

  // Helper: round to lot size locally (floor, same as MarketCloseModal)
  const floorToLotSize = useCallback((value: number): number => {
    return Math.floor(value / lotSize) * lotSize;
  }, [lotSize]);

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

  // Limit close: calculate amount tokens
  const limitCloseAmountTokens = parseFloat(limitCloseAmount) || 0;

  // Limit close: estimated PnL
  const limitEstimatedPnl = useMemo(() => {
    const closePrice = parseFloat(limitPrice) || 0;
    if (!closePrice || !limitCloseAmountTokens) return 0;
    const priceDiff = isLong
      ? closePrice - entryPrice
      : entryPrice - closePrice;
    return priceDiff * limitCloseAmountTokens;
  }, [limitPrice, limitCloseAmountTokens, isLong, entryPrice]);

  // Limit close: USD value
  const limitCloseUsdValue = useMemo(() => {
    return limitCloseAmountTokens * (parseFloat(limitPrice) || currentPrice);
  }, [limitCloseAmountTokens, limitPrice, currentPrice]);

  // Limit close handlers (same logic as LimitCloseModal)
  const handleLimitPercentageChange = useCallback((pct: number) => {
    setLimitClosePercentage(pct);
    const rawAmount = positionSize * pct / 100;
    const roundedAmount = floorToLotSize(rawAmount);
    setLimitCloseAmount(formatAmount(roundedAmount));
  }, [positionSize, floorToLotSize, formatAmount]);

  const handleLimitAmountChange = (value: string) => {
    setLimitCloseAmount(value);
    const numAmount = parseFloat(value) || 0;
    const pct = positionSize > 0 ? Math.min(100, (numAmount / positionSize) * 100) : 0;
    setLimitClosePercentage(pct);
  };

  const handleLimitAmountBlur = () => {
    const numAmount = parseFloat(limitCloseAmount) || 0;
    if (numAmount > 0) {
      const roundedAmount = Math.min(floorToLotSize(numAmount), positionSize);
      setLimitCloseAmount(formatAmount(roundedAmount));
      const pct = positionSize > 0 ? Math.min(100, (roundedAmount / positionSize) * 100) : 0;
      setLimitClosePercentage(pct);
    }
  };

  // Reset form when modal opens (only on open transition, not on price updates)
  const [wasOpen, setWasOpen] = useState(false);
  useEffect(() => {
    if (isOpen && !wasOpen) {
      // Modal just opened - reset everything
      setCloseAmount('100');
      setStopLossPrice('');
      setTakeProfitPrice('');
      setLimitPrice(formatPrice(markPrice));
      setLimitCloseAmount('');
      setLimitClosePercentage(0);
      setActiveTab('close');
    }
    setWasOpen(isOpen);
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null;

  const handleClose = async () => {
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);

      await createMarketOrder.mutateAsync({
        symbol: symbol,
        side: isLong ? 'ask' : 'bid', // Opposite side to close
        amount: formatAmount(closeAmountTokens),
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

  const handleLimitClose = async () => {
    if (isSubmitting || !limitPrice || !limitCloseAmount || limitCloseAmountTokens <= 0) return;

    try {
      setIsSubmitting(true);

      const tokenSymbol = symbol.replace('-USD', '');
      await createLimitOrder.mutateAsync({
        symbol: tokenSymbol,
        side: isLong ? 'ask' : 'bid', // Opposite side to close
        amount: limitCloseAmount,
        price: limitPrice,
        reduceOnly: true,
      });

      onClose();
    } catch (error) {
      console.error('Failed to limit close position:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetTpSl = async () => {
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);

      // Round prices to tick size before submitting (same as TpSlModal)
      const takeProfit = takeProfitPrice && parseFloat(takeProfitPrice) > 0
        ? { stop_price: roundToTickSize(parseFloat(takeProfitPrice), tickSize) }
        : null;

      const stopLoss = stopLossPrice && parseFloat(stopLossPrice) > 0
        ? { stop_price: roundToTickSize(parseFloat(stopLossPrice), tickSize) }
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
      // Use 2x position size (same as terminal's trade/page.tsx)
      const doubleAmount = (positionSize * 2).toString();

      await createMarketOrder.mutateAsync({
        symbol: symbol,
        side: isLong ? 'ask' : 'bid', // Opposite side to flip
        amount: doubleAmount,
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
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2.5 text-xs sm:text-sm font-medium transition-colors ${
              activeTab === 'close'
                ? 'bg-surface-800 text-white border-b-2 border-primary-500'
                : 'text-surface-400 hover:text-white hover:bg-surface-800/50'
            }`}
          >
            <CloseIcon sx={{ fontSize: 16 }} />
            Market
          </button>
          <button
            onClick={() => setActiveTab('limit')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2.5 text-xs sm:text-sm font-medium transition-colors ${
              activeTab === 'limit'
                ? 'bg-surface-800 text-white border-b-2 border-primary-500'
                : 'text-surface-400 hover:text-white hover:bg-surface-800/50'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            Limit
          </button>
          <button
            onClick={() => setActiveTab('tpsl')}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2.5 text-xs sm:text-sm font-medium transition-colors ${
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
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2.5 text-xs sm:text-sm font-medium transition-colors ${
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
                  {formatAmount(closeAmountTokens)} {symbolBase} (${(closeAmountTokens * currentPrice).toFixed(2)})
                </div>
              </div>
            </div>
          )}

          {activeTab === 'limit' && (
            <div className="space-y-4">
              {/* Price Input */}
              <div>
                <label className="block text-xs text-surface-400 mb-2">Price</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={limitPrice}
                    onChange={(e) => setLimitPrice(e.target.value)}
                    className="flex-1 bg-surface-900 border border-surface-800 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-primary-500"
                    placeholder="0.00"
                  />
                  <button
                    onClick={() => setLimitPrice(formatPrice(currentPrice))}
                    className="px-3 py-2 text-xs text-primary-400 hover:text-primary-300 transition-colors"
                  >
                    Mid
                  </button>
                  <span className="text-surface-400 text-sm">USD</span>
                </div>
              </div>

              {/* Amount Input */}
              <div>
                <label className="block text-xs text-surface-400 mb-2">Amount</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={limitCloseAmount}
                    onChange={(e) => handleLimitAmountChange(e.target.value)}
                    onBlur={handleLimitAmountBlur}
                    className="flex-1 bg-surface-900 border border-surface-800 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-primary-500"
                    placeholder="0.00"
                  />
                  <span className="text-surface-400 text-sm">{symbolBase}</span>
                </div>
                <div className="text-xs text-surface-500 mt-1">
                  ${limitCloseUsdValue.toFixed(2)} USD
                </div>
              </div>

              {/* Quick Percentage Buttons */}
              <div className="flex gap-2">
                {[25, 50, 75, 100].map((pct) => (
                  <button
                    key={pct}
                    onClick={() => handleLimitPercentageChange(pct)}
                    className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors ${
                      Math.abs(limitClosePercentage - pct) < 1
                        ? 'bg-primary-500 text-white'
                        : 'bg-surface-800 text-surface-400 hover:bg-surface-700 hover:text-white'
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>

              {/* Percentage Slider */}
              <input
                type="range"
                min="0"
                max="100"
                value={limitClosePercentage}
                onChange={(e) => handleLimitPercentageChange(parseInt(e.target.value))}
                className="w-full h-2 bg-surface-700 rounded-lg appearance-none cursor-pointer accent-primary-500"
                style={{
                  background: `linear-gradient(to right, #22d3ee 0%, #22d3ee ${limitClosePercentage}%, #27272a ${limitClosePercentage}%, #27272a 100%)`
                }}
              />

              {/* Estimated PnL */}
              <div className="flex justify-end items-center gap-2 text-xs">
                <span className="text-surface-400">Estimated PnL:</span>
                <span className={`font-mono font-semibold ${
                  limitEstimatedPnl >= 0 ? 'text-win-400' : 'text-loss-400'
                }`}>
                  {limitEstimatedPnl >= 0 ? '+' : '-'}${Math.abs(limitEstimatedPnl).toFixed(2)}
                </span>
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
                        onClick={() => setTakeProfitPrice(roundToTickSize(tpPrice, tickSize))}
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
                        onClick={() => setStopLossPrice(roundToTickSize(slPrice, tickSize))}
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
                    {formatAmount(positionSize)} {symbolBase} {isLong ? 'LONG' : 'SHORT'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm mt-2">
                  <span className="text-surface-400">After flip:</span>
                  <span className={`font-medium ${!isLong ? 'text-win-400' : 'text-loss-400'}`}>
                    {formatAmount(positionSize)} {symbolBase} {!isLong ? 'LONG' : 'SHORT'}
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

          {activeTab === 'limit' && (
            <>
              <button
                onClick={handleLimitClose}
                disabled={isSubmitting || !limitPrice || limitCloseAmountTokens <= 0}
                className="w-full bg-primary-500 hover:bg-primary-600 disabled:bg-surface-700 disabled:text-surface-500 text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
              >
                {isSubmitting ? 'Submitting...' : 'Limit Close'}
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
