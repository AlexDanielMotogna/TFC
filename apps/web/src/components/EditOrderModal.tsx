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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
        <div className="bg-surface-900 rounded-2xl p-6 w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-white font-semibold text-sm">Edit Limit Price</h3>
            <button
              onClick={onClose}
              className="text-surface-500 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Order Info */}
          <div className="bg-surface-800 rounded-xl p-3 space-y-2 mb-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-surface-500">Symbol</span>
              <span className="text-white font-medium">{order.symbol}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-surface-500">Side</span>
              <span className={`font-medium ${order.side === 'LONG' ? 'text-win-400' : 'text-loss-400'}`}>
                {order.side === 'LONG' ? 'Long' : 'Short'}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-surface-500">Size</span>
              <span className="text-surface-200 font-mono">{order.size} {order.symbol}</span>
            </div>
          </div>

          {/* Price Input */}
          <div className="mb-5">
            <label className="text-sm text-surface-500 mb-2 block">Limit Price</label>
            <div className="relative">
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                autoFocus
                className="w-full bg-surface-800 rounded-lg px-3 py-2.5 text-white font-mono pr-16 focus:outline-none focus:ring-1 focus:ring-surface-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 text-sm">
                USD
              </span>
            </div>
          </div>

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={!isValidInput || !hasChanges || editOrderMutation.isPending}
            className="w-full py-2.5 bg-white text-black font-medium rounded-lg transition-colors hover:bg-surface-200 disabled:bg-surface-700 disabled:text-surface-500 disabled:cursor-not-allowed"
          >
            {editOrderMutation.isPending ? 'Updating...' : 'Update Price'}
          </button>
        </div>
      </div>
    </Portal>
  );
}
