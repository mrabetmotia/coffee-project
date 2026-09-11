import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Bell,
  CheckCheck,
  Download,
  Info,
  PackageOpen,
  RefreshCcw,
  TriangleAlert,
  X,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useLanguage } from '@/lib/i18n';
import {
  addNotification,
  getNotifications,
  markAllAsRead as markAllAsReadLocal,
  markAsRead,
  removeNotification,
  updateNotification,
  useNotifications,
  type AppNotification,
} from '@/lib/notifications';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const formatRelativeTime = (value: number) => {
  const diffMs = Date.now() - value;
  const diffMin = Math.max(0, Math.round(diffMs / 60000));

  if (diffMin < 1) return 'À l’instant';
  if (diffMin < 60) return `Il y a ${diffMin} min`;

  const diffHours = Math.round(diffMin / 60);
  if (diffHours < 24) return `Il y a ${diffHours} h`;

  const diffDays = Math.round(diffHours / 24);
  return `Il y a ${diffDays} j`;
};

const notificationPalette: Record<AppNotification['type'], string> = {
  low_stock: 'text-rose-500 bg-rose-500/10',
  update_available: 'text-blue-500 bg-blue-500/10',
  update_downloading: 'text-amber-500 bg-amber-500/10',
  update_ready: 'text-emerald-500 bg-emerald-500/10',
  info: 'text-sky-500 bg-sky-500/10',
  success: 'text-emerald-500 bg-emerald-500/10',
  warning: 'text-amber-500 bg-amber-500/10',
  error: 'text-red-500 bg-red-500/10',
};

function getNotificationIcon(type: AppNotification['type']) {
  switch (type) {
    case 'low_stock':
      return TriangleAlert;
    case 'update_available':
    case 'update_downloading':
      return Download;
    case 'update_ready':
      return CheckCheck;
    case 'info':
      return Info;
    case 'success':
      return CheckCheck;
    case 'warning':
      return TriangleAlert;
    case 'error':
      return X;
    default:
      return Info;
  }
}

type LowStockProduct = {
  id: string;
  name: string;
  currentStock: string;
  minimumStock: string;
};

type BackendNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  createdAt: string;
  readAt: string | null;
  actionLabel?: string | null;
  actionUrl?: string | null;
  persistent?: boolean;
};

export function NotificationCenter() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const notifications = useNotifications();
  const [open, setOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({
    position: 'fixed',
    top: 0,
    right: 16,
    width: 420,
    zIndex: 999999,
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pendingReadRef = useRef(new Set<string>());
  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications],
  );

  useEffect(() => {
    if (!open || !triggerRef.current) return;

    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;

      setPopoverStyle({
        position: 'fixed',
        top: Math.max(12, rect.bottom + 12),
        right: Math.max(12, window.innerWidth - rect.right),
        width: 420,
        zIndex: 999999,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;

      const clickedInsideTrigger = triggerRef.current?.contains(target);
      const clickedInsidePopover = popoverRef.current?.contains(target);

      if (!clickedInsideTrigger && !clickedInsidePopover) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown, { passive: true });

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [open]);

  const persistNotification = async (notification: AppNotification, actionUrl?: string) => {
    const existsLocally = getNotifications().some((item) => item.id === notification.id);
    if (existsLocally) return;

    try {
      await api('/notifications', {
        method: 'POST',
        body: JSON.stringify({
          type: notification.type,
          title: notification.title,
          message: notification.message,
          actionLabel: notification.actionLabel ?? undefined,
          actionUrl: actionUrl ?? undefined,
          persistent: true,
          metadata: actionUrl ? { actionUrl } : undefined,
        }),
      });
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    } catch (error) {
      console.warn('Failed to persist notification', error);
    }
  };

  const { data: persistedNotifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api<BackendNotification[]>('/notifications'),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (!persistedNotifications.length) return;

    persistedNotifications.forEach((notification) => {
      addNotification({
        id: notification.id,
        type: (notification.type as AppNotification['type']) ?? 'info',
        title: notification.title,
        message: notification.message,
        createdAt: new Date(notification.createdAt).getTime() || Date.now(),
        read: Boolean(notification.readAt),
        persistent: Boolean(notification.persistent),
        actionLabel: notification.actionLabel ?? undefined,
        action: notification.actionUrl
          ? () => {
              if (notification.actionUrl?.startsWith('/')) navigate(notification.actionUrl);
            }
          : undefined,
      });
    });
  }, [navigate, persistedNotifications]);

  const markNotificationRead = async (notificationId: string) => {
    if (pendingReadRef.current.has(notificationId)) return;

    const existing = notifications.find((notification) => notification.id === notificationId);
    if (existing?.read) {
      setOpen(false);
      return;
    }

    pendingReadRef.current.add(notificationId);
    updateNotification(notificationId, { read: true });
    queryClient.setQueryData<BackendNotification[] | undefined>(['notifications'], (current) =>
      current?.map((notification) =>
        notification.id === notificationId ? { ...notification, readAt: new Date().toISOString() } : notification,
      ) ?? current,
    );
    setOpen(false);

    try {
      await api(`/notifications/${notificationId}/read`, { method: 'PATCH' });
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    } catch {
      updateNotification(notificationId, { read: false });
      queryClient.setQueryData<BackendNotification[] | undefined>(['notifications'], (current) =>
        current?.map((notification) =>
          notification.id === notificationId ? { ...notification, readAt: null } : notification,
        ) ?? current,
      );
    } finally {
      pendingReadRef.current.delete(notificationId);
    }
  };


  useEffect(() => {
    if (!window.cafestock?.updater) return;

    const dispose = window.cafestock.updater.on((event) => {
      const version = event.version ?? 'unknown';
      const date = Date.now();

      switch (event.type) {
        case 'update-available': {
          const notification: AppNotification = {
            id: 'update-available',
            type: 'update_available',
            title: t('Nouvelle version disponible'),
            message: `CaféStock v${version} est disponible.`,
            createdAt: date,
            read: false,
            actionLabel: t('Mettre à jour'),
            action: async () => {
              const result = await window.cafestock?.updater.download();
              if (!result?.ok) {
                addNotification({
                  id: 'update-error',
                  type: 'error',
                  title: t('Échec de la mise à jour'),
                  message: 'La mise à jour n\'a pas pu être téléchargée. Vous pourrez réessayer plus tard.',
                  createdAt: Date.now(),
                  read: false,
                });
              }
            },
            persistent: true,
          };
          if (!getNotifications().some((item) => item.id === notification.id)) {
            addNotification(notification);
            void persistNotification(notification);
          }
          break;
        }
        case 'download-progress': {
          const notification: AppNotification = {
            id: 'update-downloading',
            type: 'update_downloading',
            title: t('Téléchargement de la mise à jour'),
            message: `CaféStock v${version}`,
            createdAt: date,
            read: false,
            progress: event.progress ?? 0,
            persistent: true,
          };
          updateNotification('update-downloading', {
            id: 'update-downloading',
            type: 'update_downloading',
            title: t('Téléchargement de la mise à jour'),
            message: `CaféStock v${version}`,
            createdAt: date,
            read: false,
            progress: event.progress ?? 0,
          });
          if (!getNotifications().some((item) => item.id === notification.id)) {
            addNotification(notification);
            void persistNotification(notification);
          }
          break;
        }
        case 'update-downloaded': {
          const notification: AppNotification = {
            id: 'update-ready',
            type: 'update_ready',
            title: t('Mise à jour prête'),
            message: `CaféStock v${version} est prêt à être installé.`,
            createdAt: date,
            read: false,
            actionLabel: t('Redémarrer maintenant'),
            action: async () => {
              await window.cafestock?.updater.install();
            },
            persistent: true,
          };
          if (!getNotifications().some((item) => item.id === notification.id)) {
            addNotification(notification);
            void persistNotification(notification);
          }
          removeNotification('update-downloading');
          break;
        }
        case 'update-error': {
          const notification: AppNotification = {
            id: 'update-error',
            type: 'error',
            title: t('Échec de la mise à jour'),
            message: 'La mise à jour n\'a pas pu être téléchargée. Vous pourrez réessayer plus tard.',
            createdAt: date,
            read: false,
            persistent: true,
          };
          if (!getNotifications().some((item) => item.id === notification.id)) {
            addNotification(notification);
            void persistNotification(notification);
          }
          removeNotification('update-downloading');
          break;
        }
        default:
          break;
      }
    });

    return dispose;
  }, [persistNotification, t]);

  return (
    <>
      <div ref={containerRef} className="relative">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label={t('Notifications')}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          ) : null}
        </button>
      </div>

      {open
        ? createPortal(
            <div
              ref={popoverRef}
              style={popoverStyle}
              className="fixed z-[999999] w-[420px] overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div className="text-sm font-semibold">{t('Notifications')}</div>
                <button
                  type="button"
                  onClick={async () => {
                    markAllAsReadLocal();
                    try {
                      await api('/notifications/read-all', { method: 'PATCH' });
                      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
                    } catch (error) {
                      console.warn('Failed to sync all notifications as read', error);
                    }
                  }}
                  className="text-xs font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={unreadCount === 0}
                >
                  {t('Tout lire')}
                </button>
              </div>

              <div className="max-h-[480px] overflow-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">{t('Aucune notification')}</div>
                ) : (
                  notifications.map((notification) => {
                    const Icon = getNotificationIcon(notification.type);
                    const isUnread = !notification.read;

                    return (
                      <div
                        key={notification.id}
                        role="button"
                        tabIndex={0}
                        onClick={async () => {
                          await markNotificationRead(notification.id);
                          if (notification.action) {
                            notification.action();
                          }
                        }}
                        onKeyDown={async (event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            await markNotificationRead(notification.id);
                            if (notification.action) {
                              notification.action();
                            }
                          }
                        }}
                        className={cn(
                          'flex w-full cursor-pointer gap-3 border-b border-border/80 px-4 py-3 text-left transition-colors hover:bg-muted/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          isUnread && 'bg-primary/5',
                        )}
                      >
                        <div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full', notificationPalette[notification.type])}>
                          <Icon className="h-4 w-4" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="text-sm font-semibold text-foreground">{t(notification.title)}</div>
                            <span className="text-[10px] text-muted-foreground">{formatRelativeTime(notification.createdAt)}</span>
                          </div>

                          <p className="mt-1 text-sm text-muted-foreground">{notification.message}</p>

                          {typeof notification.progress === 'number' ? (
                            <div className="mt-3">
                              <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                                <span>{Math.round(notification.progress)}%</span>
                              </div>
                              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, notification.progress))}%` }} />
                              </div>
                            </div>
                          ) : null}

                          {notification.actionLabel ? (
                            <div className="mt-3">
                              <Button
                                type="button"
                                size="sm"
                                variant={notification.type === 'error' ? 'outline' : 'default'}
                                className="h-8 px-3 text-xs"
                                onClick={async (event) => {
                                  event.stopPropagation();
                                  await markNotificationRead(notification.id);
                                  notification.action?.();
                                }}
                              >
                                {t(notification.actionLabel)}
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
