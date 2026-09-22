import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState, ErrorRetry, PageSkeleton } from '@/components/ui/Feedback';

export type MyTeamCard = {
  id: string;
  name: string;
  logoUrl?: string | null;
  club?: { id: string; name: string; city?: string | null } | null;
  season?: string | null;
  players: number;
  matches: number;
  wins: number;
  losses: number;
  current: boolean;
};

export function MyTeamsPage() {
  const { t } = useTranslation();
  const q = useQuery({ queryKey: keys.myTeams, queryFn: () => api<MyTeamCard[]>('/api/v1/users/me/teams') });
  if (q.isLoading) return <PageSkeleton />;
  if (q.isError) return <ErrorRetry onRetry={() => void q.refetch()} />;
  const teams = q.data ?? [];
  const current = teams.filter((team) => team.current);
  const former = teams.filter((team) => !team.current);
  return (
    <div className="px-[var(--gutter)] py-4">
      <h1 className="text-xl font-bold">{t('drawer.myTeams')}</h1>
      {!teams.length ? <EmptyState title={t('teams.noTeams')} /> : null}
      {current.length ? (
        <>
          <h2 className="mt-4 text-sm font-bold uppercase text-text-secondary">{t('playerHome.currentTeams')}</h2>
          <TeamList teams={current} />
        </>
      ) : null}
      {former.length ? (
        <>
          <h2 className="mt-6 text-sm font-bold uppercase text-text-secondary">{t('playerHome.formerTeams')}</h2>
          <TeamList teams={former} />
        </>
      ) : null}
    </div>
  );
}

function TeamList({ teams }: { teams: MyTeamCard[] }) {
  const { t } = useTranslation();
  return (
    <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
      {teams.map((team) => (
        <li key={team.id}>
          <Link to={`/teams/${team.id}`} className="flex min-h-touch gap-3 rounded-xl border border-border bg-bg p-4 shadow-sm">
            <Avatar name={team.name} src={team.logoUrl} kind="team" size={56} />
            <div className="min-w-0">
              <p className="font-bold">{team.name}</p>
              <p className="text-xs text-text-secondary">{[team.club?.name, team.season].filter(Boolean).join(' · ')}</p>
              <p className="mt-2 text-xs font-semibold text-text-secondary">
                {team.players} {t('common.players')} · {team.matches} {t('common.matches')} · {team.wins}-{team.losses}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
