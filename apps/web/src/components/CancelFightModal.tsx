'use client';

interface CancelFightModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

/**
 * CancelFightModal - Confirmation modal for canceling a fight
 * Shows before user cancels their waiting fight
 */
export function CancelFightModal({ isOpen, onConfirm, onCancel, isLoading = false }: CancelFightModalProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9998]"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <div className="bg-surface-900 rounded-2xl max-w-md w-full">
          {/* Header */}
          <div className="p-6 pb-0">
            <h2 className="font-semibold text-sm text-white">Cancel Fight?</h2>
          </div>

          {/* Content */}
          <div className="p-6">
            <p className="text-surface-500 text-sm">
              Are you sure you want to cancel this fight? This action cannot be undone.
            </p>
          </div>

          {/* Actions */}
          <div className="px-6 pb-6 flex gap-3 justify-end">
            <button
              onClick={onCancel}
              disabled={isLoading}
              className="px-4 py-2 rounded-lg bg-surface-800 hover:bg-surface-700 text-surface-400 hover:text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              No, Keep Fight
            </button>
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className="px-4 py-2 rounded-lg bg-loss-500 hover:bg-loss-600 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Cancelling...' : 'Yes, Cancel Fight'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
