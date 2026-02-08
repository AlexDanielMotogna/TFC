'use client';

import { useState, useEffect } from 'react';
import { usePrices } from '@/hooks';
import { TokenIcon, extractBaseSymbol } from '@/components/TokenIcon';

// Wallets supported - using local icons
const wallets = [
  { name: 'Phantom', logo: '/wallets/Phantom-Icon_App.svg' },
  { name: 'MetaMask', logo: '/images/landing/walletConnection/Metamaks.png' },
  { name: 'Solflare', logo: '/images/landing/walletConnection/Solflare.png' },
];

// Features for real execution
const executionFeatures = [
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    title: 'Real Execution',
    description: 'All trades execute on Pacifica DEX with real liquidity',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
    title: 'Non-Custodial',
    description: 'Your keys, your crypto. We never hold your funds',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    title: 'Secure',
    description: 'Battle-tested smart contracts on Solana',
  },
];

export function Web3Experience() {
  // Get markets dynamically from Pacifica API
  const { markets } = usePrices();

  // Dynamic fees from Pacifica API
  const [fees, setFees] = useState({ makerFeePercent: '0.0650', takerFeePercent: '0.0900' });

  useEffect(() => {
    fetch('/api/fees')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data) {
          setFees({
            makerFeePercent: data.data.makerFeePercent,
            takerFeePercent: data.data.takerFeePercent,
          });
        }
      })
      .catch(() => {
        // Keep fallback values on error
      });
  }, []);

  // Calculate max leverage from markets
  const maxLeverage = markets.length > 0
    ? Math.max(...markets.map((m) => m.maxLeverage))
    : 50;

  return (
    <section id="markets" className="py-16 lg:py-24 border-t border-surface-800">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center mb-12 lg:mb-16">
          <h2 className="text-3xl lg:text-5xl font-bold tracking-tight mb-4 text-white">
            Trade anywhere, connect anything
          </h2>
          <p className="text-surface-400 text-lg">
            Connect your favorite wallet and trade perpetuals on {markets.length || '40+'} assets with real execution on Pacifica.
          </p>
        </div>

        {/* Asymmetric Two Column Layout */}
        <div className="grid lg:grid-cols-5 gap-6 lg:gap-8">
          {/* Left - Wallets (smaller) */}
          <div className="lg:col-span-2 glass-card rounded-2xl p-6 lg:p-8 flex flex-col">
            <h3 className="text-xl font-semibold text-white mb-3">Multiple wallets support</h3>
            <p className="text-surface-400 mb-6">
              Connect with your preferred Solana wallet. We support all major wallets through WalletConnect and native integrations.
            </p>

            <p className="text-sm text-surface-500 mb-4">Available on</p>
            <div className="flex flex-wrap gap-2 mb-8">
              {wallets.map((wallet) => (
                <div
                  key={wallet.name}
                  className="flex items-center gap-2 px-3 py-2 bg-surface-800 border border-surface-800 rounded-full hover:border-surface-600 transition-colors"
                >
                  <img
                    src={wallet.logo}
                    alt={wallet.name}
                    width={20}
                    height={20}
                    className="w-5 h-5 rounded-full"
                  />
                  <span className="text-sm text-surface-300">{wallet.name}</span>
                </div>
              ))}
            </div>

            {/* Execution Features */}
            <div className="mt-auto pt-6 border-t border-surface-800/50 space-y-4">
              {executionFeatures.map((feature, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary-500/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-primary-400">{feature.icon}</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">{feature.title}</h4>
                    <p className="text-xs text-surface-400">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right - Trading Assets (larger) */}
          <div className="lg:col-span-3 glass-card rounded-2xl p-6 lg:p-8">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xl font-semibold text-white">{markets.length || '40+'} Trading Assets</h3>
              <span className="px-3 py-1 text-xs font-medium bg-primary-500/10 text-primary-400 rounded-full">
                Up to {maxLeverage}x Leverage
              </span>
            </div>
            <p className="text-surface-400 mb-6">
              Trade Bitcoin, Ethereum, Solana, memecoins and more with perpetual contracts powered by Pacifica.
            </p>

            {/* Assets Grid */}
            <div className="grid grid-cols-8 sm:grid-cols-10 lg:grid-cols-12 gap-2 mb-6">
              {markets.map((market) => {
                const baseSymbol = extractBaseSymbol(market.symbol);
                return (
                  <div
                    key={market.symbol}
                    className="group relative flex flex-col items-center"
                    title={`${market.name} - ${market.maxLeverage}x`}
                  >
                    <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg ring-2 ring-transparent group-hover:ring-primary-500/30">
                      <TokenIcon symbol={market.symbol} size="lg" />
                    </div>
                    <span className="mt-0.5 text-[9px] text-surface-500 group-hover:text-surface-300 transition-colors truncate max-w-full">{baseSymbol}</span>
                  </div>
                );
              })}
            </div>

            {/* Additional Info - Dynamic fees from Pacifica API */}
            <div className="grid grid-cols-3 gap-4 pt-6 border-t border-surface-800/50">
              <div className="text-center">
                <div className="text-lg sm:text-2xl font-bold text-white mb-1">{fees.makerFeePercent}%</div>
                <div className="text-xs text-surface-400">Maker Fees</div>
              </div>
              <div className="text-center">
                <div className="text-lg sm:text-2xl font-bold text-white mb-1">{fees.takerFeePercent}%</div>
                <div className="text-xs text-surface-400">Taker Fees</div>
              </div>
              <div className="text-center">
                <div className="text-lg sm:text-2xl font-bold text-white mb-1">&lt;400ms</div>
                <div className="text-xs text-surface-400">Execution Time</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
