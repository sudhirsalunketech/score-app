import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import { useAuth } from '@/context/AuthContext';
import type { Tournament } from '@/types/api';
import { Button } from '@/components/ui/Button';
import { TournamentCard } from '@/components/home/TournamentCard';
import { EmptyState, ErrorRetry, PageSkeleton } from '@/components/ui/Feedback';

export function TournamentsPage() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const q = useQuery({ queryKey: keys.tournaments, queryFn: () => api<Tournament[]>('/api/v1/tournaments') });
  if (q.isLoading) return <PageSkeleton />;
  if (q.isError) return <ErrorRetry onRetry={() => void q.refetch()} />;
  return (
    <div className="px-[var(--gutter)] py-4">
      {isAuthenticated ? (
        <div className="mb-4 flex justify-end">
          <Link to="/tournaments/new">
            <Button variant="outline">{t('tournaments.create')}</Button>
          </Link>
        </div>
      ) : null}
      {(q.data ?? []).length === 0 ? (
        <EmptyState
          title={t('home.noTournaments')}
          hint={t('tournaments.emptyHint')}
          action={
            isAuthenticated ? (
              <Link to="/tournaments/new">
                <Button>{t('drawer.createTournament')}</Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {(q.data ?? []).map((tn) => (
            <TournamentCard key={tn.id} tournament={tn} layout="list" />
          ))}
        </div>
      )}
    </div>
  );
}
