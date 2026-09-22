import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import { publicLivePath } from '@/lib/live';
import { isLiveMatch } from '@/lib/roles';
import { useAuth } from '@/context/AuthContext';
import { UnderlineTabs } from '@/components/ui/Pills';
import { EmptyState, ErrorRetry, PageSkeleton } from '@/components/ui/Feedback';
import { Button } from '@/components/ui/Button';
import type { Match, Page } from '@/types/api';
import type { MyTeamCard } from '@/pages/MyTeamsPage';
import type { MyTournamentCard } from '@/pages/MyTournamentsPage';

type PlayedRow = {
  match: Match;
  tournament: Match['tournament'];
  team: { id: string; name: string };
  opponent: { id: string; name: string };
  status: string;
  result: string | null;
  playerPerformance?: { runs: number; wickets: number; mvp: number } | null;
};

type Tab = 'live' | 'upcoming' | 'completed';

export function MyMatchesPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const playerId = user?.player?.id;
  const [params, setParams] = useSearchParams();
  const tab = ((params.get('filter') as Tab | null) || 'live') as Tab;
  const page = Math.max(1, Number(params.get('page') || 1));
  const [tournamentId, setTournamentId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [season, setSeason] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const teamsQ = useQuery({ queryKey: keys.myTeams, queryFn: () => api<MyTeamCard[]>('/api/v1/users/me/teams') });
  const tournamentsQ = useQuery({
    queryKey: keys.myTournaments,
    queryFn: () => api<Page<MyTournamentCard>>('/api/v1/users/me/tournaments?limit=50'),
  });
  const q = useQuery({
    queryKey: [...keys.myPlayedMatches, tab, tournamentId, teamId, season, from, to, page],
    queryFn: () => {
      const search = new URLSearchParams({ status: tab, page: String(page), limit: '20' });
      if (tournamentId) search.set('tournamentId', tournamentId);
      if (teamId) search.set('teamId', teamId);
      if (season) search.set('season', season);
      if (from) search.set('from', from);
      if (to) search.set('to', to);
      return api<Page<PlayedRow>>(`/api/v1/users/me/played-matches?${search}`);
    },
  });
  const seasons = [...new Set((tournamentsQ.data?.items ?? []).map((tn) => tn.season).filter(Boolean))] as string[];

  if (q.isLoading) return <PageSkeleton />;
  if (q.isError) return <ErrorRetry onRetry={() => void q.refetch()} />;
  const rows = q.data?.items ?? [];

  const setPage = (next: number) => {
    const copy = new URLSearchParams(params);
    copy.set('page', String(next));
    setParams(copy, { replace: true });
  };

  return (
    <div className="py-4">
      <h1 className="px-[var(--gutter)] text-xl font-bold">{t('drawer.myMatches')}</h1>
      <div className="mt-3 px-[var(--gutter)]">
        <UnderlineTabs
          value={tab}
          onChange={(next) => {
            const copy = new URLSearchParams(params);
            copy.set('filter', next);
            copy.delete('page');
            setParams(copy, { replace: true });
          }}
          items={[
            { id: 'live', label: t('match.live') },
            { id: 'upcoming', label: t('match.upcoming') },
            { id: 'completed', label: t('match.completed') },
          ]}
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-2 px-[var(--gutter)]">
        <select className="min-h-touch rounded-pill border border-border bg-muted px-3 text-sm" value={tournamentId} onChange={(e) => setTournamentId(e.target.value)} aria-label={t('common.tournaments')}>
          <option value="">{t('profile.allTournaments')}</option>
          {(tournamentsQ.data?.items ?? []).map((tn) => (
            <option key={tn.id} value={tn.id}>{tn.name}</option>
          ))}
        </select>
        <select className="min-h-touch rounded-pill border border-border bg-muted px-3 text-sm" value={teamId} onChange={(e) => setTeamId(e.target.value)} aria-label={t('common.teams')}>
          <option value="">{t('playerHome.allTeams')}</option>
          {(teamsQ.data ?? []).map((team) => (
            <option key={team.id} value={team.id}>{team.name}</option>
          ))}
        </select>
        <select className="min-h-touch rounded-pill border border-border bg-muted px-3 text-sm" value={season} onChange={(e) => setSeason(e.target.value)} aria-label={t('tournaments.season')}>
          <option value="">{t('playerHome.allSeasons')}</option>
          {seasons.map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
        <input
          type="date"
          className="min-h-touch rounded-pill border border-border bg-muted px-3 text-sm"
          value={from}
          onChange={(e) => {
            setFrom(e.target.value);
            setPage(1);
          }}
          aria-label={t('common.fromDate')}
        />
        <input
          type="date"
          className="min-h-touch rounded-pill border border-border bg-muted px-3 text-sm"
          value={to}
          onChange={(e) => {
            setTo(e.target.value);
            setPage(1);
          }}
          aria-label={t('common.toDate')}
        />
      </div>
      {!rows.length ? <EmptyState title={t('home.noMyMatches')} /> : null}
      <ul className="mt-4 flex flex-col gap-3 px-[var(--gutter)]">
        {rows.map((row) => {
          const m = row.match;
          const live = isLiveMatch(m.status);
          const watch = live && m.publicSlug && m.publicLiveEnabled ? publicLivePath(m.publicSlug) : `/matches/${m.id}/centre`;
          return (
            <li key={m.id} className="rounded-xl border border-border bg-bg p-4 shadow-sm">
              <p className="font-semibold">
                {m.homeTeam.name} vs {m.awayTeam.name}
              </p>
              <p className="mt-1 text-xs text-text-secondary">
                {[m.scheduledAt ? new Date(m.scheduledAt).toLocaleDateString() : null, row.tournament?.name, row.result ?? m.status.replace('_', ' ')].filter(Boolean).join(' · ')}
              </p>
              {row.playerPerformance ? (
                <p className="mt-2 text-sm font-semibold">
                  {row.playerPerformance.runs} {t('profile.runs').toLowerCase()} · {row.playerPerformance.wickets} {t('profile.wickets').toLowerCase()} · {row.playerPerformance.mvp} {t('home.mvpPoints')}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-3 text-sm font-bold text-primary">
                <Link to={`/matches/${m.id}/centre`}>{t('match.view')}</Link>
                <Link to={`/matches/${m.id}/centre`}>{t('playerHome.viewScorecard')}</Link>
                {playerId ? <Link to={`/matches/${m.id}/player/${playerId}`}>{t('playerHome.viewPerformance')}</Link> : null}
                {live ? <Link to={watch}>{t('share.watchLive')}</Link> : null}
              </div>
            </li>
          );
        })}
      </ul>
      {(q.data && (q.data.page > 1 || q.data.hasMore)) ? (
        <div className="mt-4 flex justify-center gap-3 px-[var(--gutter)]">
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t('common.back')}</Button>
          <Button variant="outline" disabled={!q.data.hasMore} onClick={() => setPage(page + 1)}>{t('common.viewAll')}</Button>
        </div>
      ) : null}
    </div>
  );
}
