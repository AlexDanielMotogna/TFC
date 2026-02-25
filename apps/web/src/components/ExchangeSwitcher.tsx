'use client';

import { useExchangeContext } from '@/contexts/ExchangeContext';
import { type ExchangeType } from '@tfc/shared';
import { useState, useRef, useEffect } from 'react';

const EXCHANGES: { type: ExchangeType; label: string }[] = [
  { type: 'pacifica', label: 'Pacifica' },
  { type: 'hyperliquid', label: 'Hyperliquid' },
  { type: 'nado', label: 'Nado' },
];

export function ExchangeSwitcher() {
  const { exchangeType, switchExchange } = useExchangeContext();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const current = EXCHANGES.find((e) => e.type === exchangeType) ?? EXCHANGES[0]!;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-surface-800 hover:bg-surface-700 border border-surface-700 rounded-lg text-sm font-medium transition-colors"
      >
        <span>{current.label}</span>
        <svg
          className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full mt-1 w-44 bg-surface-800 border border-surface-700 rounded-lg shadow-xl z-50 overflow-hidden">
          {EXCHANGES.map((exchange) => (
            <button
              key={exchange.type}
              onClick={() => {
                switchExchange(exchange.type);
                setIsOpen(false);
              }}
              className={`w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-surface-700 transition-colors ${
                exchange.type === exchangeType ? 'text-white bg-surface-700/50' : 'text-surface-300'
              }`}
            >
              <span>{exchange.label}</span>
              {exchange.type === exchangeType && (
                <svg className="w-4 h-4 text-win-500" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
