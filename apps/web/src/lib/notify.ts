/**
 * Notification helper - shows a toast AND persists to database
 *
 * Usage:
 *   notify('ORDER', 'Order Placed', 'Market order for 0.001 BTC executed', { variant: 'success' });
 */

import { toast } from 'sonner';
import { useAuthStore } from './store';
import { createNotification } from './api';

export type NotificationType = 'TRADE' | 'ORDER' | 'FIGHT' | 'SYSTEM';
export type NotificationVariant = 'success' | 'error' | 'info' | 'warning';

interface NotifyOptions {
  /** Toast style: success (green), error (red), info (neutral), warning (yellow) */
  variant?: NotificationVariant;
  /** If false, only shows toast without saving to DB. Default: true */
  persist?: boolean;
  /** Duration in ms for the toast. Default: 4000 */
  duration?: number;
}

/**
 * Show a toast notification and optionally persist it to the database
 *
 * @param type - Category: TRADE, ORDER, FIGHT, SYSTEM
 * @param title - Short title for the notification
 * @param message - Detailed message
 * @param options - Configuration options
 */
export function notify(
  type: NotificationType,
  title: string,
  message: string,
  options?: NotifyOptions
): void {
  const { variant = 'info', persist = true, duration = 4000 } = options || {};

  // Show toast immediately
  const toastOptions = { duration };

  switch (variant) {
    case 'success':
      toast.success(message, toastOptions);
      break;
    case 'error':
      toast.error(message, toastOptions);
      break;
    case 'warning':
      toast.warning(message, toastOptions);
      break;
    default:
      toast(message, toastOptions);
  }

  // Persist to database (async, don't block)
  if (persist) {
    const token = useAuthStore.getState().token;

    if (token) {
      // Fire and forget - don't await, don't block the UI
      createNotification(token, { type, title, message }).catch((err) => {
        console.warn('Failed to persist notification:', err);
      });
    }
  }
}

/**
 * Convenience wrappers for common notification types
 */
export const notifySuccess = (
  type: NotificationType,
  title: string,
  message: string,
  options?: Omit<NotifyOptions, 'variant'>
) => notify(type, title, message, { ...options, variant: 'success' });

export const notifyError = (
  type: NotificationType,
  title: string,
  message: string,
  options?: Omit<NotifyOptions, 'variant'>
) => notify(type, title, message, { ...options, variant: 'error' });

export const notifyWarning = (
  type: NotificationType,
  title: string,
  message: string,
  options?: Omit<NotifyOptions, 'variant'>
) => notify(type, title, message, { ...options, variant: 'warning' });

/**
 * Show a toast-only notification (not persisted)
 */
export const toastOnly = (
  message: string,
  variant: NotificationVariant = 'info'
) => {
  switch (variant) {
    case 'success':
      toast.success(message);
      break;
    case 'error':
      toast.error(message);
      break;
    case 'warning':
      toast.warning(message);
      break;
    default:
      toast(message);
  }
};
