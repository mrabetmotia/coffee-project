import { io, type Socket } from 'socket.io-client';
import { getApiBase, getToken } from '@/lib/api';

let socket: Socket | null = null;

type ChatSocket = Socket & { cafestockAuthenticated?: boolean };

export function getChatSocket() {
  if (!socket) {
    const origin = getApiBase().replace(/\/api\/?$/, '');
    socket = io(`${origin}/chat`, {
      autoConnect: false,
      transports: ['websocket'],
      auth: { token: getToken() },
    }) as ChatSocket;
  }
  return socket;
}

export function refreshChatSocketAuth() {
  if (socket) socket.auth = { token: getToken() };
}

export function isChatAuthenticated() {
  return Boolean((socket as ChatSocket | null)?.cafestockAuthenticated);
}