'use client';

import { Portal } from './Portal';

interface CloseOppositeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  symbol: string;
  currentPositionSide: 'LONG' | 'SHORT';
  currentPositionValue: number;
  orderSide: 'LONG' | 'SHORT';
  orderValue: number;
  isLoading?: boolean;
}

export function CloseOppositeModal({
  isOpen,
  onClose,
  onConfirm,
  symbol,
  currentPositionSide,
  currentPositionValue,
  orderSide,
  orderValue,
  isLoading = false,
}: CloseOppositeModalProps) {
  if (!isOpen) return null;

  const willCloseAmount = Math.min(currentPositionValue, orderValue);
  const remainingOrderValue = orderValue - willCloseAmount;
  const willFullyClose = orderValue >= currentPositionValue;

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />

      {/* Modal */}
      <div className="relative bg-surface-900 rounded-2xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-0">
          <h3 className="font-semibold text-sm text-white">
            Close Opposite Position
          </h3>
          <button
            onClick={onClose}
            className="text-surface-500 hover:text-white transition-colors p-1"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Warning box */}
          <div className="p-4 bg-surface-800 rounded-lg mb-4">
            <p className="text-sm text-surface-200 leading-relaxed">
              You currently have a{' '}
              <span className="font-semibold text-white">
                ${currentPositionValue.toFixed(2)} {symbol.replace('-USD', '')}{' '}
                {currentPositionSide}
              </span>{' '}
              position and you are trying to open a{' '}
              <span className="font-semibold text-white">
                ${orderValue.toFixed(2)} {orderSide}
              </span>{' '}
              position.
              {willFullyClose ? (
                <>
                  {' '}
                  As a result,{' '}
                  <span className="font-semibold text-white">
                    ${currentPositionValue.toFixed(2)}
                  </span>{' '}
                  of your {currentPositionSide} position will be closed
                  {remainingOrderValue > 0 && (
                    <>
                      {' '}
                      and a new{' '}
                      <span className="font-semibold text-white">
                        ${remainingOrderValue.toFixed(2)} {orderSide}
                      </span>{' '}
                      position will be opened
                    </>
                  )}
                  .
                </>
              ) : (
                <>
                  {' '}
                  As a result,{' '}
                  <span className="font-semibold text-white">
                    ${willCloseAmount.toFixed(2)}
                  </span>{' '}
                  of your {currentPositionSide} position will be closed.
                </>
              )}
            </p>
          </div>

          {/* Order details */}
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-surface-400">Side</span>
              <span
                className={`font-semibold ${
                  orderSide === 'SHORT' ? 'text-loss-400' : 'text-win-400'
                }`}
              >
                {orderSide === 'SHORT' ? 'Sell' : 'Buy'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-400">Size</span>
              <span className="font-mono text-white">
                ${orderValue.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-400">Price</span>
              <span className="text-white">Market</span>
            </div>
          </div>

          {/* Checkbox */}
          <label className="flex items-center gap-3 mt-5 cursor-pointer group">
            <input
              type="checkbox"
              className="w-4 h-4 rounded bg-surface-800 text-surface-400 focus:ring-surface-500"
            />
            <span className="text-sm text-surface-400 group-hover:text-surface-300 transition-colors">
              Don't show this again
            </span>
          </label>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-6 pb-6 pt-2">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 py-2.5 px-4 bg-surface-800 hover:bg-surface-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex-1 py-2.5 px-4 font-semibold rounded-lg transition-colors disabled:opacity-50 ${
              orderSide === 'SHORT'
                ? 'bg-loss-500 hover:bg-loss-400 text-white'
                : 'bg-win-500 hover:bg-win-400 text-white'
            }`}
          >
            {isLoading ? 'Processing...' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
    </Portal>
  );
}
