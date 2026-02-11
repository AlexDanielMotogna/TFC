'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/store';

const PACIFICA_DEPOSIT_URL = 'https://app.pacifica.fi/trade/BTC';

/**
 * Modal shown when a user is authenticated but has no Pacifica account.
 * Cannot be dismissed — the user must deposit on Pacifica to continue.
 *
 * IMPORTANT: Does NOT show immediately. First verifies with the server
 * to avoid false positives when Pacifica auto-link failed during login.
 */
export function NoPacificaModal() {
  const { token, isAuthenticated, pacificaConnected, setPacificaConnected, _hasHydrated } = useAuthStore();
  const [isVerifying, setIsVerifying] = useState(true);
  const [serverConfirmedDisconnected, setServerConfirmedDisconnected] = useState(false);

  // Verify with server before showing the blocking modal
  useEffect(() => {
    if (!_hasHydrated || !isAuthenticated || !token || pacificaConnected) {
      setIsVerifying(false);
      return;
    }

    let cancelled = false;

    async function verify() {
      try {
        const res = await fetch('/api/auth/pacifica/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;

        if (res.ok) {
          const data = await res.json();
          if (data.connected) {
            // Server says connected — update store, don't show modal
            setPacificaConnected(true);
            setServerConfirmedDisconnected(false);
          } else {
            // Server confirmed: no Pacifica account
            setServerConfirmedDisconnected(true);
          }
        } else {
          // API error — don't block the user, assume connected
          setServerConfirmedDisconnected(false);
        }
      } catch {
        // Network error — don't block the user
        setServerConfirmedDisconnected(false);
      } finally {
        if (!cancelled) setIsVerifying(false);
      }
    }

    verify();
    return () => { cancelled = true; };
  }, [_hasHydrated, isAuthenticated, token, pacificaConnected, setPacificaConnected]);

  // Don't show until hydrated and server-verified
  if (!_hasHydrated || !isAuthenticated || pacificaConnected) return null;
  if (isVerifying || !serverConfirmedDisconnected) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop — no onClick, cannot dismiss */}
      <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative bg-surface-900 border-t border-surface-700 sm:border sm:rounded-2xl rounded-t-2xl p-6 w-full sm:max-w-sm shadow-2xl">
        {/* Icon */}
        <div className="w-16 h-16 rounded-full bg-orange-500/20 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>

        <h2 className="text-lg font-bold text-white text-center mb-1">
          Pacifica Account Required
        </h2>
        <p className="text-surface-400 text-xs text-center mb-5">
          To trade on TFC you need a Pacifica account. Deposit funds on Pacifica to get started.
        </p>

        {/* Deposit Button */}
        <a
          href={PACIFICA_DEPOSIT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full py-3 bg-primary-500 hover:bg-primary-400 text-white font-semibold rounded-lg transition-colors text-center text-sm"
        >
          Deposit on Pacifica
        </a>

        <p className="text-surface-300 text-xs text-center mt-4">
          Once you deposit, your account will be linked automatically.
        </p>
      </div>
    </div>
  );
}
