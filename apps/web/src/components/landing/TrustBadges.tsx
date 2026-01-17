'use client';

export function TrustBadges() {
  const features = [
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      title: '31 Blockchains',
      description: 'Invest in, transfer, FTX solacutive and 16 custodian blockchain integrations.',
    },
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      title: 'Low fees.',
      description: 'Lorem ipsum, or lipsum as it is sometimes known is dummy text used in laying out web designs.',
    },
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
      title: 'Up to 50x leverage.',
      description: 'Lorem ipsum, or lipsum as it is sometimes known is dummy text used in laying out web designs.',
    },
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
      title: 'Transparent.',
      description: 'Lorem ipsum, or lipsum as it is sometimes known is dummy text used in laying out web designs.',
    },
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      title: 'Ultra speed.',
      description: 'Lorem ipsum, or lipsum as it is sometimes known is dummy text used in laying out web designs.',
    },
  ];

  return (
    <section className="py-16 lg:py-24 bg-surface-850/30 border-t border-surface-800">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-4">
          <span className="section-badge">
            <span className="w-2 h-2 bg-primary-500 rounded-full" />
            Secure and private
          </span>
        </div>
        <div className="max-w-3xl mx-auto text-center mb-12 lg:mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold tracking-tight mb-4">
            You might also be interested in
          </h2>
          <p className="text-surface-400">
            Metaverse evolution of connectivity, compete & collaboration
            in the digital realm. An era of new possibilities.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Left Column - Large Feature */}
          <div className="feature-card p-8">
            <div className="w-14 h-14 rounded-xl bg-orange-500/10 flex items-center justify-center mb-6">
              <span className="text-orange-400">{features[0].icon}</span>
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">{features[0].title}</h3>
            <p className="text-surface-400 mb-8">{features[0].description}</p>

            {/* Trust Badges */}
            <div className="space-y-4">
              <p className="text-sm font-medium text-surface-300">Trusted by industry leaders</p>
              <div className="flex flex-wrap items-center gap-4">
                <div className="trust-badge">
                  <svg className="w-5 h-5 text-primary-400" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" />
                  </svg>
                  OpenSea
                </div>
                <div className="trust-badge">
                  <span className="text-yellow-400">★</span>
                  <span>4.9</span>
                </div>
                <div className="trust-badge">
                  <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">VERIFIED</span>
                </div>
                <div className="trust-badge">
                  <svg className="w-5 h-5 text-green-400" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
                  </svg>
                  Trustpilot
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Stacked Features */}
          <div className="space-y-4">
            {features.slice(1).map((feature, index) => (
              <div key={index} className="flex gap-4 p-4 rounded-xl hover:bg-surface-800/50 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex-shrink-0 flex items-center justify-center">
                  <span className="text-primary-400 scale-75">{feature.icon}</span>
                </div>
                <div>
                  <h4 className="font-semibold text-white mb-1">{feature.title}</h4>
                  <p className="text-sm text-surface-400">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
