'use client';

import { useEffect, useState, useRef } from 'react';

// Particle type for the energy effects
interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: 'cyan' | 'orange';
}

// Fighter profile component
function FighterProfile({
  side,
  name,
  winRate,
  pnl,
  isActive
}: {
  side: 'left' | 'right';
  name: string;
  winRate: number;
  pnl: number;
  isActive: boolean;
}) {
  const isLeft = side === 'left';
  const color = isLeft ? 'cyan' : 'orange';

  return (
    <div className={`flex flex-col items-center ${isLeft ? 'animate-slide-in-left' : 'animate-slide-in-right'}`}>
      {/* Avatar with glow */}
      <div className={`relative mb-4 ${isActive ? 'animate-pulse-glow' : ''}`}>
        {/* Outer glow ring */}
        <div className={`absolute -inset-3 rounded-full ${
          isLeft ? 'bg-primary-500/30' : 'bg-orange-500/30'
        } blur-xl animate-pulse`} />

        {/* Avatar container */}
        <div className={`relative w-20 h-20 md:w-28 md:h-28 rounded-full border-2 ${
          isLeft ? 'border-primary-400' : 'border-orange-400'
        } bg-surface-800 flex items-center justify-center overflow-hidden`}>
          {/* Fighter icon */}
          <svg className={`w-10 h-10 md:w-14 md:h-14 ${isLeft ? 'text-primary-400' : 'text-orange-400'}`} fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
          </svg>

          {/* Energy ring animation */}
          <div className={`absolute inset-0 rounded-full border ${
            isLeft ? 'border-primary-400/50' : 'border-orange-400/50'
          } animate-ping opacity-75`} />
        </div>

        {/* Corner badge */}
        <div className={`absolute -bottom-1 -right-1 w-8 h-8 rounded-full ${
          isLeft ? 'bg-primary-500' : 'bg-orange-500'
        } flex items-center justify-center text-white text-xs font-bold shadow-lg`}>
          {isLeft ? '#1' : '#2'}
        </div>
      </div>

      {/* Name */}
      <h3 className={`text-lg md:text-xl font-bold ${
        isLeft ? 'text-primary-400' : 'text-orange-400'
      } mb-2`}>
        {name}
      </h3>

      {/* Stats */}
      <div className="flex flex-col items-center gap-1 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-surface-500">Win Rate</span>
          <span className={`font-mono font-bold ${isLeft ? 'text-primary-400' : 'text-orange-400'}`}>
            {winRate}%
          </span>
        </div>
        <div className={`font-mono text-lg font-bold ${pnl >= 0 ? 'text-win-400' : 'text-loss-400'}`}>
          {pnl >= 0 ? '+' : ''}{pnl.toFixed(1)}%
        </div>
      </div>
    </div>
  );
}

// Animated VS badge
function VSBadge() {
  return (
    <div className="relative flex items-center justify-center">
      {/* Outer glow pulses */}
      <div className="absolute w-32 h-32 md:w-40 md:h-40 rounded-full bg-gradient-to-r from-primary-500/20 via-violet-500/20 to-orange-500/20 blur-2xl animate-pulse" />
      <div className="absolute w-24 h-24 md:w-32 md:h-32 rounded-full bg-gradient-to-r from-primary-500/30 to-orange-500/30 blur-xl animate-spin-slow" />

      {/* VS container */}
      <div className="relative">
        {/* Background shape */}
        <div className="absolute -inset-4 bg-gradient-to-r from-primary-500 via-violet-500 to-orange-500 rounded-2xl blur opacity-50 animate-pulse" />

        {/* Main VS */}
        <div className="relative bg-surface-900 px-6 py-4 md:px-8 md:py-5 rounded-2xl border border-surface-600">
          <span className="text-4xl md:text-5xl font-black bg-gradient-to-r from-primary-400 via-violet-400 to-orange-400 bg-clip-text text-transparent animate-gradient-x">
            VS
          </span>
        </div>

        {/* Sparks */}
        <div className="absolute -top-2 -left-2 w-4 h-4 bg-primary-400 rounded-full blur-sm animate-spark-1" />
        <div className="absolute -top-1 -right-3 w-3 h-3 bg-orange-400 rounded-full blur-sm animate-spark-2" />
        <div className="absolute -bottom-2 left-1/2 w-3 h-3 bg-violet-400 rounded-full blur-sm animate-spark-3" />
      </div>
    </div>
  );
}

// Floating particles canvas
function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const updateSize = () => {
      canvas.width = canvas.offsetWidth * 2;
      canvas.height = canvas.offsetHeight * 2;
      ctx.scale(2, 2);
    };
    updateSize();

    // Create particles
    const createParticle = (side: 'left' | 'right'): Particle => {
      const isLeft = side === 'left';
      const centerX = canvas.offsetWidth / 2;
      const centerY = canvas.offsetHeight / 2;

      return {
        id: Math.random(),
        x: isLeft ? centerX * 0.3 : centerX * 1.7,
        y: centerY + (Math.random() - 0.5) * 100,
        vx: isLeft ? 2 + Math.random() * 2 : -2 - Math.random() * 2,
        vy: (Math.random() - 0.5) * 2,
        life: 0,
        maxLife: 60 + Math.random() * 40,
        size: 2 + Math.random() * 3,
        color: isLeft ? 'cyan' : 'orange',
      };
    };

    // Animation loop
    const animate = () => {
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);

      // Spawn new particles
      if (Math.random() < 0.3) {
        particlesRef.current.push(createParticle('left'));
      }
      if (Math.random() < 0.3) {
        particlesRef.current.push(createParticle('right'));
      }

      // Update and draw particles
      particlesRef.current = particlesRef.current.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life++;

        const progress = p.life / p.maxLife;
        const alpha = progress < 0.5 ? progress * 2 : (1 - progress) * 2;

        // Draw particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 - progress * 0.5), 0, Math.PI * 2);
        ctx.fillStyle = p.color === 'cyan'
          ? `rgba(34, 211, 238, ${alpha * 0.8})`
          : `rgba(251, 146, 60, ${alpha * 0.8})`;
        ctx.fill();

        // Add glow
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
        ctx.fillStyle = p.color === 'cyan'
          ? `rgba(34, 211, 238, ${alpha * 0.2})`
          : `rgba(251, 146, 60, ${alpha * 0.2})`;
        ctx.fill();

        return p.life < p.maxLife;
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    window.addEventListener('resize', updateSize);
    return () => {
      window.removeEventListener('resize', updateSize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
    />
  );
}

// Energy beam connecting fighters
function EnergyBeam() {
  return (
    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1 pointer-events-none overflow-hidden">
      {/* Left beam */}
      <div className="absolute left-[15%] right-1/2 h-full">
        <div className="h-full bg-gradient-to-r from-primary-500/0 via-primary-500/50 to-primary-500 animate-beam-left" />
      </div>
      {/* Right beam */}
      <div className="absolute right-[15%] left-1/2 h-full">
        <div className="h-full bg-gradient-to-l from-orange-500/0 via-orange-500/50 to-orange-500 animate-beam-right" />
      </div>
      {/* Center clash */}
      <div className="absolute left-1/2 -translate-x-1/2 w-8 h-8 -top-3">
        <div className="w-full h-full rounded-full bg-white/80 blur-md animate-pulse" />
      </div>
    </div>
  );
}

import { TokenIcon } from '@/components/TokenIcon';

// Available assets for trading stats - popular ones from Pacifica
const tradingAssets = [
  { symbol: 'BTC', name: 'Bitcoin' },
  { symbol: 'ETH', name: 'Ethereum' },
  { symbol: 'SOL', name: 'Solana' },
  { symbol: 'DOGE', name: 'Dogecoin' },
  { symbol: 'HYPE', name: 'Hyperliquid' },
  { symbol: 'SUI', name: 'Sui' },
  { symbol: 'AVAX', name: 'Avalanche' },
  { symbol: 'LINK', name: 'Chainlink' },
  { symbol: 'ARB', name: 'Arbitrum' },
  { symbol: 'WIF', name: 'dogwifhat' },
];

interface TradeStat {
  id: number;
  asset: string;
  side: 'LONG' | 'SHORT';
  pnl: number;
  x: number;
  y: number;
}

// Floating stats that appear randomly - realistic trading positions
function FloatingStats() {
  const [stats, setStats] = useState<TradeStat[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      const assetIndex = Math.floor(Math.random() * tradingAssets.length);
      const assetData = tradingAssets[assetIndex]!;
      const side: 'LONG' | 'SHORT' = Math.random() > 0.5 ? 'LONG' : 'SHORT';

      // Realistic PnL: -8% to +12% range, slightly biased towards profit
      const isProfit = Math.random() > 0.4;
      const pnl = isProfit
        ? Math.random() * 8 + 0.5  // +0.5% to +8.5%
        : -(Math.random() * 6 + 0.3); // -0.3% to -6.3%

      const newStat: TradeStat = {
        id: Date.now() + Math.random(),
        asset: assetData.symbol,
        side,
        pnl,
        x: 15 + Math.random() * 70,
        y: 15 + Math.random() * 50,
      };

      setStats(prev => [...prev.slice(-6), newStat]);
    }, 1800);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {stats.map(stat => (
        <div
          key={stat.id}
          className="absolute animate-float-up opacity-0"
          style={{ left: `${stat.x}%`, top: `${stat.y}%` }}
        >
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg backdrop-blur-sm ${
            stat.pnl >= 0
              ? 'bg-win-500/20 border border-win-500/30'
              : 'bg-loss-500/20 border border-loss-500/30'
          }`}>
            {/* Side indicator */}
            <span className={`text-[10px] font-bold ${
              stat.side === 'LONG' ? 'text-win-400' : 'text-loss-400'
            }`}>
              {stat.side === 'LONG' ? '▲' : '▼'}
            </span>

            {/* Real asset icon */}
            <TokenIcon symbol={stat.asset} size="xs" />

            {/* Asset name */}
            <span className="text-xs font-semibold text-white">
              {stat.asset}
            </span>

            {/* PnL */}
            <span className={`text-xs font-mono font-bold ${
              stat.pnl >= 0 ? 'text-win-400' : 'text-loss-400'
            }`}>
              {stat.pnl >= 0 ? '+' : ''}{stat.pnl.toFixed(1)}%
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// Animated countdown timer
function useCountdown(initialMinutes: number) {
  const [seconds, setSeconds] = useState(initialMinutes * 60);

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds(s => {
        if (s <= 0) return initialMinutes * 60; // Loop back
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [initialMinutes]);

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Animated PnL that fluctuates
function useAnimatedPnl(basePnl: number) {
  const [pnl, setPnl] = useState(basePnl);

  useEffect(() => {
    const interval = setInterval(() => {
      // Small random fluctuation around base value
      const fluctuation = (Math.random() - 0.5) * 2; // -1 to +1
      setPnl(basePnl + fluctuation);
    }, 2000);
    return () => clearInterval(interval);
  }, [basePnl]);

  return pnl;
}

export function VSArena() {
  const [isLoaded, setIsLoaded] = useState(false);
  const countdown = useCountdown(15);
  const leftPnl = useAnimatedPnl(24.5);
  const rightPnl = useAnimatedPnl(18.2);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  return (
    <div className={`relative w-full aspect-[16/9] md:aspect-[21/9] bg-surface-900/50 rounded-2xl border border-surface-700/50 overflow-hidden transition-opacity duration-1000 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
      {/* Background grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:50px_50px]" />

      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary-500/5 via-transparent to-orange-500/5" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-surface-900/50 to-surface-900" />

      {/* Particle field */}
      <ParticleField />

      {/* Energy beam */}
      <EnergyBeam />

      {/* Floating stats */}
      <FloatingStats />

      {/* Main content */}
      <div className="relative z-10 h-full flex items-center justify-between px-8 md:px-16 lg:px-24">
        {/* Left Fighter */}
        <FighterProfile
          side="left"
          name="CryptoKing"
          winRate={73}
          pnl={leftPnl}
          isActive={true}
        />

        {/* VS Badge */}
        <VSBadge />

        {/* Right Fighter */}
        <FighterProfile
          side="right"
          name="TradeHunter"
          winRate={68}
          pnl={rightPnl}
          isActive={true}
        />
      </div>

      {/* Bottom stats bar */}
      <div className="absolute bottom-0 inset-x-0 h-12 bg-surface-900/80 backdrop-blur-sm border-t border-surface-700/50 flex items-center justify-center gap-4 md:gap-8 text-sm px-4">
        {/* Left fighter score */}
        <div className="flex items-center gap-2">
          <span className="text-primary-400 font-semibold hidden sm:inline">CryptoKing</span>
          <span className={`font-mono font-bold ${leftPnl >= 0 ? 'text-win-400' : 'text-loss-400'}`}>
            {leftPnl >= 0 ? '+' : ''}{leftPnl.toFixed(1)}%
          </span>
        </div>

        <div className="w-px h-6 bg-surface-700" />

        {/* Timer */}
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-surface-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-white font-mono font-bold">{countdown}</span>
        </div>

        <div className="w-px h-6 bg-surface-700" />

        {/* Live indicator */}
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-win-400 animate-pulse" />
          <span className="text-win-400 font-medium">LIVE</span>
        </div>

        <div className="w-px h-6 bg-surface-700" />

        {/* Right fighter score */}
        <div className="flex items-center gap-2">
          <span className={`font-mono font-bold ${rightPnl >= 0 ? 'text-win-400' : 'text-loss-400'}`}>
            {rightPnl >= 0 ? '+' : ''}{rightPnl.toFixed(1)}%
          </span>
          <span className="text-orange-400 font-semibold hidden sm:inline">TradeHunter</span>
        </div>
      </div>
    </div>
  );
}
