'use client';

import { useState, useRef, useEffect } from 'react';
import {
  useNotifications,
  useUnreadNotificationCount,
  useMarkNotificationAsRead,
  useMarkAllNotificationsAsRead,
  Notification,
} from '@/hooks';
import {
  BellIcon,
  LongShortIcon,
  MarketOrdersIcon,
  FightBannerIcon,
  TakeProfitIcon,
  StopLossIcon,
  LeverageIcon,
  FlipPositionIcon,
  DepositWithdrawIcon,
  FightCapitalLimitIcon,
  PrizeIcon,
  InfoIcon,
} from '@/components/icons/FeatureIcons';

/**
 * Get notification icon based on type
 * Uses centralized FeatureIcons to ensure consistency with landing page
 *
 * Notification types:
 * - TRADE: Long & Short icon (green)
 * - ORDER: Market Orders icon (cyan)
 * - TAKE_PROFIT: Take Profit dollar sign icon (green)
 * - STOP_LOSS: Stop Loss protection icon (red)
 * - LEVERAGE: Leverage trending arrow icon (orange)
 * - FLIP_POSITION: Flip position reversing arrows icon (cyan)
 * - DEPOSIT: Deposit/Withdraw credit card icon (green)
 * - WITHDRAW: Deposit/Withdraw credit card icon (green)
 * - FIGHT: Fight Banner lightning icon (orange)
 * - FIGHT_LIMIT: Fight Capital Limit scales icon (violet)
 * - PRIZE_CLAIMED: Prize trophy icon (yellow)
 * - default: Info icon (gray)
 */
function getNotificationIcon(type: string) {
  switch (type) {
    case 'TRADE':
      // Long & Short icon - trading arrows (green)
      return (
        <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
          <LongShortIcon className="w-4 h-4 text-green-400" />
        </div>
      );
    case 'ORDER':
      // Market Orders icon - clock for instant execution (primary/cyan)
      return (
        <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center">
          <MarketOrdersIcon className="w-4 h-4 text-primary-400" />
        </div>
      );
    case 'TAKE_PROFIT':
      // Take Profit icon - dollar sign in circle (green)
      return (
        <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
          <TakeProfitIcon className="w-4 h-4 text-green-400" />
        </div>
      );
    case 'STOP_LOSS':
      // Stop Loss icon - circle with slash for protection (red)
      return (
        <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
          <StopLossIcon className="w-4 h-4 text-red-400" />
        </div>
      );
    case 'LEVERAGE':
      // Leverage icon - trending up arrow (orange)
      return (
        <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center">
          <LeverageIcon className="w-4 h-4 text-orange-400" />
        </div>
      );
    case 'FLIP_POSITION':
      // Flip Position icon - reversing arrows (primary/cyan)
      return (
        <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center">
          <FlipPositionIcon className="w-4 h-4 text-primary-400" />
        </div>
      );
    case 'DEPOSIT':
    case 'WITHDRAW':
      // Deposit/Withdraw icon - credit card (green)
      return (
        <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
          <DepositWithdrawIcon className="w-4 h-4 text-green-400" />
        </div>
      );
    case 'FIGHT':
      // Fight Banner icon - lightning bolt (orange)
      return (
        <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center">
          <FightBannerIcon className="w-4 h-4 text-orange-400" />
        </div>
      );
    case 'FIGHT_LIMIT':
      // Fight Capital Limit icon - balance/scales (violet)
      return (
        <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center">
          <FightCapitalLimitIcon className="w-4 h-4 text-violet-400" />
        </div>
      );
    case 'PRIZE_CLAIMED':
      // Prize icon - trophy (yellow/gold)
      return (
        <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center">
          <PrizeIcon className="w-4 h-4 text-yellow-400" />
        </div>
      );
    default:
      // System/info icon
      return (
        <div className="w-8 h-8 rounded-full bg-surface-600 flex items-center justify-center">
          <InfoIcon className="w-4 h-4 text-surface-400" />
        </div>
      );
  }
}

// Format relative time
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// Single notification item
function NotificationItem({
  notification,
  onMarkAsRead,
}: {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
}) {
  return (
    <div
      className={`flex items-start gap-3 p-3 hover:bg-surface-800/50 transition-colors cursor-pointer border-b border-surface-800/50 last:border-b-0 ${
        !notification.isRead ? 'bg-surface-800/30' : ''
      }`}
      onClick={() => !notification.isRead && onMarkAsRead(notification.id)}
    >
      {/* Temporarily commented out notification icons */}
      {/* {getNotificationIcon(notification.type)} */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-sm font-medium truncate ${notification.isRead ? 'text-surface-400' : 'text-white'}`}>
            {notification.title}
          </span>
          {!notification.isRead && (
            <span className="w-2 h-2 bg-primary-500 rounded-full flex-shrink-0" />
          )}
        </div>
        <p className={`text-xs mt-0.5 line-clamp-2 ${notification.isRead ? 'text-surface-500' : 'text-surface-300'}`}>
          {notification.message}
        </p>
        <span className="text-[10px] text-surface-500 mt-1 block">
          {formatRelativeTime(notification.createdAt)}
        </span>
      </div>
    </div>
  );
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: notifications, isLoading } = useNotifications();
  const { data: unreadCount } = useUnreadNotificationCount();
  const markAsRead = useMarkNotificationAsRead();
  const markAllAsRead = useMarkAllNotificationsAsRead();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleMarkAsRead = (id: string) => {
    markAsRead.mutate(id);
  };

  const handleMarkAllAsRead = () => {
    markAllAsRead.mutate();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 text-surface-400 hover:text-surface-200 hover:bg-surface-800 rounded transition-colors relative"
      >
        <BellIcon className="w-5 h-5" />
        {unreadCount !== undefined && unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="fixed sm:absolute right-4 sm:right-0 top-14 sm:top-full sm:mt-2 w-[calc(100vw-32px)] sm:w-80 bg-surface-900 border border-surface-800 rounded-lg shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="p-3 border-b border-surface-800 flex justify-between items-center bg-surface-900">
            <span className="font-semibold text-white text-sm">Notifications</span>
            {unreadCount !== undefined && unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                disabled={markAllAsRead.isPending}
                className="text-xs text-primary-400 hover:text-primary-300 transition-colors disabled:opacity-50"
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-center text-surface-400 text-sm">
                Loading...
              </div>
            ) : notifications && notifications.length > 0 ? (
              notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={handleMarkAsRead}
                />
              ))
            ) : (
              <div className="p-8 text-center">
                <BellIcon className="w-10 h-10 text-surface-600 mx-auto mb-2" />
                <p className="text-surface-400 text-sm">No notifications</p>
                <p className="text-surface-500 text-xs mt-1">You're all caught up!</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
