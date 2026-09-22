import { Navigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import { hasMatchPerm, hasPerm, type PermissionKey } from '@/lib/access';
import type { Match, Tournament } from '@/types/api';
import { Spinner } from '@/components/ui/Feedback';

export function MatchPermissionGate({
  permission,
  fallback,
  children,
}: {
  permission: PermissionKey;
  fallback?: string;
  children: React.ReactNode;
}) {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const q = useQuery({
    queryKey: keys.match(id),
    queryFn: () => api<Match>(`/api/v1/matches/${id}`),
    enabled: Boolean(id),
    retry: false,
  });
  if (q.isLoading) return <Spinner />;
  if (q.isError) {
    const status = q.error instanceof ApiError ? q.error.status : 0;
    if (status === 403 || status === 404) {
      const msg =
        q.error instanceof ApiError
          ? q.error.message
          : status === 404
            ? t('beta.matchUnavailable')
            : t('access.deniedBody');
      return (
        <p className="px-[var(--gutter)] py-8 text-center text-sm text-text-secondary">
          {msg}
        </p>
      );
    }
    return <Navigate to="/" replace />;
  }
  if (!q.data || !hasMatchPerm(q.data, permission)) {
    return <Navigate to={fallback ?? `/matches/${id}/centre`} replace />;
  }
  return children;
}

export function TournamentPermissionGate({
  permission,
  children,
}: {
  permission: PermissionKey;
  children: React.ReactNode;
}) {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const q = useQuery({
    queryKey: keys.tournament(id),
    queryFn: () => api<Tournament>(`/api/v1/tournaments/${id}`),
    enabled: Boolean(id),
    retry: false,
  });
  if (q.isLoading) return <Spinner />;
  if (q.isError || !q.data || !hasPerm(q.data.myPermissions, permission)) {
    return (
      <p className="px-[var(--gutter)] py-8 text-center text-sm text-text-secondary">
        {t('access.deniedBody')}
      </p>
    );
  }
  return children;
}
