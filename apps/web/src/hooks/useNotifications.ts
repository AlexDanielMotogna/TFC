'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  Notification,
} from '@/lib/api';
import { isNotificationReadLocally, persistNotificationReadState } from '@/lib/queryClient';

/**
 * Hook to fetch user notifications
 * Merges server state with localStorage read state for persistence across reloads
 */
export function useNotifications(limit = 50) {
  const { token, isAuthenticated } = useAuth();

  return useQuery({
    queryKey: ['notifications', limit],
    queryFn: async () => {
      const notifications = await getNotifications(token!, limit);

      // Merge with localStorage read state to persist across page reloads
      return notifications.map((notification) => ({
        ...notification,
        isRead: notification.isRead || isNotificationReadLocally(notification.id),
      }));
    },
    enabled: isAuthenticated && !!token,
    staleTime: 10000, // Consider data fresh for 10 seconds
  });
}

/**
 * Hook to get unread notification count
 * Adjusts count based on localStorage read state
 */
export function useUnreadNotificationCount() {
  const { token, isAuthenticated } = useAuth();
  const { data: notifications } = useNotifications();

  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      // Get server count
      const serverCount = await getUnreadNotificationCount(token!);

      // Adjust based on local read state
      if (!notifications) return serverCount;

      // Count how many notifications marked as read locally but not on server
      const locallyReadCount = notifications.filter(
        (n) => !n.isRead && isNotificationReadLocally(n.id)
      ).length;

      // Return adjusted count (never negative)
      return Math.max(0, serverCount - locallyReadCount);
    },
    enabled: isAuthenticated && !!token,
    refetchInterval: 30000, // Refetch every 30 seconds (backup for cache invalidation)
    staleTime: 10000, // Consider fresh for 10 seconds
  });
}

/**
 * Hook to mark a notification as read
 * Persists to both server and localStorage
 */
export function useMarkNotificationAsRead() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      // Persist to localStorage immediately (optimistic)
      persistNotificationReadState(notificationId);

      // Then sync to server
      return markNotificationAsRead(token!, notificationId);
    },
    onSuccess: () => {
      // Invalidate both the list and the count
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

/**
 * Hook to mark all notifications as read
 * Persists all current notifications to localStorage
 */
export function useMarkAllNotificationsAsRead() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const { data: notifications } = useNotifications();

  return useMutation({
    mutationFn: async () => {
      // Persist all notifications to localStorage (optimistic)
      if (notifications) {
        notifications.forEach((notification) => {
          persistNotificationReadState(notification.id);
        });
      }

      // Then sync to server
      return markAllNotificationsAsRead(token!);
    },
    onSuccess: () => {
      // Invalidate both the list and the count
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export type { Notification };
