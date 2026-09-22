import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import { EmptyState, ErrorRetry, PageSkeleton } from '@/components/ui/Feedback';
import type { Page } from '@/types/api';

export type MyTournamentCard = {
  id: string;
  name: string;
  season?: string | null;
  coverImageUrl?: string | null;
  team?: string | null;
  matches: number;
  runs: number;
  wickets: number;
  mvpPoints: number;
  rank?: number | null;
};

export function MyTournamentsPage() {
  const { t } = useTranslation();
  const q = useQuery({
    queryKey: keys.myTournaments,
    queryFn: () => api<Page<MyTournamentCard>>('/api/v1/users/me/tournaments?limit=50'),
  });
  if (q.isLoading) return <PageSkeleton />;
  if (q.isError) return <ErrorRetry onRetry={() => void q.refetch()} />;
  const rows = q.data?.items ?? [];
  return (
    <div className="px-[var(--gutter)] py-4">
      <h1 className="text-xl font-bold">{t('drawer.myTournaments')}</h1>
      {!rows.length ? <EmptyState title={t('home.noTournaments')} /> : null}
      <ul className="mt-4 flex flex-col gap-3">
        {rows.map((tn) => (
          <li key={tn.id}>
            <Link to={`/tournaments/${tn.id}`} className="flex gap-3 rounded-xl border border-border bg-bg p-4 shadow-sm">
              {tn.coverImageUrl ? (
                <img src={tn.coverImageUrl} alt="" className="h-14 w-14 rounded-lg object-cover" />
              ) : (
                <span className="inline-flex h-14 w-14 items-center justify-center rounded-lg bg-primary-dark text-sm font-bold text-on-dark">
                  {tn.name.slice(0, 2).toUpperCase()}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-bold">{tn.name}</p>
                <p className="text-xs text-text-secondary">{[tn.season, tn.team].filter(Boolean).join(' · ')}</p>
                <p className="mt-2 text-xs font-semibold">
                  {tn.matches} {t('profile.matches')} · {tn.runs} {t('profile.runs')} · {tn.wickets} {t('profile.wickets')} · {tn.mvpPoints} {t('home.mvpPoints')}
                  {tn.rank ? ` · #${tn.rank}` : ''}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
