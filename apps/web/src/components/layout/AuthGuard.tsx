import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Spinner } from '@/components/ui/Feedback';
import { RouteSuspense } from './RouteSuspense';

export function AuthGuard() {
  const { isAuthenticated, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <Spinner />;
  if (!isAuthenticated) {
    const expired = sessionStorage.getItem('cs.sessionExpired') === '1';
    return <Navigate to={expired ? '/login?expired=1' : '/login'} replace state={{ from: loc.pathname }} />;
  }
  return <RouteSuspense />;
}

export function GuestOnly() {
  const { isAuthenticated, ready } = useAuth();
  if (!ready) return <Spinner />;
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <RouteSuspense />;
}
