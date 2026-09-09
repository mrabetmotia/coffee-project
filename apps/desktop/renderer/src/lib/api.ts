const TOKEN_KEY = 'cafestock-token';

let apiBase = import.meta.env.VITE_API_URL ?? 'https://coffee-project-zltx.onrender.com/api';

export function setApiBase(url: string) {
  apiBase = url;
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
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
