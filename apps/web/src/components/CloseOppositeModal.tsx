'use client';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-surface-900 border border-surface-700 rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-700">
          <h3 className="text-lg font-display font-semibold text-white">
            Close Opposite Position
          </h3>
          <button
            onClick={onClose}
            className="text-surface-400 hover:text-white transition-colors p-1"
          >
            <svg
              className="w-5 h-5"
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
        <div className="p-5">
          {/* Warning box */}
          <div className="p-4 bg-primary-500/10 border border-primary-500/30 rounded-lg mb-5">
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
                  <span className="font-semibold text-primary-400">
                    ${currentPositionValue.toFixed(2)}
                  </span>{' '}
                  of your {currentPositionSide} position will be closed
                  {remainingOrderValue > 0 && (
                    <>
                      {' '}
                      and a new{' '}
                      <span className="font-semibold text-primary-400">
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
                  <span className="font-semibold text-primary-400">
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
              <span className="font-mono text-primary-400">
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
              className="w-4 h-4 rounded border-surface-600 bg-surface-800 text-primary-500 focus:ring-primary-500"
            />
            <span className="text-sm text-surface-400 group-hover:text-surface-300 transition-colors">
              Don't show this again
            </span>
          </label>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-5 py-4 border-t border-surface-700 bg-surface-800/50">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 py-2.5 px-4 bg-surface-700 hover:bg-surface-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
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
  );
}
