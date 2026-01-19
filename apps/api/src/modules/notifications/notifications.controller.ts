import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { NotificationsService, CreateNotificationDto } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * GET /notifications - Get user's notifications
   */
  @Get()
  async getNotifications(
    @Request() req: { user: { userId: string } },
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    const parsedOffset = offset ? parseInt(offset, 10) : 0;

    return this.notificationsService.getNotifications(
      req.user.userId,
      parsedLimit,
      parsedOffset
    );
  }

  /**
   * GET /notifications/unread-count - Get count of unread notifications
   */
  @Get('unread-count')
  async getUnreadCount(@Request() req: { user: { userId: string } }) {
    const count = await this.notificationsService.getUnreadCount(req.user.userId);
    return { count };
  }

  /**
   * POST /notifications - Create a notification (for internal use)
   */
  @Post()
  async createNotification(
    @Request() req: { user: { userId: string } },
    @Body() body: CreateNotificationDto
  ) {
    return this.notificationsService.create(req.user.userId, body);
  }

  /**
   * POST /notifications/:id/read - Mark a notification as read
   */
  @Post(':id/read')
  async markAsRead(
    @Request() req: { user: { userId: string } },
    @Param('id') id: string
  ) {
    await this.notificationsService.markAsRead(req.user.userId, id);
    return { success: true };
  }

  /**
   * POST /notifications/read-all - Mark all notifications as read
   */
  @Post('read-all')
  async markAllAsRead(@Request() req: { user: { userId: string } }) {
    await this.notificationsService.markAllAsRead(req.user.userId);
    return { success: true };
  }
}
