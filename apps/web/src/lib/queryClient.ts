import { QueryClient } from '@tanstack/react-query';

/**
 * Shared QueryClient instance for use across the app.
 * This allows non-React code (like notify.ts) to invalidate queries.
 *
 * Note: We persist notification state to localStorage to survive page reloads/redeploys
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10 * 1000, // 10 seconds - shorter for trading data freshness
      refetchOnWindowFocus: true, // Refetch when user returns to tab
      refetchOnMount: true, // Always fetch fresh data on mount
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      // Keep notifications cache longer to reduce refetches
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
    },
  },
});

/**
 * Persist notification read state to localStorage
 * This prevents notifications from showing as unread after page reload/redeploy
 */
export function persistNotificationReadState(notificationId: string) {
  if (typeof window === 'undefined') return;

  try {
    const key = 'tfc_read_notifications';
    const stored = localStorage.getItem(key);
    const readIds = stored ? JSON.parse(stored) : [];

    if (!readIds.includes(notificationId)) {
      readIds.push(notificationId);
      // Keep only last 1000 read notification IDs to prevent localStorage bloat
      const trimmed = readIds.slice(-1000);
      localStorage.setItem(key, JSON.stringify(trimmed));
    }
  } catch (error) {
    console.warn('Failed to persist notification read state:', error);
  }
}

/**
 * Check if notification was marked as read (from localStorage)
 */
export function isNotificationReadLocally(notificationId: string): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const key = 'tfc_read_notifications';
    const stored = localStorage.getItem(key);
    const readIds = stored ? JSON.parse(stored) : [];
    return readIds.includes(notificationId);
  } catch (error) {
    console.warn('Failed to check notification read state:', error);
    return false;
  }
}

/**
 * Clear old read notification IDs (older than 30 days)
 * Call this on app init to prevent localStorage bloat
 */
export function cleanupOldReadNotifications() {
  if (typeof window === 'undefined') return;

  try {
    const key = 'tfc_read_notifications';
    const stored = localStorage.getItem(key);
    if (!stored) return;

    const readIds = JSON.parse(stored);
    // Keep only last 1000 entries
    if (readIds.length > 1000) {
      const trimmed = readIds.slice(-1000);
      localStorage.setItem(key, JSON.stringify(trimmed));
    }
  } catch (error) {
    console.warn('Failed to cleanup old read notifications:', error);
  }
}
