'use client';

import { ReactNode, useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { PacificaConnectionSync } from './PacificaConnectionSync';
import { PacificaWebSocketInit } from './PacificaWebSocketInit';

// Import wallet adapter styles
import '@solana/wallet-adapter-react-ui/styles.css';

export function WalletProviderWrapper({ children }: { children: ReactNode }) {
  // Use devnet by default, can be changed via environment variable
  const endpoint = useMemo(() => {
    const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet';
    const customRpc = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;

    if (customRpc) {
      return customRpc;
    }

    switch (network) {
      case 'mainnet-beta':
        return 'https://api.mainnet-beta.solana.com';
      case 'devnet':
      default:
        return 'https://api.devnet.solana.com';
    }
  }, []);

  // Configure wallets
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <PacificaConnectionSync />
          <PacificaWebSocketInit />
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
