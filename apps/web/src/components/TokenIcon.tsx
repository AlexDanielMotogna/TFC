'use client';

import { useState, useEffect } from 'react';

// Fallback icons for non-crypto assets (forex, stocks, commodities)
const FALLBACK_ICONS: Record<string, string> = {
  // Forex flags
  USD: 'https://flagcdn.com/w80/us.png',
  JPY: 'https://flagcdn.com/w80/jp.png',
  EUR: 'https://flagcdn.com/w80/eu.png',
  GBP: 'https://flagcdn.com/w80/gb.png',
  CHF: 'https://flagcdn.com/w80/ch.png',
  CAD: 'https://flagcdn.com/w80/ca.png',
  AUD: 'https://flagcdn.com/w80/au.png',
  // Stocks
  TSLA: 'https://companiesmarketcap.com/img/company-logos/64/TSLA.webp',
  NVDA: 'https://companiesmarketcap.com/img/company-logos/64/NVDA.webp',
  AAPL: 'https://companiesmarketcap.com/img/company-logos/64/AAPL.webp',
  GOOGL: 'https://companiesmarketcap.com/img/company-logos/64/GOOG.webp',
  AMZN: 'https://companiesmarketcap.com/img/company-logos/64/AMZN.webp',
  META: 'https://companiesmarketcap.com/img/company-logos/64/META.webp',
  MSFT: 'https://companiesmarketcap.com/img/company-logos/64/MSFT.webp',
  // Commodities
  XAG: 'https://www.metals-api.com/images/silver.png',
  XAU: 'https://www.metals-api.com/images/gold.png',
};

// Extract base symbol from trading pair (e.g., "BTC-USD" -> "BTC", "USD/JPY" -> "USD")
export const extractBaseSymbol = (symbol: string): string => {
  if (symbol.includes('-')) return symbol.split('-')[0] ?? symbol;
  if (symbol.includes('/')) return symbol.split('/')[0] ?? symbol;
  return symbol;
};

// Special casing for Pacifica token names (they use lowercase 'k' prefix)
const PACIFICA_TOKEN_NAMES: Record<string, string> = {
  'KPEPE': 'kPEPE',
  'KBONK': 'kBONK',
};

// Generate icon URLs with Pacifica as primary source
export const getIconUrls = (symbol: string): string[] => {
  const baseSymbol = extractBaseSymbol(symbol).toUpperCase();
  const urls: string[] = [];

  // Pacifica icons - primary source for all traded tokens
  // Use special casing for tokens that need it (kPEPE, kBONK)
  const pacificaSymbol = PACIFICA_TOKEN_NAMES[baseSymbol] || baseSymbol;
  urls.push(`https://app.pacifica.fi/imgs/tokens/${pacificaSymbol}.svg`);

  // Fallback for forex, stocks, commodities
  if (FALLBACK_ICONS[baseSymbol]) {
    urls.push(FALLBACK_ICONS[baseSymbol]);
  }

  // CoinIcons as last fallback
  urls.push(`https://coinicons-api.vercel.app/api/icon/${baseSymbol.toLowerCase()}`);

  return urls;
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
