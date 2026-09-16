import { useSyncExternalStore } from 'react';

const TOKEN_KEY = 'cafestock-token';
const USER_KEY = 'cafestock-user';

export type CurrentUser = {
  id?: string;
  username?: string;
  role?: string;
  name?: string | null;
  email?: string | null;
  isActive?: boolean;
  client?: { id: string; name: string; email: string | null; phone: string | null; address: string | null } | null;
};

let apiBase = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:47821/api';
let currentUser: CurrentUser | null = readStoredUser();
const userListeners = new Set<() => void>();

function readStoredUser(): CurrentUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) as CurrentUser : null;
  } catch {
    return null;
  }
}

export function setApiBase(url: string) {
  apiBase = url;
}

export function getApiBase() {
  return apiBase;
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getCurrentUser(): CurrentUser | null {
  return currentUser;
}

export function setCurrentUser(user: CurrentUser | null) {
  currentUser = user;
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
  userListeners.forEach((listener) => listener());
}

export function useCurrentUser() {
  return useSyncExternalStore(
    (listener) => {
      userListeners.add(listener);
      return () => userListeners.delete(listener);
    },
    () => currentUser,
    () => currentUser,
  );
}

export function getCurrentRole(): string | null {
  const user = getCurrentUser();
  if (user?.role) return user.role;
  const token = getToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1] ?? ''));
    return payload?.role ?? null;
  } catch {
    return null;
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(`${apiBase}${path}`, { ...init, headers });
  if (res.status === 401) {
    setToken(null);
  }
  const data = (await res.json().catch(() => ({}))) as { message?: string };
  if (!res.ok) {
    throw new ApiError(res.status, data.message ?? 'Une erreur est survenue.');
  }
  return data as T;
}
