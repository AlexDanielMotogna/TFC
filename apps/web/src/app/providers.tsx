'use client';

import { ReactNode, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useGlobalSocket } from '@/hooks/useGlobalSocket';

// Dynamically import wallet components to avoid SSR issues
const WalletProviderComponent = dynamic(
  () => import('@/components/WalletProvider').then((mod) => mod.WalletProviderWrapper),
  { ssr: false }
);

// Component to initialize global socket connection
function GlobalSocketInitializer({ children }: { children: ReactNode }) {
  // This hook establishes the persistent WebSocket connection
  useGlobalSocket();
  return <>{children}</>;
}

export function Providers({ children }: { children: ReactNode }) {
  // Create QueryClient instance (once per component lifecycle)
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10 * 1000, // 10 seconds - shorter for trading data freshness
            refetchOnWindowFocus: true, // Refetch when user returns to tab
            refetchOnMount: true, // Always fetch fresh data on mount
            retry: 2,
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <WalletProviderComponent>
        <GlobalSocketInitializer>
          {children}
        </GlobalSocketInitializer>
      </WalletProviderComponent>
    </QueryClientProvider>
  );
}
