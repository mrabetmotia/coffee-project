import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { CreateNotificationDto } from './notifications.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@Req() req: { user: { id: string } }) {
    return this.notifications.list(req.user.id);
  }

  @Post()
  create(
    @Req() req: { user: { id: string } },
    @Body() dto: CreateNotificationDto,
  ) {
    return this.notifications.createForUser(req.user.id, dto);
  }

  @Patch(':id/read')
  markRead(
    @Req() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.notifications.markRead(req.user.id, id);
  }

  @Patch('read-all')
  markAllRead(@Req() req: { user: { id: string } }) {
    return this.notifications.markAllRead(req.user.id);
  }
}
