'use client';

import { Portal } from './Portal';
import { Spinner } from './Spinner';
import type { Position } from './Positions';

interface FlipPositionModalProps {
  position: Position;
  onClose: () => void;
  onConfirm: () => void;
  isSubmitting?: boolean;
}

export function FlipPositionModal({ position, onClose, onConfirm, isSubmitting = false }: FlipPositionModalProps) {
  // Get token symbol without -USD
  const tokenSymbol = position.symbol.replace('-USD', '');

  // Format token amount
  const formatTokenAmount = (amount: number) => {
    if (amount < 0.0001) return amount.toFixed(8);
    if (amount < 0.01) return amount.toFixed(6);
    if (amount < 1) return amount.toFixed(5);
    return amount.toFixed(4);
  };

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const newSide = position.side === 'LONG' ? 'Short' : 'Long';
  const positionValue = position.sizeInToken * position.markPrice;

  return (
    <Portal>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        onClick={handleBackdropClick}
      >
        <div className="bg-surface-900 rounded-2xl w-full max-w-md mx-4">
          {/* Header */}
        <div className="flex items-center justify-between p-6 pb-0">
          <h2 className="font-semibold text-sm text-white">Flip Position</h2>
          <button
            onClick={onClose}
            className="text-surface-500 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-sm text-surface-500">
            Flip current {position.side.toLowerCase()} position to {newSide.toLowerCase()} position of same size at market price.
          </p>

          {/* Position Details */}
          <div className="space-y-3">
            {/* Current Position */}
            <div className="flex justify-between items-center">
              <span className="text-surface-400">Current Position</span>
              <span className={`font-mono font-semibold ${
                position.side === 'LONG' ? 'text-win-400' : 'text-loss-400'
              }`}>
                {position.side === 'LONG' ? 'Long' : 'Short'} {formatTokenAmount(position.sizeInToken)} {tokenSymbol}
              </span>
            </div>

            {/* New Position */}
            <div className="flex justify-between items-center">
              <span className="text-surface-400">New Position</span>
              <span className={`font-mono font-semibold ${
                position.side === 'LONG' ? 'text-loss-400' : 'text-win-400'
              }`}>
                {newSide} {formatTokenAmount(position.sizeInToken)} {tokenSymbol}
              </span>
            </div>

            {/* Position Value */}
            <div className="flex justify-between items-center">
              <span className="text-surface-400">Position Value</span>
              <span className="font-mono text-white">
                ${positionValue.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          <button
            onClick={onConfirm}
            disabled={isSubmitting}
            className="w-full py-2.5 rounded-lg font-medium bg-white text-black hover:bg-surface-200 transition-colors disabled:bg-surface-700 disabled:text-surface-500 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <Spinner size="xs" variant="white" />
                Flipping...
              </span>
            ) : (
              'Flip Position'
            )}
          </button>
        </div>
      </div>
    </div>
    </Portal>
  );
}
