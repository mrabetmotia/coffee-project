import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { NotificationRow, useBackendNotifications, type BackendNotification } from '@/components/notification-center';

export function NotificationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data = [], isLoading } = useBackendNotifications();
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
    if (notification.actionUrl?.startsWith('/')) navigate(notification.actionUrl);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Notifications" subtitle="Les événements importants de votre espace CaféStock." actions={<Button variant="outline" disabled={!data.some((item) => !item.readAt) || readAllMutation.isPending} onClick={() => readAllMutation.mutate()}><CheckCheck className="mr-2 h-4 w-4" />Tout lire</Button>} />
      <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        {isLoading ? <div className="p-8 text-sm text-muted-foreground">Chargement des notifications…</div> : !data.length ? <div className="p-12 text-center"><Bell className="mx-auto mb-3 h-9 w-9 text-muted-foreground/50" /><p className="font-medium">Aucune notification</p><p className="mt-1 text-sm text-muted-foreground">Vous êtes à jour.</p></div> : <div className="divide-y divide-border/70 p-2">{data.map((notification) => <NotificationRow key={notification.id} notification={notification} onRead={openNotification} />)}</div>}
      </section>
    </div>
  );
}
