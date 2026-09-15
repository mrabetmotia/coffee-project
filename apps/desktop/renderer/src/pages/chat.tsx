import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, CheckCheck, MessageCircle, Search, Send, Wifi, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { api, getCurrentRole } from '@/lib/api';
import { getChatSocket, isChatAuthenticated, refreshChatSocketAuth } from '@/lib/chat';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminChatView, ClientChatView } from '@/components/chat-ui';
import { cn } from '@/lib/utils';

type User = { id: string; name: string | null; role: 'ADMIN' | 'CLIENT' };
type Message = { id: string; conversationId: string; senderId: string; content: string; createdAt: string; readAt: string | null; sender: User };
type Conversation = { id: string; status: string; lastMessageAt: string | null; client: { name: string; email: string | null; user: { id: string; name: string | null; isActive?: boolean } | null }; lastMessage: Message | null; unreadCount: number };
const SEND_EVENT = 'chat:message';

function useChatConversation(conversationId: string | undefined) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [connected, setConnected] = useState(false);
  const [typing, setTyping] = useState(false);
  const [presence, setPresence] = useState(false);
  const [sending, setSending] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [content, setContent] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const authenticatedRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const socket = getChatSocket();

  useEffect(() => {
    if (!conversationId) return;
    let active = true;
    setMessages([]);
    setMessagesLoading(true);

    const loadMessages = async () => {
      try {
        const result = await api<{ items: Message[]; nextCursor: string | null }>(`/chat/conversations/${conversationId}/messages`);
        if (active) setMessages(result.items);
      } catch (error) {
        console.error('[chat] load messages error', error);
        if (active) toast.error('Impossible de charger les messages.');
      } finally {
        if (active) setMessagesLoading(false);
      }
    };

    void loadMessages();
    refreshChatSocketAuth();

    const onConnect = () => {
      console.info('[chat] connected socketId=', socket.id);
      setConnected(true);
      if (authenticatedRef.current || isChatAuthenticated()) {
        authenticatedRef.current = true;
        setAuthenticated(true);
        socket.emit('chat:conversation:join', { conversationId });
      }
    };
    const onDisconnect = (reason: string) => {
      console.warn('[chat] disconnected reason=', reason);
      setConnected(false);
      setAuthenticated(false);
      authenticatedRef.current = false;
    };
    const onConnectError = (error: Error) => {
      console.error('[chat] connect_error', error.message);
      setConnected(false);
      setAuthenticated(false);
      setSendError('Connexion au support impossible.');
    };
    const onChatConnection = (payload: { status: 'connected' | 'unauthorized'; reason?: string }) => {
      if (payload.status !== 'connected') {
        setAuthenticated(false);
        authenticatedRef.current = false;
        setSendError(payload.reason ?? 'Connexion au support impossible.');
        return;
      }
      console.info('[chat] authenticated');
      (socket as typeof socket & { cafestockAuthenticated?: boolean }).cafestockAuthenticated = true;
      setAuthenticated(true);
      authenticatedRef.current = true;
      socket.emit('chat:conversation:join', { conversationId });
    };
    const onNewMessage = (message: Message) => {
      if (message.conversationId === conversationId) {
        setMessages((current) => (current.some((item) => item.id === message.id) ? current : [...current, message]));
        void queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
      }
    };
    const onTyping = (payload: { conversationId: string; userId: string }) => {
      if (payload.conversationId === conversationId && payload.userId !== getCurrentUserId()) setTyping(true);
    };
    const onTypingStop = (payload: { conversationId: string }) => {
      if (payload.conversationId === conversationId) setTyping(false);
    };
    const onPresence = (payload: { userId: string; online: boolean }) => {
      if (payload.userId !== getCurrentUserId()) setPresence(payload.online);
    };

    socket.on('connect', onConnect).on('disconnect', onDisconnect).on('connect_error', onConnectError).on('chat:connection', onChatConnection).on('chat:message:new', onNewMessage).on('chat:typing:start', onTyping).on('chat:typing:stop', onTypingStop).on('chat:presence', onPresence);

    if (!socket.connected) {
      console.info('[chat] connecting');
      socket.connect();
    } else {
      onConnect();
    }

    void api(`/chat/conversations/${conversationId}/read`, { method: 'PATCH' }).catch((error) => {
      console.error('[chat] mark read error', error);
    });

    return () => {
      active = false;
      socket.off('connect', onConnect).off('disconnect', onDisconnect).off('connect_error', onConnectError).off('chat:connection', onChatConnection).off('chat:message:new', onNewMessage).off('chat:typing:start', onTyping).off('chat:typing:stop', onTypingStop).off('chat:presence', onPresence);
      setTyping(false);
    };
  }, [conversationId, queryClient, socket]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length, typing]);

  function emitTyping(value: string) {
    setContent(value);
    setSendError(null);
    if (conversationId && socket.connected) {
      socket.emit('chat:typing:start', { conversationId });
      window.clearTimeout((emitTyping as typeof emitTyping & { timer?: number }).timer);
      (emitTyping as typeof emitTyping & { timer?: number }).timer = window.setTimeout(() => socket.emit('chat:typing:stop', { conversationId }), 700);
    }
  }

  async function send(event?: FormEvent) {
    event?.preventDefault();
    const value = content.trim();
    if (!value || !conversationId || sending) return;
    setSending(true);
    setSendError(null);

    try {
      if (!socket.connected || !authenticated) {
        console.info('[chat] reconnecting before send');
        if (!socket.connected) socket.connect();
        throw new Error('Connexion au support en cours, réessayez dans un instant.');
      }

      const response = await new Promise<{ success: boolean; message?: Message; error?: string }>((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error('Socket timeout while sending message')), 15000);
        console.info('[chat] sending message', { event: SEND_EVENT, conversationId, contentLength: value.length });
        socket.emit(SEND_EVENT, { conversationId, content: value }, (ack: { success?: boolean; message?: Message; error?: string } | undefined) => {
          window.clearTimeout(timeout);
          console.info('[chat] send acknowledgement', ack);
          if (!ack || ack.success === false) {
            resolve({ success: false, error: ack?.error ?? 'Message could not be sent' });
            return;
          }
          resolve({ success: true, message: ack.message });
        });
      });

      if (!response.success) {
        throw new Error(response.error ?? 'Message could not be sent');
      }

      setContent('');
      socket.emit('chat:typing:stop', { conversationId });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Message could not be sent';
      console.error('[chat] send failed', error);
      setSendError(message);
      toast.error(message);
    } finally {
      setSending(false);
    }
  }

  return { messages, messagesLoading, connected, typing, presence, content, sending, sendError, bottomRef, emitTyping, send };
}

function getCurrentUserId() { try { const raw = localStorage.getItem('cafestock-user'); return raw ? (JSON.parse(raw) as { id?: string }).id : undefined; } catch { return undefined; } }

export function ClientChatPage() {
  const { data: conversation, isLoading } = useQuery({ queryKey: ['client-chat-conversation'], queryFn: () => api<Conversation>('/chat/conversations', { method: 'POST' }) });
  const chat = useChatConversation(conversation?.id);
  if (isLoading || !conversation) return <ChatLoading />;
  return <ClientChatView chat={chat} />;
}

export function AdminChatPage() {
  const { conversationId } = useParams(); const navigate = useNavigate(); const [query, setQuery] = useState('');
  const { data: conversations = [], isLoading } = useQuery({ queryKey: ['chat-conversations'], queryFn: () => api<Conversation[]>('/chat/conversations'), refetchInterval: false });
  const filtered = conversations.filter((item) => !query || item.client.name.toLowerCase().includes(query.toLowerCase()) || item.lastMessage?.content.toLowerCase().includes(query.toLowerCase()));
  const selected = conversations.find((item) => item.id === conversationId) ?? filtered[0];
  const chat = useChatConversation(selected?.id);
  return <AdminChatView conversations={filtered} selected={selected} query={query} onQueryChange={setQuery} onSelect={(id) => navigate(`/admin/chat/${id}`)} onBack={() => navigate('/admin/chat')} chat={chat} isLoading={isLoading} />;
  return <div className="space-y-6"><PageHeader title="Messages" subtitle="Centre de support client." /><div className="grid min-h-[650px] overflow-hidden rounded-2xl border bg-card shadow-sm lg:grid-cols-[320px_1fr]"><aside className={cn('border-r bg-muted/15', selected && 'hidden lg:block')}><div className="border-b p-4"><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un client" /></div><p className="mt-3 text-xs text-muted-foreground">{conversations.reduce((sum, item) => sum + item.unreadCount, 0)} message(s) non lu(s)</p></div><div className="divide-y divide-border/60">{isLoading ? <p className="p-5 text-sm text-muted-foreground">Chargement…</p> : !filtered.length ? <p className="p-5 text-sm text-muted-foreground">Aucune conversation.</p> : filtered.map((item) => <button key={item.id} type="button" onClick={() => navigate(`/admin/chat/${item.id}`)} className={cn('w-full p-4 text-left transition-colors hover:bg-muted/50', selected?.id === item.id && 'bg-primary/5')}><div className="flex items-center justify-between gap-2"><span className="truncate font-semibold">{item.client.name}</span>{item.unreadCount ? <Badge variant="destructive">{item.unreadCount}</Badge> : null}</div><p className="mt-1 truncate text-sm text-muted-foreground">{item.lastMessage?.content ?? 'Conversation vide'}</p><p className="mt-2 text-[11px] text-muted-foreground">{item.lastMessageAt ? new Date(item.lastMessageAt).toLocaleString('fr-FR') : 'Aucun message'}</p></button>)}</div></aside><main className={cn('min-w-0', !selected && 'hidden lg:block')}>{selected ? <><div className="flex items-center gap-3 border-b p-4"><Button className="lg:hidden" size="icon" variant="ghost" onClick={() => navigate('/admin/chat')}><ArrowLeft className="h-4 w-4" /></Button><div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">{selected.client.name.slice(0, 2).toUpperCase()}</div><div><h2 className="font-semibold">{selected.client.name}</h2><p className="flex items-center gap-1 text-xs text-muted-foreground"><span className={cn('h-2 w-2 rounded-full', chat.presence ? 'bg-emerald-500' : 'bg-muted-foreground/40')} />{chat.presence ? 'En ligne' : 'Hors ligne'}</p></div></div><ChatWindow title="" subtitle="" online={chat.presence} messages={chat.messages} messagesLoading={chat.messagesLoading} currentUserId={getCurrentUserId()} typing={chat.typing} connected={chat.connected} content={chat.content} sending={chat.sending} bottomRef={chat.bottomRef} onChange={chat.emitTyping} onSubmit={chat.send} compact /></> : <div className="flex h-full min-h-[600px] flex-col items-center justify-center p-8 text-center"><MessageCircle className="mb-4 h-12 w-12 text-muted-foreground/40" /><h2 className="font-semibold">Sélectionnez une conversation</h2><p className="mt-1 text-sm text-muted-foreground">Les conversations clients apparaîtront ici.</p></div>}</main></div></div>;
}

function ChatMessagesSkeleton() {
  return <div className="space-y-4"><Skeleton className="ml-auto h-14 w-2/3 rounded-2xl" /><Skeleton className="h-12 w-1/2 rounded-2xl" /><Skeleton className="ml-auto h-20 w-3/5 rounded-2xl" /></div>;
}

function ChatWindow({ title, subtitle, online, messages, messagesLoading, currentUserId, typing, connected, content, sending, bottomRef, onChange, onSubmit, compact }: { title: string; subtitle: string; online: boolean; messages: Message[]; messagesLoading: boolean; currentUserId?: string; typing: boolean; connected: boolean; content: string; sending: boolean; bottomRef: React.RefObject<HTMLDivElement | null>; onChange: (value: string) => void; onSubmit: (event?: FormEvent) => void; compact?: boolean }) {
  return <section className={cn('flex min-h-[590px] flex-col bg-card', !compact && 'overflow-hidden rounded-2xl border shadow-sm')}><>{title ? <div className="flex items-center gap-3 border-b p-4"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary"><MessageCircle className="h-5 w-5" /></div><div><h2 className="font-semibold">{title}</h2><p className="text-xs text-muted-foreground">{subtitle}</p></div><span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground"><span className={cn('h-2 w-2 rounded-full', online ? 'bg-emerald-500' : 'bg-muted-foreground/40')} />{online ? 'En ligne' : 'Hors ligne'}</span></div> : null}</><div className="flex-1 space-y-3 overflow-auto p-5">{messagesLoading ? <ChatMessagesSkeleton /> : !messages.length ? <div className="flex h-full min-h-[360px] flex-col items-center justify-center text-center"><MessageCircle className="mb-3 h-10 w-10 text-muted-foreground/40" /><p className="font-medium">Commencez la conversation</p><p className="mt-1 text-sm text-muted-foreground">Écrivez votre message à l’équipe support.</p></div> : messages.map((message) => { const mine = message.senderId === currentUserId; return <div key={message.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}><div className={cn('max-w-[82%] rounded-2xl px-4 py-3 text-sm', mine ? 'rounded-br-md bg-primary text-primary-foreground' : 'rounded-bl-md bg-muted')}><p className="whitespace-pre-wrap">{message.content}</p><div className={cn('mt-1.5 flex items-center justify-end gap-1 text-[10px]', mine ? 'text-primary-foreground/70' : 'text-muted-foreground')}><span>{new Date(message.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>{mine ? message.readAt ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" /> : null}</div></div></div>; })}{typing ? <p className="text-xs italic text-muted-foreground">{getCurrentRole() === 'ADMIN' ? 'Le client écrit…' : 'Le support écrit…'}</p> : null}<div ref={bottomRef} /></div><div className="border-t p-4"><div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">{connected ? <><Wifi className="h-3.5 w-3.5 text-emerald-600" />Connecté</> : <><WifiOff className="h-3.5 w-3.5 text-amber-600" />Reconnexion…</>}</div><form onSubmit={onSubmit} className="flex items-end gap-2"><textarea value={content} onChange={(event) => onChange(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); onSubmit(); } }} placeholder="Écrivez votre message…" rows={2} className="min-h-10 flex-1 resize-none rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30" /><Button type="submit" size="icon" disabled={sending || !content.trim()} aria-label="Envoyer"><Send className="h-4 w-4" /></Button></form><p className="mt-2 text-[11px] text-muted-foreground">Entrée pour envoyer · Maj + Entrée pour une nouvelle ligne</p></div></section>;
}

function ChatLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="grid min-h-[650px] overflow-hidden rounded-2xl border bg-card shadow-sm lg:grid-cols-[320px_1fr]">
        <aside className="hidden border-r bg-muted/15 lg:block">
          <div className="border-b p-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="mt-3 h-3 w-28" />
          </div>
          <div className="space-y-4 p-4">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-20" />
              </div>
            ))}
          </div>
        </aside>
        <section className="flex min-h-[650px] flex-col">
          <div className="flex items-center gap-3 border-b p-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <div className="flex-1 space-y-5 p-5">
            <Skeleton className="ml-auto h-14 w-2/3 rounded-2xl" />
            <Skeleton className="h-12 w-1/2 rounded-2xl" />
            <Skeleton className="ml-auto h-20 w-3/5 rounded-2xl" />
          </div>
          <div className="border-t p-4">
            <div className="flex items-end gap-2">
              <Skeleton className="h-14 flex-1 rounded-xl" />
              <Skeleton className="h-10 w-10 rounded-xl" />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}