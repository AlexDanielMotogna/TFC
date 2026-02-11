'use client';

import { ReactNode, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { QueryClientProvider } from '@tanstack/react-query';
import { useGlobalSocket } from '@/hooks/useGlobalSocket';
import { queryClient, cleanupOldReadNotifications } from '@/lib/queryClient';
import { ReferralTracker } from '@/components/ReferralTracker';

// Dynamically import wallet components to avoid SSR issues
const WalletProviderComponent = dynamic(
  () => import('@/components/WalletProvider').then((mod) => mod.WalletProviderWrapper),
  { ssr: false }
);

// Component to initialize global socket connection
function GlobalSocketInitializer({ children }: { children: ReactNode }) {
  // This hook establishes the persistent WebSocket connection
  useGlobalSocket();

  // Cleanup old read notifications on mount
  useEffect(() => {
    cleanupOldReadNotifications();
  }, []);

  return <>{children}</>;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <WalletProviderComponent>
        <GlobalSocketInitializer>
          <ReferralTracker />
          {children}
        </GlobalSocketInitializer>
      </WalletProviderComponent>
    </QueryClientProvider>
  );
}
