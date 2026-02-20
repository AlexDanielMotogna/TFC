'use client';

import { ReactNode, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { QueryClientProvider } from '@tanstack/react-query';
import { useGlobalSocket } from '@/hooks/useGlobalSocket';
import { queryClient, cleanupOldReadNotifications } from '@/lib/queryClient';
import { useNavigationStore } from '@/lib/stores/navigationStore';
import { ReferralTracker } from '@/components/ReferralTracker';
import { ExchangeProvider } from '@/contexts/ExchangeContext';

// Dynamically import wallet components to avoid SSR issues
const WalletProviderComponent = dynamic(
  () => import('@/components/WalletProvider').then((mod) => mod.WalletProviderWrapper),
  { ssr: false }
);

// Bridge Next.js router to Zustand so non-React code can navigate via SPA
function NavigationSetter() {
  const router = useRouter();
  useEffect(() => {
    useNavigationStore.getState().setRouter(router);
  }, [router]);
  return null;
}

// Component to initialize global socket connection
function GlobalSocketInitializer({ children }: { children: ReactNode }) {
  // This hook establishes the persistent WebSocket connection
  useGlobalSocket();

  // Cleanup old read notifications on mount
  useEffect(() => {
    cleanupOldReadNotifications();
  }, []);

  return (
    <>
      <NavigationSetter />
      {children}
    </>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ExchangeProvider>
        <WalletProviderComponent>
          <GlobalSocketInitializer>
            <ReferralTracker />
            {children}
          </GlobalSocketInitializer>
        </WalletProviderComponent>
      </ExchangeProvider>
    </QueryClientProvider>
  );
}
