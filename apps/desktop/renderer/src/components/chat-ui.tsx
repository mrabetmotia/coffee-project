import { FormEvent } from 'react';
import { ArrowLeft, Check, CheckCheck, MoreHorizontal, Search, Send, Wifi, WifiOff } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type ChatUser = { id: string; name: string | null; role: 'ADMIN' | 'CLIENT' };
export type ChatMessage = { id: string; conversationId: string; senderId: string; content: string; createdAt: string; readAt: string | null; sender: ChatUser };
export type ChatConversation = { id: string; status: string; lastMessageAt: string | null; client: { name: string; email: string | null; user: { id: string; name: string | null; isActive?: boolean } | null }; lastMessage: ChatMessage | null; unreadCount: number };

type ChatState = {
  messages: ChatMessage[];
  messagesLoading: boolean;
  connected: boolean;
  typing: boolean;
  presence: boolean;
  content: string;
  sending: boolean;
  sendError: string | null;
  bottomRef: React.RefObject<HTMLDivElement | null>;
  emitTyping: (value: string) => void;
  send: (event?: FormEvent) => void;
};

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'CL';
}

function relativeTime(value: string | null, t: (value: string) => string) {
  if (!value) return t('Aucun message');
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return t('À l’instant');
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  return `${days} j`;
}

function Avatar({ name, online = false, large = false }: { name: string; online?: boolean; large?: boolean }) {
  return <div className="relative shrink-0"><div className={cn('flex items-center justify-center rounded-xl bg-primary/10 font-semibold text-primary', large ? 'h-11 w-11 text-sm' : 'h-9 w-9 text-xs')}>{initials(name)}</div>{online ? <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-emerald-500" /> : null}</div>;
}

function ConnectionStatus({ connected, t }: { connected: boolean; t: (value: string) => string }) {
  return <span className={cn('inline-flex items-center gap-1.5 text-xs', connected ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400')}>{connected ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}{connected ? t('Connecté') : t('Reconnexion…')}</span>;
}

function MessageThread({ chat, t }: { chat: ChatState; t: (value: string) => string }) {
  const currentUserId = (() => { try { const raw = localStorage.getItem('cafestock-user'); return raw ? (JSON.parse(raw) as { id?: string }).id : undefined; } catch { return undefined; } })();
  return <div className="flex min-h-0 flex-1 flex-col"><div className="min-h-0 max-h-[380px] flex-1 space-y-4 overflow-y-auto px-5 py-6 sm:px-7">{chat.messagesLoading ? <div className="space-y-4"><Skeleton className="ml-auto h-16 w-[68%] rounded-2xl" /><Skeleton className="h-14 w-[54%] rounded-2xl" /><Skeleton className="ml-auto h-20 w-[60%] rounded-2xl" /></div> : !chat.messages.length ? <div className="flex min-h-[360px] flex-col items-center justify-center text-center"><div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Send className="h-6 w-6" /></div><h3 className="text-lg font-semibold">{t('How can we help you?')}</h3><p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{t('Send us a message and our support team will get back to you.')}</p></div> : chat.messages.map((message, index) => { const mine = message.senderId === currentUserId; const previous = chat.messages[index - 1]; const grouped = previous?.senderId === message.senderId; return <div key={message.id} className={cn('flex items-end gap-3', mine ? 'justify-end' : 'justify-start', grouped && 'mt-[-8px]')}><div className={cn('max-w-[min(680px,82%)]', mine ? 'items-end' : 'items-start')}><div className={cn('border px-4 py-3 text-sm leading-6 shadow-sm', mine ? 'rounded-2xl rounded-br-md border-primary bg-primary text-primary-foreground' : 'rounded-2xl rounded-bl-md border-border/70 bg-muted/50 text-foreground')}><p className="whitespace-pre-wrap break-words">{message.content}</p></div><div className={cn('mt-1 flex items-center gap-1.5 px-1 text-[10px] text-muted-foreground', mine ? 'justify-end' : 'justify-start')}><span>{new Date(message.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>{mine ? message.readAt ? <CheckCheck className="h-3 w-3 text-primary" /> : <Check className="h-3 w-3" /> : null}</div></div></div>; })}{chat.typing ? <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="flex gap-1 rounded-full bg-muted px-3 py-2"><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" /><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:150ms]" /><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:300ms]" /></span>{t('Typing…')}</div> : null}<div ref={chat.bottomRef} /></div><div className="border-t border-border/70 bg-card/95 px-4 py-4 backdrop-blur sm:px-6"><div className="mb-2 flex items-center justify-between"><ConnectionStatus connected={chat.connected} t={t} />{chat.sending ? <span className="text-xs text-muted-foreground">{t('Sending…')}</span> : null}</div>{chat.sendError ? <p className="mb-2 text-xs text-destructive">{chat.sendError}</p> : null}<form onSubmit={chat.send} className="flex items-end gap-2 rounded-2xl border border-input bg-background p-2 shadow-sm focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20"><textarea value={chat.content} onChange={(event) => chat.emitTyping(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); chat.send(); } }} rows={1} placeholder={t('Write a message…')} className="max-h-32 min-h-11 flex-1 resize-none bg-transparent px-2 py-2.5 text-sm outline-none placeholder:text-muted-foreground" disabled={chat.sending} /><Button type="submit" size="icon" disabled={chat.sending || !chat.content.trim() || !chat.connected} aria-label={t('Send')} title={t('Send')}><Send className="h-4 w-4" /></Button></form><p className="mt-2 px-1 text-[10px] text-muted-foreground">{t('Enter to send · Shift + Enter for a new line')}</p></div></div>;
}

export function ClientChatView({ chat }: { chat: ChatState }) {
  const { t } = useLanguage();
  return <div className="space-y-5"><section className="flex min-h-[calc(100vh-220px)] flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm"><header className="flex items-center gap-3 border-b border-border/70 px-5 py-4 sm:px-6"><Avatar name="CaféStock Support" online={chat.presence} large /><div className="min-w-0"><h2 className="font-semibold">{t('CaféStock Support')}</h2><p className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className={cn('h-2 w-2 rounded-full', chat.presence ? 'bg-emerald-500' : 'bg-muted-foreground/40')} />{chat.presence ? t('Online') : t('Offline')}</p></div><MoreHorizontal className="ml-auto h-5 w-5 text-muted-foreground" /></header><MessageThread chat={chat} t={t} /></section></div>;
}

export function AdminChatView({ conversations, selected, query, onQueryChange, onSelect, onBack, chat, isLoading }: { conversations: ChatConversation[]; selected?: ChatConversation; query: string; onQueryChange: (value: string) => void; onSelect: (id: string) => void; onBack: () => void; chat: ChatState; isLoading: boolean }) {
  const { t } = useLanguage();
  return <div className="space-y-5"><section className="grid min-h-[calc(100vh-220px)] overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm lg:grid-cols-[310px_minmax(0,1fr)]"><aside className={cn('border-r border-border/70 bg-muted/10', selected && 'hidden lg:block')}><div className="border-b border-border/70 p-4"><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder={t('Search conversations')} className="pl-9" /></div><p className="mt-3 text-xs text-muted-foreground">{conversations.length} {t('conversations')}</p></div><div className="divide-y divide-border/60">{isLoading ? <div className="space-y-4 p-4">{[1, 2, 3, 4].map((item) => <div key={item} className="flex gap-3"><Skeleton className="h-9 w-9 rounded-xl" /><div className="flex-1 space-y-2"><Skeleton className="h-3 w-28" /><Skeleton className="h-3 w-full" /></div></div>)}</div> : conversations.length ? conversations.map((conversation) => <button key={conversation.id} type="button" onClick={() => onSelect(conversation.id)} className={cn('flex w-full gap-3 p-4 text-left transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary', selected?.id === conversation.id && 'bg-primary/[0.07]')}><Avatar name={conversation.client.name} online={Boolean(conversation.client.user?.isActive)} /><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="truncate text-sm font-semibold">{conversation.client.name}</span>{conversation.unreadCount ? <Badge variant="destructive" className="ml-auto shrink-0 px-1.5 py-0.5">{conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}</Badge> : null}</div><div className="mt-1 flex items-center gap-2"><p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{conversation.lastMessage?.content ?? t('No messages yet')}</p><span className="shrink-0 text-[10px] text-muted-foreground">{relativeTime(conversation.lastMessageAt, t)}</span></div></div></button>) : <div className="p-8 text-center"><p className="text-sm font-medium">{query ? t('No conversations found') : t('No conversations yet')}</p><p className="mt-1 text-xs text-muted-foreground">{t('Customer conversations will appear here.')}</p></div>}</div></aside><main className={cn('flex min-w-0 flex-col', !selected && 'hidden lg:flex')}>{selected ? <><header className="flex items-center gap-3 border-b border-border/70 px-5 py-4 sm:px-6"><Button className="lg:hidden" size="icon" variant="ghost" onClick={onBack} aria-label={t('Back')}><ArrowLeft className="h-4 w-4" /></Button><Avatar name={selected.client.name} online={chat.presence} large /><div className="min-w-0 flex-1"><h2 className="truncate font-semibold">{selected.client.name}</h2><p className="truncate text-xs text-muted-foreground">{chat.presence ? t('Online now') : selected.client.email ?? t('Offline')}</p></div><Button size="icon" variant="ghost" aria-label={t('More actions')} title={t('More actions')}><MoreHorizontal className="h-5 w-5" /></Button></header><MessageThread chat={chat} t={t} /></> : <div className="flex min-h-[520px] flex-col items-center justify-center p-8 text-center"><div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Search className="h-6 w-6" /></div><h2 className="font-semibold">{t('Select a conversation')}</h2><p className="mt-1 max-w-xs text-sm text-muted-foreground">{t('Choose a customer to view the conversation.')}</p></div>}</main></section></div>;
}
