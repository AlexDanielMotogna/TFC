'use client';

import { useState } from 'react';
import { FullTerminalDemo } from './FullTerminalDemo';

// Trading features data - matching the demo features
const tradingFeatures = [
  {
    id: 'leverage',
    title: 'Leverage',
    description: 'Trade with up to 50x leverage on BTC, ETH, SOL and more.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
    color: 'orange',
  },
  {
    id: 'long-short',
    title: 'Long & Short',
    description: 'Go long when bullish, short when bearish. Profit in any market.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    ),
    color: 'green',
  },
  {
    id: 'market-orders',
    title: 'Market Orders',
    description: 'Execute instantly at current market price. No waiting.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    color: 'primary',
  },
  {
    id: 'stop-loss',
    title: 'Stop Loss',
    description: 'Protect your capital with automatic stop loss orders.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
      </svg>
    ),
    color: 'red',
  },
  {
    id: 'take-profit',
    title: 'Take Profit',
    description: 'Lock in gains automatically when price hits your target.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    color: 'green',
  },
  {
    id: 'flip-position',
    title: 'Flip Position',
    description: 'Instantly reverse your position from long to short or vice versa.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
    color: 'primary',
  },
  {
    id: 'fight-capital-limit',
    title: 'Fight Capital Limit',
    description: 'Fair fights with enforced capital limits. Same stake, same rules.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
      </svg>
    ),
    color: 'violet',
  },
  {
    id: 'deposit-withdraw',
    title: 'Deposit/Withdraw',
    description: 'Seamlessly move funds in and out via Pacifica exchange.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
    color: 'green',
  },
  {
    id: 'fight-banner',
    title: 'Fight Banner',
    description: 'Live fight status with timer, opponent info and PnL comparison.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    color: 'orange',
  },
  {
    id: 'fight-only',
    title: 'Fight Only Filter',
    description: 'Filter positions to show only those opened during the current fight.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
      </svg>
    ),
    color: 'violet',
  },
];

const getFeatureColor = (color: string) => {
  switch (color) {
    case 'orange':
      return { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/50', glow: 'shadow-orange-500/20' };
    case 'green':
      return { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/50', glow: 'shadow-green-500/20' };
    case 'primary':
      return { bg: 'bg-primary-500/10', text: 'text-primary-400', border: 'border-primary-500/50', glow: 'shadow-primary-500/20' };
    case 'violet':
      return { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/50', glow: 'shadow-violet-500/20' };
    case 'red':
      return { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/50', glow: 'shadow-red-500/20' };
    default:
      return { bg: 'bg-surface-700', text: 'text-surface-400', border: 'border-surface-600', glow: '' };
  }
};

type FeatureId = 'leverage' | 'long-short' | 'market-orders' | 'limit-orders' | 'stop-loss' | 'take-profit' | 'flip-position' | 'trailing-stop' | 'fight-capital-limit' | 'deposit-withdraw' | 'fight-banner' | 'fight-only' | null;

export function MobileAppSection() {
  const [activeFeature, setActiveFeature] = useState<FeatureId>(null);

  return (
    <section id="demo" className="py-16 lg:py-24 bg-surface-850/30 border-t border-surface-800">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center mb-12 lg:mb-16">
          <h2 className="text-3xl lg:text-5xl font-bold tracking-tight mb-4 text-white">
            Professional trading tools
          </h2>
          <p className="text-surface-400 text-lg">
            Everything you need to execute your strategy. Real perpetual trading with real execution.
          </p>
        </div>

        {/* Full Width Terminal Demo */}
        <div className="mb-12 rounded-xl border border-surface-700 overflow-hidden shadow-2xl">
          <FullTerminalDemo highlightFeature={activeFeature} />
        </div>

        {/* Features Grid Below */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {tradingFeatures.slice(0, 5).map((feature) => {
            const colors = getFeatureColor(feature.color);
            const isActive = activeFeature === feature.id;

            return (
              <button
                key={feature.id}
                onClick={() => setActiveFeature(isActive ? null : feature.id as FeatureId)}
                className={`p-4 rounded-xl text-left transition-all duration-200 ${
                  isActive
                    ? `${colors.bg} border-2 ${colors.border} shadow-lg ${colors.glow}`
                    : 'bg-surface-800/50 border border-surface-700/50 hover:border-surface-600'
                }`}
              >
                <div className={`w-10 h-10 rounded-lg ${colors.bg} flex items-center justify-center mb-3`}>
                  <span className={colors.text}>{feature.icon}</span>
                </div>
                <h3 className={`text-sm font-semibold mb-1 ${isActive ? colors.text : 'text-white'}`}>
                  {feature.title}
                </h3>
                <p className="text-xs text-surface-400 leading-relaxed line-clamp-2">
                  {feature.description}
                </p>
              </button>
            );
          })}
        </div>

        {/* Second row of features */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-3">
          {tradingFeatures.slice(5).map((feature) => {
            const colors = getFeatureColor(feature.color);
            const isActive = activeFeature === feature.id;

            return (
              <button
                key={feature.id}
                onClick={() => setActiveFeature(isActive ? null : feature.id as FeatureId)}
                className={`p-4 rounded-xl text-left transition-all duration-200 ${
                  isActive
                    ? `${colors.bg} border-2 ${colors.border} shadow-lg ${colors.glow}`
                    : 'bg-surface-800/50 border border-surface-700/50 hover:border-surface-600'
                }`}
              >
                <div className={`w-10 h-10 rounded-lg ${colors.bg} flex items-center justify-center mb-3`}>
                  <span className={colors.text}>{feature.icon}</span>
                </div>
                <h3 className={`text-sm font-semibold mb-1 ${isActive ? colors.text : 'text-white'}`}>
                  {feature.title}
                </h3>
                <p className="text-xs text-surface-400 leading-relaxed line-clamp-2">
                  {feature.description}
                </p>
              </button>
            );
          })}
        </div>

      </div>
    </section>
  );
}
