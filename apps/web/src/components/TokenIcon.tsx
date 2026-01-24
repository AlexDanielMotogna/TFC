'use client';

import { useState, useEffect } from 'react';

// CoinMarketCap ID mapping for crypto icons
const CMC_IDS: Record<string, number> = {
  // Major cryptos
  BTC: 1,
  ETH: 1027,
  SOL: 5426,
  BNB: 1839,
  XRP: 52,
  ADA: 2010,
  DOGE: 74,
  LTC: 2,
  BCH: 1831,
  LINK: 1975,
  UNI: 7083,
  AVAX: 5805,
  NEAR: 6535,
  ICP: 8916,

  // DeFi & Layer 2
  AAVE: 7278,
  ARB: 11841,
  OP: 11840,
  STRK: 22691,
  ZK: 24091,
  MATIC: 3890,
  LDO: 8000,
  CRV: 6538,

  // Solana ecosystem
  JUP: 29210,
  WIF: 28752,
  BONK: 23095,
  KBONK: 23095,
  '1000BONK': 23095,
  PEPE: 24478,
  KPEPE: 24478,
  '1000PEPE': 24478,
  PENGU: 33593,

  // AI & New tokens
  TAO: 22974,
  WLD: 13502,
  VIRTUAL: 29420,

  // Hyperliquid & specific tokens
  HYPE: 32196,
  PUMP: 29587,
  ENA: 30171,
  SUI: 20947,

  // Privacy coins
  XMR: 328,
  ZEC: 1437,

  // Memecoins & newer tokens
  TRUMP: 32698,
  FARTCOIN: 33600,
  PIPPIN: 35053,
  MON: 33908,
  ASTER: 33797,
  ZZ: 33807,
  '2Z': 33807,
  WLFI: 33878,
  XPL: 33831,
  MEGA: 33958,

  // Commodities
  PAXG: 4705,
  XAG: 33836,
  XAU: 33836, // Gold
  CL: 33739, // Oil

  // Stocks (CMC has some tokenized stocks)
  NVDA: 33738,
  TSLA: 33845,
  AAPL: 33846,

  // Misc
  LIT: 5765,
};

// CoinGecko ID mapping (for tokens not on CMC or as fallback)
const COINGECKO_IDS: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  BNB: 'binancecoin',
  XRP: 'ripple',
  ADA: 'cardano',
  DOGE: 'dogecoin',
  LTC: 'litecoin',
  BCH: 'bitcoin-cash',
  LINK: 'chainlink',
  UNI: 'uniswap',
  AVAX: 'avalanche-2',
  NEAR: 'near',
  ICP: 'internet-computer',
  AAVE: 'aave',
  ARB: 'arbitrum',
  OP: 'optimism',
  MATIC: 'matic-network',
  LDO: 'lido-dao',
  CRV: 'curve-dao-token',
  JUP: 'jupiter-exchange-solana',
  WIF: 'dogwifcoin',
  BONK: 'bonk',
  KBONK: 'bonk',
  '1000BONK': 'bonk',
  PEPE: 'pepe',
  KPEPE: 'pepe',
  '1000PEPE': 'pepe',
  PENGU: 'pudgy-penguins',
  TAO: 'bittensor',
  WLD: 'worldcoin-wld',
  VIRTUAL: 'virtual-protocol',
  HYPE: 'hyperliquid',
  SUI: 'sui',
  XMR: 'monero',
  ZEC: 'zcash',
  TRUMP: 'official-trump',
  PAXG: 'pax-gold',
  STRK: 'starknet',
  ZK: 'zksync',
};

// Direct icon URLs for tokens that don't have CMC/CoinGecko listings
const DIRECT_ICONS: Record<string, string> = {
  // Forex
  'USD': 'https://flagcdn.com/w80/us.png',
  'JPY': 'https://flagcdn.com/w80/jp.png',
  'EUR': 'https://flagcdn.com/w80/eu.png',
  'GBP': 'https://flagcdn.com/w80/gb.png',
  'CHF': 'https://flagcdn.com/w80/ch.png',
  'CAD': 'https://flagcdn.com/w80/ca.png',
  'AUD': 'https://flagcdn.com/w80/au.png',
  // Stock icons from a free service
  'TSLA': 'https://companiesmarketcap.com/img/company-logos/64/TSLA.webp',
  'NVDA': 'https://companiesmarketcap.com/img/company-logos/64/NVDA.webp',
  'AAPL': 'https://companiesmarketcap.com/img/company-logos/64/AAPL.webp',
  'GOOGL': 'https://companiesmarketcap.com/img/company-logos/64/GOOG.webp',
  'AMZN': 'https://companiesmarketcap.com/img/company-logos/64/AMZN.webp',
  'META': 'https://companiesmarketcap.com/img/company-logos/64/META.webp',
  'MSFT': 'https://companiesmarketcap.com/img/company-logos/64/MSFT.webp',
};

// Extract base symbol from trading pair (e.g., "BTC-USD" -> "BTC", "USD/JPY" -> "USD")
export const extractBaseSymbol = (symbol: string): string => {
  // Handle Pacifica format: "BTC-USD"
  if (symbol.includes('-')) {
    return symbol.split('-')[0] ?? symbol;
  }
  // Handle forex format: "USD/JPY"
  if (symbol.includes('/')) {
    return symbol.split('/')[0] ?? symbol;
  }
  return symbol;
};

// Generate icon URLs with multiple fallback sources
export const getIconUrls = (symbol: string): string[] => {
  const baseSymbol = extractBaseSymbol(symbol).toUpperCase();
  const urls: string[] = [];

  // CoinMarketCap (primary for crypto - most reliable)
  const cmcId = CMC_IDS[baseSymbol];
  if (cmcId) {
    urls.push(`https://s2.coinmarketcap.com/static/img/coins/64x64/${cmcId}.png`);
  }

  // Check direct icons (forex flags, stock logos)
  if (DIRECT_ICONS[baseSymbol]) {
    urls.push(DIRECT_ICONS[baseSymbol]);
  }

  // CoinGecko (fallback - using their standard icon endpoint)
  const geckoId = COINGECKO_IDS[baseSymbol];
  if (geckoId) {
    // CoinGecko standard icon URL format
    urls.push(`https://assets.coingecko.com/coins/images/1/small/${geckoId}.png`);
  }

  // CryptoCompare as another fallback
  urls.push(`https://www.cryptocompare.com/media/37746238/${baseSymbol.toLowerCase()}.png`);

  // If no CMC ID, try generic sources
  if (!cmcId) {
    // CoinIcons.co - covers many tokens
    urls.push(`https://coinicons-api.vercel.app/api/icon/${baseSymbol.toLowerCase()}`);
  }

  return urls;
};

// Get CMC ID (for backwards compatibility)
export const getCMCId = (symbol: string): number | null => {
  const baseSymbol = extractBaseSymbol(symbol).toUpperCase();
  return CMC_IDS[baseSymbol] || null;
};

interface TokenIconProps {
  symbol: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showFallback?: boolean;
}

const SIZE_CLASSES: Record<string, string> = {
  xs: 'w-4 h-4',
  sm: 'w-5 h-5',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
  xl: 'w-10 h-10',
};

const FALLBACK_TEXT_SIZES: Record<string, string> = {
  xs: 'text-[8px]',
  sm: 'text-[9px]',
  md: 'text-[10px]',
  lg: 'text-xs',
  xl: 'text-sm',
};

export function TokenIcon({ symbol, size = 'md', className = '', showFallback = true }: TokenIconProps) {
  const [currentUrlIndex, setCurrentUrlIndex] = useState(0);
  const [showTextFallback, setShowTextFallback] = useState(false);
  const [urls] = useState(() => getIconUrls(symbol));

  const baseSymbol = extractBaseSymbol(symbol).toUpperCase();
  const sizeClass = SIZE_CLASSES[size];
  const textSizeClass = FALLBACK_TEXT_SIZES[size];

  // Reset state when symbol changes
  useEffect(() => {
    setCurrentUrlIndex(0);
    setShowTextFallback(false);
  }, [symbol]);

  const handleError = () => {
    if (currentUrlIndex < urls.length - 1) {
      // Try next URL
      setCurrentUrlIndex(prev => prev + 1);
    } else {
      // All URLs failed, show text fallback
      setShowTextFallback(true);
    }
  };

  if (showTextFallback || urls.length === 0) {
    if (!showFallback) return null;

    // Generate a consistent color based on the symbol
    const colors = [
      'bg-blue-500/30 text-blue-400',
      'bg-green-500/30 text-green-400',
      'bg-purple-500/30 text-purple-400',
      'bg-orange-500/30 text-orange-400',
      'bg-pink-500/30 text-pink-400',
      'bg-cyan-500/30 text-cyan-400',
      'bg-yellow-500/30 text-yellow-400',
      'bg-red-500/30 text-red-400',
    ];
    const colorIndex = baseSymbol.charCodeAt(0) % colors.length;
    const colorClass = colors[colorIndex];

    return (
      <div
        className={`${sizeClass} rounded-full ${colorClass} flex items-center justify-center ${textSizeClass} font-bold ${className}`}
        title={baseSymbol}
      >
        {baseSymbol.slice(0, 2)}
      </div>
    );
  }

  return (
    <img
      src={urls[currentUrlIndex]}
      alt={baseSymbol}
      className={`${sizeClass} rounded-full object-cover ${className}`}
      onError={handleError}
      loading="lazy"
    />
  );
}

export default TokenIcon;
