import { useEffect, useMemo, useRef, useState } from 'react';
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
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useLanguage } from '@/lib/i18n';
import {
  addNotification,
  getNotifications,
  markAllAsRead,
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

export function NotificationCenter() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const notifications = useNotifications();
  const [open, setOpen] = useState(false);
  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications],
  );

  const { data: lowStockData = [] } = useQuery({
    queryKey: ['low-stock-notifications'],
    queryFn: () => api<LowStockProduct[]>('/stock/low'),
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (!lowStockData.length) {
      const stale = getNotifications().filter((notification) => notification.id.startsWith('low-stock-'));
      stale.forEach((notification) => removeNotification(notification.id));
      return;
    }

    const activeIds = new Set(lowStockData.map((product) => `low-stock-${product.id}`));

    lowStockData.forEach((product) => {
      const id = `low-stock-${product.id}`;
      const current = Number(product.currentStock ?? 0);
      const minimum = Number(product.minimumStock ?? 0);
      addNotification({
        id,
        type: 'low_stock',
        title: t('Stock faible'),
        message: `${product.name} — ${t('Stock actuel')}: ${current} / ${t('Stock minimum')}: ${minimum}`,
        createdAt: Date.now(),
        read: false,
        actionLabel: 'Voir le stock',
        action: () => navigate('/stock/faible'),
      });
    });

    getNotifications()
      .filter((notification) => notification.id.startsWith('low-stock-') && !activeIds.has(notification.id))
      .forEach((notification) => removeNotification(notification.id));
  }, [lowStockData, navigate, t]);

  useEffect(() => {
    if (!window.cafestock?.updater) return;

    const dispose = window.cafestock.updater.on((event) => {
      const version = event.version ?? 'unknown';
      const date = Date.now();

      switch (event.type) {
        case 'update-available':
          addNotification({
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
          });
          break;
        case 'download-progress':
          updateNotification('update-downloading', {
            id: 'update-downloading',
            type: 'update_downloading',
            title: t('Téléchargement de la mise à jour'),
            message: `CaféStock v${version}`,
            createdAt: date,
            read: false,
            progress: event.progress ?? 0,
          });
          if (!getNotifications().some((notification) => notification.id === 'update-downloading')) {
            addNotification({
              id: 'update-downloading',
              type: 'update_downloading',
              title: t('Téléchargement de la mise à jour'),
              message: `CaféStock v${version}`,
              createdAt: date,
              read: false,
              progress: event.progress ?? 0,
            });
          }
          break;
        case 'update-downloaded':
          addNotification({
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
          });
          removeNotification('update-downloading');
          break;
        case 'update-error':
          addNotification({
            id: 'update-error',
            type: 'error',
            title: t('Échec de la mise à jour'),
            message: 'La mise à jour n\'a pas pu être téléchargée. Vous pourrez réessayer plus tard.',
            createdAt: date,
            read: false,
          });
          removeNotification('update-downloading');
          break;
        default:
          break;
      }
    });

    return dispose;
  }, [t]);

  return (
    <div className="relative">
      <button
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

      {open ? (
        <div className="absolute right-0 top-[calc(100%+0.75rem)] z-50 w-[420px] overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="text-sm font-semibold">{t('Notifications')}</div>
            <button
              type="button"
              onClick={() => markAllAsRead()}
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
                    onClick={() => {
                      markAsRead(notification.id);
                      if (notification.action) {
                        notification.action();
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        markAsRead(notification.id);
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
                            onClick={(event) => {
                              event.stopPropagation();
                              markAsRead(notification.id);
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
        </div>
      ) : null}
    </div>
  );
}
