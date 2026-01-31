'use client';

import { useState, useEffect } from 'react';
import { useWithdraw } from '@/hooks';

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableBalance: number | null;
}

export function WithdrawModal({ isOpen, onClose, availableBalance }: WithdrawModalProps) {
  const [amount, setAmount] = useState('');
  const withdrawMutation = useWithdraw();

  // Reset amount when modal opens
  useEffect(() => {
    if (isOpen) {
      setAmount('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleMaxClick = () => {
    if (availableBalance !== null && availableBalance > 0) {
      // Leave $1 for fee
      const maxAmount = Math.max(0, availableBalance - 1);
      setAmount(maxAmount.toFixed(2));
    }
  };

  const handleSubmit = () => {
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return;
    }
    withdrawMutation.mutate(
      { amount: amountNum.toString() },
      {
        onSuccess: () => {
          onClose();
        },
      }
    );
  };

  const amountNum = parseFloat(amount) || 0;
  const isValidAmount = amountNum > 0 && (availableBalance === null || amountNum <= availableBalance);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-surface-850 border border-surface-700 rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-700">
          <h3 className="text-lg font-semibold text-white">Withdraw</h3>
          <button
            onClick={onClose}
            className="text-surface-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Available Balance with tooltip */}
          <div className="flex items-center justify-between text-sm group relative">
            <span className="text-surface-400 flex items-center gap-1 cursor-help">
              Available Balance:
              <svg className="w-3.5 h-3.5 text-surface-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
              </svg>
            </span>
            <span className="text-white font-mono">
              {availableBalance !== null ? `$${availableBalance.toFixed(2)}` : '-'}
            </span>
            {/* Tooltip */}
            <div className="absolute left-0 top-full mt-1 hidden group-hover:block z-50 w-72 p-3 bg-surface-900 border border-surface-600 rounded-lg text-xs text-surface-300 shadow-lg">
              Withdrawable balance equals your account equity minus the required margin, where the required margin is the larger of either the volume-weighted initial margin requirement (IMR) or 10% of your total position value
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-surface-800/50 rounded-lg p-3 text-xs text-surface-200 space-y-1">
            <p>Daily withdrawal limit is $250,000, resets at UTC 00:00.</p>
            <p>Withdrawal fee is $1.</p>
          </div>

          {/* Amount Input */}
          <div className="space-y-2">
            <label className="text-sm text-surface-400">Amount</label>
            <div className="relative">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-surface-800 border border-surface-600 rounded-lg px-3 py-2.5 text-white font-mono pr-20 focus:outline-none focus:border-primary-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <button
                  onClick={handleMaxClick}
                  className="text-primary-400 hover:text-primary-300 text-sm font-medium transition-colors"
                >
                  Max
                </button>
                <span className="text-surface-400 text-sm">USDC</span>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={!isValidAmount || withdrawMutation.isPending}
            className="w-full py-3 bg-primary-500 hover:bg-primary-400 disabled:bg-surface-700 disabled:text-surface-500 text-white font-semibold rounded-lg transition-colors disabled:cursor-not-allowed"
          >
            {withdrawMutation.isPending ? 'Processing...' : 'Confirm Withdraw'}
          </button>
        </div>
      </div>
    </div>
  );
}
