'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useAuth } from '@/hooks';
import { useExchangeContext } from '@/contexts/ExchangeContext';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { useAuthStore } from '@/lib/store';
import { useEffect } from 'react';

/**
 * Wallet button that shows the correct wallet UI based on exchange type:
 * - Pacifica → Solana WalletMultiButton
 * - Hyperliquid / Nado → RainbowKit ConnectButton (EVM wallet selector)
 */
export function WalletButton() {
  const { exchangeType, exchangeConfig } = useExchangeContext();

  if (exchangeConfig.walletType === 'ethereum') {
    return <EvmWalletButton />;
  }

  return <SolanaWalletButton />;
}

/** Solana wallet button (existing behavior) */
function SolanaWalletButton() {
  const { connected, connecting } = useWallet();
  const { isAuthenticated, isAuthenticating } = useAuth();

  if (connecting) {
    return (
      <button className="wallet-adapter-button" disabled>
        Connecting...
      </button>
    );
  }

  if (connected && !isAuthenticated) {
    return (
      <button className="wallet-adapter-button" disabled>
        {isAuthenticating ? 'Signing...' : 'Authenticating...'}
      </button>
    );
  }

  return <WalletMultiButton />;
}

/** EVM wallet button for Hyperliquid — RainbowKit handles the wallet selection modal */
function EvmWalletButton() {
  const { address, isConnected } = useAccount();
  const { setEvmWalletAddress, clearEvmAuth } = useAuthStore();

  // Sync wagmi address to store
  useEffect(() => {
    if (isConnected && address) {
      setEvmWalletAddress(address);
    } else {
      clearEvmAuth();
    }
  }, [isConnected, address, setEvmWalletAddress, clearEvmAuth]);

  return <ConnectButton />;
}
