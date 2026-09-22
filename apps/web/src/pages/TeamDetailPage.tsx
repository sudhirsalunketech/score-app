import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { api } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import { useAuth } from '@/context/AuthContext';
import { canManageThisTeam } from '@/lib/roles';
import type { Page, Player, Team } from '@/types/api';
import { Avatar } from '@/components/ui/Avatar';
import { PhotoField } from '@/components/ui/PhotoField';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ErrorRetry, Spinner } from '@/components/ui/Feedback';
import { FollowButton } from '@/components/follow/FollowButton';
import { PillTabs } from '@/components/ui/Pills';

type LookupRow = {
  playerId: string;
  displayName: string;
  profilePhoto?: string | null;
  profileCode: string;
  battingStyle?: string | null;
  bowlingStyle?: string | null;
};

type TeamStats = {
  matches: number;
  wins: number;
  losses: number;
  ties: number;
  noResults: number;
  winPct: number;
  runs: number;
  wickets: number;
};

type Tab = 'overview' | 'players' | 'matches' | 'stats' | 'tournaments';

type TeamMatchRow = {
  id: string;
  homeTeam: { id: string; name: string };
  awayTeam: { id: string; name: string };
  date: string | null;
  tournament: { id: string; name: string; season: string | null } | null;
  status: string;
  result: string | null;
  score: { home: string | null; away: string | null };
};

type TeamTournamentRow = {
  id: string;
  name: string;
  season: string | null;
  position: number | null;
  matches: number;
  wins: number;
  losses: number;
  nrr: number;
};

function canLookup(role?: string) {
  return role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'SCORER' || role === 'TEAM_MANAGER';
}

function isSensitiveQuery(value: string) {
  return value.includes('@') || /^\+?\d[\d\s-]{8,}$/.test(value);
}

export function TeamDetailPage() {
  const { id = '' } = useParams();
  const { isAuthenticated, user } = useAuth();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('overview');
  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const q = useQuery({ queryKey: keys.team(id), queryFn: () => api<Team>(`/api/v1/teams/${id}`) });
  const stats = useQuery({
    queryKey: [...keys.team(id), 'statistics'],
    queryFn: () => api<TeamStats>(`/api/v1/teams/${id}/statistics`),
    enabled: tab === 'overview' || tab === 'stats',
  });
  const matchesQ = useQuery({
    queryKey: keys.teamMatches(id),
    queryFn: () => api<Page<TeamMatchRow>>(`/api/v1/teams/${id}/matches?limit=50`),
    enabled: tab === 'overview' || tab === 'matches',
  });
  const tournamentsQ = useQuery({
    queryKey: keys.teamTournaments(id),
    queryFn: () => api<Page<TeamTournamentRow>>(`/api/v1/teams/${id}/tournaments?limit=50`),
    enabled: tab === 'overview' || tab === 'tournaments',
  });
  const sensitive = isSensitiveQuery(query.trim());
  const search = useQuery({
    queryKey: keys.playerSearch(`team:${id}:${query}`),
    enabled: isAuthenticated && query.trim().length >= 2 && tab === 'players',
    queryFn: async () => {
      if (sensitive && canLookup(user?.role)) {
        const rows = await api<LookupRow[]>('/api/v1/players/lookup', {
          method: 'POST',
          body: { query: query.trim(), teamId: id },
        });
        return rows.map((row) => ({
          id: row.playerId,
          name: row.displayName,
          photoUrl: row.profilePhoto,
          profileCode: row.profileCode,
        }));
      }
      return api<Player[]>(`/api/v1/players?q=${encodeURIComponent(query.trim())}&limit=10`);
    },
  });
  const addExisting = useMutation({
    mutationFn: (playerId: string) => api(`/api/v1/teams/${id}/players`, { method: 'POST', body: { playerId } }),
    onSuccess: () => {
      setQuery('');
      void qc.invalidateQueries({ queryKey: keys.team(id) });
    },
  });
  const add = useMutation({
    mutationFn: () => api('/api/v1/players', { method: 'POST', body: { name, teamId: id } }),
    onSuccess: () => {
      setName('');
      void qc.invalidateQueries({ queryKey: keys.team(id) });
    },
  });
  const remove = useMutation({
    mutationFn: (playerId: string) => api(`/api/v1/teams/${id}/players/${playerId}`, { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.team(id) });
    },
  });
  const photo = useMutation({
    mutationFn: (logoUrl: string) => api<Team>(`/api/v1/teams/${id}`, { method: 'PATCH', body: { logoUrl } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.team(id) });
      void qc.invalidateQueries({ queryKey: keys.teams });
    },
  });

  if (q.isLoading) return <Spinner />;
  if (q.isError || !q.data) return <ErrorRetry onRetry={() => void q.refetch()} />;
  const team = q.data;
  const canEdit = canManageThisTeam(user, team);
  const rosterIds = new Set((team.players ?? []).map((tp) => tp.player.id));
  const teamMatches = matchesQ.data?.items ?? [];
  const tournaments = tournamentsQ.data?.items ?? [];
  const snapshot = stats.data ?? {
    matches: team.stats?.matches ?? 0,
    wins: team.stats?.wins ?? 0,
    losses: team.stats?.losses ?? 0,
    ties: team.stats?.ties ?? 0,
    noResults: team.stats?.noResults ?? 0,
    winPct: 0,
    runs: 0,
    wickets: 0,
  };

  return (
    <div className="px-[var(--gutter)] py-4">
      <div className="mb-6 flex items-center gap-3">
        {canEdit ? (
          <PhotoField
            kind="team"
            name={team.name}
            value={team.logoUrl}
            size={64}
            compact
            onUploaded={async (url) => {
              await photo.mutateAsync(url);
            }}
          />
        ) : (
          <Avatar name={team.name} src={team.logoUrl} kind="team" size={64} />
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold uppercase">{team.name}</h1>
          <p className="text-sm text-text-secondary">{[team.club?.name, team.location].filter(Boolean).join(' · ')}</p>
        </div>
        <FollowButton targetType="TEAM" targetId={id} />
      </div>
      <PillTabs
        tone="ink"
        value={tab}
        onChange={(next) => setTab(next as Tab)}
        items={[
          { id: 'overview', label: t('tournaments.overview') },
          { id: 'players', label: t('common.players') },
          { id: 'matches', label: t('common.matches') },
          { id: 'stats', label: t('common.statistics') },
          { id: 'tournaments', label: t('common.tournaments') },
        ]}
      />

      {tab === 'overview' ? (
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Stat label={t('common.players')} value={team.players?.length ?? team._count?.players ?? 0} />
          <Stat label={t('common.matches')} value={snapshot.matches} />
          <Stat label={t('match.won')} value={snapshot.wins} />
          <Stat label={t('match.lost')} value={snapshot.losses} />
        </div>
      ) : null}

      {tab === 'players' ? (
        <>
          <ul className="mt-4 divide-y divide-border">
            {(team.players ?? []).map((tp) => (
              <li key={tp.id} className="flex min-h-touch items-center gap-3 py-2">
                <Avatar name={tp.player.name} src={tp.player.photoUrl} size={40} />
                <Link to={`/players/${tp.player.id}`} className="min-w-0 flex-1 font-semibold">
                  {tp.player.name}
                </Link>
                {canEdit ? (
                  <button
                    type="button"
                    className="shrink-0 text-sm font-semibold text-danger"
                    onClick={() => {
                      if (window.confirm(t('teams.confirmRemove'))) remove.mutate(tp.player.id);
                    }}
                  >
                    {t('teams.removePlayer')}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          {canEdit ? (
            <>
              <div className="mt-6">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('players.searchHint')}
                  underline
                />
                {(search.data ?? []).map((player) => (
                  <div key={player.id} className="flex min-h-touch items-center gap-3 py-2">
                    <Avatar name={player.name} src={player.photoUrl} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{player.name}</span>
                      {player.profileCode ? <span className="block text-xs text-text-secondary">{player.profileCode}</span> : null}
                    </span>
                    <Button
                      type="button"
                      variant="primaryDark"
                      disabled={rosterIds.has(player.id) || addExisting.isPending}
                      onClick={() => {
                        if (window.confirm(t('teams.confirmAdd', { name: player.name }))) addExisting.mutate(player.id);
                      }}
                    >
                      {rosterIds.has(player.id) ? t('teams.alreadyAdded') : t('match.addPlayer')}
                    </Button>
                  </div>
                ))}
              </div>
              <form
                className="mt-4 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (name.trim()) add.mutate();
                }}
              >
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('common.name')} />
                <Button type="submit" variant="primaryDark">
                  {t('teams.createPlayer')}
                </Button>
              </form>
            </>
          ) : null}
        </>
      ) : null}

      {tab === 'matches' ? (
        matchesQ.isLoading ? (
          <Spinner />
        ) : teamMatches.length ? (
          <ul className="mt-4 flex flex-col gap-3">
            {teamMatches.map((m) => (
              <li key={m.id}>
                <Link to={`/matches/${m.id}/centre`} className="block rounded-xl border border-border p-3">
                  <p className="font-semibold">
                    {m.homeTeam.name} vs {m.awayTeam.name}
                  </p>
                  <p className="mt-1 text-xs text-text-secondary">
                    {[m.date ? new Date(m.date).toLocaleDateString() : null, m.tournament?.name, m.result ?? m.status.replace('_', ' ')].filter(Boolean).join(' · ')}
                  </p>
                  {m.score.home || m.score.away ? (
                    <p className="mt-1 text-sm font-semibold">
                      {m.score.home ?? '—'} · {m.score.away ?? '—'}
                    </p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-8 text-center text-sm text-text-secondary">{t('home.noRecent')}</p>
        )
      ) : null}

      {tab === 'stats' ? (
        stats.isLoading ? (
          <Spinner />
        ) : (
          <div className="mt-5 grid grid-cols-2 gap-2">
            <Stat label={t('common.matches')} value={snapshot.matches} />
            <Stat label={t('match.won')} value={snapshot.wins} />
            <Stat label={t('match.lost')} value={snapshot.losses} />
            <Stat label={t('profile.runs')} value={snapshot.runs} />
            <Stat label={t('profile.wickets')} value={snapshot.wickets} />
            <Stat label={t('teams.winPct')} value={`${snapshot.winPct}%`} />
          </div>
        )
      ) : null}

      {tab === 'tournaments' ? (
        tournamentsQ.isLoading ? (
          <Spinner />
        ) : tournaments.length ? (
          <ul className="mt-4 flex flex-col gap-3">
            {tournaments.map((tn) => (
              <li key={tn.id}>
                <Link to={`/tournaments/${tn.id}`} className="block rounded-xl border border-border p-3">
                  <p className="font-semibold">{tn.name}</p>
                  <p className="text-xs text-text-secondary">{tn.season}</p>
                  <p className="mt-1 text-sm">
                    {tn.position ? `#${tn.position}` : '—'} · {tn.matches} {t('common.matches')} · {tn.wins}-{tn.losses} · NRR {tn.nrr.toFixed(3)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-8 text-center text-sm text-text-secondary">{t('home.noTournaments')}</p>
        )
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <p className="text-lg font-bold tabular-nums">{value}</p>
      <p className="text-[11px] uppercase text-text-secondary">{label}</p>
    </div>
  );
}
