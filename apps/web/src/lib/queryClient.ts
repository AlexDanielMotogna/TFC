import { QueryClient } from '@tanstack/react-query';

/**
 * Shared QueryClient instance for use across the app.
 * This allows non-React code (like notify.ts) to invalidate queries.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10 * 1000, // 10 seconds - shorter for trading data freshness
      refetchOnWindowFocus: true, // Refetch when user returns to tab
      refetchOnMount: true, // Always fetch fresh data on mount
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    },
  },
});
