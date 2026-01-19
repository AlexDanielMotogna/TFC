'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useAuth } from '@/hooks';

/**
 * Custom wallet button that shows proper connection states:
 * - "Connecting..." while wallet popup is open
 * - "Signing..." while signature is being requested
 * - "Authenticating..." while backend auth is in progress
 * - Wallet address when fully connected and authenticated
 */
export function WalletButton() {
  const { connected, connecting } = useWallet();
  const { isAuthenticated, isAuthenticating } = useAuth();

  // Show connecting state while wallet popup is open
  if (connecting) {
    return (
      <button className="wallet-adapter-button" disabled>
        Connecting...
      </button>
    );
  }

  // Show signing/authenticating state when connected but not authenticated
  if (connected && !isAuthenticated) {
    return (
      <button className="wallet-adapter-button" disabled>
        {isAuthenticating ? 'Signing...' : 'Authenticating...'}
      </button>
    );
  }

  // Default: use WalletMultiButton for connect/disconnect functionality
  return <WalletMultiButton />;
}
