'use client';

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
  { title: 'Leverage', icon: <LeverageIcon className="w-5 h-5" />, color: 'orange' },
  { title: 'Long & Short', icon: <LongShortIcon className="w-5 h-5" />, color: 'green' },
  { title: 'Order Types', icon: <OrderTypesIcon className="w-5 h-5" />, color: 'primary' },
  { title: 'Batch Orders', icon: <BatchOrdersIcon className="w-5 h-5" />, color: 'violet' },
  { title: 'Stop Loss', icon: <StopLossIcon className="w-5 h-5" />, color: 'red' },
  { title: 'Take Profit', icon: <TakeProfitIcon className="w-5 h-5" />, color: 'green' },
  { title: 'Flip Position', icon: <FlipPositionIcon className="w-5 h-5" />, color: 'primary' },
  { title: 'Capital Limit', icon: <FightCapitalLimitIcon className="w-5 h-5" />, color: 'violet' },
  { title: 'Deposit/Withdraw', icon: <DepositWithdrawIcon className="w-5 h-5" />, color: 'green' },
  { title: 'Fight Banner', icon: <FightBannerIcon className="w-5 h-5" />, color: 'orange' },
  { title: 'Fight Filter', icon: <FightOnlyFilterIcon className="w-5 h-5" />, color: 'violet' },
];

const getFeatureColor = (color: string) => {
  switch (color) {
    case 'orange':
      return { bg: 'bg-orange-500/10', text: 'text-orange-400' };
    case 'green':
      return { bg: 'bg-green-500/10', text: 'text-green-400' };
    case 'primary':
      return { bg: 'bg-primary-500/10', text: 'text-primary-400' };
    case 'violet':
      return { bg: 'bg-violet-500/10', text: 'text-violet-400' };
    case 'red':
      return { bg: 'bg-red-500/10', text: 'text-red-400' };
    default:
      return { bg: 'bg-surface-700', text: 'text-surface-400' };
  }
};

export function MobileAppSection() {
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

        {/* Features - compact icon + title chips */}
        <div className="flex flex-wrap justify-center gap-3">
          {tradingFeatures.map((feature) => {
            const colors = getFeatureColor(feature.color);
            return (
              <div
                key={feature.title}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-800/50 border border-surface-800/50"
              >
                <div className={`w-8 h-8 rounded-lg ${colors.bg} flex items-center justify-center flex-shrink-0`}>
                  <span className={colors.text}>{feature.icon}</span>
                </div>
                <span className="text-sm font-medium text-white whitespace-nowrap">{feature.title}</span>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
