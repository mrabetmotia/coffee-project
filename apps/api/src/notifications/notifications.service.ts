import { HttpStatus, Injectable } from '@nestjs/common';
import { BusinessException } from '../common/business.exception';
import { PrismaService } from '../prisma/prisma.module';
import { CreateNotificationDto } from './notifications.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async unreadCount(userId: string) {
    return { count: await this.prisma.notification.count({ where: { userId, readAt: null } }) };
  }

  async createForUser(userId: string, dto: CreateNotificationDto) {
    return this.prisma.notification.create({
      data: {
        userId,
        type: dto.type,
        title: dto.title,
        message: dto.message,
        actionLabel: dto.actionLabel ?? null,
        actionUrl: dto.actionUrl ?? null,
        metadata: dto.metadata ?? undefined,
        persistent: dto.persistent ?? false,
      },
    });
  }

  async createForAdmins(dto: CreateNotificationDto) {
    const admins = await this.prisma.user.findMany({ where: { role: 'ADMIN', isActive: true } });
    if (!admins.length) return [];
    return Promise.all(admins.map((user) => this.createForUser(user.id, dto)));
  }

  async markRead(userId: string, notificationId: string) {
    const record = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!record) {
      throw new BusinessException('Notification introuvable.', HttpStatus.NOT_FOUND, 'NOTIFICATION_NOT_FOUND');
    }

    if (record.readAt) {
      return record;
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }
}
