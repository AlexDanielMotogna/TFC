'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

interface FullTerminalDemoProps {
  highlightFeature?: 'leverage' | 'long-short' | 'market-orders' | 'limit-orders' | 'stop-loss' | 'take-profit' | 'flip-position' | 'trailing-stop' | 'fight-capital-limit' | 'deposit-withdraw' | 'fight-banner' | 'fight-only' | null;
}

export function FullTerminalDemo({ highlightFeature = null }: FullTerminalDemoProps) {
  const [selectedSide, setSelectedSide] = useState<'LONG' | 'SHORT'>('LONG');
  const [leverage, setLeverage] = useState(5);
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
  const [selectedPosition, setSelectedPosition] = useState<'BTC' | 'ETH' | null>(null);

  // Explanation modals
  const [showDepositExplain, setShowDepositExplain] = useState(false);
  const [showFightBannerExplain, setShowFightBannerExplain] = useState(false);
  const [showFightOnlyExplain, setShowFightOnlyExplain] = useState(false);
  const [showFightCapitalExplain, setShowFightCapitalExplain] = useState(false);

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
    setShowDepositExplain(false);
    setShowFightBannerExplain(false);
    setShowFightOnlyExplain(false);
    setShowFightCapitalExplain(false);

    if (highlightFeature === 'deposit-withdraw') {
      setShowDepositExplain(true);
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
    <div className="bg-surface-950 w-full relative">
      {/* Top Navbar */}
      <div className="bg-surface-900 border-b border-surface-800 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Image
            src="/images/landing/TFC-Logo.png"
            alt="TFC"
            width={28}
            height={28}
            className="rounded-lg"
          />
        </div>
        <div className="flex items-center gap-6 text-xs">
          <span className="text-primary-400 font-medium">Trade</span>
          <span className="text-surface-400 hover:text-white cursor-pointer">Arena</span>
          <span className="text-surface-400 hover:text-white cursor-pointer">Leaderboard</span>
          <span className="text-surface-400 hover:text-white cursor-pointer">Profile</span>
        </div>
        <div className="flex items-center gap-2 bg-surface-800 rounded-lg px-3 py-1.5">
          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-400 to-blue-500" />
          <span className="text-white text-xs font-mono">74t7.Rveo</span>
        </div>
      </div>

      {/* Fight Banner - Live | vs Opponent | Timer+Stake | You/Opp/Tied */}
      <div
        onClick={() => setShowFightBannerExplain(true)}
        className={`bg-surface-900 px-4 py-1.5 flex items-center justify-between cursor-pointer hover:bg-surface-800/50 transition-colors ${getHighlightClass('fight-banner')}`}
      >
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-win-400 animate-pulse" />
            <span className="text-surface-300 text-xs">Live</span>
          </span>
          <span className="text-surface-600 text-xs">|</span>
          <span className="text-surface-400 text-xs">vs</span>
          <span className="text-primary-400 text-xs font-medium">6WZ3...qVaU</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white font-mono font-bold">49:47</span>
          <span className="text-surface-400 text-xs">$5000 stake</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[10px] text-surface-500">You <span className="text-surface-600">(net)</span></span>
            <div className="text-loss-400 font-mono text-xs">-12.04%</div>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-surface-500">Opp <span className="text-surface-600">(net)</span></span>
            <div className="text-win-400 font-mono text-xs">+4.01%</div>
          </div>
          <span className="text-loss-400 bg-loss-500/20 px-2 py-0.5 rounded text-[10px]">Losing</span>
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
          <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-800 hover:bg-surface-700 border border-surface-700 rounded text-xs cursor-pointer transition-colors">
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
      <div className="p-2 flex gap-2">
        {/* Left side: Order Book + Chart + Positions */}
        <div className="flex-1 flex flex-col gap-2">
          {/* Top Row: Order Book + Chart */}
          <div className="flex gap-2">
            {/* Order Book */}
            <div className="w-72 bg-surface-900 rounded-lg border border-surface-800 flex-shrink-0 overflow-hidden">
              <div className="px-3 py-2 border-b border-surface-800 flex items-center justify-between">
                <span className="font-semibold text-xs text-white uppercase">Order Book</span>
                <div className="flex items-center gap-2">
                  <select className="bg-surface-800 border border-surface-700 rounded px-2 py-0.5 text-white text-[10px]">
                    <option>1</option>
                  </select>
                  <select className="bg-surface-800 border border-surface-700 rounded px-2 py-0.5 text-white text-[10px]">
                    <option>BTC</option>
                  </select>
                </div>
              </div>
              <div className="p-2">
                <div className="flex justify-between text-[10px] text-surface-500 mb-1 px-1">
                  <span>PRICE</span>
                  <span>SIZE(BTC)</span>
                  <span>TOTAL</span>
                </div>
                <div className="space-y-px mb-1">
                  {askLevels.map((level, i) => (
                    <div key={i} className="flex justify-between text-[10px] font-mono px-1 py-0.5 relative">
                      <div className="absolute right-0 top-0 bottom-0 bg-loss-500/20" style={{ width: `${Math.min(100, (level.total / 5) * 100)}%` }} />
                      <span className="text-loss-400 relative z-10 w-14">{level.price.toLocaleString()}</span>
                      <span className="text-surface-300 relative z-10 w-12 text-right">{level.size.toFixed(2)}</span>
                      <span className="text-surface-400 relative z-10 w-10 text-right">{level.total.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div className="text-[10px] text-surface-500 py-1.5 border-y border-surface-700 mb-1 flex justify-between px-1">
                  <span>Spread</span>
                  <span className="font-mono">1.000</span>
                  <span className="font-mono">0.001%</span>
                </div>
                <div className="space-y-px">
                  {bidLevels.map((level, i) => (
                    <div key={i} className="flex justify-between text-[10px] font-mono px-1 py-0.5 relative">
                      <div className="absolute right-0 top-0 bottom-0 bg-win-500/20" style={{ width: `${Math.min(100, (level.total / 3) * 100)}%` }} />
                      <span className="text-win-400 relative z-10 w-14">{level.price.toLocaleString()}</span>
                      <span className="text-surface-300 relative z-10 w-12 text-right">{level.size.toFixed(2)}</span>
                      <span className="text-surface-400 relative z-10 w-10 text-right">{level.total.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex h-1.5 rounded-full overflow-hidden">
                  <div className="bg-win-500" style={{ width: '32.8%' }} />
                  <div className="bg-loss-500" style={{ width: '67.2%' }} />
                </div>
                <div className="flex justify-between text-[10px] mt-1">
                  <span className="text-win-400">B 32.8%</span>
                  <span className="text-loss-400">67.2% S</span>
                </div>
              </div>
            </div>

            {/* Chart */}
            <div className="flex-1 min-w-0 bg-surface-900 rounded-lg border border-surface-800 overflow-hidden">
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
        <div className="bg-surface-900 rounded-lg border border-surface-800 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-surface-800">
            <div className="flex items-center gap-4">
              {[
                { id: 'positions', label: 'Positions', count: 1 },
                { id: 'orders', label: 'Open Orders' },
                { id: 'trades', label: 'Trades' },
                { id: 'history', label: 'History' },
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

          <div className="p-2 overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="text-surface-500 uppercase">
                  <th className="text-left py-1 px-1">Token</th>
                  <th className="text-right py-1 px-1">Size</th>
                  <th className="text-right py-1 px-1">Position Value</th>
                  <th className="text-right py-1 px-1">Entry Price</th>
                  <th className="text-right py-1 px-1">Mark Price</th>
                  <th className="text-right py-1 px-1">PNL (ROI%)</th>
                  <th className="text-right py-1 px-1">Liq Price</th>
                  <th className="text-right py-1 px-1">Margin</th>
                  <th className="text-right py-1 px-1">Funding</th>
                  <th className="text-center py-1 px-1">TP/SL</th>
                  {!showFightOnly && <th className="text-center py-1 px-1">Actions</th>}
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-surface-700/50">
                  <td className="py-2 px-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-white font-medium">BTC</span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-loss-500/20 text-loss-400">28x Short</span>
                    </div>
                  </td>
                  <td className="py-2 px-1 text-right font-mono text-white">0.001380 BTC</td>
                  <td className="py-2 px-1 text-right font-mono text-white">$133.43</td>
                  <td className="py-2 px-1 text-right font-mono text-surface-300">96.283</td>
                  <td className="py-2 px-1 text-right font-mono text-surface-300">96.690</td>
                  <td className="py-2 px-1 text-right font-mono text-loss-400">$-0.5609 (-11.8200%)</td>
                  <td className="py-2 px-1 text-right font-mono text-surface-300">0</td>
                  <td className="py-2 px-1 text-right font-mono text-white">$4.75<br/><span className="text-surface-500">Cross</span></td>
                  <td className="py-2 px-1 text-right font-mono text-win-400">+$0.0000</td>
                  <td className="py-2 px-1 text-center">
                    <button onClick={() => openModal('tpsl', 'BTC')} className="text-surface-500 hover:text-primary-400">- / -</button>
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
            <div className="mt-2 pt-2 border-t border-surface-700 flex justify-between text-[10px]">
              <span className="text-surface-400">Total Positions: <span className="text-white">1</span></span>
              <span className="text-surface-400">Total PnL: <span className="text-loss-400 font-mono">$-0.5609</span></span>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Place Order */}
      <div className="w-64 bg-surface-900 rounded-lg border border-surface-800 flex-shrink-0 overflow-hidden">
        <div className="px-3 py-2 border-b border-surface-800">
          <span className="font-semibold text-xs text-white uppercase">Place Order</span>
        </div>
        <div className="p-3 space-y-3 text-[10px]">
          <div className={`flex gap-2 ${getHighlightClass('deposit-withdraw')}`}>
            <button onClick={() => setShowDepositExplain(true)} className="flex-1 py-2 text-xs font-semibold bg-primary-500 text-white rounded-lg hover:bg-primary-400 transition-colors">Deposit</button>
            <button onClick={() => setShowDepositExplain(true)} className="flex-1 py-2 text-xs font-semibold bg-surface-700 text-white rounded-lg hover:bg-surface-600 transition-colors">Withdraw</button>
          </div>

          <div className="space-y-1">
            {[
              ['Account Equity', '$5.71'],
              ['Idle Balance', '$0.31'],
              ['Resting Order Value', '$0.00'],
              ['Fees', feesDisplay],  // Dynamic: Taker/Maker (Pacifica + TFC 0.05%)
              ['Unrealized PnL', '+$0.28', 'text-win-400'],
              ['Cross Account Leverage', '47.26x'],
              ['Maintenance Margin', '$2.70'],
            ].map(([label, value, color]) => (
              <div key={label} className="flex justify-between">
                <span className="text-surface-400">{label}</span>
                <span className={`font-mono ${color || 'text-white'}`}>{value}</span>
              </div>
            ))}
            <div className="flex justify-between">
              <span className="text-surface-400">Real-time Updates</span>
              <span className="text-win-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-win-400 animate-pulse" />Live</span>
            </div>
          </div>

          <div
            onClick={() => setShowFightCapitalExplain(true)}
            className={`p-2.5 bg-primary-500/10 rounded-lg border border-primary-500/30 cursor-pointer hover:bg-primary-500/20 transition-colors ${getHighlightClass('fight-capital-limit')}`}
          >
            <div className="text-primary-400 font-semibold mb-1.5 uppercase text-[9px]">Fight Capital Limit</div>
            <div className="space-y-1">
              {[['Fight Stake', '$5000.00'], ['Current Positions', '$0.00'], ['Max Capital Used', '$0.00', 'text-primary-400'], ['Available to Trade', '$5000.00', 'text-win-400']].map(([l, v, c]) => (
                <div key={l} className="flex justify-between">
                  <span className="text-surface-400">{l}</span>
                  <span className={`font-mono ${c || 'text-white'}`}>{v}</span>
                </div>
              ))}
              <div className="mt-1.5 h-1 bg-surface-700 rounded-full"><div className="h-full bg-primary-500 rounded-full" style={{ width: '0%' }} /></div>
              <div className="flex justify-between text-[9px] text-surface-500"><span>0% used</span><span>100% available</span></div>
            </div>
          </div>

          <div className={`grid grid-cols-2 gap-2 ${getHighlightClass('long-short')}`}>
            <button onClick={() => setSelectedSide('LONG')} className={`py-2.5 rounded-lg font-semibold text-xs ${selectedSide === 'LONG' ? 'bg-win-500 text-white' : 'bg-surface-800 text-surface-400'}`}>LONG</button>
            <button onClick={() => setSelectedSide('SHORT')} className={`py-2.5 rounded-lg font-semibold text-xs ${selectedSide === 'SHORT' ? 'bg-loss-500 text-white' : 'bg-surface-800 text-surface-400'}`}>SHORT</button>
          </div>

          <div className={getHighlightClass('market-orders')}>
            <label className="text-surface-400 mb-1.5 block">Size</label>
            <div className="flex gap-2 mb-1.5">
              <div className="flex-1 relative">
                <input type="text" defaultValue="0.00" className="w-full bg-surface-800 border border-surface-700 rounded-lg px-2 py-1.5 text-white font-mono text-xs pr-10" />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-primary-400 text-[9px] font-medium">BTC</span>
              </div>
              <div className="flex-1 relative">
                <input type="text" defaultValue="0.00" className="w-full bg-surface-800 border border-surface-700 rounded-lg px-2 py-1.5 text-white font-mono text-xs pr-10" />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-surface-400 text-[9px]">USD</span>
              </div>
            </div>
            <div className="flex justify-between text-surface-500 mb-1.5"><span>Margin: $0.00</span><span>Max: $0.30 (5x)</span></div>
            <input type="range" min="0" max="100" defaultValue="0" className="w-full h-1 bg-surface-700 rounded-full mb-1.5 accent-primary-500" />
            <div className="flex gap-1">{[25, 50, 75, 100].map(p => <button key={p} className="flex-1 py-1 bg-surface-800 text-surface-400 rounded text-[9px] hover:bg-surface-700">{p}%</button>)}</div>
          </div>

          <div className={getHighlightClass('leverage')}>
            <div className="flex justify-between mb-1.5"><span className="text-surface-400">Leverage</span><span className="text-primary-400 font-semibold">{leverage}x</span></div>
            <input type="range" min="1" max="50" value={leverage} onChange={(e) => setLeverage(Number(e.target.value))} className="w-full h-1 bg-surface-700 rounded-full accent-primary-500" style={{ background: `linear-gradient(to right, #22d3ee 0%, #22d3ee ${(leverage / 50) * 100}%, #374151 ${(leverage / 50) * 100}%, #374151 100%)` }} />
            <div className="flex justify-between text-surface-500 mt-1"><span>1x</span><span>25x</span><span>50x</span></div>
          </div>

          <div className={getHighlightClass('take-profit')}>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={tpEnabled} onChange={(e) => setTpEnabled(e.target.checked)} className="w-3.5 h-3.5 rounded accent-primary-500" />
              <span className="text-surface-400">Take Profit</span>
            </div>
            {tpEnabled && (
              <div className="mt-2 ml-5">
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-surface-400 text-[9px]">$</span>
                  <input type="text" defaultValue="98,500" className="w-full bg-surface-800 border border-surface-700 rounded-lg pl-6 pr-2 py-1.5 text-white font-mono text-xs" />
                </div>
                <div className="flex gap-1 mt-1.5">
                  {[25, 50, 75, 100].map(p => (
                    <button key={p} className="flex-1 py-1 bg-win-500/20 text-win-400 rounded text-[9px] hover:bg-win-500/30">+{p}%</button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className={getHighlightClass('stop-loss')}>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={slEnabled} onChange={(e) => setSlEnabled(e.target.checked)} className="w-3.5 h-3.5 rounded accent-primary-500" />
              <span className="text-surface-400">Stop Loss</span>
            </div>
            {slEnabled && (
              <div className="mt-2 ml-5">
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-surface-400 text-[9px]">$</span>
                  <input type="text" defaultValue="92,000" className="w-full bg-surface-800 border border-surface-700 rounded-lg pl-6 pr-2 py-1.5 text-white font-mono text-xs" />
                </div>
                <div className="flex gap-1 mt-1.5">
                  {[25, 50, 75, 100].map(p => (
                    <button key={p} className="flex-1 py-1 bg-loss-500/20 text-loss-400 rounded text-[9px] hover:bg-loss-500/30">-{p}%</button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button className={`w-full py-2.5 rounded-lg font-bold text-xs ${selectedSide === 'LONG' ? 'bg-win-500 text-white hover:bg-win-400' : 'bg-loss-500 text-white hover:bg-loss-400'} transition-colors`}>
            {selectedSide === 'LONG' ? '↑ Open Long' : '↓ Open Short'}
          </button>
        </div>
      </div>
    </div>

    {/* Modals */}
    {showMarketModal && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-surface-800 rounded-lg border border-surface-700 p-4 w-72 shadow-xl">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-white font-semibold text-sm">Market Close</h3>
              <button onClick={() => setShowMarketModal(false)} className="text-surface-400 hover:text-white text-lg">×</button>
            </div>
            <div className="text-xs text-surface-400 mb-3">Close {selectedPosition} position at market price</div>
            <button className="w-full py-2 bg-loss-500 text-white rounded font-semibold text-sm">Confirm Market Close</button>
          </div>
        </div>
      )}

      {showLimitModal && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-surface-800 rounded-lg border border-surface-700 p-4 w-72 shadow-xl">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-white font-semibold text-sm">Limit Close</h3>
              <button onClick={() => setShowLimitModal(false)} className="text-surface-400 hover:text-white text-lg">×</button>
            </div>
            <label className="text-xs text-surface-400 mb-1 block">Limit Price</label>
            <input type="text" defaultValue="95,500" className="w-full bg-surface-700 border border-surface-600 rounded px-3 py-2 text-white font-mono text-sm mb-3" />
            <button className="w-full py-2 bg-primary-500 text-white rounded font-semibold text-sm">Place Limit Order</button>
          </div>
        </div>
      )}

      {showFlipModal && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-surface-800 rounded-lg border border-surface-700 p-4 w-72 shadow-xl">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-white font-semibold text-sm">Flip Position</h3>
              <button onClick={() => setShowFlipModal(false)} className="text-surface-400 hover:text-white text-lg">×</button>
            </div>
            <button className="w-full py-2 bg-primary-500 text-white rounded font-semibold text-sm">Confirm Flip</button>
          </div>
        </div>
      )}

      {showTpSlModal && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-surface-800 rounded-lg border border-surface-700 p-4 w-80 shadow-xl">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-white font-semibold text-sm">TP/SL for {selectedPosition}</h3>
              <button onClick={() => setShowTpSlModal(false)} className="text-surface-400 hover:text-white text-lg">×</button>
            </div>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1"><span className="text-surface-400">Take Profit</span><span className="text-win-400">+25% ROI</span></div>
                <input type="text" defaultValue="93,000" className="w-full bg-surface-700 border border-surface-600 rounded px-3 py-2 text-white font-mono text-sm" />
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1"><span className="text-surface-400">Stop Loss</span><span className="text-loss-400">-25% ROI</span></div>
                <input type="text" defaultValue="96,000" className="w-full bg-surface-700 border border-surface-600 rounded px-3 py-2 text-white font-mono text-sm" />
              </div>
            </div>
            <button className="w-full py-2 bg-primary-500 text-white rounded font-semibold text-sm mt-4">Confirm TP/SL</button>
          </div>
        </div>
      )}

      {showDepositExplain && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-surface-800 rounded-lg border border-surface-700 p-5 w-96 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-semibold text-base">Deposit & Withdraw</h3>
              <button onClick={() => setShowDepositExplain(false)} className="text-surface-400 hover:text-white text-lg">×</button>
            </div>
            <div className="space-y-4 text-sm">
              <div className="bg-primary-500/10 border border-primary-500/30 rounded-lg p-3">
                <div className="text-primary-400 font-semibold mb-2">Powered by Pacifica</div>
                <p className="text-surface-300 text-xs leading-relaxed">
                  Trading Fight Club uses <span className="text-white font-medium">Pacifica</span> as its underlying perpetual futures exchange.
                </p>
              </div>
              <div className="bg-surface-700/50 rounded p-3 text-xs text-surface-400">
                Your funds are secured by Pacifica&apos;s smart contracts on Solana.
              </div>
            </div>
          </div>
        </div>
      )}

      {showFightBannerExplain && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-surface-800 rounded-lg border border-surface-700 p-5 w-[540px] shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-semibold text-base">Fight Banner</h3>
              <button onClick={() => setShowFightBannerExplain(false)} className="text-surface-400 hover:text-white text-lg">×</button>
            </div>
            <div className="space-y-4 text-sm">
              <p className="text-surface-300">
                The Fight Banner shows your active trading competition at a glance. Here&apos;s what each part means:
              </p>

              {/* Banner Preview */}
              <div className="bg-surface-900 rounded-lg p-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-win-400 animate-pulse" />
                    <span className="text-surface-300">Live</span>
                  </span>
                  <span className="text-surface-600">|</span>
                  <span className="text-surface-400">vs</span>
                  <span className="text-primary-400 font-medium">6WZ3...qVaU</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-white font-mono font-bold">49:47</span>
                  <span className="text-surface-400">$5000</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-loss-400 font-mono">-12.04%</span>
                  <span className="text-win-400 font-mono">+4.01%</span>
                  <span className="text-loss-400 bg-loss-500/20 px-1.5 py-0.5 rounded text-[10px]">Losing</span>
                </div>
              </div>

              {/* Explanations */}
              <div className="space-y-2">
                <div className="bg-surface-700/50 rounded-lg p-3 flex items-start gap-3">
                  <span className="flex items-center gap-1 shrink-0">
                    <span className="w-2 h-2 rounded-full bg-win-400" />
                    <span className="text-white text-xs font-medium">Live</span>
                  </span>
                  <p className="text-surface-400 text-xs">Indicates the fight is currently active and in progress.</p>
                </div>

                <div className="bg-surface-700/50 rounded-lg p-3 flex items-start gap-3">
                  <span className="text-primary-400 text-xs font-medium shrink-0">vs 6WZ3...qVaU</span>
                  <p className="text-surface-400 text-xs">Your opponent&apos;s wallet address (shortened). Click to view their profile.</p>
                </div>

                <div className="bg-surface-700/50 rounded-lg p-3 flex items-start gap-3">
                  <span className="text-white font-mono text-xs font-bold shrink-0">49:47</span>
                  <p className="text-surface-400 text-xs">Time remaining in the fight. When it reaches 00:00, the fight ends and the winner is determined.</p>
                </div>

                <div className="bg-surface-700/50 rounded-lg p-3 flex items-start gap-3">
                  <span className="text-surface-300 text-xs shrink-0">$5000 stake</span>
                  <p className="text-surface-400 text-xs">The maximum capital each fighter can use for positions during this fight.</p>
                </div>

                <div className="bg-surface-700/50 rounded-lg p-3 flex items-start gap-3">
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-loss-400 font-mono text-xs">You -12.04%</span>
                    <span className="text-win-400 font-mono text-xs">Opp +4.01%</span>
                  </div>
                  <p className="text-surface-400 text-xs"><span className="text-white">Net PnL%</span> (fees deducted) for you and your opponent. This is the <span className="text-white">realized PnL</span> that determines the winner. The positions table shows unrealized PnL before fees.</p>
                </div>

                <div className="bg-surface-700/50 rounded-lg p-3 flex items-start gap-3">
                  <span className="text-surface-400 bg-surface-600 px-2 py-0.5 rounded text-[10px] shrink-0">Tied</span>
                  <p className="text-surface-400 text-xs">Shows who&apos;s winning: <span className="text-win-400">Winning</span>, <span className="text-loss-400">Losing</span>, or <span className="text-surface-300">Tied</span>.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showFightOnlyExplain && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-surface-800 rounded-lg border border-surface-700 p-5 w-[420px] shadow-xl">
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
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 bg-surface-600 text-white rounded text-xs font-medium">All</span>
                    <span className="text-surface-400 text-xs">Shows ALL your open positions</span>
                  </div>
                  <p className="text-surface-500 text-xs mt-2">Includes action buttons (Market, Limit, Flip) to close or modify positions.</p>
                </div>
                <div className="bg-primary-500/10 border border-primary-500/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
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
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-surface-800 rounded-lg border border-surface-700 p-5 w-[480px] shadow-xl">
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
                <div className="bg-surface-700/50 rounded-lg p-3 flex items-start gap-3">
                  <span className="text-white text-xs font-medium shrink-0">Fight Stake</span>
                  <p className="text-surface-400 text-xs">The maximum capital you can use for positions during this fight. Both fighters have the same limit.</p>
                </div>

                <div className="bg-surface-700/50 rounded-lg p-3 flex items-start gap-3">
                  <span className="text-white text-xs font-medium shrink-0">Current Positions</span>
                  <p className="text-surface-400 text-xs">Total value of your open positions right now. Updated in real-time.</p>
                </div>

                <div className="bg-surface-700/50 rounded-lg p-3 flex items-start gap-3">
                  <span className="text-primary-400 text-xs font-medium shrink-0">Max Capital Used</span>
                  <p className="text-surface-400 text-xs">The highest position value you&apos;ve had during this fight. This is what counts for the limit.</p>
                </div>

                <div className="bg-surface-700/50 rounded-lg p-3 flex items-start gap-3">
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
    </div>
  );
}
