import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Tournament } from '@/types/api';
import { cn } from '@/lib/cn';

export function TournamentCard({ tournament, layout = 'tile' }: { tournament: Tournament; layout?: 'tile' | 'list' }) {
  const { t } = useTranslation();
  const teams = tournament.groups?.reduce((n, g) => n + (g.teams?.length ?? 0), 0) ?? 0;
  const meta = [tournament.season, tournament.club?.name, teams ? t('tournaments.teamCount', { count: teams }) : null, tournament._count?.matches != null ? t('tournaments.matchCount', { count: tournament._count.matches }) : null]
    .filter(Boolean)
    .join(' · ');

  if (layout === 'list') {
    return (
      <Link to={`/tournaments/${tournament.id}`} className="flex items-center gap-3 rounded-xl border border-border px-4 py-3">
        {tournament.coverImageUrl ? (
          <img src={tournament.coverImageUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />
        ) : (
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-sm font-bold text-primary">
            {tournament.name.slice(0, 2).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate font-semibold">{tournament.name}</p>
          {meta ? <p className="truncate text-sm text-text-secondary">{meta}</p> : null}
        </div>
      </Link>
    );
  }

  return (
    <Link
      to={`/tournaments/${tournament.id}`}
      className={cn('relative block h-36 w-[78vw] max-w-sm shrink-0 overflow-hidden rounded-xl sm:w-80')}
    >
      {tournament.coverImageUrl ? (
        <img src={tournament.coverImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-primary-dark" />
      )}
      <div className="absolute inset-0 bg-black/35" />
      <div className="absolute inset-x-0 bottom-0 p-4 text-on-dark">
        <p className="text-base font-bold">{tournament.name}</p>
        {meta ? <p className="text-xs opacity-90">{meta}</p> : null}
      </div>
    </Link>
  );
}
