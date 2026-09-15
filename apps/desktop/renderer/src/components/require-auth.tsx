import { Navigate, Outlet } from 'react-router-dom';
import { getCurrentRole, getToken } from '@/lib/api';

export function RequireAuth() {
  if (!getToken()) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export function RequireRole({ role }: { role: 'ADMIN' | 'CLIENT' }) {
  if (!getToken()) return <Navigate to="/login" replace />;
  if (getCurrentRole() !== role) {
    const fallback = role === 'ADMIN' ? '/' : '/client';
    return <Navigate to={fallback} replace />;
  }
  return <Outlet />;
}
