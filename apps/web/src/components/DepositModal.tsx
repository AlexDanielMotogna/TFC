'use client';

import { useState, useEffect } from 'react';
import { useBalance, useAccount as useWagmiAccount } from 'wagmi';
import { useDeposit } from '@/hooks';
import { useExchangeContext } from '@/contexts/ExchangeContext';
import { getHlContracts } from '@/lib/hyperliquid/transfers';
import { Portal } from './Portal';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DepositModal({ isOpen, onClose }: DepositModalProps) {
  const [amount, setAmount] = useState('');
  const { exchangeType, exchangeConfig } = useExchangeContext();
  // Always call hooks unconditionally (Rules of Hooks)
  const depositMutation = useDeposit();

  // Read Arbitrum USDC balance from connected EVM wallet
  const contracts = getHlContracts();
  const { address: evmAddress } = useWagmiAccount();
  const { data: usdcBalance } = useBalance({
    address: evmAddress,
    token: contracts.usdc,
    chainId: contracts.chainId,
  });

  const walletBalance = usdcBalance ? parseFloat(usdcBalance.formatted) : null;

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setAmount('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Pacifica: just open external link
  if (exchangeType === 'pacifica') {
    return (
      <Portal>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
          <div className="bg-surface-900 rounded-2xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-semibold text-sm">Deposit</h3>
              <button onClick={onClose} className="text-surface-500 hover:text-white transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="bg-surface-800 rounded-xl p-4 text-sm text-surface-300 mb-5">
              <p>Deposit USDC on Pacifica to start trading.</p>
              <p className="text-surface-500 text-xs mt-2">You will be redirected to Pacifica&apos;s deposit page.</p>
            </div>

            <button
              onClick={() => {
                window.open(exchangeConfig.depositUrl, '_blank');
                onClose();
              }}
              className="w-full py-2.5 bg-white text-black font-medium rounded-lg transition-colors hover:bg-surface-200"
            >
              Open Pacifica
            </button>
          </div>
        </div>
      </Portal>
    );
  }

  // Hyperliquid: in-app Arbitrum bridge deposit
  const amountNum = parseFloat(amount) || 0;
  const isValidAmount = amountNum >= 5 && (walletBalance === null || amountNum <= walletBalance);

  const handleMaxClick = () => {
    if (walletBalance !== null && walletBalance > 0) {
      setAmount(walletBalance.toFixed(2));
    }
  };

  const handleSubmit = () => {
    if (!isValidAmount) return;
    depositMutation.mutate(
      { amount: amountNum.toString() },
      {
        onSuccess: () => {
          onClose();
        },
      }
    );
  };

  const getButtonText = () => {
    if (depositMutation.isPending) return 'Processing...';
    if (amountNum > 0 && amountNum < 5) return 'Minimum $5';
    if (walletBalance !== null && amountNum > walletBalance) return 'Insufficient balance';
    return 'Confirm Deposit';
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
        <div className="bg-surface-900 rounded-2xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-white font-semibold text-sm">Deposit</h3>
            <button onClick={onClose} className="text-surface-500 hover:text-white transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Wallet USDC Balance */}
          <div className="flex items-center justify-between text-sm mb-4">
            <span className="text-surface-500">Arbitrum USDC Balance</span>
            <span className="text-white font-mono">
              {walletBalance !== null ? `$${walletBalance.toFixed(2)}` : '-'}
            </span>
          </div>

          <div className="bg-surface-800 rounded-xl p-3 text-xs text-surface-400 space-y-1 mb-4">
            <p>Deposit USDC from Arbitrum to Hyperliquid via bridge.</p>
            <p>Minimum deposit: $5. Funds arrive in ~1 minute.</p>
          </div>

          <div className="mb-5">
            <label className="text-sm text-surface-500 mb-2 block">Amount</label>
            <div className="relative">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                min="5"
                className="w-full bg-surface-800 rounded-lg px-3 py-2.5 text-white font-mono pr-24 focus:outline-none focus:ring-1 focus:ring-surface-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <button
                  onClick={handleMaxClick}
                  className="text-surface-300 hover:text-white text-sm font-medium transition-colors"
                >
                  Max
                </button>
                <span className="text-surface-500 text-sm">USDC</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={!isValidAmount || depositMutation.isPending}
            className="w-full py-2.5 bg-white text-black font-medium rounded-lg transition-colors hover:bg-surface-200 disabled:bg-surface-700 disabled:text-surface-500 disabled:cursor-not-allowed"
          >
            {getButtonText()}
          </button>
        </div>
      </div>
    </Portal>
  );
}
