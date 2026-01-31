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

// Import wallet adapter styles
import '@solana/wallet-adapter-react-ui/styles.css';

// Detectar si es móvil (client-side only)
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor;
      const isMobileDevice = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
        userAgent.toLowerCase()
      );
      setIsMobile(isMobileDevice);
    };
    checkMobile();
  }, []);

  return isMobile;
}

export function WalletProviderWrapper({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();

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

  // Configurar wallets según dispositivo
  const wallets = useMemo(() => {
    if (isMobile) {
      // En móvil: usar Mobile Wallet Adapter para deep linking
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
    // En desktop: usar extensiones de navegador
    return [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ];
  }, [isMobile]);

  return (
    <ConnectionProvider endpoint={endpoint}>
      {/* Deshabilitar autoConnect en móvil para evitar popups repetidos */}
      <WalletProvider wallets={wallets} autoConnect={!isMobile}>
        <WalletModalProvider>
          <PacificaConnectionSync />
          <PacificaWebSocketInit />
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
