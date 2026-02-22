'use client';

import { WagmiProvider, type Config } from 'wagmi';
import { arbitrum, arbitrumSepolia } from 'wagmi/chains';
import { getDefaultConfig, RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { type ReactNode } from 'react';

import '@rainbow-me/rainbowkit/styles.css';

const WALLETCONNECT_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '';

const config = getDefaultConfig({
  appName: 'TradeFightClub',
  projectId: WALLETCONNECT_PROJECT_ID,
  chains: [arbitrum, arbitrumSepolia],
  ssr: false,
}) as unknown as Config;

export function EvmWalletProvider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: '#26a69a',
            accentColorForeground: 'white',
            borderRadius: 'medium',
          })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
