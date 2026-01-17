'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { formatPrice, formatUSD, formatPercent, formatFundingRate } from '@/lib/formatters';

// CoinMarketCap ID mapping for crypto icons
const getCMCId = (symbol: string): number => {
  const cmcIds: Record<string, number> = {
    BTC: 1,
    ETH: 1027,
    SOL: 5426,
    BNB: 1839,
    HYPE: 32196,
    XMR: 328,
    ZEC: 1437,
    XRP: 52,
    ENA: 30171,
    SUI: 20947,
    PUMP: 29587,
    LTC: 2,
    PAXG: 4705,
    KPEPE: 24478,
    LIT: 5765,
    FARTCOIN: 33600,
    XAG: 33836,
    DOGE: 74,
    NVDA: 33738,
    AAVE: 7278,
    BCH: 1831,
    WLFI: 33878,
    JUP: 29210,
    XPL: 33831,
    TAO: 22974,
    ADA: 2010,
    CL: 33739,
    UNI: 7083,
    AVAX: 5805,
    ARB: 11841,
    WIF: 28752,
    VIRTUAL: 29420,
    ICP: 8916,
    LINK: 1975,
    KBONK: 23095,
    ASTER: 33797,
    TRUMP: 32698,
    LDO: 8000,
    PENGU: 33593,
    NEAR: 6535,
    ZK: 24091,
    WLD: 13502,
    PIPPIN: 34003,
    ZZ: 33807,
    STRK: 22691,
    CRV: 6538,
    MON: 33908,
  };
  // Extract base symbol (e.g., "BTC-USD" -> "BTC")
  const baseSymbol = symbol.replace('-USD', '');
  return cmcIds[baseSymbol] || 1;
};

interface Market {
  symbol: string;
  name: string;
  maxLeverage: number;
}

interface PriceData {
  price?: number;
  oracle?: number;
  change24h?: number;
  volume24h?: number;
  openInterest?: number;
  funding?: number;
  nextFunding?: number;
}

interface MarketSelectorProps {
  markets: Market[];
  selectedMarket: string;
  onSelectMarket: (symbol: string) => void;
  getPrice: (symbol: string) => PriceData | undefined | null;
}

export function MarketSelector({ markets, selectedMarket, onSelectMarket, getPrice }: MarketSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'volume' | 'change' | 'symbol'>('volume');
  const [sortDesc, setSortDesc] = useState(true);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);

  // For portal rendering
  useEffect(() => {
    setMounted(true);
  }, []);

  // Update dropdown position when opening
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX,
      });
    }
  }, [isOpen]);

  // Close dropdown when clicking outside (exclude the toggle button)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      // Ignore clicks on the toggle button (let the button's onClick handle it)
      if (buttonRef.current && buttonRef.current.contains(target)) {
        return;
      }
      // Close if clicking outside the dropdown
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Filter and sort markets
  const filteredMarkets = markets
    .filter((market) => {
      const query = searchQuery.toLowerCase();
      return (
        market.symbol.toLowerCase().includes(query) ||
        market.name.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      const priceA = getPrice(a.symbol);
      const priceB = getPrice(b.symbol);

      let comparison = 0;
      switch (sortBy) {
        case 'volume':
          comparison = (priceA?.volume24h || 0) - (priceB?.volume24h || 0);
          break;
        case 'change':
          comparison = (priceA?.change24h || 0) - (priceB?.change24h || 0);
          break;
        case 'symbol':
          comparison = a.symbol.localeCompare(b.symbol);
          break;
      }
      return sortDesc ? -comparison : comparison;
    });

  const handleSort = (column: 'volume' | 'change' | 'symbol') => {
    if (sortBy === column) {
      setSortDesc(!sortDesc);
    } else {
      setSortBy(column);
      setSortDesc(true);
    }
  };

  const baseSymbol = selectedMarket.replace('-USD', '');

  // Dropdown content to be rendered in portal
  const dropdownContent = isOpen && mounted ? createPortal(
    <div
      ref={dropdownRef}
      className="fixed w-[900px] max-h-[500px] bg-surface-900 border border-surface-700 rounded-xl shadow-2xl z-[9999] overflow-hidden"
      style={{
        top: dropdownPosition.top,
        left: dropdownPosition.left,
      }}
    >
      {/* Search */}
      <div className="p-3 border-b border-surface-700">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search markets..."
            className="w-full pl-10 pr-4 py-2 bg-surface-800 border border-surface-700 rounded-lg text-sm text-white placeholder-surface-500 focus:outline-none focus:border-primary-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-y-auto max-h-[420px]">
        <table className="w-full">
          <thead className="sticky top-0 bg-surface-900 z-10">
            <tr className="border-b border-surface-700">
              <th
                className="text-left text-xs font-medium text-surface-400 py-2 px-3 cursor-pointer hover:text-white"
                onClick={() => handleSort('symbol')}
              >
                <div className="flex items-center gap-1">
                  Symbol
                  {sortBy === 'symbol' && (
                    <span className="text-primary-400">{sortDesc ? '↓' : '↑'}</span>
                  )}
                </div>
              </th>
              <th className="text-right text-xs font-medium text-surface-400 py-2 px-3">
                Mark Price
              </th>
              <th
                className="text-right text-xs font-medium text-surface-400 py-2 px-3 cursor-pointer hover:text-white"
                onClick={() => handleSort('change')}
              >
                <div className="flex items-center justify-end gap-1">
                  24h Change
                  {sortBy === 'change' && (
                    <span className="text-primary-400">{sortDesc ? '↓' : '↑'}</span>
                  )}
                </div>
              </th>
              <th className="text-right text-xs font-medium text-surface-400 py-2 px-3">
                Next Funding
              </th>
              <th
                className="text-right text-xs font-medium text-surface-400 py-2 px-3 cursor-pointer hover:text-white"
                onClick={() => handleSort('volume')}
              >
                <div className="flex items-center justify-end gap-1">
                  Volume
                  {sortBy === 'volume' && (
                    <span className="text-primary-400">{sortDesc ? '↓' : '↑'}</span>
                  )}
                </div>
              </th>
              <th className="text-right text-xs font-medium text-surface-400 py-2 px-3">
                Open Interest
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredMarkets.map((market) => {
              const priceData = getPrice(market.symbol);
              const price = priceData?.price || 0;
              const change24h = priceData?.change24h || 0;
              const volume24h = priceData?.volume24h || 0;
              const openInterest = priceData?.openInterest || 0;
              const nextFunding = priceData?.nextFunding || 0;
              const isSelected = market.symbol === selectedMarket;
              const marketBaseSymbol = market.symbol.replace('-USD', '');

              return (
                <tr
                  key={market.symbol}
                  onClick={() => {
                    onSelectMarket(market.symbol);
                    setIsOpen(false);
                    setSearchQuery('');
                  }}
                  className={`border-b border-surface-800/50 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-primary-500/10'
                      : 'hover:bg-surface-800/50'
                  }`}
                >
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-2">
                      <img
                        src={`https://s2.coinmarketcap.com/static/img/coins/64x64/${getCMCId(market.symbol)}.png`}
                        alt={marketBaseSymbol}
                        className="w-6 h-6 rounded-full"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          if (target.parentElement) {
                            const fallback = document.createElement('div');
                            fallback.className = 'w-6 h-6 rounded-full bg-surface-700 flex items-center justify-center text-[10px] font-bold text-white';
                            fallback.textContent = marketBaseSymbol.slice(0, 2);
                            target.parentElement.replaceChild(fallback, target);
                          }
                        }}
                      />
                      <span className="text-sm font-medium text-white">{marketBaseSymbol}</span>
                      <span className="px-1.5 py-0.5 text-[10px] font-medium bg-surface-700 text-surface-300 rounded">
                        {market.maxLeverage}x
                      </span>
                    </div>
                  </td>
                  <td className="py-2 px-3 text-right">
                    <span className="text-sm text-white font-mono">
                      {price > 0 ? formatPrice(price) : '-'}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right">
                    <span className={`text-sm font-mono ${change24h >= 0 ? 'text-win-400' : 'text-loss-400'}`}>
                      {change24h !== 0 ? formatPercent(change24h) : '-'}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right">
                    <span className={`text-sm font-mono ${nextFunding >= 0 ? 'text-win-400' : 'text-loss-400'}`}>
                      {nextFunding !== 0 ? formatFundingRate(nextFunding) : '-'}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right">
                    <span className="text-sm text-surface-300 font-mono">
                      {volume24h > 0 ? formatUSD(volume24h) : '-'}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right">
                    <span className="text-sm text-surface-300 font-mono">
                      {openInterest > 0 ? formatUSD(openInterest) : '-'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredMarkets.length === 0 && (
          <div className="py-8 text-center text-surface-500 text-sm">
            No markets found
          </div>
        )}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div className="relative">
      {/* Selected Market Button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-surface-800 hover:bg-surface-700 border border-surface-700 rounded-lg transition-colors"
      >
        <img
          src={`https://s2.coinmarketcap.com/static/img/coins/64x64/${getCMCId(selectedMarket)}.png`}
          alt={baseSymbol}
          className="w-5 h-5 rounded-full"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
          }}
        />
        <span className="font-display font-semibold text-white">{selectedMarket}</span>
        <svg
          className={`w-4 h-4 text-surface-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown rendered via portal */}
      {dropdownContent}
    </div>
  );
}
