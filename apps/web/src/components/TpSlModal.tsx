'use client';

import { useState, useMemo, useCallback } from 'react';
import { usePrices } from '@/hooks/usePrices';
import { Portal } from './Portal';
import type { Position, TpSlOrder } from './Positions';

export interface TpSlParams {
  positionId: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  size: string; // Size in token units (effective size: full position or partial)
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
  onCancelOrder?: (orderId: string, symbol: string, orderType: string) => Promise<void>;
  isSubmitting?: boolean;
}

// Helper to format price for initial state (before component mounts)
function formatInitialPrice(price: number): string {
  if (price >= 10000) return price.toFixed(0);
  if (price >= 100) return price.toFixed(2);
  if (price >= 1) return price.toFixed(4);
  return price.toFixed(6);
}

export function TpSlModal({ position, onClose, onConfirm, onCancelOrder, isSubmitting = false }: TpSlModalProps) {
  // Tab state for main modal
  const [isPartialTab, setIsPartialTab] = useState(false);
  // State for secondary "Add Partial" modal
  const [showAddPartialModal, setShowAddPartialModal] = useState(false);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);

  // Full position TP/SL values
  const [tpPrice, setTpPrice] = useState(() =>
    position.takeProfit ? formatInitialPrice(position.takeProfit) : ''
  );
  const [slPrice, setSlPrice] = useState(() =>
    position.stopLoss ? formatInitialPrice(position.stopLoss) : ''
  );
  const [useLimitPrice, setUseLimitPrice] = useState(false);
  const [tpLimitPrice, setTpLimitPrice] = useState('');
  const [slLimitPrice, setSlLimitPrice] = useState('');

  // Partial modal state
  const [partialTpPrice, setPartialTpPrice] = useState('');
  const [partialSlPrice, setPartialSlPrice] = useState('');
  const [partialUseLimitPrice, setPartialUseLimitPrice] = useState(false);
  const [partialTpLimitPrice, setPartialTpLimitPrice] = useState('');
  const [partialSlLimitPrice, setPartialSlLimitPrice] = useState('');
  const [configureAmount, setConfigureAmount] = useState(false);
  const [partialAmount, setPartialAmount] = useState('');
  const [partialPercentage, setPartialPercentage] = useState(100);

  // Combine existing TP/SL orders for display
  const existingOrders: TpSlOrder[] = useMemo(() => {
    const orders: TpSlOrder[] = [];
    if (position.tpOrders) orders.push(...position.tpOrders);
    if (position.slOrders) orders.push(...position.slOrders);
    // Sort by trigger price descending (TPs first, then SLs)
    return orders.sort((a, b) => b.triggerPrice - a.triggerPrice);
  }, [position.tpOrders, position.slOrders]);

  const hasExistingOrders = existingOrders.length > 0;
  const tokenSymbol = position.symbol.replace('-USD', '');

  // Get live mark price, lot size, and tick size from WebSocket
  const { getPrice } = usePrices();
  const priceData = getPrice(position.symbol);
  const livePrice = priceData?.price || position.markPrice;
  const lotSize = priceData?.lotSize || 0.00001;
  const tickSize = priceData?.tickSize || 0.01;

  // Helper functions for lot size and tick size rounding
  const { roundToLotSize, formatAmount, roundToTickSize } = useMemo(() => {
    // Calculate decimal places from tick size (e.g., 0.1 -> 1 decimal, 0.01 -> 2 decimals)
    const tickDecimals = tickSize >= 1 ? 0 : Math.max(0, -Math.floor(Math.log10(tickSize)));
    const lotDecimals = Math.max(0, -Math.floor(Math.log10(lotSize)));

    return {
      roundToLotSize: (value: number): number => {
        // Use Math.round to avoid floating point precision issues
        // e.g., 0.00061 / 0.00001 = 60.99999... should round to 61, not floor to 60
        return Math.round(value / lotSize) * lotSize;
      },
      formatAmount: (value: number): string => {
        return value.toFixed(lotDecimals);
      },
      roundToTickSize: (value: number): number => {
        // Round price to nearest tick size, then fix floating point precision
        // e.g., 31436 * 0.1 = 3143.6000000000004, need to fix to 3143.6
        const rounded = Math.round(value / tickSize) * tickSize;
        // Use toFixed to eliminate floating point errors, then parse back
        return parseFloat(rounded.toFixed(tickDecimals));
      },
    };
  }, [lotSize, tickSize]);

  // Update amount when percentage changes (partial modal)
  const handlePartialPercentageChange = useCallback((pct: number) => {
    setPartialPercentage(pct);
    // At 100%, use exact position size without rounding
    if (pct === 100) {
      setPartialAmount(formatAmount(position.sizeInToken));
    } else {
      const rawAmount = position.sizeInToken * pct / 100;
      const rounded = roundToLotSize(rawAmount);
      setPartialAmount(formatAmount(rounded));
    }
  }, [position.sizeInToken, roundToLotSize, formatAmount]);

  // Update percentage when amount changes (partial modal)
  const handlePartialAmountChange = (value: string) => {
    setPartialAmount(value);
    const numAmount = parseFloat(value) || 0;
    const pct = position.sizeInToken > 0 ? Math.min(100, (numAmount / position.sizeInToken) * 100) : 0;
    setPartialPercentage(pct);
  };

  // Round amount on blur
  const handlePartialAmountBlur = () => {
    const numAmount = parseFloat(partialAmount) || 0;
    if (numAmount > 0) {
      const rounded = Math.min(roundToLotSize(numAmount), position.sizeInToken);
      setPartialAmount(formatAmount(rounded));
      const pct = position.sizeInToken > 0 ? Math.min(100, (rounded / position.sizeInToken) * 100) : 0;
      setPartialPercentage(pct);
    }
  };

  // Format price with appropriate decimals
  const formatPrice = (p: number) => {
    if (p >= 10000) return p.toFixed(0);
    if (p >= 100) return p.toFixed(2);
    if (p >= 1) return p.toFixed(4);
    return p.toFixed(6);
  };

  // Calculate TP price based on percentage gain
  const calculateTpPrice = (gainPercent: number, size: number) => {
    const margin = position.margin * (size / position.sizeInToken);
    const gainAmount = (margin * gainPercent) / 100;

    if (position.side === 'LONG') {
      return position.entryPrice + (gainAmount / size);
    } else {
      return position.entryPrice - (gainAmount / size);
    }
  };

  // Calculate SL price based on percentage loss
  const calculateSlPrice = (lossPercent: number, size: number) => {
    const margin = position.margin * (size / position.sizeInToken);
    const lossAmount = (margin * Math.abs(lossPercent)) / 100;

    if (position.side === 'LONG') {
      return position.entryPrice - (lossAmount / size);
    } else {
      return position.entryPrice + (lossAmount / size);
    }
  };

  // Calculate effective size for partial
  const partialEffectiveSize = useMemo(() => {
    if (configureAmount) {
      return parseFloat(partialAmount) || position.sizeInToken;
    }
    return position.sizeInToken;
  }, [configureAmount, partialAmount, position.sizeInToken]);

  // Calculate estimated gain/loss for full position
  const tpGain = useMemo(() => {
    const tp = parseFloat(tpPrice);
    if (!tp) return 0;
    if (position.side === 'LONG') {
      return (tp - position.entryPrice) * position.sizeInToken;
    } else {
      return (position.entryPrice - tp) * position.sizeInToken;
    }
  }, [tpPrice, position.side, position.entryPrice, position.sizeInToken]);

  const slLoss = useMemo(() => {
    const sl = parseFloat(slPrice);
    if (!sl) return 0;
    if (position.side === 'LONG') {
      return (sl - position.entryPrice) * position.sizeInToken;
    } else {
      return (position.entryPrice - sl) * position.sizeInToken;
    }
  }, [slPrice, position.side, position.entryPrice, position.sizeInToken]);

  // Calculate estimated gain/loss for partial
  const partialTpGain = useMemo(() => {
    const tp = parseFloat(partialTpPrice);
    if (!tp || !partialEffectiveSize) return 0;
    if (position.side === 'LONG') {
      return (tp - position.entryPrice) * partialEffectiveSize;
    } else {
      return (position.entryPrice - tp) * partialEffectiveSize;
    }
  }, [partialTpPrice, position.side, position.entryPrice, partialEffectiveSize]);

  const partialSlLoss = useMemo(() => {
    const sl = parseFloat(partialSlPrice);
    if (!sl || !partialEffectiveSize) return 0;
    if (position.side === 'LONG') {
      return (sl - position.entryPrice) * partialEffectiveSize;
    } else {
      return (position.entryPrice - sl) * partialEffectiveSize;
    }
  }, [partialSlPrice, position.side, position.entryPrice, partialEffectiveSize]);

  // Calculate percentage of margin
  const tpPercent = position.margin > 0 ? (tpGain / position.margin) * 100 : 0;
  const slPercent = position.margin > 0 ? (slLoss / position.margin) * 100 : 0;

  const partialMargin = position.margin * (partialEffectiveSize / position.sizeInToken);
  const partialTpPercent = partialMargin > 0 ? (partialTpGain / partialMargin) * 100 : 0;
  const partialSlPercent = partialMargin > 0 ? (partialSlLoss / partialMargin) * 100 : 0;

  // Full position TP/SL percent button handlers
  const handleTpPercentClick = (percent: number) => {
    const price = calculateTpPrice(percent, position.sizeInToken);
    setTpPrice(formatPrice(price));
  };

  const handleSlPercentClick = (percent: number) => {
    const price = calculateSlPrice(percent, position.sizeInToken);
    setSlPrice(formatPrice(price));
  };

  // Partial TP/SL percent button handlers
  const handlePartialTpPercentClick = (percent: number) => {
    const price = calculateTpPrice(percent, partialEffectiveSize);
    setPartialTpPrice(formatPrice(price));
  };

  const handlePartialSlPercentClick = (percent: number) => {
    const price = calculateSlPrice(percent, partialEffectiveSize);
    setPartialSlPrice(formatPrice(price));
  };

  // Confirm full position TP/SL
  const handleConfirmFullPosition = () => {
    const params: TpSlParams = {
      positionId: position.id,
      symbol: position.symbol,
      side: position.side,
      size: position.sizeInToken.toString(),
      isPartial: false,
    };

    if (tpPrice && parseFloat(tpPrice) > 0) {
      // Round to tick size to avoid "not a multiple of tick size" errors
      const roundedTpPrice = roundToTickSize(parseFloat(tpPrice));
      params.takeProfit = {
        stopPrice: roundedTpPrice.toString(),
        limitPrice: useLimitPrice && tpLimitPrice ? roundToTickSize(parseFloat(tpLimitPrice)).toString() : undefined,
      };
    }

    if (slPrice && parseFloat(slPrice) > 0) {
      // Round to tick size to avoid "not a multiple of tick size" errors
      const roundedSlPrice = roundToTickSize(parseFloat(slPrice));
      params.stopLoss = {
        stopPrice: roundedSlPrice.toString(),
        limitPrice: useLimitPrice && slLimitPrice ? roundToTickSize(parseFloat(slLimitPrice)).toString() : undefined,
      };
    }

    onConfirm(params);
  };

  // Confirm partial TP/SL
  const handleConfirmPartial = () => {
    const effectiveSize = configureAmount ? (parseFloat(partialAmount) || position.sizeInToken) : position.sizeInToken;

    const params: TpSlParams = {
      positionId: position.id,
      symbol: position.symbol,
      side: position.side,
      size: effectiveSize.toString(),
      isPartial: true,
      partialAmount: configureAmount ? partialAmount : undefined,
    };

    if (partialTpPrice && parseFloat(partialTpPrice) > 0) {
      // Round to tick size to avoid "not a multiple of tick size" errors
      const roundedTpPrice = roundToTickSize(parseFloat(partialTpPrice));
      params.takeProfit = {
        stopPrice: roundedTpPrice.toString(),
        limitPrice: partialUseLimitPrice && partialTpLimitPrice ? roundToTickSize(parseFloat(partialTpLimitPrice)).toString() : undefined,
      };
    }

    if (partialSlPrice && parseFloat(partialSlPrice) > 0) {
      // Round to tick size to avoid "not a multiple of tick size" errors
      const roundedSlPrice = roundToTickSize(parseFloat(partialSlPrice));
      params.stopLoss = {
        stopPrice: roundedSlPrice.toString(),
        limitPrice: partialUseLimitPrice && partialSlLimitPrice ? roundToTickSize(parseFloat(partialSlLimitPrice)).toString() : undefined,
      };
    }

    onConfirm(params);
    // Close partial modal but keep main modal open
    setShowAddPartialModal(false);
    // Reset partial form
    setPartialTpPrice('');
    setPartialSlPrice('');
    setPartialUseLimitPrice(false);
    setPartialTpLimitPrice('');
    setPartialSlLimitPrice('');
    setConfigureAmount(false);
    setPartialAmount('');
    setPartialPercentage(100);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handlePartialBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setShowAddPartialModal(false);
    }
  };

  // Open Add Partial modal
  const handleOpenAddPartial = () => {
    // Initialize with full position size
    handlePartialPercentageChange(100);
    setShowAddPartialModal(true);
  };

  // Validation for full position
  const hasValidFullInput = (tpPrice && parseFloat(tpPrice) > 0) ||
                            (slPrice && parseFloat(slPrice) > 0);

  // Validation for partial
  const hasValidPartialInput = (partialTpPrice && parseFloat(partialTpPrice) > 0) ||
                               (partialSlPrice && parseFloat(partialSlPrice) > 0);
  const hasValidPartialAmount = !configureAmount || (parseFloat(partialAmount) > 0);
  const canSubmitPartial = hasValidPartialInput && hasValidPartialAmount;

  return (
    <Portal>
      {/* Main Modal */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={handleBackdropClick}
      >
        <div className="bg-surface-800 rounded-xl shadow-xl w-full max-w-md mx-4 border border-surface-700 max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-surface-700">
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
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Position Info */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm p-3 bg-surface-900/30 rounded-lg">
              <div className="flex justify-between">
                <span className="text-surface-400">Symbol</span>
                <span className="text-white font-medium">{tokenSymbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-surface-400">Entry</span>
                <span className="text-white font-mono">${formatPrice(position.entryPrice)}</span>
              </div>
              <div className="flex justify-between items-center col-span-2 pt-1">
                <div className="flex items-center gap-2">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${
                    position.side === 'LONG'
                      ? 'bg-win-500/20 text-win-400'
                      : 'bg-loss-500/20 text-loss-400'
                  }`}>
                    {position.leverage}x {position.side === 'LONG' ? 'Long' : 'Short'}
                  </span>
                  <span className="text-white font-mono text-sm">{position.sizeInToken.toFixed(5)} {tokenSymbol}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-white font-mono tabular-nums">${formatPrice(livePrice)}</span>
                  <span className="text-[10px] text-win-400 bg-win-500/20 px-1.5 py-0.5 rounded font-medium animate-pulse">
                    LIVE
                  </span>
                </div>
              </div>
            </div>

            {/* Full Position / Partial Toggle */}
            <div className="flex border border-surface-700 rounded-lg overflow-hidden">
              <button
                onClick={() => setIsPartialTab(false)}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  !isPartialTab
                    ? 'bg-surface-700 text-white'
                    : 'bg-surface-800 text-surface-400 hover:text-white'
                }`}
              >
                Full Position
              </button>
              <button
                onClick={() => setIsPartialTab(true)}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  isPartialTab
                    ? 'bg-surface-700 text-white'
                    : 'bg-surface-800 text-surface-400 hover:text-white'
                }`}
              >
                Partial
              </button>
            </div>

            {/* Full Position Tab Content */}
            {!isPartialTab && (
              <>
                {/* Take Profit */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-surface-400">TP Price</label>
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
                  </div>
                </div>

                {/* Stop Loss */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-surface-400">SL Price</label>
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
                  </div>
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

                {/* Limit Price Inputs */}
                {useLimitPrice && (
                  <div className="space-y-3 p-3 bg-surface-900/50 rounded-lg border border-surface-700">
                    <div className="space-y-1.5">
                      <label className="text-xs text-surface-400">TP Limit Price</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={tpLimitPrice}
                          onChange={(e) => setTpLimitPrice(e.target.value)}
                          placeholder={tpPrice || '0.00'}
                          className="flex-1 bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-primary-500"
                        />
                        <span className="text-surface-400 text-xs">USD</span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-surface-400">SL Limit Price</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={slLimitPrice}
                          onChange={(e) => setSlLimitPrice(e.target.value)}
                          placeholder={slPrice || '0.00'}
                          className="flex-1 bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-primary-500"
                        />
                        <span className="text-surface-400 text-xs">USD</span>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-surface-700 space-y-2">
                      <p className="text-xs text-surface-400 leading-relaxed">
                        Enabling this converts your TP/SL from a market stop into a limit stop. When the trigger price is hit, a limit order is placed at the prices you specify above.
                      </p>
                      <p className="text-xs text-surface-500 leading-relaxed">
                        <span className="text-surface-400 font-medium">NOTE:</span> Limit stops may not execute if the limit prices are not reached again after the trigger price is hit. For guaranteed execution, uncheck this field to use market stop instead.
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Partial Tab Content */}
            {isPartialTab && (
              <div className="space-y-3">
                {/* Add button */}
                <div className="flex justify-end">
                  <button
                    onClick={handleOpenAddPartial}
                    className="px-4 py-2 text-sm font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-400 transition-colors"
                  >
                    Add
                  </button>
                </div>

                {/* Existing Orders List */}
                {hasExistingOrders ? (
                  <div className="space-y-2">
                    {existingOrders.map((order) => (
                      <div
                        key={order.orderId}
                        className={`p-3 rounded-lg border ${
                          order.type === 'TP'
                            ? 'bg-win-500/5 border-win-500/20'
                            : 'bg-loss-500/5 border-loss-500/20'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-medium ${
                              order.type === 'TP' ? 'text-win-400' : 'text-loss-400'
                            }`}>
                              {order.type === 'TP' ? 'Take Profit' : 'Stop Loss'}
                            </span>
                            <span className={`font-mono text-sm ${
                              order.type === 'TP' ? 'text-win-400' : 'text-loss-400'
                            }`}>
                              ${formatPrice(order.triggerPrice)}
                            </span>
                            <span className="text-xs text-surface-500">
                              ({order.orderType === 'market' ? 'Market' : 'Limit'})
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <span className="text-xs text-surface-400">Qty: </span>
                              <span className="text-xs text-white font-mono">
                                {order.amount.toFixed(5)}
                              </span>
                            </div>
                            <button
                              onClick={async () => {
                                if (!onCancelOrder) return;
                                setCancellingOrderId(order.orderId);
                                try {
                                  const orderType = order.type === 'TP' ? 'TP MARKET' : 'SL MARKET';
                                  await onCancelOrder(order.orderId, position.symbol.replace('-USD', ''), orderType);
                                } finally {
                                  setCancellingOrderId(null);
                                }
                              }}
                              disabled={cancellingOrderId === order.orderId}
                              className="px-3 py-1 text-xs font-medium bg-surface-700 text-surface-300 rounded hover:bg-surface-600 transition-colors disabled:opacity-50"
                            >
                              {cancellingOrderId === order.orderId ? '...' : 'Cancel'}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-surface-500 text-sm">
                    No partial TP/SL orders. Click &quot;Add&quot; to create one.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer - only show Confirm button for Full Position tab */}
          {!isPartialTab && (
            <div className="flex-shrink-0 p-4 border-t border-surface-700">
              <button
                onClick={handleConfirmFullPosition}
                disabled={isSubmitting || !hasValidFullInput}
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
          )}
        </div>
      </div>

      {/* Add Partial TP/SL Modal */}
      {showAddPartialModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={handlePartialBackdropClick}
        >
          <div className="bg-surface-800 rounded-xl shadow-xl w-full max-w-md mx-4 border border-surface-700 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-surface-700">
              <h2 className="text-lg font-semibold text-white">Add Partial TP/SL</h2>
              <button
                onClick={() => setShowAddPartialModal(false)}
                className="text-surface-400 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Take Profit */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-surface-400">TP Price</label>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-surface-500">Gain</span>
                    <span className={`font-mono ${partialTpGain >= 0 ? 'text-win-400' : 'text-loss-400'}`}>
                      ${partialTpGain.toFixed(2)}
                    </span>
                    <span className="text-surface-600">|</span>
                    <span className={`font-mono ${partialTpPercent >= 0 ? 'text-win-400' : 'text-loss-400'}`}>
                      {partialTpPercent >= 0 ? '+' : ''}{partialTpPercent.toFixed(0)}%
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={partialTpPrice}
                    onChange={(e) => setPartialTpPrice(e.target.value)}
                    placeholder="0.00"
                    className="flex-1 bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-primary-500"
                  />
                  <span className="text-surface-400 text-sm">USD</span>
                </div>
                <div className="flex gap-2">
                  {[25, 50, 75, 100].map((pct) => (
                    <button
                      key={pct}
                      onClick={() => handlePartialTpPercentClick(pct)}
                      className="flex-1 py-1.5 rounded text-xs font-medium bg-surface-700 text-surface-300 hover:bg-surface-600 hover:text-white transition-colors"
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Stop Loss */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-surface-400">SL Price</label>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-surface-500">Loss</span>
                    <span className={`font-mono ${partialSlLoss <= 0 ? 'text-loss-400' : 'text-win-400'}`}>
                      ${partialSlLoss.toFixed(2)}
                    </span>
                    <span className="text-surface-600">|</span>
                    <span className={`font-mono ${partialSlPercent <= 0 ? 'text-loss-400' : 'text-win-400'}`}>
                      {partialSlPercent.toFixed(0)}%
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={partialSlPrice}
                    onChange={(e) => setPartialSlPrice(e.target.value)}
                    placeholder="0.00"
                    className="flex-1 bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-primary-500"
                  />
                  <span className="text-surface-400 text-sm">USD</span>
                </div>
                <div className="flex gap-2">
                  {[-25, -50, -75, -100].map((pct) => (
                    <button
                      key={pct}
                      onClick={() => handlePartialSlPercentClick(pct)}
                      className="flex-1 py-1.5 rounded text-xs font-medium bg-surface-700 text-surface-300 hover:bg-surface-600 hover:text-white transition-colors"
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Configure Amount Toggle */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setConfigureAmount(!configureAmount)}
                  className={`w-10 h-5 rounded-full transition-colors relative ${
                    configureAmount ? 'bg-primary-500' : 'bg-surface-600'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                      configureAmount ? 'left-5' : 'left-0.5'
                    }`}
                  />
                </button>
                <span className="text-sm text-surface-300">Configure Amount</span>
              </div>

              {/* Amount Configuration */}
              {configureAmount && (
                <div className="space-y-3 p-3 bg-surface-900/50 rounded-lg border border-surface-700">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={partialAmount}
                      onChange={(e) => handlePartialAmountChange(e.target.value)}
                      onBlur={handlePartialAmountBlur}
                      placeholder="0.00"
                      className="flex-1 bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-primary-500"
                    />
                    <span className="text-surface-400 text-sm min-w-[50px]">{tokenSymbol}</span>
                  </div>

                  {/* Slider */}
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={partialPercentage}
                      onChange={(e) => handlePartialPercentageChange(parseInt(e.target.value))}
                      className="flex-1 h-2 bg-surface-700 rounded-lg appearance-none cursor-pointer accent-primary-500"
                      style={{
                        background: `linear-gradient(to right, #22d3ee 0%, #22d3ee ${partialPercentage}%, #374151 ${partialPercentage}%, #374151 100%)`
                      }}
                    />
                    <span className="text-sm text-white font-mono min-w-[50px] text-right">{partialPercentage.toFixed(0)}%</span>
                  </div>

                  {/* Quick buttons */}
                  <div className="flex gap-2">
                    {[25, 50, 75, 100].map((pct) => (
                      <button
                        key={pct}
                        onClick={() => handlePartialPercentageChange(pct)}
                        className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors ${
                          Math.abs(partialPercentage - pct) < 1
                            ? 'bg-surface-600 text-white'
                            : 'bg-surface-700 text-surface-300 hover:bg-surface-600'
                        }`}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Limit Price Toggle */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setPartialUseLimitPrice(!partialUseLimitPrice)}
                  className={`w-10 h-5 rounded-full transition-colors relative ${
                    partialUseLimitPrice ? 'bg-primary-500' : 'bg-surface-600'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                      partialUseLimitPrice ? 'left-5' : 'left-0.5'
                    }`}
                  />
                </button>
                <span className="text-sm text-surface-300">Limit Price</span>
              </div>

              {/* Limit Price Inputs */}
              {partialUseLimitPrice && (
                <div className="space-y-3 p-3 bg-surface-900/50 rounded-lg border border-surface-700">
                  <div className="space-y-1.5">
                    <label className="text-xs text-surface-400">TP Limit Price</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={partialTpLimitPrice}
                        onChange={(e) => setPartialTpLimitPrice(e.target.value)}
                        placeholder={partialTpPrice || '0.00'}
                        className="flex-1 bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-primary-500"
                      />
                      <span className="text-surface-400 text-xs">USD</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-surface-400">SL Limit Price</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={partialSlLimitPrice}
                        onChange={(e) => setPartialSlLimitPrice(e.target.value)}
                        placeholder={partialSlPrice || '0.00'}
                        className="flex-1 bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-primary-500"
                      />
                      <span className="text-surface-400 text-xs">USD</span>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-surface-700 space-y-2">
                    <p className="text-xs text-surface-400 leading-relaxed">
                      Enabling this converts your TP/SL from a market stop into a limit stop. When the trigger price is hit, a limit order is placed at the prices you specify above.
                    </p>
                    <p className="text-xs text-surface-500 leading-relaxed">
                      <span className="text-surface-400 font-medium">NOTE:</span> Limit stops may not execute if the limit prices are not reached again after the trigger price is hit. For guaranteed execution, uncheck this field to use market stop instead.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 p-4 border-t border-surface-700">
              <button
                onClick={handleConfirmPartial}
                disabled={isSubmitting || !canSubmitPartial}
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
      )}
    </Portal>
  );
}
