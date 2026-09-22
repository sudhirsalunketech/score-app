import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import { useAuth } from '@/context/AuthContext';
import type { Club } from '@/types/api';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorRetry, PageSkeleton } from '@/components/ui/Feedback';
import { ClubCard } from './TeamsPage';

export function ClubsPage() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const q = useQuery({ queryKey: keys.clubs, queryFn: () => api<Club[]>('/api/v1/clubs') });

  if (params.get('register') === '1') {
    return <Navigate to="/clubs/register" replace />;
  }

  if (q.isLoading) return <PageSkeleton />;
  if (q.isError) return <ErrorRetry onRetry={() => void q.refetch()} />;

  return (
    <div className="px-[var(--gutter)] py-4">
      {isAuthenticated ? (
        <div className="mb-4 flex justify-end">
          <Button variant="outline" onClick={() => nav('/clubs/register')}>
            {t('clubs.register')}
          </Button>
        </div>
      ) : null}
      {(q.data ?? []).length === 0 ? (
        <EmptyState
          title={t('clubs.noClubs')}
          hint={t('clubs.emptyHint')}
          action={
            isAuthenticated ? (
              <Button onClick={() => nav('/clubs/register')}>{t('clubs.register')}</Button>
            ) : undefined
          }
        />
      ) : null}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {(q.data ?? []).map((c) => (
          <Link key={c.id} to={`/clubs/${c.id}`} className="block">
            <ClubCard club={c} />
          </Link>
        ))}
      </div>
    </div>
  );
}
