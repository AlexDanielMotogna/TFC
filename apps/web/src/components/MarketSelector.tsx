'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { formatPrice, formatUSD, formatPercent, formatFundingRate } from '@/lib/formatters';
import { TokenIcon, extractBaseSymbol } from './TokenIcon';

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
  blockedSymbols?: string[]; // Symbols blocked from trading (pre-fight positions)
}

export function MarketSelector({ markets, selectedMarket, onSelectMarket, getPrice, blockedSymbols = [] }: MarketSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'volume' | 'change' | 'symbol'>('volume');
  const [sortDesc, setSortDesc] = useState(true);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, isMobile: false });
  const [mounted, setMounted] = useState(false);

  // For portal rendering
  useEffect(() => {
    setMounted(true);
  }, []);

  // Update dropdown position when opening
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const isMobile = window.innerWidth < 1024;

      if (isMobile) {
        // On mobile/tablet - full width centered with padding
        // Use fixed position relative to viewport (no scrollY needed)
        setDropdownPosition({
          top: rect.bottom + 8,
          left: 16,
          isMobile: true,
        });
      } else {
        // On desktop - position below the button
        setDropdownPosition({
          top: rect.bottom + 8,
          left: Math.max(16, rect.left),
          isMobile: false,
        });
      }
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

  const baseSymbol = extractBaseSymbol(selectedMarket);

  // Dropdown content to be rendered in portal
  const dropdownContent = isOpen && mounted ? createPortal(
    <>
      {/* Backdrop for mobile/tablet */}
      {dropdownPosition.isMobile && (
        <div
          className="fixed inset-0 bg-black/60 z-[9998]"
          onClick={() => setIsOpen(false)}
        />
      )}
      <div
        ref={dropdownRef}
        className={`fixed bg-surface-900  border-surface-800 rounded-xl shadow-2xl z-[9999] overflow-hidden flex flex-col ${
          dropdownPosition.isMobile ? 'inset-4 top-16' : ''
        }`}
        style={dropdownPosition.isMobile ? { maxHeight: 'calc(100vh - 80px)' } : {
          top: dropdownPosition.top,
          left: dropdownPosition.left,
          width: '900px',
          maxWidth: 'calc(100vw - 32px)',
          maxHeight: '70vh',
        }}
      >
        {/* Header with close button on mobile */}
        <div className="p-3 border-b border-surface-800 flex items-center gap-3">
          <div className="relative flex-1">
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
              className="w-full pl-10 pr-4 py-2 bg-surface-800 border border-surface-800 rounded-lg text-sm text-white placeholder-surface-500 focus:outline-none focus:border-primary-500"
            />
          </div>
          {dropdownPosition.isMobile && (
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 hover:bg-surface-700 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Table */}
        <div className="overflow-auto flex-1">
        <table className="w-full min-w-[500px]">
          <thead className="sticky top-0 bg-surface-900 z-10">
            <tr className="border-b border-surface-800">
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
                className="hidden sm:table-cell text-right text-xs font-medium text-surface-400 py-2 px-3 cursor-pointer hover:text-white"
                onClick={() => handleSort('volume')}
              >
                <div className="flex items-center justify-end gap-1">
                  Volume
                  {sortBy === 'volume' && (
                    <span className="text-primary-400">{sortDesc ? '↓' : '↑'}</span>
                  )}
                </div>
              </th>
              <th className="hidden md:table-cell text-right text-xs font-medium text-surface-400 py-2 px-3">
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
              const marketBaseSymbol = extractBaseSymbol(market.symbol);
              const isBlocked = blockedSymbols.includes(market.symbol);

              return (
                <tr
                  key={market.symbol}
                  onClick={() => {
                    if (isBlocked) return; // Don't allow selecting blocked symbols
                    onSelectMarket(market.symbol);
                    setIsOpen(false);
                    setSearchQuery('');
                  }}
                  className={`transition-colors ${
                    isBlocked
                      ? 'opacity-50 cursor-not-allowed'
                      : isSelected
                        ? 'bg-primary-500/10 cursor-pointer'
                        : 'hover:bg-surface-800/50 cursor-pointer'
                  }`}
                  title={isBlocked ? 'Blocked: You had a position in this symbol before the fight started' : undefined}
                >
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-2">
                      <TokenIcon symbol={market.symbol} size="md" />
                      <span className={`text-sm font-medium ${isBlocked ? 'text-surface-500' : 'text-white'}`}>{marketBaseSymbol}</span>
                      <span className="px-1.5 py-0.5 text-[10px] font-medium bg-surface-700 text-surface-300 rounded">
                        {market.maxLeverage}x
                      </span>
                      {isBlocked && (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-amber-500/20 text-amber-400 rounded">
                          Blocked
                        </span>
                      )}
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
                  <td className="hidden sm:table-cell py-2 px-3 text-right">
                    <span className="text-sm text-surface-300 font-mono">
                      {volume24h > 0 ? formatUSD(volume24h) : '-'}
                    </span>
                  </td>
                  <td className="hidden md:table-cell py-2 px-3 text-right">
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
    </div>
    </>,
    document.body
  ) : null;

  return (
    <div className="relative">
      {/* Selected Market Button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-surface-800 hover:bg-surface-700 border border-surface-800 rounded-lg transition-colors"
      >
        <TokenIcon symbol={selectedMarket} size="sm" />
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
