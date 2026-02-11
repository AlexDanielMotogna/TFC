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
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={handleBackdropClick}
      >
        <div className="bg-surface-800 rounded-xl shadow-xl w-full max-w-md mx-4 border border-surface-800">
          {/* Header */}
        <div className="flex items-center justify-between p-4 border-surface-800">
          <h2 className="text-lg font-semibold text-white">Flip Position</h2>
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
          <p className="text-sm text-surface-400">
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
        <div className="p-4 border-t border-surface-800">
          <button
            onClick={onConfirm}
            disabled={isSubmitting}
            className="w-full py-3 rounded-lg font-semibold bg-primary-500 hover:bg-primary-400 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
