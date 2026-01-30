'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

interface FullTerminalDemoProps {
  highlightFeature?: 'leverage' | 'long-short' | 'market-orders' | 'limit-orders' | 'stop-loss' | 'take-profit' | 'flip-position' | 'trailing-stop' | 'fight-capital-limit' | 'deposit-withdraw' | 'fight-banner' | 'fight-only' | null;
}

export function FullTerminalDemo({ highlightFeature = null }: FullTerminalDemoProps) {
  const [selectedSide, setSelectedSide] = useState<'LONG' | 'SHORT'>('LONG');
  const [leverage, setLeverage] = useState(5);
  const [orderType, setOrderType] = useState<'market' | 'limit' | 'stop-market' | 'stop-limit'>('market');
  const [tpEnabled, setTpEnabled] = useState(false);
  const [slEnabled, setSlEnabled] = useState(false);
  const [bottomTab, setBottomTab] = useState<'positions' | 'orders' | 'trades' | 'history'>('positions');
  const [selectedInterval, setSelectedInterval] = useState('5m');
  const [showFightOnly, setShowFightOnly] = useState(true);

  // Modal states
  const [showMarketModal, setShowMarketModal] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [showFlipModal, setShowFlipModal] = useState(false);
  const [showTpSlModal, setShowTpSlModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<'BTC' | 'ETH' | null>(null);
  const [tpSlTab, setTpSlTab] = useState<'full' | 'partial'>('full');
  const [showAddPartialModal, setShowAddPartialModal] = useState(false);
  const [limitPriceEnabled, setLimitPriceEnabled] = useState(false);
  const [configureAmountEnabled, setConfigureAmountEnabled] = useState(false);
  const [partialAmount, setPartialAmount] = useState(50);
  const [closeAmount, setCloseAmount] = useState(100);

  // Explanation modals
  const [showFightBannerExplain, setShowFightBannerExplain] = useState(false);
  const [showFightOnlyExplain, setShowFightOnlyExplain] = useState(false);
  const [showFightCapitalExplain, setShowFightCapitalExplain] = useState(false);
  const [showSwitchFightExplain, setShowSwitchFightExplain] = useState(false);

  // Dynamic fees from Pacifica API
  const [feesDisplay, setFeesDisplay] = useState('0.0900% / 0.0650%');

  useEffect(() => {
    fetch('/api/fees')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data) {
          setFeesDisplay(`${data.data.takerFeePercent}% / ${data.data.makerFeePercent}%`);
        }
      })
      .catch(() => {
        // Keep fallback value on error
      });
  }, []);

  // Auto-open modals when feature is selected
  useEffect(() => {
    setShowDepositModal(false);
    setShowWithdrawModal(false);
    setShowFightBannerExplain(false);
    setShowFightOnlyExplain(false);
    setShowFightCapitalExplain(false);
    setShowSwitchFightExplain(false);

    if (highlightFeature === 'deposit-withdraw') {
      setShowDepositModal(true);
    } else if (highlightFeature === 'fight-banner') {
      setShowFightBannerExplain(true);
    } else if (highlightFeature === 'fight-only') {
      setShowFightOnlyExplain(true);
    } else if (highlightFeature === 'fight-capital-limit') {
      setShowFightCapitalExplain(true);
    }
  }, [highlightFeature]);

  const getHighlightClass = (feature: string) => {
    if (highlightFeature === feature) {
      return 'ring-2 ring-primary-500 ring-offset-1 ring-offset-surface-900 rounded relative z-10';
    }
    return '';
  };

  // Order book demo data
  const askLevels = [
    { price: 96688, size: 1.30, total: 4.54 },
    { price: 96679, size: 0.51, total: 3.24 },
    { price: 96678, size: 0.16, total: 2.73 },
    { price: 96676, size: 0.03, total: 2.58 },
    { price: 96673, size: 0.00, total: 2.54 },
    { price: 96672, size: 0.16, total: 2.54 },
    { price: 96669, size: 0.30, total: 2.38 },
    { price: 96667, size: 0.02, total: 2.09 },
    { price: 96666, size: 0.03, total: 2.07 },
    { price: 96664, size: 2.04, total: 2.04 },
  ];

  const bidLevels = [
    { price: 96663, size: 0.00, total: 0.00 },
    { price: 96662, size: 0.00, total: 0.00 },
    { price: 96651, size: 0.19, total: 0.19 },
    { price: 96646, size: 0.19, total: 0.19 },
    { price: 96645, size: 0.03, total: 0.22 },
    { price: 96644, size: 0.53, total: 0.76 },
    { price: 96640, size: 0.03, total: 0.79 },
    { price: 96639, size: 0.21, total: 1.00 },
    { price: 96638, size: 1.85, total: 2.85 },
    { price: 96637, size: 0.17, total: 2.22 },
  ];

  const openModal = (type: 'market' | 'limit' | 'flip' | 'tpsl', position: 'BTC' | 'ETH') => {
    setSelectedPosition(position);
    if (type === 'market') setShowMarketModal(true);
    if (type === 'limit') setShowLimitModal(true);
    if (type === 'flip') setShowFlipModal(true);
    if (type === 'tpsl') setShowTpSlModal(true);
  };

  return (
    <div className="bg-surface-950 w-full relative overflow-x-auto">
      {/* Single wrapper to ensure consistent width across all sections */}
      <div className="min-w-[1200px]">
      {/* Top Navbar - matches AppShell.tsx */}
      <div className="bg-surface-850 border-b border-surface-700 px-4 h-12 flex items-center">
        {/* Logo - Left */}
        <div className="flex-shrink-0">
          <Image
            src="/images/logos/favicon-white-192.png"
            alt="TFC"
            width={36}
            height={36}
            className="rounded-lg"
          />
        </div>

        {/* Navigation - Centered (matches AppShell.tsx MUI icons) */}
        <nav className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1">
          {/* Trade - ShowChartIcon */}
          <div className="px-3 py-1.5 text-sm rounded flex items-center gap-1.5 text-zinc-100 bg-surface-800 cursor-pointer">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z"/>
            </svg>
            <span>Trade</span>
          </div>
          {/* Arena - SportsKabaddiIcon */}
          <div className="px-3 py-1.5 text-sm rounded flex items-center gap-1.5 text-surface-400 hover:text-zinc-200 hover:bg-surface-800/50 cursor-pointer">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 5c1.11 0 2-.9 2-2s-.89-2-2-2-2 .9-2 2 .9 2 2 2zm-5.5 6.5c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5S5 9.17 5 10s.67 1.5 1.5 1.5zM5.5 21h1v-3.8l-.73-2.2L3 17.53l1.71 1.7v1.77H5.5zm6.5.5c.28 0 .5-.22.5-.5v-4.66c0-.24-.12-.47-.31-.62l-1.52-1.17 1.03-4.19.71.67c.19.18.46.28.74.28H15c.55 0 1-.45 1-1s-.45-1-1-1h-1.39l-.31-.29c-.06-.06-.12-.11-.19-.15l-1.33-1.26-.55-1.7c-.11-.34-.39-.62-.73-.71L9.73 5c-.55-.15-1.11.17-1.26.73l-.52 1.91c-.11.38-.01.79.27 1.08l1.37 1.37-1.05 4.5L5.96 9.3c-.29-.53-.95-.72-1.48-.43s-.72.95-.43 1.48l4.99 9.01c.14.25.4.39.68.41l2.2.08c.03 0 .05.01.08.01zM17.5 21h1v-1.77l1.71-1.7L17.44 15l-.73 2.2V21zM17.5 10c.83 0 1.5-.67 1.5-1.5S18.33 7 17.5 7 16 7.67 16 8.5s.67 1.5 1.5 1.5z"/>
            </svg>
            <span>Arena</span>
          </div>
          {/* Leaderboard - LeaderboardIcon */}
          <div className="px-3 py-1.5 text-sm rounded flex items-center gap-1.5 text-surface-400 hover:text-zinc-200 hover:bg-surface-800/50 cursor-pointer">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7.5 21H2V9h5.5v12zm7.25-18h-5.5v18h5.5V3zM22 11h-5.5v10H22V11z"/>
            </svg>
            <span>Leaderboard</span>
          </div>
          {/* Rewards - EmojiEventsIcon */}
          <div className="px-3 py-1.5 text-sm rounded flex items-center gap-1.5 text-surface-400 hover:text-zinc-200 hover:bg-surface-800/50 cursor-pointer">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"/>
            </svg>
            <span>Rewards</span>
          </div>
          {/* Referrals - GroupsIcon */}
          <div className="px-3 py-1.5 text-sm rounded flex items-center gap-1.5 text-surface-400 hover:text-zinc-200 hover:bg-surface-800/50 cursor-pointer">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 12.75c1.63 0 3.07.39 4.24.9 1.08.48 1.76 1.56 1.76 2.73V18H6v-1.61c0-1.18.68-2.26 1.76-2.73 1.17-.52 2.61-.91 4.24-.91zM4 13c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm1.13 1.1c-.37-.06-.74-.1-1.13-.1-.99 0-1.93.21-2.78.58C.48 14.9 0 15.62 0 16.43V18h4.5v-1.61c0-.83.23-1.61.63-2.29zM20 13c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm4 3.43c0-.81-.48-1.53-1.22-1.85-.85-.37-1.79-.58-2.78-.58-.39 0-.76.04-1.13.1.4.68.63 1.46.63 2.29V18H24v-1.57zM12 6c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3z"/>
            </svg>
            <span>Referrals</span>
          </div>
          {/* Profile - PersonIcon */}
          <div className="px-3 py-1.5 text-sm rounded flex items-center gap-1.5 text-surface-400 hover:text-zinc-200 hover:bg-surface-800/50 cursor-pointer">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
            <span>Profile</span>
          </div>
        </nav>

        {/* Right side: Balance, Notifications, Wallet */}
        <div className="flex items-center gap-3 ml-auto">
          {/* Balance Display - matches AppShell.tsx WalletIcon */}
          <div className="flex items-center gap-1.5 px-2 py-1 bg-surface-800 rounded text-sm">
            <svg className="w-4 h-4 text-surface-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3" />
            </svg>
            <span className="text-surface-200 font-mono">$5.71</span>
          </div>

          {/* Notification Bell */}
          <button className="p-1.5 text-surface-400 hover:text-surface-200 hover:bg-surface-800 rounded transition-colors relative">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
            </svg>
            <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">2</span>
          </button>

          {/* Wallet Button */}
          <div className="flex items-center gap-2 bg-surface-800 rounded-lg px-3 py-1.5">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-400 to-blue-500" />
            <span className="text-white text-xs font-mono">74t7.Rveo</span>
          </div>
        </div>
      </div>

      {/* Fight Banner - Matches actual FightBanner.tsx */}
      <div
        onClick={() => setShowFightBannerExplain(true)}
        className={`bg-surface-850 border-b border-surface-700 px-4 h-10 flex items-center justify-between cursor-pointer hover:bg-surface-800/50 transition-colors ${getHighlightClass('fight-banner')}`}
      >
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
            <span className="text-surface-400">Live</span>
          </div>
          <div className="h-4 w-px bg-surface-700" />
          <span className="text-zinc-400">
            vs <span className="text-zinc-100 font-medium">6WZ3...qVaU</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-base tabular-nums text-zinc-400">49:47</span>
          <span className="text-xs ttext-zinc-100">$5,000 stake</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs text-surface-500">You</div>
              <div className="text-loss-500 font-mono tabular-nums">-12.0423%</div>
            </div>
            <div className="h-6 w-px bg-surface-700" />
            <div>
              <div className="text-xs text-surface-500">Opp</div>
              <div className="text-win-500 font-mono tabular-nums">+4.0156%</div>
            </div>
          </div>
          <div className="px-2 py-0.5 rounded text-xs font-medium bg-loss-500/10 text-loss-500">Behind</div>
        </div>
      </div>

      {/* Active Fights Switcher */}
      <div className="bg-surface-900 px-4 py-1.5 flex items-center justify-between border-t border-b border-surface-800">
        <span className="text-xs text-surface-500">3 active fights</span>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-800 border border-primary-500 rounded text-xs cursor-pointer transition-colors">
            <span className="text-surface-400">vs</span>
            <span className="font-medium text-primary-400">6WZ3...qVaU</span>
            <span className="text-surface-600">|</span>
            <span className="font-mono text-white">169:34</span>
            <span className="text-surface-600">|</span>
            <span className="font-mono text-white">$5000</span>
          </div>
          <div
            onClick={() => setShowSwitchFightExplain(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-surface-800 hover:bg-surface-700 border border-surface-700 rounded text-xs cursor-pointer transition-colors"
          >
            <span className="text-surface-400">vs</span>
            <span className="font-medium text-primary-400">6WZ3...qVaU</span>
            <span className="text-surface-600">|</span>
            <span className="font-mono text-surface-300">169:29</span>
            <span className="text-surface-600">|</span>
            <span className="font-mono text-surface-300">$1000</span>
          </div>
        </div>
      </div>

      {/* Main Content with gaps */}
      <div className="p-2 flex gap-2 h-[700px]">
        {/* Left side: Order Book + Chart + Positions */}
        <div className="flex-1 flex flex-col gap-2">
          {/* Top Row: Order Book + Chart */}
          <div className="flex gap-2 flex-1">
            {/* Order Book - matches OrderBook.tsx */}
            <div className="w-72 bg-surface-900 rounded-none border border-surface-800 flex-shrink-0 overflow-hidden flex flex-col">
              {/* Header with agg level and size mode selector */}
              <div className="px-2 py-1.5 border-b border-surface-700 flex items-center justify-between">
                {/* Aggregation level selector */}
                <select className="bg-surface-800 border border-surface-600 rounded px-2 py-0.5 text-xs text-surface-300 cursor-pointer hover:border-surface-500">
                  <option>0.01</option>
                  <option>0.02</option>
                  <option>0.05</option>
                  <option>0.1</option>
                  <option>1</option>
                  <option>10</option>
                </select>
                {/* Size mode selector */}
                <select className="bg-surface-800 border border-surface-600 rounded px-2 py-0.5 text-xs text-surface-300 cursor-pointer hover:border-surface-500">
                  <option>USD</option>
                  <option>BTC</option>
                </select>
              </div>

              {/* Column headers */}
              <div className="grid grid-cols-3 text-[10px] text-surface-400 px-2 py-1 border-b border-surface-700 uppercase">
                <span>Price</span>
                <span className="text-right">Size(BTC)</span>
                <span className="text-right">Total</span>
              </div>

              {/* Asks (sells) */}
              <div className="flex-1 flex flex-col justify-end">
                {askLevels.map((level, i) => (
                  <div key={i} className="relative grid grid-cols-3 text-[10px] font-mono px-2 py-0.5 cursor-pointer hover:bg-surface-700/30 items-center">
                    <div className="absolute inset-y-0 right-0 bg-gradient-to-l from-loss-500/30 to-loss-600/10" style={{ width: `${Math.min(100, (level.total / 5) * 100)}%` }} />
                    <span className="text-loss-400 relative tabular-nums tracking-tight">{level.price.toLocaleString()}</span>
                    <span className="text-surface-200 relative text-right tabular-nums tracking-tight">{level.size.toFixed(5)}</span>
                    <span className="text-surface-200 relative text-right tabular-nums tracking-tight">{level.total.toFixed(5)}</span>
                  </div>
                ))}
              </div>

              {/* Spread */}
              <div className="px-2 py-1 border-y border-surface-700 bg-surface-800/30 flex justify-between text-[10px] text-surface-400">
                <span>Spread</span>
                <span className="tabular-nums tracking-tight">1.000</span>
                <span className="tabular-nums tracking-tight">0.001%</span>
              </div>

              {/* Bids (buys) */}
              <div className="flex-1 flex flex-col">
                {bidLevels.map((level, i) => (
                  <div key={i} className="relative grid grid-cols-3 text-[10px] font-mono px-2 py-0.5 cursor-pointer hover:bg-surface-700/30 items-center">
                    <div className="absolute inset-y-0 right-0 bg-gradient-to-l from-win-500/30 to-win-600/10" style={{ width: `${Math.min(100, (level.total / 3) * 100)}%` }} />
                    <span className="text-win-400 relative tabular-nums tracking-tight">{level.price.toLocaleString()}</span>
                    <span className="text-surface-200 relative text-right tabular-nums tracking-tight">{level.size.toFixed(5)}</span>
                    <span className="text-surface-200 relative text-right tabular-nums tracking-tight">{level.total.toFixed(5)}</span>
                  </div>
                ))}
              </div>

              {/* Buy/Sell percentage bar */}
              <div className="px-2 py-1.5 border-t border-surface-700">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-win-400 font-medium tabular-nums">32.8%</span>
                  <div className="flex-1 h-1.5 bg-surface-800 rounded-full overflow-hidden flex">
                    <div className="bg-win-500" style={{ width: '32.8%' }} />
                    <div className="bg-loss-500" style={{ width: '67.2%' }} />
                  </div>
                  <span className="text-[10px] text-loss-400 font-medium tabular-nums">67.2%</span>
                </div>
              </div>
            </div>

            {/* Chart */}
            <div className="flex-1 min-w-0 bg-surface-900 rounded-none border border-surface-800 overflow-hidden">
              {/* Market Info Header */}
              <div className="px-3 py-2 border-b border-surface-800 flex items-center gap-4 overflow-x-auto text-[10px]">
              <select className="bg-surface-800 border border-surface-700 rounded px-2 py-1 text-white text-xs font-semibold flex-shrink-0">
                <option>BTC-USD</option>
              </select>
              <div className="flex flex-col flex-shrink-0">
                <span className="text-surface-500">Last Price</span>
                <span className="text-white font-mono">96,718.00</span>
              </div>
              <div className="flex flex-col flex-shrink-0">
                <span className="text-surface-500">Mark</span>
                <span className="text-white font-mono">96,678.61</span>
              </div>
              <div className="flex flex-col flex-shrink-0">
                <span className="text-surface-500">24h Change</span>
                <span className="text-win-400 font-mono">+3.58%</span>
              </div>
              <div className="flex flex-col flex-shrink-0">
                <span className="text-surface-500">24h Volume</span>
                <span className="text-white font-mono">$510,399,536.83</span>
              </div>
              <div className="flex flex-col flex-shrink-0">
                <span className="text-surface-500">Open Interest</span>
                <span className="text-white font-mono">$32,365,266.81</span>
              </div>
              <div className="flex flex-col flex-shrink-0">
                <span className="text-surface-500">Next Funding / Countdown</span>
                <span className="text-win-400 font-mono">+0.0005% /1h</span>
              </div>
            </div>

            {/* Interval selector */}
            <div className="flex items-center gap-1 px-3 py-1.5 border-b border-surface-800">
              {['1m', '5m', '15m', '1h', '4h', '1d'].map((int) => (
                <button
                  key={int}
                  onClick={() => setSelectedInterval(int)}
                  className={`px-2.5 py-1 text-[10px] rounded transition-colors ${
                    selectedInterval === int ? 'bg-primary-500 text-white' : 'text-surface-400 hover:text-white'
                  }`}
                >
                  {int}
                </button>
              ))}
              <div className="ml-3 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-win-400 animate-pulse" />
                <span className="text-[10px] text-surface-400">Live</span>
              </div>
            </div>

            {/* Chart Area - Realistic candles */}
            <div className="h-[300px] relative bg-surface-950">
              {/* Price scale */}
              <div className="absolute right-2 top-3 bottom-10 flex flex-col justify-between text-[9px] text-surface-500 font-mono">
                {['98000', '97600', '97200', '96800', '96400', '96000', '95600', '95200', '94800', '94400', '94000'].map(p => <span key={p}>{p}</span>)}
              </div>

              {/* Candlestick chart - SVG for precise control */}
              <svg className="absolute inset-3 right-14 bottom-8" viewBox="0 0 800 240" preserveAspectRatio="none">
                {/* Grid lines */}
                {[0, 24, 48, 72, 96, 120, 144, 168, 192, 216, 240].map((y) => (
                  <line key={y} x1="0" y1={y} x2="800" y2={y} stroke="#1e293b" strokeWidth="0.5" />
                ))}

                {/* Realistic candle data - simulating a pattern similar to screenshot */}
                {[
                  // Starting consolidation around 94800-95200
                  { x: 10, o: 180, c: 175, h: 170, l: 185 },
                  { x: 20, o: 175, c: 182, h: 168, l: 188 },
                  { x: 30, o: 182, c: 178, h: 172, l: 186 },
                  { x: 40, o: 178, c: 170, h: 165, l: 182 },
                  { x: 50, o: 170, c: 176, h: 164, l: 180 },
                  // Small dip
                  { x: 60, o: 176, c: 185, h: 172, l: 190 },
                  { x: 70, o: 185, c: 190, h: 180, l: 195 },
                  { x: 80, o: 190, c: 182, h: 178, l: 195 },
                  { x: 90, o: 182, c: 175, h: 170, l: 188 },
                  // Recovery
                  { x: 100, o: 175, c: 168, h: 162, l: 180 },
                  { x: 110, o: 168, c: 160, h: 155, l: 172 },
                  { x: 120, o: 160, c: 155, h: 148, l: 165 },
                  { x: 130, o: 155, c: 162, h: 150, l: 168 },
                  { x: 140, o: 162, c: 158, h: 152, l: 166 },
                  // Consolidation mid-range
                  { x: 150, o: 158, c: 165, h: 152, l: 170 },
                  { x: 160, o: 165, c: 160, h: 155, l: 170 },
                  { x: 170, o: 160, c: 168, h: 155, l: 172 },
                  { x: 180, o: 168, c: 162, h: 158, l: 175 },
                  { x: 190, o: 162, c: 170, h: 158, l: 175 },
                  // Move up
                  { x: 200, o: 170, c: 158, h: 152, l: 175 },
                  { x: 210, o: 158, c: 150, h: 145, l: 162 },
                  { x: 220, o: 150, c: 145, h: 138, l: 155 },
                  { x: 230, o: 145, c: 152, h: 140, l: 158 },
                  { x: 240, o: 152, c: 148, h: 142, l: 156 },
                  // Peak area
                  { x: 250, o: 148, c: 138, h: 132, l: 152 },
                  { x: 260, o: 138, c: 130, h: 125, l: 142 },
                  { x: 270, o: 130, c: 135, h: 125, l: 140 },
                  { x: 280, o: 135, c: 128, h: 122, l: 140 },
                  { x: 290, o: 128, c: 138, h: 125, l: 145 },
                  // Pullback
                  { x: 300, o: 138, c: 148, h: 135, l: 155 },
                  { x: 310, o: 148, c: 155, h: 142, l: 162 },
                  { x: 320, o: 155, c: 150, h: 145, l: 160 },
                  { x: 330, o: 150, c: 158, h: 145, l: 165 },
                  { x: 340, o: 158, c: 152, h: 148, l: 162 },
                  // Consolidation
                  { x: 350, o: 152, c: 160, h: 148, l: 165 },
                  { x: 360, o: 160, c: 155, h: 150, l: 165 },
                  { x: 370, o: 155, c: 162, h: 150, l: 168 },
                  { x: 380, o: 162, c: 158, h: 152, l: 168 },
                  { x: 390, o: 158, c: 165, h: 152, l: 170 },
                  // Another dip
                  { x: 400, o: 165, c: 172, h: 160, l: 178 },
                  { x: 410, o: 172, c: 180, h: 168, l: 185 },
                  { x: 420, o: 180, c: 175, h: 170, l: 185 },
                  { x: 430, o: 175, c: 168, h: 162, l: 180 },
                  { x: 440, o: 168, c: 175, h: 162, l: 180 },
                  // Recovery and rally
                  { x: 450, o: 175, c: 165, h: 160, l: 180 },
                  { x: 460, o: 165, c: 155, h: 148, l: 170 },
                  { x: 470, o: 155, c: 148, h: 142, l: 160 },
                  { x: 480, o: 148, c: 140, h: 135, l: 152 },
                  { x: 490, o: 140, c: 145, h: 135, l: 150 },
                  // Strong move up
                  { x: 500, o: 145, c: 132, h: 128, l: 150 },
                  { x: 510, o: 132, c: 125, h: 120, l: 138 },
                  { x: 520, o: 125, c: 118, h: 112, l: 130 },
                  { x: 530, o: 118, c: 125, h: 115, l: 132 },
                  { x: 540, o: 125, c: 115, h: 108, l: 130 },
                  // Sharp rally
                  { x: 550, o: 115, c: 100, h: 95, l: 120 },
                  { x: 560, o: 100, c: 92, h: 88, l: 108 },
                  { x: 570, o: 92, c: 85, h: 80, l: 98 },
                  { x: 580, o: 85, c: 78, h: 72, l: 90 },
                  { x: 590, o: 78, c: 82, h: 72, l: 88 },
                  // Continuation
                  { x: 600, o: 82, c: 75, h: 70, l: 88 },
                  { x: 610, o: 75, c: 68, h: 62, l: 80 },
                  { x: 620, o: 68, c: 72, h: 65, l: 78 },
                  { x: 630, o: 72, c: 65, h: 58, l: 78 },
                  { x: 640, o: 65, c: 58, h: 52, l: 72 },
                  // Top area with some pullback
                  { x: 650, o: 58, c: 52, h: 48, l: 65 },
                  { x: 660, o: 52, c: 58, h: 48, l: 65 },
                  { x: 670, o: 58, c: 50, h: 45, l: 62 },
                  { x: 680, o: 50, c: 55, h: 45, l: 60 },
                  { x: 690, o: 55, c: 48, h: 42, l: 60 },
                  // Final candles near top
                  { x: 700, o: 48, c: 42, h: 38, l: 55 },
                  { x: 710, o: 42, c: 38, h: 32, l: 48 },
                  { x: 720, o: 38, c: 45, h: 35, l: 52 },
                  { x: 730, o: 45, c: 40, h: 35, l: 50 },
                  { x: 740, o: 40, c: 35, h: 30, l: 48 },
                  { x: 750, o: 35, c: 38, h: 28, l: 45 },
                  { x: 760, o: 38, c: 32, h: 28, l: 42 },
                  { x: 770, o: 32, c: 35, h: 28, l: 40 },
                  { x: 780, o: 35, c: 30, h: 25, l: 40 },
                ].map((candle, i) => {
                  const isGreen = candle.c < candle.o;
                  const top = Math.min(candle.o, candle.c);
                  const bodyHeight = Math.abs(candle.c - candle.o);
                  return (
                    <g key={i}>
                      {/* Wick */}
                      <line
                        x1={candle.x}
                        y1={candle.h}
                        x2={candle.x}
                        y2={candle.l}
                        stroke={isGreen ? '#26A69A' : '#EF5350'}
                        strokeWidth="1"
                      />
                      {/* Body */}
                      <rect
                        x={candle.x - 3}
                        y={top}
                        width="6"
                        height={Math.max(bodyHeight, 2)}
                        fill={isGreen ? '#26A69A' : '#EF5350'}
                      />
                    </g>
                  );
                })}

                {/* Volume bars at bottom */}
                {[
                  10, 15, 12, 18, 14, 22, 25, 20, 16, 13,
                  11, 19, 24, 17, 15, 12, 20, 18, 14, 16,
                  22, 28, 25, 19, 17, 15, 13, 18, 22, 20,
                  16, 14, 12, 19, 24, 21, 18, 15, 13, 17,
                  25, 32, 28, 22, 18, 15, 20, 26, 35, 42,
                  55, 48, 38, 32, 28, 45, 52, 40, 35, 30,
                  38, 45, 35, 42, 38, 48, 55, 45, 40, 35,
                  42, 50, 45, 48, 52, 58, 52, 48, 45, 50,
                ].map((vol, i) => (
                  <rect
                    key={`vol-${i}`}
                    x={10 + i * 10 - 3}
                    y={240 - vol * 0.6}
                    width="6"
                    height={vol * 0.6}
                    fill={i > 45 ? '#26A69A33' : '#64748b22'}
                  />
                ))}
              </svg>

              {/* Current price line */}
              <div className="absolute left-3 right-14 top-[12%] border-t border-dashed border-loss-500/60">
                <span className="absolute right-0 -top-2.5 bg-loss-500 text-white text-[9px] px-1.5 py-0.5 rounded font-mono">97558.00</span>
              </div>

              {/* TradingView watermark */}
              <div className="absolute bottom-10 left-4 flex items-center gap-1">
                <svg className="w-5 h-5 text-surface-700" viewBox="0 0 36 28" fill="currentColor">
                  <path d="M14 22H7V11H0V4h14v18zm8-18h7v18h-7V4zm14 0h-7v11h7V4z"/>
                </svg>
              </div>

              {/* Time scale */}
              <div className="absolute bottom-2 left-3 right-14 flex justify-between text-[9px] text-surface-500 font-mono">
                {['06:00', '07:30', '09:00', '10:30', '12:00', '13:30', '15:00', '16:30', '18:00', '20:00'].map(t => <span key={t}>{t}</span>)}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Row: Positions Table (Below Order Book + Chart only) */}
        <div className="bg-surface-900 rounded-none border border-surface-800 overflow-hidden flex flex-col min-h-[197px]">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-surface-800 flex-shrink-0">
            <div className="flex items-center gap-4">
              {[
                { id: 'positions', label: 'Positions', count: 1 },
                { id: 'orders', label: 'Open Orders' },
                { id: 'trades', label: 'Trade History' },
                { id: 'history', label: 'Order History' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setBottomTab(tab.id as typeof bottomTab)}
                  className={`py-1.5 text-[11px] font-medium border-b-2 transition-colors flex items-center gap-1 ${
                    bottomTab === tab.id ? 'text-primary-400 border-primary-400' : 'text-surface-400 border-transparent'
                  }`}
                >
                  {tab.label}
                  {tab.count && <span className="text-[9px] bg-surface-700 px-1.5 rounded">{tab.count}</span>}
                </button>
              ))}
            </div>
            <div className={`flex items-center gap-1 ${getHighlightClass('fight-only')}`}>
              <button
                onClick={() => setShowFightOnly(false)}
                className={`px-3 py-1 text-[10px] rounded font-medium transition-colors ${!showFightOnly ? 'bg-surface-600 text-white' : 'bg-surface-700 text-surface-400 hover:text-white'}`}
              >
                All
              </button>
              <button
                onClick={() => setShowFightOnly(true)}
                className={`px-3 py-1 text-[10px] rounded font-medium transition-colors ${showFightOnly ? 'bg-primary-500 text-white' : 'bg-surface-700 text-surface-400 hover:text-white'}`}
              >
                Fight Only
              </button>
            </div>
          </div>

          <div className="p-2 overflow-x-auto flex-1 flex flex-col items-start">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="text-surface-500 capitalize">
                  <th className="text-left py-1 px-1">Token</th>
                  <th className="text-right py-1 px-1">Size</th>
                  <th className="text-right py-1 px-1">Pos Value</th>
                  <th className="text-right py-1 px-1">Entry</th>
                  <th className="text-right py-1 px-1">Mark</th>
                  <th className="text-right py-1 px-1">PnL (ROI%)</th>
                  <th className="text-right py-1 px-1">Liq Price</th>
                  <th className="text-right py-1 px-1">Margin</th>
                  <th className="text-right py-1 px-1">Funding</th>
                  <th className="text-center py-1 px-1">TP/SL</th>
                  {!showFightOnly && <th className="text-center py-1 px-1">Close</th>}
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-surface-700/50">
                  <td className="py-2 px-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-white font-medium">BTC</span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-loss-500/20 text-loss-400">50x Short</span>
                    </div>
                  </td>
                  <td className="py-2 px-1 text-right font-mono text-white">0.000190 <span className="text-surface-400">BTC</span></td>
                  <td className="py-2 px-1 text-right font-mono text-white">$18.37</td>
                  <td className="py-2 px-1 text-right font-mono text-surface-300">96,420.00</td>
                  <td className="py-2 px-1 text-right font-mono text-surface-300">96,678.61</td>
                  <td className="py-2 px-1 text-right font-mono text-loss-400">-$2.21 (-12.04%)</td>
                  <td className="py-2 px-1 text-right font-mono text-surface-300">97,871.00</td>
                  <td className="py-2 px-1 text-right font-mono text-white">$0.37<br/><span className="text-surface-500">Cross</span></td>
                  <td className="py-2 px-1 text-right font-mono text-loss-400">-$2.21</td>
                  <td className="py-2 px-1 text-center">
                    <button onClick={() => openModal('tpsl', 'BTC')} className="text-surface-500 hover:text-primary-400 flex items-center gap-1 justify-center">
                      - / -
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                      </svg>
                    </button>
                  </td>
                  {!showFightOnly && (
                    <td className="py-2 px-1">
                      <div className={`flex items-center justify-center gap-1 ${getHighlightClass('market-orders')}`}>
                        <button
                          onClick={() => openModal('market', 'BTC')}
                          className="px-2 py-1 bg-surface-700 hover:bg-surface-600 text-surface-300 rounded text-[9px] font-medium transition-colors"
                        >
                          Market
                        </button>
                        <button
                          onClick={() => openModal('limit', 'BTC')}
                          className="px-2 py-1 bg-surface-700 hover:bg-surface-600 text-surface-300 rounded text-[9px] font-medium transition-colors"
                        >
                          Limit
                        </button>
                        <button
                          onClick={() => openModal('flip', 'BTC')}
                          className={`px-2 py-1 bg-primary-500/20 hover:bg-primary-500/30 text-primary-400 rounded text-[9px] font-medium transition-colors ${getHighlightClass('flip-position')}`}
                        >
                          Flip
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Footer: Positions Summary */}
          <div className="flex-shrink-0 px-3 py-2 border-t border-surface-800 flex gap-4 text-[10px]">
            <span className="text-surface-400">Positions: <span className="text-white">1</span></span>
            <span className="text-surface-400">Total Value: <span className="text-white font-mono">$18.37</span></span>
            <span className="text-surface-400">Total PnL: <span className="text-loss-400 font-mono">-$2.21</span></span>
          </div>
        </div>
      </div>

      {/* Right: Place Order */}
      <div className="w-64 bg-surface-900 rounded-none border border-surface-800 flex-shrink-0 overflow-hidden flex flex-col max-h-[700px]">
        {/* Header */}
        <div className="px-3 py-2 border-b border-surface-800">
          <span className="text-white text-xs font-semibold tracking-wider">PLACE ORDER</span>
        </div>

        <div className="p-3 space-y-3 text-xs flex-1 overflow-y-auto">
          {/* Deposit/Withdraw Buttons */}
          <div className={`grid grid-cols-2 gap-2 ${getHighlightClass('deposit-withdraw')}`}>
            <button onClick={() => setShowDepositModal(true)} className="py-2 text-xs font-semibold bg-[#0d9488] hover:bg-[#0f766e] text-white rounded transition-colors">
              Deposit
            </button>
            <button onClick={() => setShowWithdrawModal(true)} className="py-2 text-xs font-semibold bg-surface-700 hover:bg-surface-600 text-white rounded transition-colors">
              Withdraw
            </button>
          </div>

          {/* Account Info */}
          <div className="space-y-1 text-[10px]">
            <div className="flex justify-between">
              <span className="text-surface-400">Account Equity</span>
              <span className="text-white font-mono">$9.70</span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-400">Idle Balance</span>
              <span className="text-white font-mono">$8.36</span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-400">Resting Order Value</span>
              <span className="text-white font-mono">$0.01</span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-400">Fees</span>
              <span className="text-white font-mono">{feesDisplay}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-400">Unrealized PnL</span>
              <span className="text-loss-400 font-mono">-$2.21</span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-400">Cross Account Leverage</span>
              <span className="text-white font-mono">24.17x</span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-400">Margin</span>
              <span className="text-white font-mono">$0.17</span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-400">Real-time Updates</span>
              <span className="text-win-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-win-400 animate-pulse" />
                Live
              </span>
            </div>
          </div>

          {/* Long/Short Toggle */}
          <div className={`grid grid-cols-2 gap-2 ${getHighlightClass('long-short')}`}>
            <button
              onClick={() => setSelectedSide('LONG')}
              className={`py-2.5 rounded font-semibold text-xs transition-all ${selectedSide === 'LONG' ? 'bg-[#0d9488] text-white' : 'bg-surface-800 text-surface-400 hover:text-white'}`}
            >
              LONG
            </button>
            <button
              onClick={() => setSelectedSide('SHORT')}
              className={`py-2.5 rounded font-semibold text-xs transition-all ${selectedSide === 'SHORT' ? 'bg-surface-700 text-white' : 'bg-surface-800 text-surface-400 hover:text-white'}`}
            >
              SHORT
            </button>
          </div>

          {/* Order Type */}
          <div className={getHighlightClass('market-orders')}>
            <label className="text-surface-400 mb-1.5 block text-xs">Order Type</label>
            <div className="relative">
              <select
                value={orderType}
                onChange={(e) => setOrderType(e.target.value as typeof orderType)}
                className="w-full bg-black border-none rounded px-3 py-2 text-white text-sm appearance-none cursor-pointer pr-8"
              >
                <option value="market">Market</option>
                <option value="limit">Limit</option>
                <option value="stop-market">Stop Market</option>
                <option value="stop-limit">Stop Limit</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                <svg className="w-4 h-4 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {/* Size */}
          <div>
            <label className="text-surface-400 mb-1.5 block text-xs">Size</label>
            <div className="flex gap-2 mb-2">
              <div className="flex-1 relative">
                <input type="text" defaultValue="0.00" className="w-full bg-black border-none rounded px-3 py-2 text-white font-mono text-[8px] pr-12" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-primary-400 text-xs font-medium">BTC</span>
              </div>
              <div className="flex-1 relative">
                <input type="text" defaultValue="0.00" className="w-full bg-black border-none rounded px-3 py-2 text-white font-mono text-[8px] pr-12" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 text-xs">USD</span>
              </div>
            </div>
            <div className="flex justify-between text-surface-500 text-[10px] mb-2">
              <span>Margin: <span className="text-white font-mono text-[8px]">$0.00</span></span>
              <span>Max: <span className="text-white font-mono text-[8px]">$0.34 (50x)</span></span>
            </div>
            <input type="range" min="0" max="100" defaultValue="0" className="w-full h-1.5 bg-surface-700 rounded-full mb-2 accent-primary-500" />
            <div className="grid grid-cols-4 gap-1.5">
              {[25, 50, 75, 100].map(p => (
                <button key={p} className="py-1.5 bg-surface-800 text-surface-400 rounded text-[8px] hover:bg-surface-700 transition-colors">
                  {p}%
                </button>
              ))}
            </div>
          </div>

          {/* Leverage */}
          <div className={getHighlightClass('leverage')}>
            <div className="flex justify-between items-center mb-2">
              <span className="text-surface-400 text-xs">Leverage</span>
              <span className="text-primary-400 font-semibold font-mono text-[8px]">{leverage}x</span>
            </div>
            <input type="range" min="1" max="50" value={leverage} onChange={(e) => setLeverage(Number(e.target.value))} className="w-full h-1.5 bg-surface-700 rounded-full accent-primary-500 mb-1" />
            <div className="flex justify-between text-surface-500 font-mono text-[8px]">
              <span>1x</span>
              <span>25x</span>
              <span>50x</span>
            </div>
          </div>

          {/* Take Profit / Stop Loss */}
          <div className={getHighlightClass('take-profit')}>
            <div className="flex items-center gap-1.5 py-1">
              <button
                onClick={() => { setTpEnabled(!tpEnabled || !slEnabled); setSlEnabled(!tpEnabled || !slEnabled); }}
                className={`relative w-7 h-4 rounded-full transition-colors flex-shrink-0 ${tpEnabled || slEnabled ? 'bg-primary-500' : 'bg-surface-700'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${tpEnabled || slEnabled ? 'translate-x-3' : ''}`} />
              </button>
              <span className="text-surface-300 text-[10px]">Take Profit / Stop Loss</span>
            </div>

            {/* TP/SL Expanded Fields */}
            {(tpEnabled || slEnabled) && (
              <div className="mt-2 space-y-2">
                {/* TP Price */}
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <button
                      onClick={() => setTpEnabled(!tpEnabled)}
                      className={`relative w-7 h-4 rounded-full transition-colors flex-shrink-0 ${tpEnabled ? 'bg-primary-500' : 'bg-surface-700'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${tpEnabled ? 'translate-x-3' : ''}`} />
                    </button>
                    <span className="text-surface-300 text-[10px]">TP Price</span>
                  </div>
                  {tpEnabled && (
                    <>
                      <div className="relative mb-1.5">
                        <input type="text" placeholder="> 89375" className="w-full bg-black border-none rounded px-2 py-1.5 text-white font-mono text-[8px]" />
                      </div>
                      <div className="grid grid-cols-4 gap-1">
                        {[25, 50, 75, 100].map(p => (
                          <button key={`tp-${p}`} className="py-0.5 bg-surface-800 text-win-400 rounded text-[8px] hover:bg-surface-700 transition-colors">
                            {p}%
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* SL Price */}
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <button
                      onClick={() => setSlEnabled(!slEnabled)}
                      className={`relative w-7 h-4 rounded-full transition-colors flex-shrink-0 ${slEnabled ? 'bg-loss-500' : 'bg-surface-700'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${slEnabled ? 'translate-x-3' : ''}`} />
                    </button>
                    <span className="text-surface-300 text-[10px]">SL Price</span>
                  </div>
                  {slEnabled && (
                    <>
                      <div className="relative mb-1.5">
                        <input type="text" placeholder="< 89375" className="w-full bg-black border-none rounded px-2 py-1.5 text-white font-mono text-[8px]" />
                      </div>
                      <div className="grid grid-cols-4 gap-1">
                        {['-25', '-50', '-75', '-100'].map(p => (
                          <button key={`sl-${p}`} className="py-0.5 bg-surface-800 text-loss-400 rounded text-[8px] hover:bg-surface-700 transition-colors">
                            {p}%
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Order Summary */}
          <div className="space-y-1.5 pt-2 border-t border-surface-800 text-[10px]">
            <div className="flex justify-between">
              <span className="text-surface-400">Order Type</span>
              <span className="text-primary-400 font-medium">Market</span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-400">Max Slippage</span>
              <span className="text-white">0.5%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-400">Est. Liq Price</span>
              <span className="text-[#d4a574]">N/A</span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-400">Margin</span>
              <span className="text-[#d4a574]">N/A</span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-400">Available</span>
              <span className="text-white font-mono">$8.36</span>
            </div>
          </div>
        </div>

        {/* Long/Short Button */}
        <div className="p-3 border-t border-surface-800">
          <button className={`w-full py-3 rounded font-bold text-sm flex items-center justify-center gap-2 transition-colors ${selectedSide === 'LONG' ? 'bg-[#0d9488] hover:bg-[#0f766e] text-white' : 'bg-loss-500 text-white hover:bg-loss-400'}`}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d={selectedSide === 'LONG' ? "M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" : "M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3"} />
            </svg>
            {selectedSide === 'LONG' ? 'Long' : 'Short'}
          </button>
        </div>
      </div>
    </div>

    {/* Modals */}
    {showMarketModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1a] rounded-lg border border-surface-700 w-full max-w-[480px] shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-surface-700">
              <div className="flex items-center gap-3">
                <h3 className="text-white font-semibold text-lg">Market Close</h3>
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-loss-500/20 text-loss-400">50x Short</span>
                <span className="text-surface-300 font-mono text-sm">0.00019000 BTC</span>
              </div>
              <button onClick={() => { setShowMarketModal(false); setCloseAmount(100); }} className="text-surface-400 hover:text-white text-xl leading-none">×</button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-4">
              <p className="text-surface-400 text-sm">Attempt to close position immediately.</p>

              {/* Current Price */}
              <div className="flex items-center justify-between">
                <span className="text-white font-mono text-2xl">96,678.61</span>
                <div className="flex items-center gap-2">
                  <span className="text-surface-400 text-sm">USD</span>
                  <span className="px-2 py-0.5 rounded text-xs font-semibold bg-win-500/20 text-win-400">LIVE</span>
                </div>
              </div>

              {/* Amount Inputs */}
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    defaultValue="0.00019"
                    className="w-full bg-black border-none rounded px-3 py-2.5 text-white font-mono text-sm pr-12"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 text-xs">BTC</span>
                </div>
                <div className="flex-1 relative">
                  <input
                    type="text"
                    defaultValue="18.37"
                    className="w-full bg-black border-none rounded px-3 py-2.5 text-white font-mono text-sm pr-12"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 text-xs">USD</span>
                </div>
              </div>

              {/* Percentage Slider */}
              <div>
                <div className="flex justify-end mb-2">
                  <span className="text-white text-sm">{closeAmount}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={closeAmount}
                  onChange={(e) => setCloseAmount(Number(e.target.value))}
                  className="w-full h-1.5 bg-surface-700 rounded-full accent-primary-500"
                />
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {[25, 50, 75, 100].map(p => (
                    <button
                      key={p}
                      onClick={() => setCloseAmount(p)}
                      className={`py-1.5 rounded text-sm font-medium transition-colors ${
                        closeAmount === p ? 'bg-surface-600 text-white' : 'bg-surface-800 text-surface-400 hover:bg-surface-700'
                      }`}
                    >
                      {p}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Estimated PnL */}
              <div className="flex justify-end">
                <span className="text-surface-400 text-sm">
                  Estimated PnL: <span className="text-loss-400 font-mono">-$2.21</span>
                </span>
              </div>

              {/* Market Close Button */}
              <button className="w-full py-3 bg-[#0d9488] hover:bg-[#0f766e] text-white rounded font-semibold text-sm transition-colors">
                Market Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showLimitModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1a] rounded-lg border border-surface-700 w-full max-w-[480px] shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-surface-700">
              <div className="flex items-center gap-3">
                <h3 className="text-white font-semibold text-lg">Limit Close</h3>
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-loss-500/20 text-loss-400">50x Short</span>
                <span className="text-surface-300 font-mono text-sm">0.000190 BTC</span>
              </div>
              <button onClick={() => { setShowLimitModal(false); setCloseAmount(0); }} className="text-surface-400 hover:text-white text-xl leading-none">×</button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-4">
              <p className="text-surface-400 text-sm">Send limit order to close position.</p>

              {/* Current Price */}
              <div className="flex items-center justify-between">
                <span className="text-white font-mono text-2xl">89291</span>
                <div className="flex items-center gap-2">
                  <span className="text-surface-400 text-sm">USD</span>
                  <span className="px-2 py-0.5 rounded text-xs font-semibold bg-win-500/20 text-win-400">LIVE</span>
                </div>
              </div>

              {/* Price */}
              <div>
                <label className="text-surface-400 text-sm mb-2 block">Price</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    defaultValue="89291"
                    className="flex-1 bg-black border-none rounded px-3 py-2.5 text-white font-mono text-sm"
                  />
                  <button className="px-4 py-2.5 bg-primary-500 hover:bg-primary-400 text-white rounded font-semibold text-sm transition-colors">
                    Mid
                  </button>
                  <span className="text-surface-400 text-sm">USD</span>
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="text-surface-400 text-sm mb-2 block">Amount</label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      defaultValue="0.00"
                      className="w-full bg-black border-none rounded px-3 py-2.5 text-white font-mono text-sm pr-12"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 text-xs">BTC</span>
                  </div>
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      defaultValue="0.00"
                      className="w-full bg-black border-none rounded px-3 py-2.5 text-white font-mono text-sm pr-12"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 text-xs">USD</span>
                  </div>
                </div>
              </div>

              {/* Percentage Slider */}
              <div>
                <div className="flex justify-start mb-2">
                  <span className="text-surface-400 text-sm">{closeAmount}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={closeAmount}
                  onChange={(e) => setCloseAmount(Number(e.target.value))}
                  className="w-full h-1.5 bg-surface-700 rounded-full accent-primary-500"
                />
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {[25, 50, 75, 100].map(p => (
                    <button
                      key={p}
                      onClick={() => setCloseAmount(p)}
                      className={`py-1.5 rounded text-sm font-medium transition-colors ${
                        closeAmount === p ? 'bg-surface-600 text-white' : 'bg-surface-800 text-surface-400 hover:bg-surface-700'
                      }`}
                    >
                      {p}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Estimated PnL */}
              <div className="flex justify-end">
                <span className="text-surface-400 text-sm">
                  Estimated PnL: <span className="text-loss-400 font-mono">-$2.21</span>
                </span>
              </div>

              {/* Limit Close Button */}
              <button className="w-full py-3 bg-[#0d9488] hover:bg-[#0f766e] text-white rounded font-semibold text-sm transition-colors">
                Limit Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showFlipModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1a] rounded-lg border border-surface-700 w-full max-w-[480px] shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-surface-700">
              <h3 className="text-white font-semibold text-lg">Flip Position</h3>
              <button onClick={() => setShowFlipModal(false)} className="text-surface-400 hover:text-white text-xl leading-none">×</button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-4">
              <p className="text-surface-400 text-sm">
                Flip current short position to long position of same size at market price.
              </p>

              {/* Position Details */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-surface-400">Current Position</span>
                  <span className="text-loss-400 font-mono font-semibold">Short 0.000190 BTC</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-surface-400">New Position</span>
                  <span className="text-[#0d9488] font-mono font-semibold">Long 0.000190 BTC</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-surface-400">Position Value</span>
                  <span className="text-white font-mono">$16.97</span>
                </div>
              </div>

              {/* Flip Position Button */}
              <button className="w-full py-3 bg-[#0d9488] hover:bg-[#0f766e] text-white rounded font-semibold text-sm transition-colors">
                Flip Position
              </button>
            </div>
          </div>
        </div>
      )}

      {showTpSlModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-800 rounded-lg border border-surface-700 w-full max-w-[420px] shadow-xl">
            <div className="flex justify-between items-center px-4 py-3 border-b border-surface-700">
              <h3 className="text-white font-semibold text-base">TP/SL for {selectedPosition}</h3>
              <button onClick={() => { setShowTpSlModal(false); setTpSlTab('full'); setLimitPriceEnabled(false); }} className="text-surface-400 hover:text-white text-xl leading-none">×</button>
            </div>

            {/* Tab Switcher */}
            <div className="flex border-b border-surface-700">
              <button
                onClick={() => setTpSlTab('full')}
                className={`flex-1 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  tpSlTab === 'full' ? 'text-primary-400 border-primary-400' : 'text-surface-400 border-transparent hover:text-white'
                }`}
              >
                Full Position
              </button>
              <button
                onClick={() => setTpSlTab('partial')}
                className={`flex-1 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  tpSlTab === 'partial' ? 'text-primary-400 border-primary-400' : 'text-surface-400 border-transparent hover:text-white'
                }`}
              >
                Partial
              </button>
            </div>

            {/* Full Position Tab */}
            {tpSlTab === 'full' && (
              <div className="p-4 space-y-4">
                {/* TP Price */}
                <div>
                  <label className="text-surface-400 text-sm mb-2 block">TP Price</label>
                  <input
                    type="text"
                    defaultValue="98,500"
                    className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-white font-mono text-sm mb-2"
                  />
                  <div className="flex gap-1.5">
                    {[25, 50, 75, 100].map((pct) => (
                      <button key={pct} className="flex-1 py-1.5 bg-surface-700 hover:bg-surface-600 text-win-400 rounded text-xs font-medium transition-colors">
                        {pct}%
                      </button>
                    ))}
                  </div>
                </div>

                {/* SL Price */}
                <div>
                  <label className="text-surface-400 text-sm mb-2 block">SL Price</label>
                  <input
                    type="text"
                    defaultValue="92,000"
                    className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-white font-mono text-sm mb-2"
                  />
                  <div className="flex gap-1.5">
                    {[25, 50, 75, 100].map((pct) => (
                      <button key={pct} className="flex-1 py-1.5 bg-surface-700 hover:bg-surface-600 text-loss-400 rounded text-xs font-medium transition-colors">
                        {pct}%
                      </button>
                    ))}
                  </div>
                </div>

                {/* Limit Price Toggle */}
                <div className="flex items-center justify-between py-2 border-t border-surface-700">
                  <span className="text-surface-300 text-sm">Limit Price</span>
                  <button
                    onClick={() => setLimitPriceEnabled(!limitPriceEnabled)}
                    className={`relative w-10 h-5 rounded-full transition-colors ${limitPriceEnabled ? 'bg-primary-500' : 'bg-surface-600'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${limitPriceEnabled ? 'translate-x-5' : ''}`} />
                  </button>
                </div>

                {/* Limit Price Inputs */}
                {limitPriceEnabled && (
                  <div className="space-y-3 pt-2">
                    <div>
                      <label className="text-surface-400 text-sm mb-2 block">TP Limit Price</label>
                      <input
                        type="text"
                        placeholder="Optional"
                        className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-white font-mono text-sm placeholder:text-surface-500"
                      />
                    </div>
                    <div>
                      <label className="text-surface-400 text-sm mb-2 block">SL Limit Price</label>
                      <input
                        type="text"
                        placeholder="Optional"
                        className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-white font-mono text-sm placeholder:text-surface-500"
                      />
                    </div>
                  </div>
                )}

                <button className="w-full py-2.5 bg-primary-500 hover:bg-primary-400 text-white rounded-lg font-semibold text-sm transition-colors">
                  Confirm
                </button>
              </div>
            )}

            {/* Partial Tab */}
            {tpSlTab === 'partial' && (
              <div className="p-4">
                <div className="flex flex-col items-center justify-center py-12">
                  <p className="text-surface-400 text-sm mb-4 text-center">
                    No partial TP/SL orders. Click &apos;Add&apos; to create one.
                  </p>
                  <button
                    onClick={() => setShowAddPartialModal(true)}
                    className="px-6 py-2 bg-primary-500 hover:bg-primary-400 text-white rounded-lg font-semibold text-sm transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Partial TP/SL Modal */}
      {showAddPartialModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-800 rounded-lg border border-surface-700 w-full max-w-[420px] shadow-xl">
            <div className="flex justify-between items-center px-4 py-3 border-b border-surface-700">
              <h3 className="text-white font-semibold text-base">Add Partial TP/SL</h3>
              <button onClick={() => { setShowAddPartialModal(false); setConfigureAmountEnabled(false); setLimitPriceEnabled(false); }} className="text-surface-400 hover:text-white text-xl leading-none">×</button>
            </div>

            <div className="p-4 space-y-4">
              {/* TP Price */}
              <div>
                <label className="text-surface-400 text-sm mb-2 block">TP Price</label>
                <input
                  type="text"
                  placeholder="Optional"
                  className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-white font-mono text-sm placeholder:text-surface-500 mb-2"
                />
                <div className="flex gap-1.5">
                  {[25, 50, 75, 100].map((pct) => (
                    <button key={pct} className="flex-1 py-1.5 bg-surface-700 hover:bg-surface-600 text-win-400 rounded text-xs font-medium transition-colors">
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>

              {/* SL Price */}
              <div>
                <label className="text-surface-400 text-sm mb-2 block">SL Price</label>
                <input
                  type="text"
                  placeholder="Optional"
                  className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-white font-mono text-sm placeholder:text-surface-500 mb-2"
                />
                <div className="flex gap-1.5">
                  {[25, 50, 75, 100].map((pct) => (
                    <button key={pct} className="flex-1 py-1.5 bg-surface-700 hover:bg-surface-600 text-loss-400 rounded text-xs font-medium transition-colors">
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Configure Amount Toggle */}
              <div className="flex items-center justify-between py-2 border-t border-surface-700">
                <span className="text-surface-300 text-sm">Configure Amount</span>
                <button
                  onClick={() => setConfigureAmountEnabled(!configureAmountEnabled)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${configureAmountEnabled ? 'bg-primary-500' : 'bg-surface-600'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${configureAmountEnabled ? 'translate-x-5' : ''}`} />
                </button>
              </div>

              {/* Amount Slider */}
              {configureAmountEnabled && (
                <div className="pt-2">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-surface-400 text-sm">% of Position</span>
                    <span className="text-white font-mono text-sm">{partialAmount}%</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={partialAmount}
                    onChange={(e) => setPartialAmount(Number(e.target.value))}
                    className="w-full h-2 bg-surface-700 rounded-full accent-primary-500"
                  />
                  <div className="flex justify-between text-surface-500 text-xs mt-1">
                    <span>1%</span>
                    <span>50%</span>
                    <span>100%</span>
                  </div>
                </div>
              )}

              {/* Limit Price Toggle */}
              <div className="flex items-center justify-between py-2 border-t border-surface-700">
                <span className="text-surface-300 text-sm">Limit Price</span>
                <button
                  onClick={() => setLimitPriceEnabled(!limitPriceEnabled)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${limitPriceEnabled ? 'bg-primary-500' : 'bg-surface-600'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${limitPriceEnabled ? 'translate-x-5' : ''}`} />
                </button>
              </div>

              {/* Limit Price Inputs */}
              {limitPriceEnabled && (
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="text-surface-400 text-sm mb-2 block">TP Limit Price</label>
                    <input
                      type="text"
                      placeholder="Optional"
                      className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-white font-mono text-sm placeholder:text-surface-500"
                    />
                  </div>
                  <div>
                    <label className="text-surface-400 text-sm mb-2 block">SL Limit Price</label>
                    <input
                      type="text"
                      placeholder="Optional"
                      className="w-full bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-white font-mono text-sm placeholder:text-surface-500"
                    />
                  </div>
                </div>
              )}

              <button className="w-full py-2.5 bg-primary-500 hover:bg-primary-400 text-white rounded-lg font-semibold text-sm transition-colors">
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deposit Modal - Opens Pacifica */}
      {showDepositModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1a] rounded-lg border border-surface-700 w-full max-w-[480px] shadow-xl">
            <div className="flex justify-between items-center px-4 py-3 border-b border-surface-700">
              <h3 className="text-white font-semibold text-lg">Deposit Funds</h3>
              <button onClick={() => setShowDepositModal(false)} className="text-surface-400 hover:text-white text-xl leading-none">×</button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-surface-400 text-sm">
                Deposits are managed through <span className="text-white font-medium">Pacifica Exchange</span>, our underlying trading platform.
              </p>

              <div className="bg-surface-800/50 rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-[#0d9488] mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                  <div>
                    <p className="text-white text-sm font-medium mb-1">Secure & Non-Custodial</p>
                    <p className="text-surface-400 text-xs">Your funds are secured by Pacifica&apos;s smart contracts on Solana. Only you control your assets.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-[#0d9488] mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                  </svg>
                  <div>
                    <p className="text-white text-sm font-medium mb-1">Instant Availability</p>
                    <p className="text-surface-400 text-xs">Deposited funds are immediately available for trading and fights.</p>
                  </div>
                </div>
              </div>

              <button className="w-full py-3 bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2">
                <span>Open Pacifica to Deposit</span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Withdraw Modal - Done in TFC */}
      {showWithdrawModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1a] rounded-lg border border-surface-700 w-full max-w-[480px] shadow-xl">
            <div className="flex justify-between items-center px-4 py-3 border-b border-surface-700">
              <h3 className="text-white font-semibold text-lg">Withdraw Funds</h3>
              <button onClick={() => setShowWithdrawModal(false)} className="text-surface-400 hover:text-white text-xl leading-none">×</button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-surface-400 text-sm">
                Withdraw your funds from TradeFightClub directly to your wallet.
              </p>

              <div className="flex justify-between items-center py-2 px-3 bg-surface-800/50 rounded-lg">
                <span className="text-surface-400 text-sm">Available Balance</span>
                <span className="text-white font-mono text-base font-medium">$8.36</span>
              </div>

              <div className="bg-surface-800/50 rounded-lg p-3 text-xs text-surface-400 space-y-2">
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-surface-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                  </svg>
                  <div className="space-y-1">
                    <p>Daily withdrawal limit: <span className="text-white">$100,000</span> (resets at UTC 00:00)</p>
                    <p>Withdrawal fee: <span className="text-white">$1 USDC</span></p>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-surface-400 text-sm mb-2 block">Amount (USDC)</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="0.00"
                    className="w-full bg-black border-none rounded-lg px-3 py-2.5 text-white font-mono text-sm pr-16"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    <button className="text-primary-400 text-xs font-medium hover:text-primary-300">Max</button>
                    <span className="text-surface-400 text-xs">USDC</span>
                  </div>
                </div>
              </div>

              <button className="w-full py-3 bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-lg font-semibold text-sm transition-colors">
                Confirm Withdrawal
              </button>
            </div>
          </div>
        </div>
      )}

      {showFightBannerExplain && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1a] rounded-lg border border-surface-700 w-full max-w-[540px] shadow-xl max-h-[85vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center px-4 py-3 border-b border-surface-700 flex-shrink-0">
              <h3 className="text-white font-semibold text-lg">Fight Banner</h3>
              <button onClick={() => setShowFightBannerExplain(false)} className="text-surface-400 hover:text-white text-xl leading-none">×</button>
            </div>

            {/* Scrollable content */}
            <div className="overflow-y-auto flex-1 p-4 space-y-4">
              <p className="text-surface-400 text-sm">
                The Fight Banner shows your active trading competition at a glance. Here&apos;s what each part means:
              </p>

              {/* Banner Preview - matches actual FightBanner */}
              <div className="bg-surface-900 rounded-lg p-3 text-sm border border-surface-700 space-y-2.5">
                {/* Row 1: Live status and opponent */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-win-400 animate-pulse" />
                    <span className="text-surface-400 text-xs">Live</span>
                  </div>
                  <span className="text-zinc-400 text-xs">vs <span className="text-zinc-100 font-medium">6WZ3...qVaU</span></span>
                </div>

                {/* Row 2: Timer, stake, and status */}
                <div className="flex items-center justify-between border-t border-surface-700 pt-2">
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-100 font-mono font-bold text-sm">49:47</span>
                    <span className="text-xs text-zinc-100">$5,000 stake</span>
                  </div>
                  <span className="text-loss-500 bg-loss-500/10 px-2 py-0.5 rounded text-xs font-medium">Behind</span>
                </div>

                {/* Row 3: PnL comparison */}
                <div className="flex items-center justify-between border-t border-surface-700 pt-2">
                  <div>
                    <div className="text-xs text-surface-400">You</div>
                    <div className="text-loss-500 font-mono tabular-nums text-sm font-medium">-12.0423%</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-surface-400">Opp</div>
                    <div className="text-win-500 font-mono tabular-nums text-sm font-medium">+4.0156%</div>
                  </div>
                </div>
              </div>

              {/* Explanations */}
              <div className="space-y-2.5">
                <div className="bg-surface-800/50 rounded-lg p-3 flex gap-3">
                  <span className="flex items-center gap-1.5 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-win-400" />
                    <span className="text-white text-xs font-medium">Live</span>
                  </span>
                  <p className="text-surface-400 text-xs">Indicates the fight is currently active and connected via WebSocket.</p>
                </div>

                <div className="bg-surface-800/50 rounded-lg p-3 flex gap-3">
                  <span className="text-zinc-100 text-xs font-medium shrink-0">6WZ3...qVaU</span>
                  <p className="text-surface-400 text-xs">Your opponent&apos;s username or wallet address. Click to view their profile.</p>
                </div>

                <div className="bg-surface-800/50 rounded-lg p-3 flex gap-3">
                  <span className="text-zinc-100 font-mono text-xs font-bold shrink-0">49:47</span>
                  <p className="text-surface-400 text-xs">Time remaining in the fight. When it reaches 00:00, the fight ends and the winner is determined.</p>
                </div>

                <div className="bg-surface-800/50 rounded-lg p-3 flex gap-3">
                  <span className="text-zinc-100 text-xs shrink-0">$5,000 stake</span>
                  <p className="text-surface-400 text-xs">The maximum capital each fighter can use for positions during this fight.</p>
                </div>

                <div className="bg-surface-800/50 rounded-lg p-3 flex gap-3">
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-loss-500 font-mono text-xs">-12.0423%</span>
                    <span className="text-win-500 font-mono text-xs">+4.0156%</span>
                  </div>
                  <p className="text-surface-400 text-xs"><span className="text-white">Net PnL%</span> for you and your opponent. This determines who&apos;s winning the fight.</p>
                </div>

                <div className="bg-surface-800/50 rounded-lg p-3 flex gap-3">
                  <span className="text-surface-400 bg-surface-700 px-2 py-0.5 rounded text-xs font-medium shrink-0">Tied</span>
                  <p className="text-surface-400 text-xs">Shows your status: <span className="text-win-500">Ahead</span>, <span className="text-loss-500">Behind</span>, or <span className="text-surface-300">Tied</span>.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showFightOnlyExplain && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-800 rounded-lg border border-surface-700 p-4 sm:p-5 w-full max-w-[420px] shadow-xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-semibold text-base">Position Filters</h3>
              <button onClick={() => setShowFightOnlyExplain(false)} className="text-surface-400 hover:text-white text-lg">×</button>
            </div>
            <div className="space-y-4 text-sm">
              <p className="text-surface-300">
                Filter your positions to focus on what matters during a fight.
              </p>
              <div className="space-y-2">
                <div className="bg-surface-700/50 rounded-lg p-3">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 bg-surface-600 text-white rounded text-xs font-medium">All</span>
                    <span className="text-surface-400 text-xs">Shows ALL your open positions</span>
                  </div>
                  <p className="text-surface-500 text-xs mt-2">Includes action buttons (Market, Limit, Flip) to close or modify positions.</p>
                </div>
                <div className="bg-primary-500/10 border border-primary-500/30 rounded-lg p-3">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 bg-primary-500 text-white rounded text-xs font-medium">Fight Only</span>
                    <span className="text-surface-400 text-xs">Shows ONLY positions during this fight</span>
                  </div>
                  <p className="text-surface-500 text-xs mt-2">View-only mode to track fight performance. No action buttons.</p>
                </div>
              </div>
              <div className="bg-orange-500/10 border border-orange-500/30 rounded p-3 text-xs">
                <div className="text-orange-400 font-semibold">Important</div>
                <p className="text-surface-300 mt-1">
                  To <span className="text-white">close positions</span>, you must switch to <span className="text-white">All</span> view to access the action buttons (Market, Limit, Flip).
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {showFightCapitalExplain && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-800 rounded-lg border border-surface-700 p-4 sm:p-5 w-full max-w-[480px] shadow-xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-semibold text-base">Fight Capital Limit</h3>
              <button onClick={() => setShowFightCapitalExplain(false)} className="text-surface-400 hover:text-white text-lg">×</button>
            </div>
            <div className="space-y-4 text-sm">
              <p className="text-surface-300">
                The Fight Capital Limit ensures fair competition by limiting how much capital each fighter can use.
              </p>

              {/* Preview */}
              <div className="bg-primary-500/10 border border-primary-500/30 rounded-lg p-3">
                <div className="text-primary-400 font-semibold mb-2 uppercase text-[9px]">Fight Capital Limit</div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-surface-400">Fight Stake</span><span className="font-mono text-white">$5000.00</span></div>
                  <div className="flex justify-between"><span className="text-surface-400">Current Positions</span><span className="font-mono text-white">$0.00</span></div>
                  <div className="flex justify-between"><span className="text-surface-400">Max Capital Used</span><span className="font-mono text-primary-400">$0.00</span></div>
                  <div className="flex justify-between"><span className="text-surface-400">Available to Trade</span><span className="font-mono text-win-400">$5000.00</span></div>
                </div>
                <div className="mt-2 h-1.5 bg-surface-700 rounded-full"><div className="h-full bg-primary-500 rounded-full" style={{ width: '0%' }} /></div>
                <div className="flex justify-between text-[9px] text-surface-500 mt-1"><span>0% used</span><span>100% available</span></div>
              </div>

              {/* Explanations */}
              <div className="space-y-2">
                <div className="bg-surface-700/50 rounded-lg p-3 flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3">
                  <span className="text-white text-xs font-medium shrink-0">Fight Stake</span>
                  <p className="text-surface-400 text-xs">The maximum capital you can use for positions during this fight. Both fighters have the same limit.</p>
                </div>

                <div className="bg-surface-700/50 rounded-lg p-3 flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3">
                  <span className="text-white text-xs font-medium shrink-0">Current Positions</span>
                  <p className="text-surface-400 text-xs">Total value of your open positions right now. Updated in real-time.</p>
                </div>

                <div className="bg-surface-700/50 rounded-lg p-3 flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3">
                  <span className="text-primary-400 text-xs font-medium shrink-0">Max Capital Used</span>
                  <p className="text-surface-400 text-xs">The highest position value you&apos;ve had during this fight. This is what counts for the limit.</p>
                </div>

                <div className="bg-surface-700/50 rounded-lg p-3 flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3">
                  <span className="text-win-400 text-xs font-medium shrink-0">Available to Trade</span>
                  <p className="text-surface-400 text-xs">How much more capital you can use. Calculated as: Fight Stake - Max Capital Used.</p>
                </div>
              </div>

              <div className="bg-surface-700/50 rounded-lg p-3">
                <div className="text-white font-semibold text-xs mb-1">Why does this exist?</div>
                <p className="text-surface-400 text-xs leading-relaxed">
                  The capital limit ensures <span className="text-white">fair fights</span>. Without it, a trader with $100k could easily beat someone with $1k just by taking larger positions. With the limit, both fighters compete on equal footing using the same maximum capital.
                </p>
              </div>

              <div className="bg-primary-500/10 border border-primary-500/30 rounded p-3 text-xs">
                <div className="text-primary-400 font-semibold">Important</div>
                <p className="text-surface-300 mt-1">
                  Your actual account balance on Pacifica doesn&apos;t change. The fight capital limit only restricts how much you can use <span className="text-white">during the fight</span>.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Switch Fight Explanation Modal */}
      {showSwitchFightExplain && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface-800 rounded-xl border border-surface-700 max-w-md w-full p-6 shadow-2xl">
            {/* Icon */}
            <div className="w-16 h-16 rounded-full bg-primary-500/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </div>

            {/* Title */}
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xl font-bold text-white">Switch Between Fights</h3>
              <button
                onClick={() => setShowSwitchFightExplain(false)}
                className="text-surface-400 hover:text-white text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Description */}
            <p className="text-surface-400 text-center mb-6">
              You can switch between your active fights at any time. Your positions and progress in each fight are saved separately.
            </p>

            {/* Fight Info Preview */}
            <div className="bg-surface-900/50 rounded-lg p-4 mb-6 border border-surface-700">
              <p className="text-sm text-surface-400 mb-3">Example: Switching to another fight</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-surface-500">Opponent</p>
                  <p className="text-lg font-bold text-white">6WZ3...qVaU</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-surface-500">Time Left</p>
                  <p className="text-lg font-mono font-bold text-primary-400">169:29</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-surface-500">Stake</p>
                  <p className="text-lg font-bold text-white">$1,000</p>
                </div>
              </div>
            </div>

            {/* Explanation boxes */}
            <div className="space-y-3 mb-6">
              <div className="bg-surface-700/50 rounded-lg p-3">
                <div className="text-white font-semibold text-sm mb-1">Multiple Fights</div>
                <p className="text-surface-400 text-xs">
                  You can participate in multiple fights simultaneously. Each fight has its own timer, positions, and PnL tracking.
                </p>
              </div>

              <div className="bg-surface-700/50 rounded-lg p-3">
                <div className="text-white font-semibold text-sm mb-1">Positions Stay Separate</div>
                <p className="text-surface-400 text-xs">
                  Positions opened in one fight don&apos;t count towards another fight&apos;s performance. Each fight is completely independent.
                </p>
              </div>

              <div className="bg-surface-700/50 rounded-lg p-3">
                <div className="text-white font-semibold text-sm mb-1">Switch Anytime</div>
                <p className="text-surface-400 text-xs">
                  Click on any fight button in the navbar to instantly switch. Your current fight will continue in the background.
                </p>
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={() => setShowSwitchFightExplain(false)}
              className="w-full px-4 py-3 bg-primary-500 hover:bg-primary-400 text-white font-semibold rounded-lg transition-colors"
            >
              Got it!
            </button>
          </div>
        </div>
      )}

      </div>{/* End of min-w wrapper */}
    </div>
  );
}
