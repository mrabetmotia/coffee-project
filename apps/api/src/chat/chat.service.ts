import { HttpStatus, Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { BusinessException } from '../common/business.exception';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.module';

export type ChatUser = { id: string; role: UserRole; name?: string | null };

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService, private readonly notifications: NotificationsService) {}

  async getOrCreateClientConversation(userId: string) {
    const client = await this.prisma.client.findUnique({ where: { userId }, include: { user: true } });
    if (!client?.user || client.user.role !== UserRole.CLIENT || !client.user.isActive) throw new BusinessException('Profil client introuvable ou inactif.', HttpStatus.FORBIDDEN, 'CHAT_CLIENT_FORBIDDEN');
    return this.prisma.conversation.upsert({ where: { clientId: client.id }, create: { clientId: client.id }, update: {}, include: { client: { include: { user: { select: { id: true, name: true, email: true } } } } } });
  }

  async listConversations(user: ChatUser) {
    const where = user.role === UserRole.CLIENT ? { client: { userId: user.id } } : {};
    const conversations = await this.prisma.conversation.findMany({ where, include: { client: { include: { user: { select: { id: true, name: true, email: true, isActive: true } } } }, messages: { orderBy: { createdAt: 'desc' }, take: 1 } }, orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }] });
    return Promise.all(conversations.map(async (conversation) => ({ ...conversation, messages: undefined, lastMessage: conversation.messages[0] ?? null, unreadCount: await this.unreadCountForConversation(conversation.id, user.id) })));
  }

  async getMessages(user: ChatUser, conversationId: string, cursor?: string, limitValue?: string) {
    const conversation = await this.authorizeConversation(user, conversationId);
    const limit = Math.min(Math.max(Number(limitValue) || 30, 1), 100);
    const messages = await this.prisma.chatMessage.findMany({ where: { conversationId: conversation.id }, orderBy: { createdAt: 'desc' }, take: limit + 1, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), include: { sender: { select: { id: true, name: true, role: true } } } });
    const hasMore = messages.length > limit;
    return { items: messages.slice(0, limit).reverse(), nextCursor: hasMore ? messages[limit - 1]?.id ?? null : null };
  }

  async markConversationRead(user: ChatUser, conversationId: string) {
    const conversation = await this.authorizeConversation(user, conversationId);
    await this.prisma.chatMessage.updateMany({ where: { conversationId: conversation.id, senderId: { not: user.id }, readAt: null }, data: { readAt: new Date() } });
    return { conversationId, unreadCount: 0 };
  }

  async unreadCount(user: ChatUser) {
    if (user.role === UserRole.CLIENT) {
      const conversation = await this.prisma.conversation.findFirst({ where: { client: { userId: user.id } } });
      return { count: conversation ? await this.unreadCountForConversation(conversation.id, user.id) : 0 };
    }
    return { count: await this.prisma.chatMessage.count({ where: { readAt: null, sender: { role: UserRole.CLIENT } } }) };
  }

  async createMessage(user: ChatUser, conversationId: string, content: string) {
    const conversation = await this.authorizeConversation(user, conversationId);
    const value = content.trim();
    if (!value || value.length > 4000) throw new BusinessException('Le message doit contenir entre 1 et 4000 caractères.', HttpStatus.BAD_REQUEST, 'INVALID_CHAT_MESSAGE');
    console.info('[chat] creating message');
    console.info('[chat] conversationId:', conversation.id);
    console.info('[chat] senderId:', user.id);
    console.info('[chat] senderRole:', user.role);
    console.info('[chat] content length:', value.length);
    const message = await this.prisma.$transaction(async (tx) => {
      let created;
      try {
        created = await tx.chatMessage.create({ data: { conversationId: conversation.id, senderId: user.id, content: value }, include: { sender: { select: { id: true, name: true, role: true } } } });
        console.info('[chat] message created:', { id: created.id, conversationId: created.conversationId, senderId: created.senderId });
      } catch (error) {
        console.error('[chat] ChatMessage.create FAILED', error);
        throw error;
      }
      await tx.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: created.createdAt } });
      return created;
    });
    return { message, recipientId: conversation.client.userId, senderRole: user.role };
  }

  async authorizeConversation(user: ChatUser, conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({ where: { id: conversationId }, include: { client: { include: { user: true } } } });
    if (!conversation) throw new BusinessException('Conversation introuvable.', HttpStatus.NOT_FOUND, 'CHAT_CONVERSATION_NOT_FOUND');
    if (user.role === UserRole.CLIENT && conversation.client.userId !== user.id) throw new BusinessException('Accès refusé à cette conversation.', HttpStatus.FORBIDDEN, 'CHAT_CONVERSATION_FORBIDDEN');
    return conversation;
  }

  private unreadCountForConversation(conversationId: string, userId: string) { return this.prisma.chatMessage.count({ where: { conversationId, senderId: { not: userId }, readAt: null } }); }
}
