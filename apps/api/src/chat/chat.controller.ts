import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { ChatMessagesQueryDto, SendChatMessageDto } from './chat.dto';
import { ChatService, ChatUser } from './chat.service';

@Controller('chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get('conversations')
  list(@Req() req: { user: ChatUser }) { return this.chat.listConversations(req.user); }

  @Post('conversations')
  @Roles(UserRole.CLIENT)
  create(@Req() req: { user: ChatUser }) { return this.chat.getOrCreateClientConversation(req.user.id); }

  @Get('conversations/:id/messages')
  messages(@Req() req: { user: ChatUser }, @Param('id') id: string, @Query() query: ChatMessagesQueryDto) { return this.chat.getMessages(req.user, id, query.cursor, query.limit); }

  @Patch('conversations/:id/read')
  read(@Req() req: { user: ChatUser }, @Param('id') id: string) { return this.chat.markConversationRead(req.user, id); }

  @Get('unread-count')
  unread(@Req() req: { user: ChatUser }) { return this.chat.unreadCount(req.user); }

  @Post('conversations/:id/messages')
  send(@Req() req: { user: ChatUser }, @Param('id') id: string, @Body() dto: SendChatMessageDto) { return this.chat.createMessage(req.user, id, dto.content); }
}
