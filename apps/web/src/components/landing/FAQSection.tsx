'use client';

import { useState, useEffect } from 'react';
import { usePrices } from '@/hooks';

interface FAQItem {
  question: string;
  answer: string;
}

function FAQItem({ item, isOpen, onToggle }: { item: FAQItem; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-surface-700/50 last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-5 text-left group"
      >
        <span className="text-white font-medium pr-4 group-hover:text-orange-400 transition-colors">
          {item.question}
        </span>
        <span className={`flex-shrink-0 w-8 h-8 rounded-lg bg-surface-800 flex items-center justify-center transition-transform ${isOpen ? 'rotate-180' : ''}`}>
          <svg className="w-5 h-5 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-96 pb-5' : 'max-h-0'}`}
      >
        <p className="text-surface-400 leading-relaxed pr-12">
          {item.answer}
        </p>
      </div>
    </div>
  );
}

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const { markets } = usePrices();

  // Dynamic fees from Pacifica API
  const [fees, setFees] = useState({ makerFeePercent: '0.0650', takerFeePercent: '0.0900' });

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
      .catch(() => {
        // Keep fallback values on error
      });
  }, []);

  // Calculate dynamic values from API
  const marketCount = markets.length || 40;
  const maxLeverage = markets.length > 0
    ? Math.max(...markets.map((m) => m.maxLeverage))
    : 50;

  const faqs: FAQItem[] = [
    {
      question: 'What is Trade Fight Club?',
      answer: 'Trade Fight Club is a 1v1 trading competition platform where traders compete in real-time PvP fights. Create a fight, wait for an opponent to join, and battle it out. All trades execute on Pacifica DEX with real liquidity. Compete, climb the leaderboard, and win weekly cash prizes.',
    },
    {
      question: 'How do fights work?',
      answer: 'Create a fight with your parameters (duration, stake amount) and wait for an opponent to join. Once matched, both traders execute real trades during the fight period. The trader with the highest PnL percentage at the end wins. Winners climb the leaderboard and compete for weekly prizes.',
    },
    {
      question: 'What are the weekly prizes?',
      answer: 'Top 3 traders on the weekly leaderboard share 10% of all platform fees. 1st place gets 5%, 2nd place gets 3%, and 3rd place gets 2%. Prizes are calculated and distributed at the end of each week.',
    },
    {
      question: 'Is my crypto safe?',
      answer: 'Yes. Trade Fight Club is fully non-custodial. We never hold your funds. All trades execute directly on Pacifica DEX through your connected wallet. Your keys, your crypto.',
    },
    {
      question: 'What wallets are supported?',
      answer: 'We support all major Solana wallets including Phantom, MetaMask (via Snaps), Solflare, and more through WalletConnect and native integrations.',
    },
    {
      question: 'What assets can I trade?',
      answer: `You can trade ${marketCount}+ perpetual contracts including crypto (BTC, ETH, SOL, memecoins), stocks (Tesla, Nvidia), forex (USD/JPY) and more with up to ${maxLeverage}x leverage. All markets are powered by Pacifica DEX.`,
    },
    {
      question: 'What are the trading fees?',
      answer: `Trading fees are set by Pacifica DEX. Maker fees are ${fees.makerFeePercent}% and taker fees are ${fees.takerFeePercent}%. These fees contribute to the weekly prize pool.`,
    },
    {
      question: 'How do I get started?',
      answer: 'Connect your Solana wallet, deposit USDC on Pacifica DEX, and head to the lobby to create a fight or join an existing one. Start fighting and climb the leaderboard!',
    },
    {
      question: 'Anti-Cheat System?',
      answer: 'Fights with zero trading, very low volume, repeated self-matches, or shared IPs are marked NO CONTEST and don’t affect rankings or PnL.',
    },

  ];

  return (
    <section id="faq" className="py-16 lg:py-24 border-t border-surface-800">
      <div className="max-w-4xl mx-auto px-4 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl lg:text-5xl font-bold tracking-tight mb-4 text-white">
            Frequently Asked Questions
          </h2>
          <p className="text-surface-400 text-lg">
            Everything you need to know about Trade Fight Club
          </p>
        </div>

        {/* FAQ Accordion */}
        <div className="glass-card rounded-2xl p-6 lg:p-8">
          {faqs.map((faq, index) => (
            <FAQItem
              key={index}
              item={faq}
              isOpen={openIndex === index}
              onToggle={() => setOpenIndex(openIndex === index ? null : index)}
            />
          ))}
        </div>

        {/* Contact CTA */}
        <div className="mt-8 text-center">
          <p className="text-surface-400 mb-4">
            Still have questions?
          </p>
          <a
            href="https://twitter.com/tradefightclub"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-orange-400 hover:text-orange-300 transition-colors"
          >
            <span>Reach out on Twitter</span>
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}
