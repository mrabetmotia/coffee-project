import { useSyncExternalStore } from 'react';

export type NotificationType =
  | 'low_stock'
  | 'update_available'
  | 'update_downloading'
  | 'update_ready'
  | 'info'
  | 'success'
  | 'warning'
  | 'error';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  createdAt: number;
  read: boolean;
  persistent?: boolean;
  actionLabel?: string;
  action?: () => void;
  progress?: number;
}

const STORAGE_KEY = 'cafestock-notifications';
const MAX_HISTORY = 50;
const listeners = new Set<() => void>();

let notifications: AppNotification[] = readPersisted();

function readPersisted(): AppNotification[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as Partial<AppNotification>[];
    if (!Array.isArray(parsed)) return [];

    const hydrated: AppNotification[] = [];

    for (const item of parsed) {
      if (!item || typeof item.id !== 'string') continue;

      hydrated.push({
        id: item.id,
        type: (item.type as NotificationType) ?? 'info',
        title: item.title ?? 'Notification',
        message: item.message ?? '',
        createdAt: Number(item.createdAt) || Date.now(),
        read: Boolean(item.read),
        persistent: Boolean(item.persistent),
        actionLabel: item.actionLabel ?? undefined,
        progress: typeof item.progress === 'number' ? item.progress : undefined,
      });
    }

    return hydrated.slice(0, MAX_HISTORY);
  } catch {
    return [];
  }
}

function persist() {
  if (typeof window === 'undefined') return;

  const metadata = notifications.map(({ id, type, title, message, createdAt, read, persistent, actionLabel, progress }) => ({
    id,
    type,
    title,
    message,
    createdAt,
    read,
    persistent,
    actionLabel,
    progress,
  }));

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(metadata));
}

function emit() {
  listeners.forEach((listener) => listener());
}

function normalize(notification: AppNotification): AppNotification {
  return {
    ...notification,
    createdAt: Number(notification.createdAt) || Date.now(),
    read: Boolean(notification.read),
    persistent: Boolean(notification.persistent),
    progress: typeof notification.progress === 'number' ? notification.progress : undefined,
  };
}

export function getNotifications(): AppNotification[] {
  return notifications;
}

export function getUnreadNotificationCount(): number {
  return notifications.filter((notification) => !notification.read).length;
}

export function addNotification(notification: AppNotification): AppNotification {
  const normalized = normalize(notification);
  const existingIndex = notifications.findIndex((item) => item.id === normalized.id);

  if (existingIndex >= 0) {
    notifications = notifications.map((item) => (item.id === normalized.id ? { ...item, ...normalized } : item));
  } else {
    notifications = [normalized, ...notifications].slice(0, MAX_HISTORY);
  }

  persist();
  emit();
  return normalized;
}

export function updateNotification(id: string, updates: Partial<AppNotification>): AppNotification | null {
  const existing = notifications.find((notification) => notification.id === id);
  if (!existing) return null;

  const next = normalize({ ...existing, ...updates, id, createdAt: existing.createdAt });
  notifications = notifications.map((notification) => (notification.id === id ? next : notification));
  persist();
  emit();
  return next;
}

export function removeNotification(id: string): void {
  const next = notifications.filter((notification) => notification.id !== id);
  if (next.length === notifications.length) return;

  notifications = next;
  persist();
  emit();
}

export function markAsRead(id: string): void {
  notifications = notifications.map((notification) =>
    notification.id === id ? { ...notification, read: true } : notification,
  );
  persist();
  emit();
}

export function markAllAsRead(): void {
  notifications = notifications.map((notification) => ({ ...notification, read: true }));
  persist();
  emit();
}

export function clearNotifications(): void {
  notifications = [];
  persist();
  emit();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useNotifications() {
  return useSyncExternalStore(
    subscribe,
    () => notifications,
    () => notifications,
  );
}
