'use client';

/**
 * AI Trading Signal Widget — Professional Edition
 * Institutional-grade floating panel for AI-powered trading signal analysis.
 * Features: tabbed UI, order execution flow, chart line drawing, position awareness.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useAiBias } from '@/hooks/useAiBias';
import { useAccount } from '@/hooks/useAccount';
import { usePrices } from '@/hooks/usePrices';
import { useCreateMarketOrder, useCreateLimitOrder } from '@/hooks/useOrders';
import { roundToTickSize, calculateOrderAmount } from '@/lib/trading/utils';
import { AiDisclaimerModal } from '@/components/AiDisclaimerModal';
import type { ChartWidget } from '@/components/TradingViewChartAdvanced';
import type { RiskProfile, SignalDirection, OpenPosition, PositionAction } from '@/lib/ai/types/AiBias.types';

const DISCLAIMER_KEY = 'tfc-ai-disclaimer-accepted';

interface AiBiasWidgetProps {
  selectedMarket: string;
  currentPrice: number;
  tvWidget?: ChartWidget | null;
}

type Tab = 'signal' | 'factors' | 'positions';
type OrderMode = 'market' | 'limit';
type ExecStep = 'idle' | 'confirm' | 'pending' | 'success' | 'error';

const RISK_LABELS: Record<RiskProfile, string> = {
  conservative: 'Safe',
  moderate: 'Balanced',
  aggressive: 'Aggro',
};

const SIGNAL_CONFIG: Record<SignalDirection, {
  label: string; arrow: string; color: string; barColor: string;
  bgColor: string; borderColor: string;
}> = {
  LONG:     { label: 'LONG',     arrow: '↑', color: 'text-win-400',     barColor: 'bg-win-400',     bgColor: 'bg-win-400/10',     borderColor: 'border-win-400/30' },
  SHORT:    { label: 'SHORT',    arrow: '↓', color: 'text-loss-400',    barColor: 'bg-loss-400',    bgColor: 'bg-loss-400/10',    borderColor: 'border-loss-400/30' },
  STAY_OUT: { label: 'STAY OUT', arrow: '—', color: 'text-surface-400', barColor: 'bg-surface-500', bgColor: 'bg-surface-800',    borderColor: 'border-surface-600' },
};

const ACTION_CONFIG: Record<PositionAction, { label: string; color: string; bg: string }> = {
  HOLD:    { label: 'HOLD',    color: 'text-surface-300', bg: 'bg-surface-700/60' },
  CLOSE:   { label: 'CLOSE',   color: 'text-loss-400',    bg: 'bg-loss-400/10' },
  ADD:     { label: 'ADD',     color: 'text-win-400',     bg: 'bg-win-400/10' },
  REDUCE:  { label: 'REDUCE',  color: 'text-yellow-400',  bg: 'bg-yellow-400/10' },
  MOVE_SL: { label: 'MOVE SL', color: 'text-blue-400',   bg: 'bg-blue-400/10' },
};

export function AiBiasWidget({ selectedMarket, tvWidget }: AiBiasWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('signal');
  const [riskProfile, setRiskProfile] = useState<RiskProfile>('moderate');
  const [orderMode, setOrderMode] = useState<OrderMode>('market');
  const [execStep, setExecStep] = useState<ExecStep>('idle');
  const [execError, setExecError] = useState<string | null>(null);
  const [posExecStep, setPosExecStep] = useState<Record<string, ExecStep>>({});
  const [posExecError, setPosExecError] = useState<Record<string, string | null>>({});
  const [chartLinesDrawn, setChartLinesDrawn] = useState(false);
  const [customPositionValue, setCustomPositionValue] = useState<string>('');

  const { data, isLoading, error, analyze, clear, isExpired } = useAiBias();
  const { connected } = useWallet();
  const { account, positions: accountPositions } = useAccount();
  const { getPrice } = usePrices();
  const createMarketOrder = useCreateMarketOrder();
  const createLimitOrder = useCreateLimitOrder();

  const drawnShapeIdsRef = useRef<unknown[]>([]);
  const lastDrawnTimestampRef = useRef<number | null>(null);

  // Disclaimer state
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  useEffect(() => {
    setDisclaimerAccepted(localStorage.getItem(DISCLAIMER_KEY) === 'true');
  }, []);

  const handleAcceptDisclaimer = useCallback(() => {
    localStorage.setItem(DISCLAIMER_KEY, 'true');
    setDisclaimerAccepted(true);
    setShowDisclaimer(false);
  }, []);

  // Reset state when market changes
  useEffect(() => {
    clear();
    setActiveTab('signal');
    setExecStep('idle');
    setExecError(null);
    setCustomPositionValue('');
    // Reset draw guard so new signal on new market triggers a redraw
    lastDrawnTimestampRef.current = null;
    drawnShapeIdsRef.current = [];
    setChartLinesDrawn(false);
  }, [selectedMarket, clear]);

  // Map positions to OpenPosition format — per-symbol live price
  const openPositions: OpenPosition[] = useMemo(() => {
    if (!accountPositions || accountPositions.length === 0) return [];
    return accountPositions.map((p) => {
      const entryPrice = parseFloat(p.entryPrice) || 0;
      const sizeInToken = parseFloat(p.size) || 0;
      const symbolPriceData = getPrice(p.symbol);
      const markPrice = symbolPriceData?.price || symbolPriceData?.oracle
        || parseFloat(p.markPrice) || entryPrice;
      const pnlRaw = p.side === 'LONG'
        ? (markPrice - entryPrice) * sizeInToken
        : (entryPrice - markPrice) * sizeInToken;
      return {
        symbol: p.symbol,
        side: p.side,
        size: p.size,
        entryPrice: p.entryPrice,
        markPrice: String(markPrice),
        leverage: String(p.leverage),
        unrealizedPnl: pnlRaw.toFixed(2),
        liquidationPrice: p.liquidationPrice,
      };
    });
  }, [accountPositions, getPrice]);

  // Only send the position for the currently analyzed market
  const relevantPositions = useMemo(
    () => openPositions.filter(p => p.symbol === selectedMarket),
    [openPositions, selectedMarket]
  );

  // Order size calculation — uses existing lot/tick size utilities
  const orderCalc = useMemo(() => {
    if (!data || data.signal === 'STAY_OUT' || !account || data.entry === 0) return null;
    const available = parseFloat(account.availableToSpend) || 0;
    if (available === 0) return null;

    const priceData = getPrice(selectedMarket);
    const lotSize = priceData?.lotSize ?? 0.00001;
    const tickSize = priceData?.tickSize ?? 0.01;
    const maxLeverage = priceData?.maxLeverage ?? 10;

    const effectiveLeverage = Math.min(data.suggestedLeverage, maxLeverage);
    const MIN_POSITION_VALUE = 11;

    // If user has entered a custom position value, use it; otherwise auto-calculate
    const customVal = parseFloat(customPositionValue);
    const hasCustom = customPositionValue !== '' && !isNaN(customVal) && customVal > 0;

    const riskUSD = available * (data.riskPercent / 100);
    const rawPositionValue = hasCustom ? customVal : riskUSD * data.suggestedLeverage;
    const positionValue = Math.max(rawPositionValue, MIN_POSITION_VALUE);
    const effectiveRiskUSD = positionValue / (effectiveLeverage || 1);

    // calculateOrderAmount handles lot-size rounding (reuse existing utility)
    const amountStr = calculateOrderAmount({
      positionSize: effectiveRiskUSD,
      leverage: effectiveLeverage,
      maxLeverage,
      price: data.entry,
      lotSize,
    });
    const sizeInTokens = parseFloat(amountStr);
    if (sizeInTokens === 0) return null; // still 0 after rounding — can't place order

    // Round prices to tick size for Pacifica API
    const entryStr = roundToTickSize(data.entry, tickSize);
    const tpStr = roundToTickSize(data.takeProfit, tickSize);
    const slStr = roundToTickSize(data.stopLoss, tickSize);

    const gainIfTP = Math.abs(data.takeProfit - data.entry) / data.entry * positionValue;
    const lossIfSL = Math.abs(data.entry - data.stopLoss) / data.entry * positionValue;
    return {
      sizeInTokens,
      amountStr,
      entryStr,
      tpStr,
      slStr,
      positionValue,
      riskUSD: effectiveRiskUSD,
      isClamped: !hasCustom && rawPositionValue < MIN_POSITION_VALUE,
      gainIfTP,
      lossIfSL,
      rr: lossIfSL > 0 ? gainIfTP / lossIfSL : 0,
    };
  }, [data, account, selectedMarket, getPrice, customPositionValue]);

  const canExecute = connected && !!account && !!orderCalc && !isExpired;
  const symbol = selectedMarket.replace('-USD', '');
  const signalConfig = data ? SIGNAL_CONFIG[data.signal] : null;

  // Countdown timer
  const [timeLeft, setTimeLeft] = useState(0);
  useEffect(() => {
    if (!data) { setTimeLeft(0); return; }
    const tick = () => setTimeLeft(Math.max(0, Math.floor((data.expiresAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [data]);

  // Erase AI chart lines
  const eraseChartLines = useCallback(() => {
    if (!tvWidget) return;
    console.log('[AI Widget] eraseChartLines called, ids:', drawnShapeIdsRef.current);
    try {
      const chart = (tvWidget as any).activeChart();
      // Primary: remove by stored EntityId
      if (drawnShapeIdsRef.current.length > 0) {
        drawnShapeIdsRef.current.forEach(id => {
          try {
            chart.removeEntity(id, { disableUndo: true });
            console.log('[AI Widget] removeEntity ok:', id);
          } catch (e) {
            console.warn('[AI Widget] removeEntity failed for id:', id, e);
          }
        });
        // Verify removal — if shapes still exist, fall back to removeAllShapes
        try {
          const remaining = chart.getAllShapes?.() ?? [];
          console.log('[AI Widget] shapes remaining after removal:', remaining);
          const stillPresent = remaining.some((s: any) => drawnShapeIdsRef.current.includes(s.id));
          if (stillPresent) {
            console.log('[AI Widget] fallback: removeAllShapes');
            chart.removeAllShapes();
          }
        } catch { /* ignore */ }
      } else {
        console.log('[AI Widget] no ids stored, calling removeAllShapes');
        try { chart.removeAllShapes(); } catch { /* ignore */ }
      }
    } catch (e) { console.error('[AI Widget] eraseChartLines error:', e); }
    drawnShapeIdsRef.current = [];
    lastDrawnTimestampRef.current = null;
    setChartLinesDrawn(false);
  }, [tvWidget]);

  // Chart line drawing — draw entry/SL/TP after signal analysis (for testing deletion)
  // TODO: change back to execStep !== 'success' once deletion is confirmed working
  // createShape returns Promise<EntityId> — must await to get the real ID
  useEffect(() => {
    if (!tvWidget || !data || data.signal === 'STAY_OUT') {
      return;
    }
    // Skip if we already drew lines for this exact signal timestamp
    if (lastDrawnTimestampRef.current === data.timestamp) {
      return;
    }

    const drawLines = async () => {
      try {
        const chart = (tvWidget as any).activeChart();
        // Clear previous AI lines before drawing new ones
        if (drawnShapeIdsRef.current.length > 0) {
          drawnShapeIdsRef.current.forEach(id => {
            try { chart.removeEntity(id, { disableUndo: true }); } catch { /* ignore */ }
          });
          drawnShapeIdsRef.current = [];
        }
        lastDrawnTimestampRef.current = data.timestamp;

        // Use current unix timestamp in seconds (TV uses seconds, not ms)
        const nowSec = Math.floor(Date.now() / 1000);

        const drawLine = async (price: number, color: string, label: string) => {
          // createShape returns Promise<EntityId> in TV ACL v30+
          const id = await chart.createShape(
            { time: nowSec, price },
            {
              shape: 'horizontal_line',
              lock: false,
              disableSelection: false,
              overrides: {
                linecolor: color,
                linewidth: 1,
                linestyle: 0,
                showLabel: true,
                text: label,
                textcolor: color,
                fontsize: 11,
              },
            }
          );
          if (id != null) {
            drawnShapeIdsRef.current.push(id);
            console.log('[AI Widget] drew shape, id:', id, typeof id);
          }
        };

        await drawLine(data.entry, '#94a3b8', `AI Entry $${data.entry.toLocaleString()}`);
        await drawLine(data.stopLoss, '#f87171', `AI SL $${data.stopLoss.toLocaleString()}`);
        await drawLine(data.takeProfit, data.signal === 'LONG' ? '#4ade80' : '#f87171',
          `AI TP $${data.takeProfit.toLocaleString()}`);
        console.log('[AI Widget] all shape ids:', drawnShapeIdsRef.current);
        setChartLinesDrawn(true);
      } catch (err) {
        console.error('[AI Widget] drawLines error:', err);
        setChartLinesDrawn(false);
      }
    };

    drawLines();
  }, [tvWidget, data, execStep]);

  // Cleanup AI lines when widget closes
  useEffect(() => {
    if (!isOpen && tvWidget && drawnShapeIdsRef.current.length > 0) {
      try {
        const chart = (tvWidget as any).activeChart();
        drawnShapeIdsRef.current.forEach(id => {
          try { chart.removeEntity(id); } catch { /* ignore */ }
        });
      } catch { /* ignore */ }
      drawnShapeIdsRef.current = [];
      setChartLinesDrawn(false);
    }
  }, [isOpen, tvWidget]);

  const handleAnalyze = useCallback(() => {
    if (!disclaimerAccepted) { setShowDisclaimer(true); return; }
    analyze(selectedMarket, riskProfile, relevantPositions.length > 0 ? relevantPositions : undefined);
  }, [disclaimerAccepted, analyze, selectedMarket, riskProfile, relevantPositions]);

  const handleExecute = useCallback(async () => {
    if (!data || !orderCalc) return;
    const side = data.signal === 'LONG' ? 'bid' : 'ask';
    const { amountStr, entryStr, tpStr, slStr } = orderCalc;
    const tp = { stop_price: tpStr };
    const sl = { stop_price: slStr };
    setExecError(null);
    setExecStep('pending');
    try {
      if (orderMode === 'market') {
        await createMarketOrder.mutateAsync({
          symbol, side, amount: amountStr,
          slippage_percent: '0.5', take_profit: tp, stop_loss: sl,
        });
      } else {
        await createLimitOrder.mutateAsync({
          symbol, side, price: entryStr,
          amount: amountStr, tif: 'GTC', take_profit: tp, stop_loss: sl,
        });
      }
      setExecStep('success');
    } catch (err) {
      setExecError(err instanceof Error ? err.message : 'Order failed');
      setExecStep('error');
    }
  }, [data, orderCalc, orderMode, symbol, createMarketOrder, createLimitOrder]);

  const handleClosePositionAction = useCallback(async (advice: { symbol: string; action: string }) => {
    const posSymbol = advice.symbol.replace('-USD', '');
    const key = advice.symbol;

    // Find the matching open position
    const pos = openPositions.find(p => p.symbol === advice.symbol);
    if (!pos) return;

    const side = pos.side === 'LONG' ? 'ask' : 'bid'; // opposite to close
    const amount = pos.size;

    // For REDUCE, close 50% of the position
    const priceData = getPrice(advice.symbol);
    const lotSize = priceData?.lotSize ?? 0.00001;
    const rawAmount = advice.action === 'REDUCE'
      ? String(Math.floor(parseFloat(amount) / 2 / lotSize) * lotSize)
      : amount;
    const closeAmount = parseFloat(rawAmount) > 0 ? String(parseFloat(rawAmount).toFixed(String(lotSize).split('.')[1]?.length ?? 5)) : amount;

    setPosExecError(prev => ({ ...prev, [key]: null }));
    setPosExecStep(prev => ({ ...prev, [key]: 'pending' }));
    try {
      await createMarketOrder.mutateAsync({
        symbol: posSymbol,
        side,
        amount: closeAmount,
        reduceOnly: true,
        slippage_percent: '1',
      });
      setPosExecStep(prev => ({ ...prev, [key]: 'success' }));
    } catch (err) {
      setPosExecError(prev => ({ ...prev, [key]: err instanceof Error ? err.message : 'Failed' }));
      setPosExecStep(prev => ({ ...prev, [key]: 'error' }));
    }
  }, [openPositions, getPrice, createMarketOrder]);

  const handleCopyLevels = useCallback(() => {
    if (!data || data.signal === 'STAY_OUT') return;
    const text = `Entry: $${data.entry.toLocaleString()} | SL: $${data.stopLoss.toLocaleString()} | TP: $${data.takeProfit.toLocaleString()}`;
    navigator.clipboard.writeText(text).catch(() => {});
  }, [data]);

  const adviceCount = data?.positionAdvice?.length ?? 0;

  return (
    <>
      {/* ═══ FAB ═══ */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed top-[72px] right-3 xl:top-auto xl:bottom-8 xl:right-5 z-50 group"
        >
          <div className="flex items-center gap-2 px-3 py-2 xl:px-3.5 xl:py-2.5 bg-surface-900/90 backdrop-blur-md border border-surface-700/50 rounded-xl hover:border-surface-500/50 transition-all duration-300 shadow-lg shadow-black/30">
            <div className="relative w-6 h-6 xl:w-7 xl:h-7">
              <div className="absolute inset-0 rounded-full bg-surface-700/50" />
              <div className={`absolute inset-[3px] rounded-full ${data && !isExpired ? signalConfig?.barColor : 'bg-surface-500'} opacity-40 group-hover:opacity-60 transition-opacity`} />
              <div className={`absolute inset-[6px] xl:inset-[7px] rounded-full ${data && !isExpired ? signalConfig?.barColor : 'bg-surface-400'} opacity-80`} />
              {(!data || isExpired) && (
                <div className="absolute inset-0 rounded-full border border-surface-500/30 animate-[spin_8s_linear_infinite]">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-surface-400" />
                </div>
              )}
            </div>
            {data && !isExpired ? (
              <span className={`text-xs font-mono font-semibold tracking-wide ${signalConfig?.color}`}>
                {signalConfig?.label}
              </span>
            ) : (
              <span className="text-[11px] font-mono text-surface-400 group-hover:text-surface-200 tracking-wide transition-colors">
                AI
              </span>
            )}
          </div>
        </button>
      )}

      {/* ═══ Panel ═══ */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]" onClick={() => setIsOpen(false)} />

          <div className="fixed inset-x-3 top-16 bottom-auto xl:inset-auto xl:bottom-8 xl:right-5 xl:top-auto z-[60] xl:w-[400px] max-h-[85vh] xl:max-h-[82vh] bg-surface-900/80 backdrop-blur-xl border border-surface-600/60 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden flex flex-col">

            {/* ── Header ── */}
            <div className="flex items-center justify-between px-5 py-3.5 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="relative w-8 h-8">
                  <div className="absolute inset-0 rounded-full bg-surface-800" />
                  <div className="absolute inset-1 rounded-full bg-gradient-to-br from-surface-600 to-surface-800" />
                  <div className={`absolute inset-2 rounded-full transition-colors duration-500 ${
                    isLoading ? 'bg-surface-500 animate-pulse' :
                    data ? (signalConfig?.barColor ?? '') + ' opacity-60' : 'bg-surface-600'
                  }`} />
                  <div className="absolute inset-0 rounded-full border border-surface-600/30 animate-[spin_12s_linear_infinite]">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-surface-400/60" />
                  </div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-white tracking-tight">AI Signal</div>
                  <div className="text-[11px] font-mono text-surface-400 tracking-wider">{selectedMarket}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {chartLinesDrawn && (
                  <button
                    onClick={eraseChartLines}
                    title="Remove chart lines"
                    className="flex items-center gap-1 px-2 py-1 rounded-md bg-surface-800/60 border border-surface-700/40 hover:border-loss-400/40 hover:bg-loss-400/5 transition-all group"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 group-hover:bg-loss-400 transition-colors" />
                    <span className="text-[10px] font-mono text-surface-500 group-hover:text-loss-400 transition-colors">chart ✕</span>
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg text-surface-500 hover:text-white hover:bg-surface-800/50 transition-all"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="h-px bg-gradient-to-r from-transparent via-surface-700/50 to-transparent flex-shrink-0" />

            {/* ── Scrollable Content ── */}
            <div className="px-5 py-4 space-y-3 overflow-y-auto flex-1">

              {/* Risk selector */}
              <div className="flex items-center gap-1 p-1 bg-surface-800/50 rounded-lg">
                {(['conservative', 'moderate', 'aggressive'] as RiskProfile[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setRiskProfile(p)}
                    className={`flex-1 py-1.5 text-[12px] font-medium rounded-md transition-all duration-200 ${
                      riskProfile === p
                        ? 'bg-surface-700 text-white shadow-sm'
                        : 'text-surface-500 hover:text-surface-300'
                    }`}
                  >
                    {RISK_LABELS[p]}
                  </button>
                ))}
              </div>

              {/* Open positions indicator — only for this market */}
              {relevantPositions.length > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 bg-surface-800/40 rounded-lg border border-surface-700/30">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                  <span className="text-[11px] font-mono text-surface-300">
                    {relevantPositions.length} {symbol} position detected
                  </span>
                </div>
              )}

              {/* Analyze button */}
              <button
                onClick={handleAnalyze}
                disabled={isLoading}
                className="w-full group relative overflow-hidden py-3 bg-surface-800 hover:bg-surface-750 border border-surface-700/50 hover:border-surface-600/50 rounded-xl transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent" />
                <div className="relative flex items-center justify-center gap-2">
                  {isLoading ? (
                    <>
                      <div className="w-3.5 h-3.5 border border-surface-400 border-t-white rounded-full animate-spin" />
                      <span className="text-[13px] font-mono text-surface-300">Analyzing...</span>
                    </>
                  ) : (
                    <>
                      <div className="w-1.5 h-1.5 rounded-full bg-surface-400 group-hover:bg-white transition-colors" />
                      <span className="text-[13px] font-mono text-surface-300 group-hover:text-white transition-colors">
                        Analyze {symbol}
                      </span>
                    </>
                  )}
                </div>
              </button>

              {/* Error */}
              {error && (
                <div className="px-3 py-2.5 bg-loss-500/5 border border-loss-500/15 rounded-lg">
                  <p className="text-[12px] text-loss-400">{error}</p>
                </div>
              )}

              {/* ── Results ── */}
              {data && (
                <div className="space-y-3">

                  {/* Signal badge */}
                  <div className={`flex items-center justify-center gap-3 py-3.5 rounded-xl border ${signalConfig?.bgColor} ${signalConfig?.borderColor}`}>
                    <span className={`text-2xl font-bold font-mono ${signalConfig?.color}`}>
                      {signalConfig?.arrow}
                    </span>
                    <span className={`text-2xl font-bold font-mono tracking-widest ${signalConfig?.color}`}>
                      {signalConfig?.label}
                    </span>
                  </div>

                  {/* Confidence */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-surface-400 uppercase tracking-widest">Confidence</span>
                      <span className={`text-[13px] font-mono font-semibold tabular-nums ${
                        data.confidence >= 70 ? 'text-win-400' :
                        data.confidence >= 40 ? 'text-yellow-400' : 'text-loss-400'
                      }`}>{data.confidence}%</span>
                    </div>
                    <div className="h-1 bg-surface-700/60 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          data.confidence >= 70 ? 'bg-win-400/70' :
                          data.confidence >= 40 ? 'bg-yellow-400/70' : 'bg-loss-400/70'
                        }`}
                        style={{ width: `${data.confidence}%` }}
                      />
                    </div>
                  </div>

                  {/* Tabs */}
                  <div className="flex items-center border border-surface-700/40 rounded-lg overflow-hidden">
                    {(['signal', 'factors', 'positions'] as Tab[]).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 py-2 text-[11px] font-mono uppercase tracking-wider transition-all duration-150 flex items-center justify-center gap-1.5 ${
                          activeTab === tab
                            ? 'bg-surface-700/60 text-white'
                            : 'text-surface-500 hover:text-surface-300 hover:bg-surface-800/30'
                        }`}
                      >
                        {tab === 'positions' ? 'POS' : tab === 'factors' ? 'FACTORS' : 'SIGNAL'}
                        {tab === 'positions' && adviceCount > 0 && (
                          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-surface-600 text-[10px] font-bold text-surface-200">
                            {adviceCount}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* ── SIGNAL Tab ── */}
                  {activeTab === 'signal' && (
                    <div className="space-y-3">

                      {/* Data grid */}
                      {data.signal !== 'STAY_OUT' ? (
                        <div className="rounded-xl border border-surface-700/40 overflow-hidden">
                          <div className="grid grid-cols-3 divide-x divide-surface-700/40">
                            {[
                              { label: 'ENTRY', value: `$${data.entry.toLocaleString()}`, color: 'text-surface-100' },
                              { label: 'STOP', value: `$${data.stopLoss.toLocaleString()}`, color: 'text-loss-400' },
                              { label: 'TARGET', value: `$${data.takeProfit.toLocaleString()}`, color: 'text-win-400' },
                            ].map(({ label, value, color }) => (
                              <div key={label} className="px-2 py-3 text-center bg-surface-800/30">
                                <div className="text-[9px] font-mono text-surface-400 uppercase tracking-widest mb-1">{label}</div>
                                <div className={`text-[12px] font-mono font-semibold tabular-nums ${color}`}>{value}</div>
                              </div>
                            ))}
                          </div>
                          <div className="h-px bg-surface-700/40" />
                          <div className="grid grid-cols-3 divide-x divide-surface-700/40">
                            {[
                              { label: 'LEVERAGE', value: `${data.suggestedLeverage}x`, color: 'text-surface-200' },
                              { label: 'RISK', value: `${data.riskPercent}%`, color: 'text-surface-200' },
                              { label: 'R:R', value: orderCalc ? `1:${orderCalc.rr.toFixed(1)}` : '—', color: 'text-surface-200' },
                            ].map(({ label, value, color }) => (
                              <div key={label} className="px-2 py-3 text-center bg-surface-800/20">
                                <div className="text-[9px] font-mono text-surface-400 uppercase tracking-widest mb-1">{label}</div>
                                <div className={`text-[12px] font-mono font-semibold tabular-nums ${color}`}>{value}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="px-4 py-5 bg-surface-800/30 border border-dashed border-surface-700/50 rounded-xl text-center">
                          <p className="text-[13px] text-surface-500 font-mono">No actionable setup detected</p>
                          <p className="text-[11px] text-surface-600 mt-1">Wait for better conditions or adjust risk profile.</p>
                        </div>
                      )}

                      {/* Summary */}
                      <p className="text-[12px] text-surface-300 leading-relaxed italic px-0.5">
                        {data.summary}
                      </p>

                      {/* Execute section */}
                      {data.signal !== 'STAY_OUT' && !isExpired && (
                        <div className="rounded-xl border border-surface-700/40 overflow-hidden">
                          <div className="px-3 py-2.5 bg-surface-800/40 border-b border-surface-700/30">
                            <span className="text-[10px] font-mono text-surface-400 uppercase tracking-widest">Execute Signal</span>
                          </div>

                          {(execStep === 'idle' || execStep === 'confirm') ? (
                            <div className="p-3 space-y-2.5">
                              {/* Order mode pills */}
                              <div className="flex gap-1 p-0.5 bg-surface-800/60 rounded-lg">
                                {(['market', 'limit'] as OrderMode[]).map((mode) => (
                                  <button
                                    key={mode}
                                    onClick={() => setOrderMode(mode)}
                                    className={`flex-1 py-1.5 text-[11px] font-mono rounded-md transition-all ${
                                      orderMode === mode
                                        ? 'bg-surface-700 text-white'
                                        : 'text-surface-500 hover:text-surface-300'
                                    }`}
                                  >
                                    {mode === 'market' ? 'Market' : `Limit @ $${data.entry.toLocaleString()}`}
                                  </button>
                                ))}
                              </div>

                              {/* Order preview */}
                              {orderCalc ? (
                                <div className="space-y-1.5 text-[11px] font-mono">
                                  {orderCalc.isClamped && (
                                    <div className="px-2 py-1.5 bg-yellow-400/5 border border-yellow-400/20 rounded-lg">
                                      <span className="text-[10px] text-yellow-400/80">Min. order size applied ($11)</span>
                                    </div>
                                  )}
                                  {/* Position value — editable */}
                                  <div className="flex items-center justify-between text-surface-300">
                                    <span>Position value</span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-surface-400">$</span>
                                      <input
                                        type="number"
                                        min="11"
                                        step="1"
                                        placeholder={orderCalc.positionValue.toFixed(0)}
                                        value={customPositionValue}
                                        onChange={e => setCustomPositionValue(e.target.value)}
                                        className="w-20 bg-surface-800 border border-surface-700/60 focus:border-surface-500 rounded px-1.5 py-0.5 text-[11px] font-mono text-white text-right outline-none tabular-nums"
                                      />
                                    </div>
                                  </div>
                                  <div className="flex justify-between text-surface-300">
                                    <span>Size</span>
                                    <span className="text-white">{orderCalc.amountStr} {symbol}</span>
                                  </div>
                                  <div className="flex justify-between text-surface-300">
                                    <span>Est. TP gain</span>
                                    <span className="text-win-400">+${orderCalc.gainIfTP.toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between text-surface-300">
                                    <span>Est. SL loss</span>
                                    <span className="text-loss-400">-${orderCalc.lossIfSL.toFixed(2)}</span>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-[11px] text-surface-600 font-mono">
                                  {!account ? 'Connect wallet to calculate size' : 'Insufficient balance for calculation'}
                                </p>
                              )}

                              {execStep === 'idle' ? (
                                <>
                                  {canExecute ? (
                                    <button
                                      onClick={() => setExecStep('confirm')}
                                      className={`w-full py-2.5 rounded-lg text-[12px] font-mono font-semibold border transition-all ${
                                        data.signal === 'LONG'
                                          ? 'bg-win-400/15 hover:bg-win-400/25 border-win-400/30 text-win-400'
                                          : 'bg-loss-400/15 hover:bg-loss-400/25 border-loss-400/30 text-loss-400'
                                      }`}
                                    >
                                      {data.signal === 'LONG' ? '↑' : '↓'} Execute {data.signal} Signal
                                    </button>
                                  ) : (
                                    <button
                                      disabled
                                      className="w-full py-2.5 rounded-lg text-[12px] font-mono text-surface-600 bg-surface-800/40 border border-surface-700/30 cursor-not-allowed"
                                    >
                                      {!connected ? 'Connect Wallet to Execute' : 'Calculating...'}
                                    </button>
                                  )}
                                  <p className="text-[10px] text-surface-700 text-center font-mono">
                                    Uses account leverage · AI suggests {data.suggestedLeverage}x
                                  </p>
                                </>
                              ) : (
                                /* Confirm card */
                                <div className="space-y-2.5">
                                  <div className="px-3 py-2.5 bg-surface-800/60 rounded-lg border border-surface-700/30 space-y-1.5">
                                    <div className="flex items-center justify-between">
                                      <span className={`text-[12px] font-mono font-bold ${signalConfig?.color}`}>
                                        {data.signal} {symbol}
                                      </span>
                                      <span className="text-[11px] font-mono text-surface-300">
                                        {orderMode === 'market' ? 'Market order' : `Limit @ $${data.entry.toLocaleString()}`}
                                      </span>
                                    </div>
                                    {orderCalc && (
                                      <div className="text-[11px] font-mono text-surface-300">
                                        {orderCalc.amountStr} {symbol} · TP ${orderCalc.tpStr} · SL ${orderCalc.slStr}
                                      </div>
                                    )}
                                    <div className="text-[10px] font-mono text-surface-700">
                                      Uses current account leverage · AI suggests {data.suggestedLeverage}x
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => setExecStep('idle')}
                                      className="flex-1 py-2 rounded-lg text-[12px] font-mono text-surface-400 hover:text-white bg-surface-800/40 hover:bg-surface-700/40 border border-surface-700/30 transition-all"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      onClick={handleExecute}
                                      className={`flex-1 py-2 rounded-lg text-[12px] font-mono font-semibold border transition-all ${
                                        data.signal === 'LONG'
                                          ? 'bg-win-400/20 hover:bg-win-400/30 border-win-400/40 text-win-400'
                                          : 'bg-loss-400/20 hover:bg-loss-400/30 border-loss-400/40 text-loss-400'
                                      }`}
                                    >
                                      Confirm & Sign →
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : execStep === 'pending' ? (
                            <div className="p-4 flex items-center justify-center gap-2">
                              <div className="w-4 h-4 border border-surface-400 border-t-white rounded-full animate-spin" />
                              <span className="text-[12px] font-mono text-surface-300">Signing & submitting...</span>
                            </div>
                          ) : execStep === 'success' ? (
                            <div className="p-4 space-y-3">
                              <div className="flex items-start gap-3">
                                <div className="w-5 h-5 rounded-full bg-win-400/20 border border-win-400/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                                  <svg className="w-3 h-3 text-win-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                                <div>
                                  <p className="text-[12px] font-mono text-win-400 font-semibold">Order submitted</p>
                                  <p className="text-[11px] font-mono text-surface-500 mt-0.5">
                                    {orderMode === 'market'
                                      ? 'Filled at market price. TP/SL orders are active.'
                                      : `Limit order at $${data.entry.toLocaleString()} placed. TP/SL activate on fill.`}
                                  </p>
                                </div>
                              </div>
                              <button
                                onClick={() => setExecStep('idle')}
                                className="w-full py-2 rounded-lg text-[12px] font-mono text-surface-400 hover:text-white bg-surface-800/40 border border-surface-700/30 transition-all"
                              >
                                Done
                              </button>
                            </div>
                          ) : (
                            /* Error */
                            <div className="p-4 space-y-3">
                              <div className="flex items-start gap-3">
                                <div className="w-5 h-5 rounded-full bg-loss-400/10 border border-loss-400/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                                  <span className="text-[10px] text-loss-400 font-bold">✕</span>
                                </div>
                                <div>
                                  <p className="text-[12px] font-mono text-loss-400 font-semibold">Order failed</p>
                                  <p className="text-[11px] font-mono text-surface-500 mt-0.5">{execError}</p>
                                </div>
                              </div>
                              <button
                                onClick={() => setExecStep('idle')}
                                className="w-full py-2 rounded-lg text-[12px] font-mono text-surface-400 hover:text-white bg-surface-800/40 border border-surface-700/30 transition-all"
                              >
                                Try Again
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Copy levels + expiry bar */}
                      <div className="flex items-center gap-2">
                        {data.signal !== 'STAY_OUT' && (
                          <button
                            onClick={handleCopyLevels}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-800/40 border border-surface-700/30 hover:border-surface-600/40 text-[10px] font-mono text-surface-500 hover:text-surface-300 transition-all flex-shrink-0"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            Copy
                          </button>
                        )}
                        <div className="flex-1">
                          {!isExpired && timeLeft > 0 ? (
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-0.5 bg-surface-700 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-1000 ease-linear ${
                                    timeLeft > 30 ? 'bg-win-400/50' : timeLeft > 10 ? 'bg-yellow-400/50' : 'bg-loss-400/50'
                                  }`}
                                  style={{ width: `${Math.min(100, (timeLeft / 60) * 100)}%` }}
                                />
                              </div>
                              <span className={`text-[10px] font-mono tabular-nums flex-shrink-0 ${
                                timeLeft > 30 ? 'text-surface-600' : timeLeft > 10 ? 'text-yellow-400' : 'text-loss-400'
                              }`}>{timeLeft}s</span>
                            </div>
                          ) : isExpired ? (
                            <div className="flex items-center gap-1.5">
                              <div className="w-1.5 h-1.5 rounded-full bg-loss-400/60" />
                              <span className="text-[10px] font-mono text-surface-600">Signal expired — re-analyze</span>
                            </div>
                          ) : null}
                        </div>
                      </div>

                    </div>
                  )}

                  {/* ── FACTORS Tab ── */}
                  {activeTab === 'factors' && (
                    <div className="space-y-2">
                      {data.keyFactors.map((factor, i) => (
                        <div key={i} className="flex items-start gap-3 px-3 py-2.5 bg-surface-800/30 rounded-lg">
                          <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                            factor.bias === 'bullish' ? 'bg-win-400' :
                            factor.bias === 'bearish' ? 'bg-loss-400' : 'bg-surface-500'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <div className="text-[12px] font-semibold text-white">{factor.factor}</div>
                            <div className="text-[11px] text-surface-300 mt-0.5 leading-relaxed">{factor.detail}</div>
                          </div>
                          <span className={`text-[9px] font-mono uppercase tracking-wider flex-shrink-0 mt-0.5 ${
                            factor.bias === 'bullish' ? 'text-win-400/60' :
                            factor.bias === 'bearish' ? 'text-loss-400/60' : 'text-surface-600'
                          }`}>{factor.bias}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── POSITIONS Tab ── */}
                  {activeTab === 'positions' && (
                    <div className="space-y-2">
                      {data.positionAdvice && data.positionAdvice.length > 0 ? (
                        data.positionAdvice.map((advice, i) => {
                          const actionCfg = ACTION_CONFIG[advice.action] || ACTION_CONFIG.HOLD;
                          const key = advice.symbol;
                          const step = posExecStep[key] ?? 'idle';
                          const err = posExecError[key] ?? null;
                          const canAct = (advice.action === 'CLOSE' || advice.action === 'REDUCE') && connected;
                          const hasPos = openPositions.some(p => p.symbol === advice.symbol);
                          return (
                            <div key={i} className={`px-3 py-2.5 rounded-lg border border-surface-700/30 ${actionCfg.bg} space-y-2`}>
                              <div className="flex items-start gap-3">
                                <span className={`text-[10px] font-mono font-bold flex-shrink-0 mt-0.5 ${actionCfg.color}`}>
                                  {actionCfg.label}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <div className="text-[11px] font-mono text-surface-400">{advice.symbol}</div>
                                  <p className="text-[12px] text-surface-200 mt-0.5 leading-relaxed">{advice.detail}</p>
                                </div>
                              </div>

                              {/* Action button for CLOSE / REDUCE */}
                              {canAct && hasPos && (
                                step === 'idle' ? (
                                  <button
                                    onClick={() => setPosExecStep(prev => ({ ...prev, [key]: 'confirm' }))}
                                    className={`w-full py-1.5 rounded-md text-[11px] font-mono font-semibold border transition-all ${
                                      advice.action === 'CLOSE'
                                        ? 'bg-loss-400/15 hover:bg-loss-400/25 border-loss-400/30 text-loss-400'
                                        : 'bg-yellow-400/10 hover:bg-yellow-400/20 border-yellow-400/30 text-yellow-400'
                                    }`}
                                  >
                                    {advice.action === 'CLOSE' ? '✕ Close Position' : '↓ Reduce 50%'}
                                  </button>
                                ) : step === 'confirm' ? (
                                  <div className="flex gap-1.5">
                                    <button
                                      onClick={() => setPosExecStep(prev => ({ ...prev, [key]: 'idle' }))}
                                      className="flex-1 py-1.5 rounded-md text-[11px] font-mono text-surface-400 hover:text-white bg-surface-800/40 border border-surface-700/30 transition-all"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      onClick={() => handleClosePositionAction(advice)}
                                      className={`flex-1 py-1.5 rounded-md text-[11px] font-mono font-semibold border transition-all ${
                                        advice.action === 'CLOSE'
                                          ? 'bg-loss-400/20 hover:bg-loss-400/30 border-loss-400/40 text-loss-400'
                                          : 'bg-yellow-400/15 hover:bg-yellow-400/25 border-yellow-400/40 text-yellow-400'
                                      }`}
                                    >
                                      Confirm & Sign →
                                    </button>
                                  </div>
                                ) : step === 'pending' ? (
                                  <div className="flex items-center justify-center gap-2 py-1.5">
                                    <div className="w-3 h-3 border border-surface-400 border-t-white rounded-full animate-spin" />
                                    <span className="text-[11px] font-mono text-surface-300">Signing...</span>
                                  </div>
                                ) : step === 'success' ? (
                                  <div className="flex items-center justify-between py-1">
                                    <span className="text-[11px] font-mono text-win-400">Order submitted</span>
                                    <button
                                      onClick={() => setPosExecStep(prev => ({ ...prev, [key]: 'idle' }))}
                                      className="text-[10px] font-mono text-surface-500 hover:text-surface-300"
                                    >
                                      Done
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-between py-1">
                                    <span className="text-[11px] font-mono text-loss-400">{err || 'Failed'}</span>
                                    <button
                                      onClick={() => setPosExecStep(prev => ({ ...prev, [key]: 'idle' }))}
                                      className="text-[10px] font-mono text-surface-500 hover:text-surface-300"
                                    >
                                      Retry
                                    </button>
                                  </div>
                                )
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div className="px-3 py-6 text-center">
                          <p className="text-[12px] text-surface-600 font-mono">No position advice</p>
                          <p className="text-[11px] text-surface-700 mt-1">Analyze while holding a {symbol} position to get advice.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Footer */}
                  <p className="text-[10px] text-surface-500 text-center">
                    Not financial advice · 100% your responsibility
                  </p>

                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ═══ Disclaimer Modal ═══ */}
      <AiDisclaimerModal
        isOpen={showDisclaimer}
        onAccept={handleAcceptDisclaimer}
      />
    </>
  );
}
