'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { usePrices } from '@/hooks/usePrices';
import { useStats } from '@/hooks/useStats';
import { TickerCard } from './shared/TickerCard';

// Token data with CoinGecko icons
const TOKEN_DATA: Record<string, { icon: string; name: string; fullName: string }> = {
  'BTC-USD': {
    icon: 'https://assets.coingecko.com/coins/images/1/standard/bitcoin.png',
    name: 'Bitcoin',
    fullName: 'Bitcoin / U.S. Dollar',
  },
  'ETH-USD': {
    icon: 'https://assets.coingecko.com/coins/images/279/standard/ethereum.png',
    name: 'Ethereum',
    fullName: 'Ethereum / U.S. Dollar',
  },
  'SOL-USD': {
    icon: 'https://assets.coingecko.com/coins/images/4128/standard/solana.png',
    name: 'Solana',
    fullName: 'Solana / U.S. Dollar',
  },
};

// Format volume for display
const formatVolume = (volume: number): string => {
  if (volume >= 1000000) {
    return `$${(volume / 1000000).toFixed(1)}M`;
  } else if (volume >= 1000) {
    return `$${(volume / 1000).toFixed(1)}K`;
  }
  return `$${volume.toFixed(0)}`;
};

export function HeroSection() {
  const { connected } = useWallet();
  const { prices, isConnected } = usePrices({ symbols: ['BTC-USD', 'ETH-USD', 'SOL-USD'] });
  const { stats } = useStats();

  const tickerSymbols = ['BTC-USD', 'ETH-USD', 'SOL-USD'];

  return (
    <section className="relative pt-24 pb-12 lg:pt-32 lg:pb-20 overflow-hidden hero-bg">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(249,115,22,0.12)_0%,_transparent_50%)]" />
      <div className="absolute top-1/3 left-0 w-[600px] h-[600px] bg-primary-500/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-violet-500/5 rounded-full blur-3xl" />

      <div className="relative max-w-7xl mx-auto px-4 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
          {/* Left Column - Content */}
          <div className="text-center lg:text-left">
            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight mb-6 leading-tight text-white">
              Revolutionizing
              <br />
              1v1 Trading
              <br />
              Fights
            </h1>

            {/* Subheadline */}
            <p className="text-lg lg:text-xl text-surface-400 mb-8 max-w-xl mx-auto lg:mx-0 leading-relaxed">
              Unleash your trading skills. Compete head-to-head against other traders in real-time PvP fights. Top 3 weekly traders win cash prizes.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 mb-10">
              {connected ? (
                <Link href="/lobby" className="btn-glow-orange w-full sm:w-auto text-center">
                  Start Fighting
                </Link>
              ) : (
                <WalletMultiButton />
              )}
              <Link
                href="/leaderboard"
                className="btn-outline-glow w-full sm:w-auto text-center"
              >
                View Leaderboard
              </Link>
            </div>

            {/* Stats Row */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-6 lg:gap-10 mb-6">
              <div>
                <p className="text-2xl lg:text-3xl font-bold text-white">
                  {formatVolume(stats.tradingVolume)}
                </p>
                <p className="text-sm text-surface-500">Trading Volume</p>
              </div>
              <div className="w-px h-10 bg-surface-700 hidden sm:block" />
              <div>
                <p className="text-2xl lg:text-3xl font-bold text-white">
                  {formatVolume(stats.fightVolume)}
                </p>
                <p className="text-sm text-surface-500">Fight Volume</p>
              </div>
              <div className="w-px h-10 bg-surface-700 hidden sm:block" />
              <div>
                <p className="text-2xl lg:text-3xl font-bold text-white">
                  {stats.fightsCompleted}
                </p>
                <p className="text-sm text-surface-500">Fights Completed</p>
              </div>
            </div>

            {/* Powered by Pacifica */}
            <div className="flex items-center justify-center lg:justify-start gap-3">
              <span className="text-sm text-surface-500">Powered by</span>
              <Image
                src="images/landing/White_Text_White.png"
                alt="Pacifica"
                width={120}
                height={30}
                className="h-6 w-auto opacity-80"
              />
            </div>
          </div>

          {/* Right Column - Bull vs Bear Image */}
          <div className="relative hidden lg:block">
            <Image
              src="/images/landing/TFC-Bear-vs-Bull.png"
              alt="Bull vs Bear - Trade Fight Club"
              width={600}
              height={500}
              className="w-full h-auto"
              priority
            />
            {/* Decorative Elements */}
            <div className="absolute -z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-gradient-radial from-orange-500/10 via-transparent to-transparent rounded-full blur-2xl" />
          </div>
        </div>
      </div>

      {/* Crypto Tickers - Inside Hero for same background */}
      <div className="relative max-w-7xl mx-auto px-4 lg:px-8 mt-12 lg:mt-16">
        <div className="grid md:grid-cols-3 gap-4 lg:gap-6">
          {tickerSymbols.map((symbol) => {
            const tokenInfo = TOKEN_DATA[symbol];
            if (!tokenInfo) return null;
            return (
              <TickerCard
                key={symbol}
                symbol={symbol}
                tokenInfo={tokenInfo}
                priceData={prices[symbol]}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}
