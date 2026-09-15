import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, CheckCheck, CircleAlert, CircleCheck, Clock3, Info, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type BackendNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  createdAt: string;
  readAt: string | null;
  actionLabel?: string | null;
  actionUrl?: string | null;
};

function relativeTime(value: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return 'À l’instant';
  if (minutes < 60) return `Il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Il y a ${hours} h`;
  return `Il y a ${Math.round(hours / 24)} j`;
}

function notificationIcon(type: string) {
  if (type.includes('REJECT') || type.includes('CANCEL') || type === 'error') return { Icon: X, tone: 'bg-destructive/10 text-destructive' };
  if (type.includes('ACCEPT') || type.includes('COMPLET') || type === 'success') return { Icon: CircleCheck, tone: 'bg-emerald-500/10 text-emerald-600' };
  if (type.includes('NEW') || type.includes('CREATED') || type.includes('PENDING')) return { Icon: Clock3, tone: 'bg-amber-500/10 text-amber-600' };
  if (type === 'warning') return { Icon: CircleAlert, tone: 'bg-amber-500/10 text-amber-600' };
  return { Icon: Info, tone: 'bg-primary/10 text-primary' };
}

export function useBackendNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => api<BackendNotification[]>('/notifications'),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function NotificationCenter() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data = [] } = useBackendNotifications();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, right: 16 });
  const unreadCount = useMemo(() => data.filter((item) => !item.readAt).length, [data]);

  useEffect(() => {
    if (!open) return;
    const update = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect) setPosition({ top: Math.max(12, rect.bottom + 10), right: Math.max(12, window.innerWidth - rect.right) });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!(event.target instanceof Node)) return;
      if (!triggerRef.current?.contains(event.target) && !popoverRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const readMutation = useMutation({
    mutationFn: (id: string) => api(`/notifications/${id}/read`, { method: 'PATCH' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const readAllMutation = useMutation({
    mutationFn: () => api('/notifications/read-all', { method: 'PATCH' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  function openNotification(notification: BackendNotification) {
    if (!notification.readAt) readMutation.mutate(notification.id);
    setOpen(false);
    if (notification.actionUrl?.startsWith('/')) navigate(notification.actionUrl);
  }

  return (
    <>
      <button ref={triggerRef} type="button" onClick={() => setOpen((value) => !value)} className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" aria-label="Notifications" aria-expanded={open}>
        <Bell className="h-4 w-4" />
        {unreadCount > 0 ? <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">{unreadCount > 9 ? '9+' : unreadCount}</span> : null}
      </button>
      {open ? createPortal(
        <div ref={popoverRef} style={{ top: position.top, right: position.right }} className="fixed z-[999999] w-[min(420px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div><p className="text-sm font-semibold">Notifications</p><p className="text-xs text-muted-foreground">Vos alertes et mises à jour</p></div>
            <Button type="button" variant="ghost" size="sm" disabled={!unreadCount || readAllMutation.isPending} onClick={() => readAllMutation.mutate()}><CheckCheck className="mr-1.5 h-3.5 w-3.5" />Tout lire</Button>
          </div>
          <div className="max-h-[min(520px,70vh)] overflow-auto">
            {!data.length ? <div className="px-6 py-12 text-center"><Bell className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" /><p className="text-sm font-medium">Aucune notification</p><p className="mt-1 text-xs text-muted-foreground">Vous êtes à jour.</p></div> : data.map((notification) => {
              const { Icon, tone } = notificationIcon(notification.type);
              return <button key={notification.id} type="button" onClick={() => openNotification(notification)} className={cn('flex w-full gap-3 border-b border-border/70 px-4 py-3 text-left transition-colors hover:bg-muted/60', !notification.readAt && 'bg-primary/5')}>
                <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full', tone)}><Icon className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1"><span className="flex items-start justify-between gap-2"><span className={cn('text-sm', !notification.readAt ? 'font-semibold' : 'font-medium')}>{notification.title}</span><span className="shrink-0 text-[10px] text-muted-foreground">{relativeTime(notification.createdAt)}</span></span><span className="mt-1 block text-sm text-muted-foreground">{notification.message}</span>{notification.actionLabel ? <span className="mt-2 block text-xs font-semibold text-primary">{notification.actionLabel} →</span> : null}</span>
              </button>;
            })}
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  );
}

export function NotificationRow({ notification, onRead }: { notification: BackendNotification; onRead: (notification: BackendNotification) => void }) {
  const { Icon, tone } = notificationIcon(notification.type);
  return <button type="button" onClick={() => onRead(notification)} className={cn('flex w-full gap-3 rounded-xl p-4 text-left transition-colors hover:bg-muted/60', !notification.readAt && 'bg-primary/5')}><span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', tone)}><Icon className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="flex justify-between gap-3"><span className={cn('text-sm', !notification.readAt ? 'font-semibold' : 'font-medium')}>{notification.title}</span><span className="shrink-0 text-xs text-muted-foreground">{relativeTime(notification.createdAt)}</span></span><span className="mt-1 block text-sm text-muted-foreground">{notification.message}</span></span></button>;
}
