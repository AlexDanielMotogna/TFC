'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { TokenIcon, extractBaseSymbol } from '@/components/TokenIcon';
import { createWsAdapter } from '@/lib/ws/ws-factory';
import type { ExchangeWsCallbacks, WsMarket } from '@/lib/ws/types';
import type { ExchangeType } from '@tfc/shared';
import { getBaseToken } from '@tfc/shared';

// Wallets supported - grouped by chain ecosystem
const solanaWallets = [
  { name: 'Phantom', logo: '/wallets/Phantom-Icon_App_128x128.png' },
  { name: 'Solflare', logo: '/wallets/solflare.jpeg' },
];

const evmWallets = [
  { name: 'MetaMask', logo: '/wallets/metamask.svg' },
  { name: 'Coinbase', logo: '/wallets/coinbase.svg' },
  { name: 'Trust Wallet', logo: '/wallets/trust.svg' },
  { name: 'OKX', logo: '/wallets/okx.svg' },
  { name: 'WalletConnect', logo: '/wallets/walletconnect.svg' },
];

// Features for real execution
const executionFeatures = [
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13 10V3L4 14h7v7l9-11h-7z"
        />
      </svg>
    ),
    title: 'Real Execution',
    description: 'All trades execute on-chain with real liquidity across multiple DEXs',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
        />
      </svg>
    ),
    title: 'Non-Custodial',
    description: 'Your keys, your crypto. We never hold your funds',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
        />
      </svg>
    ),
    title: 'Secure',
    description: 'Battle-tested smart contracts across Solana and EVM chains',
  },
];

const ASSETS_PER_PAGE = 50;
const AUTO_ADVANCE_MS = 5000;

// All active exchanges to aggregate markets from
const LANDING_EXCHANGES: ExchangeType[] = ['pacifica', 'hyperliquid', 'nado'];

/**
 * Connects to all active exchanges and returns a deduplicated, merged market list.
 * Deduplicates by base token (e.g. BTC-USD and BTC-PERP merge), keeping the highest leverage.
 */
function useAllExchangeMarkets(): WsMarket[] {
  const [marketsByExchange, setMarketsByExchange] = useState<Record<string, WsMarket[]>>({});

  useEffect(() => {
    const adapters: {
      adapter: ReturnType<typeof createWsAdapter>;
      callbacks: ExchangeWsCallbacks;
    }[] = [];

    for (const exchange of LANDING_EXCHANGES) {
      const adapter = createWsAdapter(exchange);
      let received = false;
      const callbacks: ExchangeWsCallbacks = {
        onPrices: (_prices, markets) => {
          if (!received && markets.length > 0) {
            received = true;
            setMarketsByExchange((prev) => ({ ...prev, [exchange]: markets }));
          }
        },
      };
      adapters.push({ adapter, callbacks });
      adapter.connect(callbacks);
      adapter.subscribePrices();
    }

    return () => {
      for (const { adapter, callbacks } of adapters) {
        adapter.removeCallbacks(callbacks);
      }
    };
  }, []);

  return useMemo(() => {
    const byBase = new Map<string, WsMarket>();
    for (const exchange of LANDING_EXCHANGES) {
      for (const market of marketsByExchange[exchange] || []) {
        const base = getBaseToken(market.symbol);
        const existing = byBase.get(base);
        if (!existing || market.maxLeverage > existing.maxLeverage) {
          byBase.set(base, { ...market, symbol: `${base}-USD` });
        }
      }
    }
    return Array.from(byBase.values());
  }, [marketsByExchange]);
}

export function Web3Experience() {
  // Get deduplicated markets from all exchanges
  const markets = useAllExchangeMarkets();

  // Dynamic fees from Pacifica API
  const [fees, setFees] = useState({ makerFeePercent: '0.0650', takerFeePercent: '0.0900' });
  const [activePage, setActivePage] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      .catch(() => {});
  }, []);

  // Calculate max leverage from markets
  const maxLeverage = markets.length > 0 ? Math.max(...markets.map((m) => m.maxLeverage)) : 50;

  // Paginate markets into chunks of 50
  const pages = useMemo(() => {
    const result: (typeof markets)[] = [];
    for (let i = 0; i < markets.length; i += ASSETS_PER_PAGE) {
      result.push(markets.slice(i, i + ASSETS_PER_PAGE));
    }
    return result.length > 0 ? result : [[]];
  }, [markets]);

  const totalPages = pages.length;

  const goToPage = useCallback(
    (page: number) => {
      setActivePage(Math.max(0, Math.min(page, totalPages - 1)));
    },
    [totalPages]
  );

  const nextPage = useCallback(() => {
    setActivePage((prev) => (prev + 1) % totalPages);
  }, [totalPages]);

  const prevPage = useCallback(() => {
    setActivePage((prev) => (prev - 1 + totalPages) % totalPages);
  }, [totalPages]);

  // Auto-advance
  useEffect(() => {
    if (isPaused || totalPages <= 1) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(nextPage, AUTO_ADVANCE_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPaused, totalPages, nextPage]);

  return (
    <section id="markets" className="py-16 lg:py-24 border-t border-surface-800">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center mb-12 lg:mb-16">
          <h2 className="text-3xl lg:text-5xl font-bold tracking-tight mb-4 text-white">
            Trade anywhere, connect anything
          </h2>
          <p className="text-surface-400 text-lg">
            Connect your favorite wallet and trade perpetuals on {markets.length || '200+'} assets
            across Pacifica, Hyperliquid, and Nado.
          </p>
        </div>

        {/* Asymmetric Two Column Layout */}
        <div className="grid lg:grid-cols-5 gap-6 lg:gap-8">
          {/* Left - Wallets (smaller) */}
          <div className="lg:col-span-2 glass-card rounded-2xl p-6 lg:p-8 flex flex-col">
            <h3 className="text-xl font-semibold text-white mb-3">Any wallet, any chain</h3>
            <p className="text-surface-400 mb-6">
              Connect any Solana or EVM wallet. We support all major wallets natively and hundreds
              more through WalletConnect.
            </p>

            {/* Solana Wallets */}
            <p className="text-[10px] uppercase tracking-widest text-surface-500 mb-2">Solana</p>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {solanaWallets.map((wallet) => (
                <div
                  key={wallet.name}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-surface-800 border border-surface-800 rounded-full hover:border-surface-600 transition-colors"
                >
                  <img
                    src={wallet.logo}
                    alt={wallet.name}
                    width={16}
                    height={16}
                    className="w-4 h-4 rounded-full"
                  />
                  <span className="text-xs text-surface-300">{wallet.name}</span>
                </div>
              ))}
            </div>

            {/* EVM Wallets */}
            <p className="text-[10px] uppercase tracking-widest text-surface-500 mb-2">EVM</p>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {evmWallets.map((wallet) => (
                <div
                  key={wallet.name}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-surface-800 border border-surface-800 rounded-full hover:border-surface-600 transition-colors"
                >
                  <img
                    src={wallet.logo}
                    alt={wallet.name}
                    width={16}
                    height={16}
                    className="w-4 h-4 rounded-full"
                  />
                  <span className="text-xs text-surface-300">{wallet.name}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-surface-600 mb-6">
              + any WalletConnect compatible wallet
            </p>

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
              <h3 className="text-xl font-semibold text-white">
                {markets.length || '40+'} Trading Assets
              </h3>
              <span className="px-3 py-1 text-xs font-medium bg-primary-500/10 text-primary-400 rounded-full">
                Up to {maxLeverage}x Leverage
              </span>
            </div>
            <p className="text-surface-400 mb-6">
              Trade Bitcoin, Ethereum, Solana, memecoins and more with perpetual contracts across
              multiple DEXs.
            </p>

            {/* Assets Slider */}
            <div
              className="relative group/slider"
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
            >
              {/* Slider viewport */}
              <div className="overflow-hidden rounded-xl">
                <div
                  className="flex transition-transform duration-500 ease-in-out"
                  style={{ transform: `translateX(-${activePage * 100}%)` }}
                >
                  {pages.map((page, pageIdx) => (
                    <div
                      key={pageIdx}
                      className="w-full flex-shrink-0 grid grid-cols-5 sm:grid-cols-10 gap-2"
                    >
                      {page.map((market) => {
                        const baseSymbol = extractBaseSymbol(market.symbol);
                        return (
                          <div
                            key={market.symbol}
                            className="group relative flex flex-col items-center py-1"
                            title={`${market.name} - ${market.maxLeverage}x`}
                          >
                            <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg ring-2 ring-transparent group-hover:ring-primary-500/30">
                              <TokenIcon symbol={market.symbol} size="lg" />
                            </div>
                            <span className="mt-0.5 text-[9px] text-surface-500 group-hover:text-surface-300 transition-colors truncate max-w-full">
                              {baseSymbol}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              {/* Navigation Arrows */}
              {totalPages > 1 && (
                <>
                  <button
                    onClick={prevPage}
                    className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-surface-900/90 backdrop-blur-sm border border-surface-700 flex items-center justify-center text-surface-400 hover:text-white hover:border-surface-500 transition-all opacity-0 group-hover/slider:opacity-100"
                    aria-label="Previous page"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15.75 19.5L8.25 12l7.5-7.5"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={nextPage}
                    className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-8 h-8 rounded-full bg-surface-900/90 backdrop-blur-sm border border-surface-700 flex items-center justify-center text-surface-400 hover:text-white hover:border-surface-500 transition-all opacity-0 group-hover/slider:opacity-100"
                    aria-label="Next page"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M8.25 4.5l7.5 7.5-7.5 7.5"
                      />
                    </svg>
                  </button>
                </>
              )}
            </div>

            {/* Pagination dots + page counter */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-4">
                <div className="flex items-center gap-1.5">
                  {pages.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => goToPage(idx)}
                      className={`rounded-full transition-all duration-300 ${
                        idx === activePage
                          ? 'w-5 h-1.5 bg-primary-400'
                          : 'w-1.5 h-1.5 bg-surface-600 hover:bg-surface-500'
                      }`}
                      aria-label={`Go to page ${idx + 1}`}
                    />
                  ))}
                </div>
                <span className="text-[10px] text-surface-500 tabular-nums">
                  {activePage + 1}/{totalPages}
                </span>
              </div>
            )}

            {/* Additional Info - Dynamic fees from Pacifica API */}
            <div className="grid grid-cols-3 gap-4 pt-6 mt-4 border-t border-surface-800/50">
              <div className="text-center">
                <div className="text-lg sm:text-2xl font-bold text-white mb-1">
                  {fees.makerFeePercent}%
                </div>
                <div className="text-xs text-surface-400">Maker Fees</div>
              </div>
              <div className="text-center">
                <div className="text-lg sm:text-2xl font-bold text-white mb-1">
                  {fees.takerFeePercent}%
                </div>
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
