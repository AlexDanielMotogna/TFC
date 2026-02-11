'use client';

import { useState, useEffect } from 'react';
import { useEditOrder } from '@/hooks';
import { Portal } from './Portal';

interface Order {
  id: number;
  symbol: string;
  side: string;
  price: string;
  size: string;
  type: string;
}

interface EditOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
}

export function EditOrderModal({ isOpen, onClose, order }: EditOrderModalProps) {
  const [price, setPrice] = useState('');
  const editOrderMutation = useEditOrder();

  // Reset values when modal opens or order changes
  useEffect(() => {
    if (isOpen && order) {
      setPrice(order.price);
    }
  }, [isOpen, order]);

  if (!isOpen || !order) return null;

  const handleSubmit = () => {
    const priceNum = parseFloat(price);

    if (isNaN(priceNum) || priceNum <= 0) {
      return;
    }

    editOrderMutation.mutate(
      {
        orderId: order.id,
        symbol: order.symbol,
        price: price,
        amount: order.size,
      },
      {
        onSuccess: () => {
          onClose();
        },
      }
    );
  };

  const priceNum = parseFloat(price) || 0;
  const isValidInput = priceNum > 0;
  const hasChanges = price !== order.price;

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative bg-surface-850 border border-surface-800 rounded-lg shadow-xl w-full max-w-sm mx-4">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-surface-800">
            <h3 className="text-lg font-semibold text-white">Edit Limit Price</h3>
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
            {/* Order Info */}
            <div className="bg-surface-800/50 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-surface-400">Symbol</span>
                <span className="text-primary-400 font-medium">{order.symbol}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-surface-400">Side</span>
                <span className={`font-medium ${order.side === 'LONG' ? 'text-win-400' : 'text-loss-400'}`}>
                  {order.side === 'LONG' ? 'Long' : 'Short'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-surface-400">Size</span>
                <span className="text-surface-200 font-mono">{order.size} {order.symbol}</span>
              </div>
            </div>

            {/* Price Input */}
            <div className="space-y-2">
              <label className="text-sm text-surface-400">Limit Price</label>
              <div className="relative">
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                  autoFocus
                  className="w-full bg-surface-800 border border-surface-600 rounded-lg px-3 py-2.5 text-white font-mono pr-16 focus:outline-none focus:border-primary-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 text-sm">
                  USD
                </span>
              </div>
            </div>

            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              disabled={!isValidInput || !hasChanges || editOrderMutation.isPending}
              className="w-full py-3 bg-primary-500 hover:bg-primary-400 disabled:bg-surface-700 disabled:text-surface-500 text-white font-semibold rounded-lg transition-colors disabled:cursor-not-allowed"
            >
              {editOrderMutation.isPending ? 'Updating...' : 'Update Price'}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
