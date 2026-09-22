import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorRetry, PageSkeleton } from '@/components/ui/Feedback';
import { FollowButton } from '@/components/follow/FollowButton';

type Following = {
  players: Array<{ id: string; name: string; photoUrl?: string | null; profileCode?: string | null }>;
  teams: Array<{ id: string; name: string; logoUrl?: string | null }>;
  tournaments: Array<{ id: string; name: string; season?: string | null }>;
};

export function FollowingPage() {
  const { t } = useTranslation();
  const q = useQuery({
    queryKey: keys.following,
    queryFn: () => api<Following>('/api/v1/users/me/following'),
  });
  if (q.isLoading) return <PageSkeleton />;
  if (q.isError) return <ErrorRetry onRetry={() => void q.refetch()} />;
  const data = q.data ?? { players: [], teams: [], tournaments: [] };
  const empty = !data.players.length && !data.teams.length && !data.tournaments.length;
  if (empty) {
    return (
      <EmptyState
        title={t('following.empty')}
        hint={t('following.browseHint')}
        action={
          <Link to="/tournaments">
            <Button variant="outline">{t('following.browse')}</Button>
          </Link>
        }
      />
    );
  }
  return (
    <div className="flex flex-col gap-8 px-[var(--gutter)] py-4">
      {data.players.length ? (
        <section>
          <h2 className="mb-2 font-bold">{t('common.players')}</h2>
          <ul className="divide-y divide-border">
            {data.players.map((p) => (
              <li key={p.id} className="flex min-h-touch items-center justify-between gap-3 py-2">
                <Link to={`/players/${p.id}`} className="flex min-w-0 items-center gap-3">
                  <Avatar name={p.name} src={p.photoUrl} kind="person" size={40} />
                  <span className="truncate font-semibold">{p.name}</span>
                </Link>
                <FollowButton targetType="PLAYER" targetId={p.id} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {data.teams.length ? (
        <section>
          <h2 className="mb-2 font-bold">{t('common.teams')}</h2>
          <ul className="divide-y divide-border">
            {data.teams.map((team) => (
              <li key={team.id} className="flex min-h-touch items-center justify-between gap-3 py-2">
                <Link to={`/teams/${team.id}`} className="flex min-w-0 items-center gap-3">
                  <Avatar name={team.name} src={team.logoUrl} kind="team" size={40} />
                  <span className="truncate font-semibold">{team.name}</span>
                </Link>
                <FollowButton targetType="TEAM" targetId={team.id} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {data.tournaments.length ? (
        <section>
          <h2 className="mb-2 font-bold">{t('common.tournaments')}</h2>
          <ul className="divide-y divide-border">
            {data.tournaments.map((tn) => (
              <li key={tn.id} className="flex min-h-touch items-center justify-between gap-3 py-2">
                <Link to={`/tournaments/${tn.id}`} className="min-w-0 truncate font-semibold">
                  {tn.name}
                </Link>
                <FollowButton targetType="TOURNAMENT" targetId={tn.id} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
