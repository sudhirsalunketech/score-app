import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import { useAuth } from '@/context/AuthContext';
import { canCreateMatch } from '@/lib/roles';
import { clubBallLabelKey } from '@/lib/ball-type';
import type { Club, Team, Tournament } from '@/types/api';
import { PillTabs } from '@/components/ui/Pills';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState, ErrorRetry, Spinner } from '@/components/ui/Feedback';
import { CreateTeamModal } from '@/components/forms/CreateTeamModal';
import { TournamentCard } from '@/components/home/TournamentCard';

export function TeamsPage() {
  const { t } = useTranslation();
  const { isAuthenticated, user } = useAuth();
  const canCreate = isAuthenticated && canCreateMatch(user?.role);
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState('teams');
  const [createOpen, setCreateOpen] = useState(false);
  const qc = useQueryClient();

  const teams = useQuery({ queryKey: keys.teams, queryFn: () => api<Team[]>('/api/v1/teams') });
  const tournaments = useQuery({ queryKey: keys.tournaments, queryFn: () => api<Tournament[]>('/api/v1/tournaments'), enabled: tab === 'tournaments' });
  const clubs = useQuery({ queryKey: keys.clubs, queryFn: () => api<Club[]>('/api/v1/clubs'), enabled: tab === 'clubs' });

  useEffect(() => {
    if (params.get('create') === '1' && canCreate) {
      setCreateOpen(true);
      const next = new URLSearchParams(params);
      next.delete('create');
      setParams(next, { replace: true });
    }
  }, [params, canCreate, setParams]);

  const create = useMutation({
    mutationFn: (v: { name: string; location?: string; shortName?: string; clubId?: string; logoUrl?: string }) =>
      api<Team>('/api/v1/teams', { method: 'POST', body: v }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.teams });
      setCreateOpen(false);
    },
  });

  return (
    <div className="px-[var(--gutter)] py-4">
      <PillTabs
        value={tab}
        onChange={setTab}
        items={[
          { id: 'teams', label: t('common.teams') },
          { id: 'tournaments', label: t('common.tournaments') },
          { id: 'clubs', label: t('common.clubs') },
        ]}
      />
      {tab === 'teams' ? (
        <>
          {canCreate ? (
          <div className="my-4 flex justify-end">
            <Button variant="outline" onClick={() => setCreateOpen(true)}>
              {t('teams.create')}
            </Button>
          </div>
          ) : null}
          {teams.isLoading ? <Spinner /> : null}
          {teams.isError ? <ErrorRetry onRetry={() => void teams.refetch()} /> : null}
          {!teams.isLoading && !(teams.data ?? []).length ? (
            <EmptyState
              title={t('teams.noTeams')}
              hint={t('teams.emptyHint')}
              action={
                canCreate ? (
                  <Button onClick={() => setCreateOpen(true)}>{t('teams.create')}</Button>
                ) : undefined
              }
            />
          ) : null}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {(teams.data ?? []).map((team) => (
              <Link key={team.id} to={`/teams/${team.id}`} className="flex flex-col items-center gap-2 rounded-xl border border-border p-3">
                <Avatar name={team.name} src={team.logoUrl} kind="team" size={72} />
                <p className="text-center text-xs font-bold uppercase">{team.name}</p>
              </Link>
            ))}
          </div>
        </>
      ) : null}
      {tab === 'tournaments' ? (
        <div className="mt-4 flex flex-col gap-3">
          {isAuthenticated ? (
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => nav('/tournaments/new')}>
              {t('tournaments.create')}
            </Button>
          </div>
          ) : null}
          {tournaments.isLoading ? <Spinner /> : null}
          {(tournaments.data ?? []).map((tn) => (
            <TournamentCard key={tn.id} tournament={tn} />
          ))}
        </div>
      ) : null}
      {tab === 'clubs' ? (
        <div className="mt-4 flex flex-col gap-3">
          {(clubs.data ?? []).map((c) => (
            <ClubCard key={c.id} club={c} />
          ))}
        </div>
      ) : null}
      {isAuthenticated ? (
      <CreateTeamModal open={createOpen} onClose={() => setCreateOpen(false)} onCreate={async (v) => { await create.mutateAsync(v); }} busy={create.isPending} />
      ) : null}
    </div>
  );
}

export function ClubCard({ club }: { club: Club }) {
  const { t } = useTranslation();
  const balls = (club.ballTypes ?? []).map((type) => t(clubBallLabelKey(type))).join(' · ');
  return (
    <article className="flex items-center gap-3 rounded-xl border border-border bg-bg p-4">
      <Avatar name={club.name} src={club.logoUrl} size={56} />
      <div>
        <p className="font-semibold">{club.name}</p>
        <p className="text-sm text-text-secondary">
          {[club.city, club.establishedYear, balls].filter(Boolean).join(' · ')}
        </p>
      </div>
    </article>
  );
}
