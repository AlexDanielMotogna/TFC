'use client';

import { useState, useEffect } from 'react';
import CloseIcon from '@mui/icons-material/Close';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [showQuickBar, setShowQuickBar] = useState(true);
  const [showWallet, setShowWallet] = useState(true);
  const [showNotifications, setShowNotifications] = useState(true);

  // Load settings from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('tfc-settings');
    if (saved) {
      try {
        const settings = JSON.parse(saved);
        setShowQuickBar(settings.showQuickBar ?? true);
        setShowWallet(settings.showWallet ?? true);
        setShowNotifications(settings.showNotifications ?? true);
      } catch (e) {
        // Ignore parse errors
      }
    }
  }, []);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    const settings = { showQuickBar, showWallet, showNotifications };
    localStorage.setItem('tfc-settings', JSON.stringify(settings));

    // Dispatch custom event so other components can listen
    window.dispatchEvent(new CustomEvent('tfc-settings-changed', { detail: settings }));
  }, [showQuickBar, showWallet, showNotifications]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]" onClick={onClose}>
      <div
        className="bg-surface-850 border border-surface-800 rounded-lg shadow-xl max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-800">
          <h2 className="text-lg font-semibold text-white">Settings</h2>
          <button
            onClick={onClose}
            className="text-surface-400 hover:text-white transition-colors"
          >
            <CloseIcon sx={{ fontSize: 20 }} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-surface-300">Navbar Components</h3>

            {/* Quick Bar Toggle */}
            <div className="flex items-center justify-between py-2">
              <div>
                <div className="text-sm text-white">Quick Positions Bar</div>
                <div className="text-xs text-surface-500">Show active positions in navbar</div>
              </div>
              <button
                onClick={() => setShowQuickBar(!showQuickBar)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  showQuickBar ? 'bg-primary-500' : 'bg-surface-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    showQuickBar ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Wallet Toggle */}
            <div className="flex items-center justify-between py-2">
              <div>
                <div className="text-sm text-white">Balance Display</div>
                <div className="text-xs text-surface-500">Show balance and deposit/withdraw</div>
              </div>
              <button
                onClick={() => setShowWallet(!showWallet)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  showWallet ? 'bg-primary-500' : 'bg-surface-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    showWallet ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Notifications Toggle */}
            <div className="flex items-center justify-between py-2">
              <div>
                <div className="text-sm text-white">Notifications</div>
                <div className="text-xs text-surface-500">Show notification bell icon</div>
              </div>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  showNotifications ? 'bg-primary-500' : 'bg-surface-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    showNotifications ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-surface-800 bg-surface-900/30">
          <button
            onClick={onClose}
            className="w-full bg-primary-500 hover:bg-primary-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
