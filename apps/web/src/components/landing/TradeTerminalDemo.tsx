'use client';

import { useState } from 'react';

interface TradeTerminalDemoProps {
  /** Initial price to display */
  price?: number;
  /** Price change percentage */
  priceChange?: number;
  /** Fight stake amount */
  fightStake?: number;
  /** Available amount */
  available?: number;
  /** Selected feature to highlight */
  highlightFeature?: 'leverage' | 'long-short' | 'market-orders' | 'limit-orders' | 'stop-loss' | 'take-profit' | 'flip-position' | 'trailing-stop' | 'fight-capital-limit' | null;
}

export function TradeTerminalDemo({
  price = 97234.50,
  priceChange = 2.34,
  fightStake = 500,
  available = 320,
  highlightFeature = null,
}: TradeTerminalDemoProps) {
  const [selectedSide, setSelectedSide] = useState<'LONG' | 'SHORT'>('LONG');
  const [leverage, setLeverage] = useState(10);
  const [tpEnabled, setTpEnabled] = useState(true);
  const [slEnabled, setSlEnabled] = useState(true);
  const [tokenAmount, setTokenAmount] = useState('0.00125');
  const [usdAmount, setUsdAmount] = useState('121.54');
  const [takeProfit, setTakeProfit] = useState('102500');
  const [stopLoss, setStopLoss] = useState('94000');

  // Calculate derived values
  const positionSize = parseFloat(usdAmount) * leverage || 0;
  const marginRequired = parseFloat(usdAmount) || 0;
  const estLiqPrice = price * (selectedSide === 'LONG' ? 1 - (1 / leverage) * 0.9 : 1 + (1 / leverage) * 0.9);

  // ROI calculations
  const tpRoi = tpEnabled && takeProfit
    ? ((parseFloat(takeProfit) - price) / price * 100 * leverage).toFixed(1)
    : '0';
  const slRoi = slEnabled && stopLoss
    ? ((price - parseFloat(stopLoss)) / price * 100 * leverage).toFixed(1)
    : '0';

  // Highlight classes
  const getHighlightClass = (feature: string) => {
    if (highlightFeature === feature) {
      return 'ring-2 ring-primary-500 ring-offset-2 ring-offset-surface-900 rounded-lg';
    }
    return '';
  };

  return (
    <div className="bg-surface-900 rounded-xl border border-surface-700 w-full max-w-sm overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="px-4 py-3 border-b border-surface-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-display font-bold text-white">BTC-USD</span>
          <span className="text-white font-mono">${price.toLocaleString()}</span>
          <span className={`text-sm font-medium ${priceChange >= 0 ? 'text-win-400' : 'text-loss-400'}`}>
            {priceChange >= 0 ? '+' : ''}{priceChange}%
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-win-400 animate-pulse" />
          <span className="text-xs text-surface-400">Live</span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Fight Capital Limit */}
        <div className={`p-3 bg-primary-500/10 rounded-lg border border-primary-500/30 ${getHighlightClass('fight-capital-limit')}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span className="text-xs font-semibold text-primary-400 uppercase">Fight Capital Limit</span>
            </div>
            <span className="text-white font-mono font-semibold">${fightStake.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-surface-400">Available:</span>
            <span className="text-surface-300 font-mono">${available.toFixed(2)}</span>
          </div>
          {/* Progress bar */}
          <div className="mt-2 h-1.5 bg-surface-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary-500 to-primary-400"
              style={{ width: `${((fightStake - available) / fightStake) * 100}%` }}
            />
          </div>
        </div>

        {/* Long/Short Toggle */}
        <div className={`grid grid-cols-2 gap-2 ${getHighlightClass('long-short')}`}>
          <button
            onClick={() => setSelectedSide('LONG')}
            className={`py-3 rounded-lg font-semibold transition-all ${
              selectedSide === 'LONG'
                ? 'bg-win-500 text-white shadow-lg shadow-win-500/25'
                : 'bg-surface-800 text-surface-400 hover:text-white'
            }`}
          >
            LONG
          </button>
          <button
            onClick={() => setSelectedSide('SHORT')}
            className={`py-3 rounded-lg font-semibold transition-all ${
              selectedSide === 'SHORT'
                ? 'bg-loss-500 text-white shadow-lg shadow-loss-500/25'
                : 'bg-surface-800 text-surface-400 hover:text-white'
            }`}
          >
            SHORT
          </button>
        </div>

        {/* Size Input */}
        <div className={getHighlightClass('market-orders')}>
          <label className="block text-xs font-medium text-surface-400 mb-2">Size</label>
          <div className="flex gap-2 mb-2">
            <div className="flex-1 relative">
              <input
                type="text"
                value={tokenAmount}
                onChange={(e) => setTokenAmount(e.target.value)}
                className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-primary-500 pr-12"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-primary-400 font-medium">
                BTC
              </span>
            </div>
            <div className="flex-1 relative">
              <input
                type="text"
                value={usdAmount}
                onChange={(e) => setUsdAmount(e.target.value)}
                className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-primary-500 pr-12"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-surface-400 font-medium">
                USD
              </span>
            </div>
          </div>
          {/* Percentage buttons */}
          <div className="flex gap-2">
            {[25, 50, 75, 100].map((pct) => (
              <button
                key={pct}
                className="flex-1 py-1.5 text-xs font-medium bg-surface-800 text-surface-400 hover:bg-surface-700 hover:text-white rounded transition-colors border border-surface-700"
              >
                {pct}%
              </button>
            ))}
          </div>
        </div>

        {/* Leverage Slider */}
        <div className={getHighlightClass('leverage')}>
          <div className="flex justify-between mb-2">
            <label className="text-xs font-medium text-surface-400">Leverage</label>
            <span className="text-xs font-semibold text-primary-400">{leverage}x</span>
          </div>
          <div className="relative">
            <input
              type="range"
              min="1"
              max="50"
              value={leverage}
              onChange={(e) => setLeverage(Number(e.target.value))}
              className="w-full h-2 bg-surface-700 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #22d3ee 0%, #22d3ee ${(leverage / 50) * 100}%, #374151 ${(leverage / 50) * 100}%, #374151 100%)`
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-surface-500 mt-1">
            <span>1x</span>
            <span>25x</span>
            <span>50x</span>
          </div>
        </div>

        {/* Take Profit */}
        <div className={getHighlightClass('take-profit')}>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-surface-400 flex items-center gap-2">
              <input
                type="checkbox"
                checked={tpEnabled}
                onChange={(e) => setTpEnabled(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-surface-600 bg-surface-800 text-win-500 focus:ring-win-500"
              />
              Take Profit
            </label>
            {tpEnabled && (
              <span className="text-xs text-win-400">+{tpRoi}% ROI</span>
            )}
          </div>
          {tpEnabled && (
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400">$</span>
              <input
                type="text"
                value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value)}
                className="w-full bg-surface-800 border border-surface-700 rounded-lg pl-7 pr-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-win-500"
              />
            </div>
          )}
        </div>

        {/* Stop Loss */}
        <div className={getHighlightClass('stop-loss')}>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-surface-400 flex items-center gap-2">
              <input
                type="checkbox"
                checked={slEnabled}
                onChange={(e) => setSlEnabled(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-surface-600 bg-surface-800 text-loss-500 focus:ring-loss-500"
              />
              Stop Loss
            </label>
            {slEnabled && (
              <span className="text-xs text-loss-400">-{slRoi}% ROI</span>
            )}
          </div>
          {slEnabled && (
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400">$</span>
              <input
                type="text"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                className="w-full bg-surface-800 border border-surface-700 rounded-lg pl-7 pr-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-loss-500"
              />
            </div>
          )}
        </div>

        {/* Order Preview */}
        <div className="text-xs space-y-1.5 py-2 border-t border-surface-700">
          <div className="flex justify-between">
            <span className="text-surface-400">Position Size</span>
            <span className="text-white font-mono">${positionSize.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-surface-400">Margin Required</span>
            <span className="text-white font-mono">${marginRequired.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-surface-400">Est. Liq. Price</span>
            <span className="text-white font-mono">${estLiqPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>

        {/* Submit Button */}
        <button
          className={`w-full py-3 rounded-lg font-bold text-sm transition-all ${
            selectedSide === 'LONG'
              ? 'bg-gradient-to-r from-win-600 to-win-500 hover:from-win-500 hover:to-win-400 text-white shadow-lg shadow-win-500/25'
              : 'bg-gradient-to-r from-loss-600 to-loss-500 hover:from-loss-500 hover:to-loss-400 text-white shadow-lg shadow-loss-500/25'
          }`}
        >
          {selectedSide === 'LONG' ? '⬆ Open Long' : '⬇ Open Short'}
        </button>

        {/* Flip Position Button */}
        <button
          className={`w-full py-2 rounded-lg text-sm font-medium border border-primary-500/50 text-primary-400 hover:bg-primary-500/10 transition-colors ${getHighlightClass('flip-position')}`}
        >
          Flip Position
        </button>
      </div>
    </div>
  );
}
