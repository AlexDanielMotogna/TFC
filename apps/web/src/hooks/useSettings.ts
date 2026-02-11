'use client';

import { useState, useEffect } from 'react';

export interface Settings {
  showQuickBar: boolean;
  showWallet: boolean;
  showNotifications: boolean;
}

const defaultSettings: Settings = {
  showQuickBar: true,
  showWallet: true,
  showNotifications: true,
};

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);

  useEffect(() => {
    // Load from localStorage on mount
    const saved = localStorage.getItem('tfc-settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSettings({ ...defaultSettings, ...parsed });
      } catch (e) {
        // Ignore parse errors
      }
    }

    // Listen for settings changes from other components
    const handleSettingsChanged = (event: CustomEvent<Settings>) => {
      setSettings(event.detail);
    };

    window.addEventListener('tfc-settings-changed', handleSettingsChanged as EventListener);

    return () => {
      window.removeEventListener('tfc-settings-changed', handleSettingsChanged as EventListener);
    };
  }, []);

  return settings;
}
