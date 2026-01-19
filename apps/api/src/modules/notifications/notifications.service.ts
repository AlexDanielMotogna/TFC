import { Injectable } from '@nestjs/common';
import { prisma } from '@tfc/db';

export interface CreateNotificationDto {
  type: string;
  title: string;
  message: string;
}

@Injectable()
export class NotificationsService {
  /**
   * Create a notification for a user
   */
  async create(userId: string, data: CreateNotificationDto) {
    return prisma.notification.create({
      data: {
        userId,
        type: data.type,
        title: data.title,
        message: data.message,
      },
    });
  }

  /**
   * Get notifications for a user (paginated, newest first)
   */
  async getNotifications(userId: string, limit = 50, offset = 0) {
    return prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Get count of unread notifications
   */
  async getUnreadCount(userId: string): Promise<number> {
    return prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(userId: string, notificationId: string) {
    return prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId, // Ensure user owns this notification
      },
      data: { isRead: true },
    });
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string) {
    return prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: { isRead: true },
    });
  }

  /**
   * Delete old notifications (for cleanup job)
   */
  async deleteOldNotifications(daysOld = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    return prisma.notification.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
        isRead: true, // Only delete read notifications
      },
    });
  }
}
