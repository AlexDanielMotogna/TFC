'use client';

const tiers = [
  {
    tier: 'Tier 1',
    label: 'Direct Referrals',
    rate: '34%',
    description: 'Earn 34% commission on every trade your direct referrals make.',
    color: 'orange',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
  {
    tier: 'Tier 2',
    label: 'Their Referrals',
    rate: '12%',
    description: 'When your referrals invite others, you earn 12% on their trades too.',
    color: 'primary',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    tier: 'Tier 3',
    label: 'Deep Network',
    rate: '4%',
    description: 'Three levels deep. Earn 4% from your extended referral network.',
    color: 'violet',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
      </svg>
    ),
  },
];

const getColorClasses = (color: string) => {
  switch (color) {
    case 'orange':
      return {
        bg: 'bg-orange-500/10',
        text: 'text-orange-400',
        border: 'border-orange-500/30',
        rateBg: 'bg-orange-500/15',
        rateText: 'text-orange-400',
      };
    case 'primary':
      return {
        bg: 'bg-primary-500/10',
        text: 'text-primary-400',
        border: 'border-primary-500/30',
        rateBg: 'bg-primary-500/15',
        rateText: 'text-primary-400',
      };
    case 'violet':
      return {
        bg: 'bg-violet-500/10',
        text: 'text-violet-400',
        border: 'border-violet-500/30',
        rateBg: 'bg-violet-500/15',
        rateText: 'text-violet-400',
      };
    default:
      return {
        bg: 'bg-surface-700',
        text: 'text-surface-400',
        border: 'border-surface-600',
        rateBg: 'bg-surface-700',
        rateText: 'text-surface-400',
      };
  }
};

const steps = [
  { step: '1', text: 'Share your unique referral link' },
  { step: '2', text: 'Friends sign up and start trading' },
  { step: '3', text: 'You earn commissions on every trade' },
];

export function ReferralSection() {
  return (
    <section id="referrals" className="py-16 lg:py-24 border-t border-surface-800">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center mb-12 lg:mb-16">
          <h2 className="text-3xl lg:text-5xl font-bold tracking-tight mb-4 text-white">
            Earn up to <span className="text-gradient-orange">50%</span> in referral commissions
          </h2>
          <p className="text-surface-300 text-lg">
            Invite traders to Trade Fight Club and earn commissions on every trade they make.
            Three tiers deep — your network works for you.
          </p>
        </div>

        {/* Tier Cards */}
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8 mb-12">
          {tiers.map((tier) => {
            const colors = getColorClasses(tier.color);
            return (
              <div
                key={tier.tier}
                className={`relative p-6 lg:p-8 rounded-2xl bg-surface-850/50 border ${colors.border} hover:border-opacity-60 transition-all`}
              >
                {/* Icon */}
                <div className={`w-12 h-12 rounded-xl ${colors.bg} flex items-center justify-center mb-4`}>
                  <span className={colors.text}>{tier.icon}</span>
                </div>

                {/* Tier label */}
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs font-bold uppercase tracking-wider ${colors.rateText}`}>
                    {tier.tier}
                  </span>
                  <span className="text-surface-600">—</span>
                  <span className="text-sm text-surface-300">{tier.label}</span>
                </div>

                {/* Rate */}
                <div className={`inline-flex items-center px-3 py-1.5 rounded-lg ${colors.rateBg} mb-4`}>
                  <span className={`text-2xl font-bold ${colors.rateText}`}>{tier.rate}</span>
                  <span className={`text-sm ml-1 ${colors.rateText} opacity-70`}>commission</span>
                </div>

                {/* Description */}
                <p className="text-surface-300 text-sm leading-relaxed">
                  {tier.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* How it works - simple steps */}
        <div className="glass-card rounded-2xl p-6 lg:p-8">
          <h3 className="text-xl font-semibold text-white text-center mb-8">How it works</h3>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8">
            {steps.map((s, i) => (
              <div key={s.step} className="flex items-center gap-3 sm:gap-4">
                {i > 0 && (
                  <svg className="hidden sm:block w-5 h-5 text-surface-600 -ml-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
                <div className="w-10 h-10 rounded-full bg-orange-500/15 flex items-center justify-center flex-shrink-0">
                  <span className="text-orange-400 font-bold">{s.step}</span>
                </div>
                <span className="text-white text-sm">{s.text}</span>
              </div>
            ))}
          </div>

          {/* Total earning potential */}
          <div className="mt-8 pt-6 border-t border-surface-800/50 text-center">
            <p className="text-surface-300 text-sm mb-2">Combined earning potential across all tiers</p>
            <p className="text-3xl font-bold text-gradient-orange">Up to 50% commission</p>
            <p className="text-surface-400 text-xs mt-1">34% + 12% + 4% = 50% total across 3 tiers</p>
          </div>
        </div>
      </div>
    </section>
  );
}
