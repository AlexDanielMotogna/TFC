'use client';

import { useState } from 'react';
import {
  LeverageIcon,
  LongShortIcon,
  StopLossIcon,
  TakeProfitIcon,
  FlipPositionIcon,
  FightCapitalLimitIcon,
  DepositWithdrawIcon,
  FightBannerIcon,
  FightOnlyFilterIcon,
  OrderTypesIcon,
  BatchOrdersIcon,
} from '@/components/icons/FeatureIcons';

// Trading features data - using centralized icons
const tradingFeatures = [
  {
    id: 'leverage',
    title: 'Leverage',
    description: 'Trade with up to 50x leverage on BTC, ETH, SOL and more.',
    icon: <LeverageIcon className="w-5 h-5" />,
    color: 'orange',
  },
  {
    id: 'long-short',
    title: 'Long & Short',
    description: 'Go long when bullish, short when bearish. Profit in any market.',
    icon: <LongShortIcon className="w-5 h-5" />,
    color: 'green',
  },
  {
    id: 'order-types',
    title: 'Order Types',
    description: 'Market, Limit, Stop Market and Stop Limit orders for full control.',
    icon: <OrderTypesIcon className="w-5 h-5" />,
    color: 'primary',
  },
  {
    id: 'batch-orders',
    title: 'Batch Orders',
    description: 'Place multiple orders at once. Scale in and out efficiently.',
    icon: <BatchOrdersIcon className="w-5 h-5" />,
    color: 'violet',
  },
  {
    id: 'stop-loss',
    title: 'Stop Loss',
    description: 'Protect your capital with automatic stop loss orders.',
    icon: <StopLossIcon className="w-5 h-5" />,
    color: 'red',
  },
  {
    id: 'take-profit',
    title: 'Take Profit',
    description: 'Lock in gains automatically when price hits your target.',
    icon: <TakeProfitIcon className="w-5 h-5" />,
    color: 'green',
  },
  {
    id: 'flip-position',
    title: 'Flip Position',
    description: 'Instantly reverse your position from long to short or vice versa.',
    icon: <FlipPositionIcon className="w-5 h-5" />,
    color: 'primary',
  },
  {
    id: 'fight-capital-limit',
    title: 'Fight Capital Limit',
    description: 'Fair fights with enforced capital limits. Same stake, same rules.',
    icon: <FightCapitalLimitIcon className="w-5 h-5" />,
    color: 'violet',
  },
  {
    id: 'deposit-withdraw',
    title: 'Deposit/Withdraw',
    description: 'Seamlessly move funds in and out via Pacifica exchange.',
    icon: <DepositWithdrawIcon className="w-5 h-5" />,
    color: 'green',
  },
  {
    id: 'fight-banner',
    title: 'Fight Banner',
    description: 'Live fight status with timer, opponent info and PnL comparison.',
    icon: <FightBannerIcon className="w-5 h-5" />,
    color: 'orange',
  },
  {
    id: 'fight-only',
    title: 'Fight Only Filter',
    description: 'Filter positions to show only those opened during the current fight.',
    icon: <FightOnlyFilterIcon className="w-5 h-5" />,
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

type FeatureId = 'leverage' | 'long-short' | 'order-types' | 'batch-orders' | 'stop-loss' | 'take-profit' | 'flip-position' | 'fight-capital-limit' | 'deposit-withdraw' | 'fight-banner' | 'fight-only' | null;

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
          <p className="text-surface-400 text-lg mb-2">
            Everything you need to execute your strategy. Real perpetual trading with real execution.
          </p>
          <p className="text-surface-500 text-sm">
            See the platform in action.
          </p>
        </div>

        {/* Terminal Video */}
        <div className="mb-12 rounded-xl border border-surface-800 shadow-2xl overflow-hidden">
          <video
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-auto"
          >
            <source src="/Video/Terminal.webm" type="video/webm" />
          </video>
        </div>

        {/* Features Grid - Single grid for proper mobile layout */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {tradingFeatures.map((feature) => {
            const colors = getFeatureColor(feature.color);
            const isActive = activeFeature === feature.id;

            return (
              <button
                key={feature.id}
                onClick={() => setActiveFeature(isActive ? null : feature.id as FeatureId)}
                className={`p-4 rounded-xl text-left transition-all duration-200 ${
                  isActive
                    ? `${colors.bg} border-2 ${colors.border} shadow-lg ${colors.glow}`
                    : 'bg-surface-800/50 border border-surface-800/50 hover:border-surface-600'
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
