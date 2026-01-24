'use client';

import Link from 'next/link';
import { VSArena } from './VSArena';

// Feature cards data
const features = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    title: 'Create',
    description: 'Create a 1v1 fight and wait for another trader to join. Climb the leaderboard to win weekly prizes.',
    color: 'orange',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
    title: 'Trade',
    description: 'Execute real trades on Trade Fight Club. Long or short crypto, stocks, forex with up to 50x leverage.',
    color: 'green',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
      </svg>
    ),
    title: 'Rank',
    description: 'Climb the leaderboard. Top 3 weekly traders share 10% of platform fees as cash prizes.',
    color: 'violet',
  },
];

const getColorClasses = (color: string) => {
  switch (color) {
    case 'violet':
      return {
        iconBg: 'bg-violet-500/10',
        iconText: 'text-violet-400',
      };
    case 'orange':
      return {
        iconBg: 'bg-orange-500/10',
        iconText: 'text-orange-400',
      };
    case 'green':
      return {
        iconBg: 'bg-green-500/10',
        iconText: 'text-green-400',
      };
    default:
      return {
        iconBg: 'bg-surface-700',
        iconText: 'text-surface-400',
      };
  }
};

export function FeaturesGrid() {
  return (
    <section id="how-it-works" className="py-16 lg:py-24 border-t border-surface-800">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center mb-12 lg:mb-16">
          <h2 className="text-3xl lg:text-5xl font-bold tracking-tight mb-4 text-white">
            The ultimate
            <br />
            trading battleground
          </h2>
          <p className="text-surface-400 text-lg">
            Prove your skills. Win weekly prizes. Top 3 traders share 10% of platform fees.
          </p>
        </div>

        {/* VS Arena Animation */}
        <div className="mb-12 lg:mb-16">
          <VSArena />
        </div>

        {/* Feature Cards - 3 columns */}
        <div className="grid md:grid-cols-3 gap-6">
          {features.map((feature, index) => {
            const colors = getColorClasses(feature.color);
            return (
              <div key={index} className="feature-card p-6 text-center md:text-left">
                <div className={`w-12 h-12 rounded-xl ${colors.iconBg} flex items-center justify-center mb-4 mx-auto md:mx-0`}>
                  <span className={colors.iconText}>{feature.icon}</span>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-surface-400 leading-relaxed">{feature.description}</p>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div className="mt-12 text-center">
          <Link
            href="/lobby"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-base font-semibold text-white bg-orange-500 hover:bg-orange-400 transition-colors shadow-lg shadow-orange-500/20"
          >
            Start Fighting
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
