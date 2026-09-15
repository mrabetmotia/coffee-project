import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import { NotificationsService } from '../notifications/notifications.service';
import { ChatService, ChatUser } from './chat.service';

type ChatSocket = Socket & { data: { user: ChatUser } };
const conversationRoom = (id: string) => `conversation:${id}`;

@WebSocketGateway({ namespace: '/chat', cors: { origin: true, credentials: true } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly userSockets = new Map<string, Set<string>>();

  constructor(private readonly jwt: JwtService, private readonly prisma: PrismaService, private readonly chat: ChatService, private readonly notifications: NotificationsService) {}

  async handleConnection(socket: ChatSocket) {
    socket.on('disconnect', (reason) => {
      console.info('[chat] socket disconnect reason', { socketId: socket.id, reason, userId: socket.data?.user?.id });
    });
    try {
      const token = this.readToken(socket);
      console.info('[chat] connecting', { socketId: socket.id, hasToken: Boolean(token) });
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token);
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user || !user.isActive) throw new Error('UNAUTHORIZED');
      socket.data.user = { id: user.id, role: user.role, name: user.name };
      const sockets = this.userSockets.get(user.id) ?? new Set<string>();
      sockets.add(socket.id);
      this.userSockets.set(user.id, sockets);
      console.info('[chat] connected', { socketId: socket.id, userId: user.id, role: user.role });
      socket.emit('chat:connection', { status: 'connected' });
      this.emitUnread(socket.data.user);
    } catch (error) {
      console.error('[chat] connect_error', error);
      socket.emit('chat:connection', { status: 'unauthorized', reason: error instanceof Error ? error.message : 'unknown' });
      socket.disconnect(true);
    }
  }

  handleDisconnect(socket: ChatSocket) {
    const user = socket.data?.user;
    console.info('[chat] disconnected', { socketId: socket.id, userId: user?.id, reason: socket.disconnected });
    if (!user) return;
    const sockets = this.userSockets.get(user.id);
    sockets?.delete(socket.id);
    if (sockets?.size === 0) this.userSockets.delete(user.id);
    for (const joinedRoom of socket.rooms) {
      if (joinedRoom.startsWith('conversation:')) {
        this.server.to(joinedRoom).emit('chat:presence', { userId: user.id, online: false, name: user.name });
      }
    }
  }

  @SubscribeMessage('chat:conversation:join')
  async join(@ConnectedSocket() socket: ChatSocket, @MessageBody() body: { conversationId: string }) {
    if (!socket.data?.user) {
      socket.emit('chat:connection', { status: 'unauthorized' });
      socket.disconnect(true);
      return;
    }
    const conversation = await this.chat.authorizeConversation(socket.data.user, body.conversationId);
    await socket.join(conversationRoom(conversation.id));
    await this.chat.markConversationRead(socket.data.user, conversation.id);
    socket.emit('chat:conversation:joined', { conversationId: conversation.id });
    this.server.to(conversationRoom(conversation.id)).emit('chat:presence', { userId: socket.data.user.id, online: true, name: socket.data.user.name });
    this.emitUnread(socket.data.user);
  }

  @SubscribeMessage('chat:message')
  @SubscribeMessage('chat:message:send')
  async message(@ConnectedSocket() socket: ChatSocket, @MessageBody() body: { conversationId?: string; content?: string }) {
    console.info('[chat] SEND MESSAGE HANDLER CALLED');
    try {
      console.info('[chat] payload', body);
      console.info('[chat] receive message', { userId: socket.data?.user?.id, conversationId: body?.conversationId, contentLength: body?.content?.length ?? 0 });
      if (!socket.data?.user) {
        return { success: false, error: 'Unauthorized socket user.' };
      }
      if (!body || typeof body.conversationId !== 'string' || typeof body.content !== 'string') {
        return { success: false, error: 'Invalid message payload.' };
      }
      const normalized = body.content.trim();
      if (!normalized || normalized.length > 4000) {
        return { success: false, error: 'Message content is invalid.' };
      }
      const result = await this.chat.createMessage(socket.data.user, body.conversationId, normalized);
      console.info('[chat] message created', { messageId: result.message.id, conversationId: result.message.conversationId, senderId: socket.data.user.id });
      const event = { ...result.message, createdAt: result.message.createdAt.toISOString() };
      try {
        await this.notifyRecipientIfAway(result.recipientId, socket.data.user, result.message.conversationId);
      } catch (error) {
        console.error('[chat] notification failed after message persisted', error);
      }
      this.server.to(conversationRoom(result.message.conversationId)).emit('chat:message:new', event);
      this.server.to(conversationRoom(result.message.conversationId)).emit('chat:conversation:updated', { conversationId: result.message.conversationId, lastMessage: event });
      this.emitUnread(socket.data.user);
      if (result.recipientId && result.recipientId !== socket.data.user.id) void this.emitUnreadForUserId(result.recipientId);
      console.info('[chat] emitting message', { conversationId: result.message.conversationId, messageId: result.message.id });
      return { success: true, message: event };
    } catch (error) {
      console.error('[chat] message failed', error);
      return { success: false, error: error instanceof Error ? error.message : 'Message could not be sent' };
    }
  }

  @SubscribeMessage('chat:message:read')
  async read(@ConnectedSocket() socket: ChatSocket, @MessageBody() body: { conversationId: string }) {
    if (!socket.data?.user) {
      socket.emit('chat:connection', { status: 'unauthorized' });
      socket.disconnect(true);
      return;
    }
    await this.chat.markConversationRead(socket.data.user, body.conversationId);
    this.server.to(conversationRoom(body.conversationId)).emit('chat:message:read', { conversationId: body.conversationId, userId: socket.data.user.id });
    this.emitUnread(socket.data.user);
  }

  @SubscribeMessage('chat:typing:start')
  async typingStart(@ConnectedSocket() socket: ChatSocket, @MessageBody() body: { conversationId: string }) {
    if (!socket.data?.user) return;
    await this.chat.authorizeConversation(socket.data.user, body.conversationId);
    socket.to(conversationRoom(body.conversationId)).emit('chat:typing:start', { conversationId: body.conversationId, userId: socket.data.user.id, name: socket.data.user.name });
  }

  @SubscribeMessage('chat:typing:stop')
  async typingStop(@ConnectedSocket() socket: ChatSocket, @MessageBody() body: { conversationId: string }) {
    if (!socket.data?.user) return;
    await this.chat.authorizeConversation(socket.data.user, body.conversationId);
    socket.to(conversationRoom(body.conversationId)).emit('chat:typing:stop', { conversationId: body.conversationId, userId: socket.data.user.id });
  }

  private emitUnread(user: ChatUser) {
    void this.chat.unreadCount(user).then((payload) => {
      const socketMap = (this.server.sockets as unknown as { sockets?: Map<string, ChatSocket> }).sockets;
      if (!socketMap) return;
      socketMap.forEach((socket) => {
        if (socket.data.user?.id === user.id) socket.emit('chat:unread-count', payload);
      });
    });
  }

  private async emitUnreadForUserId(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, name: true } });
    if (user) this.emitUnread(user);
  }

  private async notifyRecipientIfAway(recipientId: string | null, sender: ChatUser, conversationId: string) {
    if (!recipientId || this.isViewing(recipientId, conversationId)) return;
    if (sender.role === UserRole.CLIENT) {
      await this.notifications.createForAdmins({ type: 'NEW_CHAT_MESSAGE', title: 'Nouveau message client', message: `${sender.name ?? 'Un client'} vous a envoyé un message.`, actionLabel: 'Ouvrir la conversation', actionUrl: `/admin/chat/${conversationId}`, metadata: { conversationId } });
    } else {
      await this.notifications.createForUser(recipientId, { type: 'NEW_CHAT_MESSAGE', title: 'Nouveau message du support', message: 'L’administration vous a répondu.', actionLabel: 'Ouvrir les messages', actionUrl: '/client/chat', metadata: { conversationId } });
    }
  }

  private isViewing(userId: string, conversationId: string) {
    const sockets = this.userSockets.get(userId);
    const roomSockets = this.server.sockets.adapter.rooms.get(conversationRoom(conversationId));
    return Boolean(sockets && roomSockets && [...roomSockets].some((id) => sockets.has(id)));
  }

  private readToken(socket: Socket) {
    const auth = socket.handshake.auth?.token as string | undefined;
    if (auth) return auth.replace(/^Bearer\s+/i, '');
    const header = socket.handshake.headers.authorization;
    if (header) return header.replace(/^Bearer\s+/i, '');
    throw new Error('MISSING_TOKEN');
  }
}
