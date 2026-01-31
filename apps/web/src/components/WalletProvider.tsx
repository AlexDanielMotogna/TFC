'use client';

import { ReactNode, useMemo, useEffect, useState } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import {
  SolanaMobileWalletAdapter,
  createDefaultAddressSelector,
  createDefaultAuthorizationResultCache,
  createDefaultWalletNotFoundHandler,
} from '@solana-mobile/wallet-adapter-mobile';
import { PacificaConnectionSync } from './PacificaConnectionSync';
import { PacificaWebSocketInit } from './PacificaWebSocketInit';
import { getDeviceContext, type DeviceContext } from '@/lib/mobile';

// Import wallet adapter styles
import '@solana/wallet-adapter-react-ui/styles.css';

// Detectar contexto del dispositivo (desktop, mobile-browser, phantom-browser)
function useDeviceContext() {
  const [context, setContext] = useState<DeviceContext>('desktop');

  useEffect(() => {
    const detectContext = () => {
      setContext(getDeviceContext());
    };

    detectContext();

    // Re-check on focus (in case user navigated from external app)
    window.addEventListener('focus', detectContext);
    return () => window.removeEventListener('focus', detectContext);
  }, []);

  return context;
}

// Check if user was previously authenticated (has stored auth state)
function useHasPreviousAuth() {
  const [hasPreviousAuth, setHasPreviousAuth] = useState(false);

  useEffect(() => {
    try {
      const storedAuth = localStorage.getItem('tfc-auth');
      if (storedAuth) {
        const parsed = JSON.parse(storedAuth);
        // Check if there's a valid stored wallet address
        setHasPreviousAuth(!!parsed?.state?.walletAddress);
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  return hasPreviousAuth;
}

export function WalletProviderWrapper({ children }: { children: ReactNode }) {
  const deviceContext = useDeviceContext();
  const hasPreviousAuth = useHasPreviousAuth();

  // AutoConnect logic:
  // - Desktop: always autoConnect
  // - Phantom browser: always autoConnect (provider is injected)
  // - Mobile browser: only autoConnect if user was previously authenticated
  const shouldAutoConnect = deviceContext === 'desktop' || deviceContext === 'phantom-browser' || hasPreviousAuth;

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

  // Configure wallets based on device context
  const wallets = useMemo(() => {
    if (deviceContext === 'phantom-browser') {
      // Inside Phantom's dApp browser: provider is pre-injected
      // Only use PhantomWalletAdapter for seamless connection
      return [new PhantomWalletAdapter()];
    }

    if (deviceContext === 'mobile-browser') {
      // Regular mobile browser: use Mobile Wallet Adapter for deep linking
      const cluster = (process.env.NEXT_PUBLIC_SOLANA_NETWORK as 'devnet' | 'mainnet-beta') || 'devnet';
      return [
        new SolanaMobileWalletAdapter({
          addressSelector: createDefaultAddressSelector(),
          appIdentity: {
            name: 'Trading Fight Club',
            uri: typeof window !== 'undefined' ? window.location.origin : 'https://tradefight.club',
            icon: '/images/logos/favicon-white-192.png',
          },
          authorizationResultCache: createDefaultAuthorizationResultCache(),
          cluster,
          onWalletNotFound: createDefaultWalletNotFoundHandler(),
        }),
      ];
    }

    // Desktop: use browser extensions
    return [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ];
  }, [deviceContext]);

  return (
    <ConnectionProvider endpoint={endpoint}>
      {/* autoConnect: desktop always, mobile only if user was previously authenticated */}
      <WalletProvider wallets={wallets} autoConnect={shouldAutoConnect}>
        <WalletModalProvider>
          <PacificaConnectionSync />
          <PacificaWebSocketInit />
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
