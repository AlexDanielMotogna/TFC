'use client';

import { WagmiProvider, type Config } from 'wagmi';
import { arbitrum, arbitrumSepolia, type Chain } from 'wagmi/chains';
import { getDefaultConfig, RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { type ReactNode } from 'react';

import '@rainbow-me/rainbowkit/styles.css';

const WALLETCONNECT_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '';

// Ink Sepolia (Nado testnet) — chainId 763373
const inkSepolia: Chain = {
  id: 763373,
  name: 'Ink Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc-gel-sepolia.inkonchain.com'] },
  },
  blockExplorers: {
    default: { name: 'Ink Explorer', url: 'https://explorer-sepolia.inkonchain.com' },
  },
  testnet: true,
};

const config = getDefaultConfig({
  appName: 'TradeFightClub',
  projectId: WALLETCONNECT_PROJECT_ID,
  chains: [arbitrum, arbitrumSepolia, inkSepolia],
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
