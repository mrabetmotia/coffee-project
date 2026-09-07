import { Navigate, Outlet } from 'react-router-dom';
import { getToken } from '@/lib/api';

export function RequireAuth() {
  if (!getToken()) return <Navigate to="/login" replace />;
  return <Outlet />;
}
