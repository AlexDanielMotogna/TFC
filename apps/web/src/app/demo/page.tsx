'use client';

import { useState } from 'react';
import { TradeTerminalDemo, FullTerminalDemo } from '@/components/landing';

const FEATURES = [
  { id: 'leverage', label: 'Leverage' },
  { id: 'long-short', label: 'Long & Short' },
  { id: 'market-orders', label: 'Market Orders' },
  { id: 'stop-loss', label: 'Stop Loss' },
  { id: 'take-profit', label: 'Take Profit' },
  { id: 'flip-position', label: 'Flip Position' },
  { id: 'fight-capital-limit', label: 'Fight Capital Limit' },
  { id: 'deposit-withdraw', label: 'Deposit/Withdraw' },
  { id: 'fight-banner', label: 'Fight Banner' },
  { id: 'fight-only', label: 'Fight Only Filter' },
] as const;

type FeatureId = typeof FEATURES[number]['id'] | null;

export default function DemoPage() {
  const [highlightFeature, setHighlightFeature] = useState<FeatureId>(null);
  const [viewMode, setViewMode] = useState<'full' | 'compact'>('full');

  return (
    <div className="min-h-screen bg-surface-950 py-12 px-4">
      <div className="max-w-[1400px] mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8 text-center">
          Trade Terminal Demo Preview
        </h1>

        {/* View mode toggle */}
        <div className="flex justify-center gap-2 mb-6">
          <button
            onClick={() => setViewMode('full')}
            className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'full'
                ? 'bg-primary-500 text-white'
                : 'bg-surface-800 text-surface-400 hover:text-white'
            }`}
          >
            Full Terminal
          </button>
          <button
            onClick={() => setViewMode('compact')}
            className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'compact'
                ? 'bg-primary-500 text-white'
                : 'bg-surface-800 text-surface-400 hover:text-white'
            }`}
          >
            Order Entry Only
          </button>
        </div>

        {/* Feature selector */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          <button
            onClick={() => setHighlightFeature(null)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              highlightFeature === null
                ? 'bg-surface-600 text-white'
                : 'bg-surface-800 text-surface-400 hover:text-white'
            }`}
          >
            None
          </button>
          {FEATURES.map((feature) => (
            <button
              key={feature.id}
              onClick={() => setHighlightFeature(feature.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                highlightFeature === feature.id
                  ? 'bg-primary-500 text-white'
                  : 'bg-surface-800 text-surface-400 hover:text-white'
              }`}
            >
              {feature.label}
            </button>
          ))}
        </div>

        {/* Terminal demo */}
        <div className="flex justify-center">
          {viewMode === 'full' ? (
            <FullTerminalDemo highlightFeature={highlightFeature as any} />
          ) : (
            <TradeTerminalDemo
              price={97234.50}
              priceChange={2.34}
              fightStake={500}
              available={320}
              highlightFeature={highlightFeature as any}
            />
          )}
        </div>
      </div>
    </div>
  );
}
