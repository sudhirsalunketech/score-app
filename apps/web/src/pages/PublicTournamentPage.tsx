import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { setPageMeta, publicLivePath, publicTournamentUrl } from '@/lib/live';
import { tournamentShareText } from '@/lib/share-text';
import { ShareSheet } from '@/components/share/ShareSheet';
import { MatchCentreHeader } from '@/components/centre/MatchCentreHeader';
import { UnderlineTabs } from '@/components/ui/Pills';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { ErrorRetry, Spinner } from '@/components/ui/Feedback';
import { TournamentPointsTab } from '@/components/tournament/TournamentPointsTab';
import { SuperStarsList } from '@/components/match/SuperStarsList';
import type { MvpPlayerRow, PointsGroup, StatRow } from '@/types/api';

type PublicTn = {
  publicSlug: string;
  name: string;
  season?: string | null;
  coverImageUrl?: string | null;
  clubName?: string | null;
  groups: Array<{ id: string; name: string; teams: Array<{ teamId: string; name: string; logoUrl: string | null }> }>;
  matches: Array<{
    publicSlug: string | null;
    title: string;
    status: string;
    scheduledAt?: string | null;
    venueText?: string | null;
    overs: number;
    homeTeam: { name: string; logoUrl: string | null };
    awayTeam: { name: string; logoUrl: string | null };
    watchLive: boolean;
    score: { battingTeamId?: string; runs: number; wickets: number; overs: string } | null;
  }>;
};

type Tab = 'matches' | 'points' | 'teams' | 'stats' | 'mvp';

export function PublicTournamentPage() {
  const { slug = '' } = useParams();
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('matches');
  const [shareOpen, setShareOpen] = useState(false);
  const q = useQuery({
    queryKey: ['public-tournament', slug],
    queryFn: () => api<PublicTn>(`/api/v1/public/tournaments/${slug}`, { auth: false }),
    retry: false,
  });
  const points = useQuery({
    queryKey: ['public-tournament-points', slug],
    queryFn: () => api<PointsGroup[]>(`/api/v1/public/tournaments/${slug}/points`, { auth: false }),
    enabled: tab === 'points',
    retry: false,
  });
  const mvp = useQuery({
    queryKey: ['public-tournament-mvp', slug],
    queryFn: () => api<{ rows?: StatRow[] } | StatRow[]>(`/api/v1/public/tournaments/${slug}/mvp`, { auth: false }),
    enabled: tab === 'mvp',
    retry: false,
  });
  const stats = useQuery({
    queryKey: ['public-tournament-stats', slug],
    queryFn: () => api<StatRow[]>(`/api/v1/public/tournaments/${slug}/stats?category=mostRuns`, { auth: false }),
    enabled: tab === 'stats',
    retry: false,
  });
  const wickets = useQuery({
    queryKey: ['public-tournament-wickets', slug],
    queryFn: () => api<StatRow[]>(`/api/v1/public/tournaments/${slug}/stats?category=mostWickets`, { auth: false }),
    enabled: tab === 'stats',
    retry: false,
  });
  const tn = q.data;
  const live = (tn?.matches ?? []).filter((m) => m.status === 'LIVE' || m.status === 'INNINGS_BREAK');
  const upcoming = (tn?.matches ?? []).filter((m) => m.status !== 'LIVE' && m.status !== 'INNINGS_BREAK' && m.status !== 'COMPLETED' && m.status !== 'ABANDONED');
  const done = (tn?.matches ?? []).filter((m) => m.status === 'COMPLETED' || m.status === 'ABANDONED');
  const mvpRows = useMemo(() => {
    const d = mvp.data;
    const raw = !d ? [] : Array.isArray(d) ? d : Array.isArray(d.rows) ? d.rows : [];
    return raw.map(
      (r): MvpPlayerRow => ({
        playerId: r.playerId ?? r.playerName,
        playerName: r.playerName,
        teamName: r.teamName ?? '',
        batting: r.breakdown?.bat ?? 0,
        bowling: r.breakdown?.bowl ?? 0,
        fielding: r.breakdown?.field ?? 0,
        total: typeof r.value === 'number' ? r.value : Number(r.value) || 0,
      }),
    );
  }, [mvp.data]);

  useEffect(() => {
    if (!tn) return;
    setPageMeta({
      title: `${tn.name} | CrickScore`,
      description: `${tn.name}. Live scores, fixtures, points table, stats and MVP.`,
      url: publicTournamentUrl(slug),
      image: tn.coverImageUrl || `${window.location.origin}/favicon.svg`,
    });
  }, [slug, tn]);

  if (q.isLoading) return <Spinner />;
  if (q.isError || !tn) {
    return <ErrorRetry message={t('match.unableToLoad')} onRetry={() => void q.refetch()} />;
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1100px] flex-col bg-bg">
      <MatchCentreHeader onBack={() => window.history.back()} />
      <div className="px-[var(--gutter)] pb-3">
        <p className="text-xs">🏆</p>
        <h1 className="text-xl font-bold">{tn.name}</h1>
        {tn.season ? <p className="text-sm text-text-secondary">{tn.season}</p> : null}
        <Button type="button" variant="outline" className="mt-3 w-full" onClick={() => setShareOpen(true)}>
          {t('share.shareTournament')}
        </Button>
      </div>
      <UnderlineTabs
        value={tab}
        onChange={(v) => setTab(v as Tab)}
        tone="ink"
        items={[
          { id: 'matches', label: t('tournaments.matches') },
          { id: 'points', label: t('tournaments.points') },
          { id: 'teams', label: t('tournaments.teams') },
          { id: 'stats', label: t('tournaments.statistics') },
          { id: 'mvp', label: t('statistics.mvp') },
        ]}
      />
      {tab === 'matches' ? (
        <div className="flex flex-col gap-4 p-[var(--gutter)] pb-10">
          {live.length ? <p className="text-xs font-bold uppercase text-live">{t('share.liveNow')}</p> : null}
          {live.map((m) => (
            <PublicMatchRow key={m.title + m.status} match={m} />
          ))}
          {upcoming.length ? <p className="text-xs font-bold uppercase text-text-secondary">{t('share.upcoming')}</p> : null}
          {upcoming.map((m) => (
            <PublicMatchRow key={m.title + (m.scheduledAt ?? '')} match={m} />
          ))}
          {done.length ? <p className="text-xs font-bold uppercase text-text-secondary">{t('share.completed')}</p> : null}
          {done.map((m) => (
            <PublicMatchRow key={m.title + 'done'} match={m} />
          ))}
        </div>
      ) : null}
      {tab === 'points' ? (
        <TournamentPointsTab
          groups={points.data ?? []}
          loading={points.isFetching}
          canEdit={false}
          onRefresh={async () => points.refetch()}
          onAddTeam={() => undefined}
          onRemoveTeam={() => undefined}
          onRemoveGroup={() => undefined}
          onCreateGroup={() => undefined}
          creatingGroup={false}
        />
      ) : null}
      {tab === 'teams' ? (
        <div className="grid grid-cols-2 gap-4 p-[var(--gutter)]">
          {tn.groups.flatMap((g) => g.teams).map((team) => (
            <div key={team.teamId} className="flex flex-col items-center gap-2">
              <Avatar name={team.name} src={team.logoUrl} kind="team" size={72} />
              <p className="text-xs font-bold uppercase">{team.name}</p>
            </div>
          ))}
        </div>
      ) : null}
      {tab === 'stats' ? (
        <div className="pb-8">
          <h2 className="px-[var(--gutter)] pt-4 text-sm font-bold uppercase text-text-secondary">{t('statistics.mostRuns')}</h2>
          <StatRankList rows={stats.data ?? []} empty={t('statistics.empty')} />
          <h2 className="px-[var(--gutter)] pt-4 text-sm font-bold uppercase text-text-secondary">{t('statistics.mostWickets')}</h2>
          <StatRankList rows={wickets.data ?? []} empty={t('statistics.empty')} />
        </div>
      ) : null}
      {tab === 'mvp' ? <SuperStarsList rows={mvpRows} /> : null}
      <ShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        heading={t('share.shareTournament')}
        destinations={[
          {
            id: 'tn',
            label: t('share.shareTournament'),
            url: publicTournamentUrl(slug),
            title: tn.name,
            text: tournamentShareText({ name: tn.name, season: tn.season, url: publicTournamentUrl(slug) }),
          },
        ]}
      />
    </div>
  );
}

function PublicMatchRow({ match }: { match: PublicTn['matches'][number] }) {
  const { t } = useTranslation();
  const live = match.status === 'LIVE' || match.status === 'INNINGS_BREAK';
  return (
    <article className="rounded-card border border-border p-3">
      {live ? <p className="mb-1 text-xs font-bold uppercase text-live">{t('share.liveNow')}</p> : null}
      <div className="flex items-center gap-2">
        <Avatar name={match.homeTeam.name} src={match.homeTeam.logoUrl} kind="team" size={28} />
        <p className="flex-1 truncate text-sm font-bold uppercase">{match.homeTeam.name}</p>
        {match.score ? <p className="font-bold">{match.score.runs}/{match.score.wickets}</p> : null}
      </div>
      {match.score ? <p className="ps-9 text-xs text-text-secondary">{match.score.overs} {t('live.overs')}</p> : null}
      <div className="mt-2 flex items-center gap-2">
        <Avatar name={match.awayTeam.name} src={match.awayTeam.logoUrl} kind="team" size={28} />
        <p className="flex-1 truncate text-sm font-bold uppercase">{match.awayTeam.name}</p>
      </div>
      <div className="mt-3 flex gap-3">
        {match.watchLive && match.publicSlug ? (
          <Link to={publicLivePath(match.publicSlug)} className="min-h-touch text-sm font-semibold text-primary">
            {t('share.watchLive')}
          </Link>
        ) : match.publicSlug ? (
          <Link to={`/match/${match.publicSlug}`} className="min-h-touch text-sm font-semibold text-primary">
            {t('match.view')}
          </Link>
        ) : null}
      </div>
    </article>
  );
}

function StatRankList({ rows, empty }: { rows: StatRow[]; empty: string }) {
  if (!rows.length) return <p className="px-[var(--gutter)] py-4 text-sm text-text-secondary">{empty}</p>;
  return (
    <ol className="px-[var(--gutter)]">
      {rows.map((row, i) => (
        <li key={row.playerId ?? `${row.playerName}-${i}`} className="flex items-center gap-3 border-b border-border py-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-on-dark">
            {row.rank ?? i + 1}
          </span>
          <Avatar name={row.playerName} size={40} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{row.playerName}</p>
            {row.teamName ? <p className="text-xs uppercase text-text-secondary">{row.teamName}</p> : null}
          </div>
          <p className="text-lg font-bold">{row.value}</p>
        </li>
      ))}
    </ol>
  );
}
