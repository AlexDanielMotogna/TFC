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

/**
 * Hook to fetch user notifications
 */
export function useNotifications(limit = 50) {
  const { token, isAuthenticated } = useAuth();

  return useQuery({
    queryKey: ['notifications', limit],
    queryFn: () => getNotifications(token!, limit),
    enabled: isAuthenticated && !!token,
    staleTime: 30000, // Consider data fresh for 30 seconds
  });
}

/**
 * Hook to get unread notification count
 */
export function useUnreadNotificationCount() {
  const { token, isAuthenticated } = useAuth();

  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => getUnreadNotificationCount(token!),
    enabled: isAuthenticated && !!token,
    refetchInterval: 60000, // Refetch every minute
    staleTime: 30000,
  });
}

/**
 * Hook to mark a notification as read
 */
export function useMarkNotificationAsRead() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) => markNotificationAsRead(token!, notificationId),
    onSuccess: () => {
      // Invalidate both the list and the count
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

/**
 * Hook to mark all notifications as read
 */
export function useMarkAllNotificationsAsRead() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => markAllNotificationsAsRead(token!),
    onSuccess: () => {
      // Invalidate both the list and the count
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export type { Notification };
