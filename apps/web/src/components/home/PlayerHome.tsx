import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import { publicLivePath } from '@/lib/live';
import { useAuth } from '@/context/AuthContext';
import type { BallEvent, HomeData, LiveData, Match, Team, Tournament } from '@/types/api';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Feedback';
import { SectionHeader } from '@/components/home/SectionHeader';
import { TournamentCard } from '@/components/home/TournamentCard';
import { isLiveMatch } from '@/lib/roles';
import { formatOversFromBalls } from '@/lib/format';
import { ballFeedBadge } from '@/lib/ball-feed';

type TeamCard = Team & { club?: { name?: string | null } | null };

export function PlayerHome({ data }: { data: HomeData }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const live = data.liveMatches ?? [];
  const upcoming = data.upcomingMatches ?? [];
  const recent = data.recentMatches ?? [];
  const snap = data.profileSnapshot;
  const player = snap?.player ?? user?.player;
  const name = player?.name ?? user?.name ?? '';
  const teams = (snap?.teams ?? []) as TeamCard[];
  const tournaments = data.tournaments ?? [];

  return (
    <div className="py-4">
      <div className="mb-5 flex items-center gap-3 px-[var(--gutter)]">
        <Link to={player?.id ? `/players/${player.id}` : '/profile'} className="flex min-w-0 items-center gap-3">
          <Avatar name={name} src={player?.photoUrl ?? user?.avatarUrl} kind="person" size={56} />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold">{name}</h1>
            <p className="text-xs font-bold uppercase tracking-wide text-primary">{t('playerHome.role')}</p>
            {player?.profileCode ? <p className="text-xs text-text-secondary">{player.profileCode}</p> : null}
          </div>
        </Link>
      </div>

      <section className="mb-6">
        <SectionHeader title={t('playerHome.liveNow')} to="/my-matches?filter=live" />
        {live[0] ? <PlayerLiveNow match={live[0]} /> : <p className="px-[var(--gutter)] text-sm text-text-secondary">{t('home.noLive')}</p>}
      </section>

      <MatchStrip title={t('home.upcoming')} to="/my-matches?filter=upcoming" matches={upcoming} empty={t('home.noUpcoming')} />
      <MatchStrip title={t('home.recent')} to="/my-matches?filter=completed" matches={recent} empty={t('home.noRecent')} />

      <section className="mt-6">
        <SectionHeader title={t('home.myTeams')} to="/my-teams" />
        {teams.length ? (
          <div className="flex gap-3 overflow-x-auto px-[var(--gutter)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {teams.map((team) => (
              <Link key={team.id} to={`/teams/${team.id}`} className="flex w-32 shrink-0 flex-col items-center gap-2 rounded-xl border border-border bg-bg p-3 shadow-sm">
                <Avatar name={team.name} src={team.logoUrl} kind="team" size={56} />
                <p className="line-clamp-2 text-center text-xs font-bold">{team.name}</p>
              </Link>
            ))}
          </div>
        ) : (
          <p className="px-[var(--gutter)] text-sm text-text-secondary">{t('teams.noTeams')}</p>
        )}
      </section>

      <section className="mt-6">
        <SectionHeader title={t('home.tournaments')} to="/my-tournaments" />
        {tournaments.length ? (
          <div className="flex gap-3 overflow-x-auto px-[var(--gutter)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {tournaments.map((tn: Tournament) => (
              <TournamentCard key={tn.id} tournament={tn} />
            ))}
          </div>
        ) : (
          <EmptyState title={t('home.noTournaments')} />
        )}
      </section>

      <section className="mt-8 px-[var(--gutter)]">
        <h2 className="mb-3 text-lg font-bold">{t('playerHome.quickStats')}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat value={snap?.matches ?? 0} label={t('profile.matches')} />
          <Stat value={snap?.runs ?? 0} label={t('profile.runs')} />
          <Stat value={snap?.bestScore ?? 0} label={t('profile.highScore')} />
          <Stat value={snap?.strikeRate ?? 0} label={t('profile.strikeRate')} />
          <Stat value={snap?.wickets ?? 0} label={t('profile.wickets')} />
          <Stat value={snap?.economy ?? 0} label={t('profile.economy')} />
          <Stat value={snap?.mvpPoints ?? 0} label={t('home.mvpPoints')} />
        </div>
        {player?.id ? (
          <Link to={`/players/${player.id}?tab=statistics`} className="mt-4 inline-block text-sm font-bold text-primary">
            {t('playerHome.viewFullStats')}
          </Link>
        ) : null}
      </section>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-xl border border-border bg-bg p-3 shadow-sm">
      <p className="text-xl font-bold tabular-nums text-primary">{value}</p>
      <p className="mt-1 text-[11px] font-semibold uppercase text-text-secondary">{label}</p>
    </div>
  );
}

function MatchStrip({ title, to, matches, empty }: { title: string; to: string; matches: Match[]; empty: string }) {
  return (
    <section className="mt-6">
      <SectionHeader title={title} to={to} />
      {matches.length ? (
        <ul className="flex flex-col gap-2 px-[var(--gutter)]">
          {matches.slice(0, 4).map((m) => (
            <li key={m.id}>
              <Link to={`/matches/${m.id}/centre`} className="block rounded-xl border border-border bg-bg p-3 shadow-sm">
                <p className="font-semibold">
                  {m.homeTeam.name} vs {m.awayTeam.name}
                </p>
                <p className="mt-1 text-xs text-text-secondary">{[m.tournament?.name, m.status.replace('_', ' ')].filter(Boolean).join(' · ')}</p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-[var(--gutter)] text-sm text-text-secondary">{empty}</p>
      )}
    </section>
  );
}

function PlayerLiveNow({ match }: { match: Match }) {
  const { t } = useTranslation();
  const live = useQuery({
    queryKey: keys.live(match.id),
    queryFn: () => api<LiveData>(`/api/v1/matches/${match.id}/live`),
    enabled: isLiveMatch(match.status),
    refetchInterval: 4000,
  });
  const inn = live.data?.innings ?? match.innings?.[0];
  const events = useQuery({
    queryKey: keys.inningsEvents(inn?.id ?? ''),
    queryFn: () => api<BallEvent[]>(`/api/v1/innings/${inn!.id}/events`),
    enabled: Boolean(inn?.id) && isLiveMatch(match.status),
    refetchInterval: 4000,
  });
  const snap = live.data?.snapshot;
  const homeInn = match.innings?.find((i) => i.battingTeamId === match.homeTeam.id);
  const awayInn = match.innings?.find((i) => i.battingTeamId === match.awayTeam.id);
  const href =
    match.publicSlug && match.publicLiveEnabled ? publicLivePath(match.publicSlug) : `/matches/${match.id}/centre`;
  const names = new Map((match.players ?? []).map((p) => [p.playerId, p.player.name]));
  const batter = snap?.strikerId ? names.get(snap.strikerId) : null;
  const bowler = snap?.bowlerId ? names.get(snap.bowlerId) : null;
  const overs = snap?.oversDisplay ?? (inn ? formatOversFromBalls(inn.totalBallsLegal, match.ballsPerOver) : '0.0');

  return (
    <article className="mx-[var(--gutter)] rounded-xl border border-border bg-bg p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-live">● {t('match.live')}</p>
      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div>
          <p className="text-xs font-semibold uppercase text-text-secondary">{match.homeTeam.name}</p>
          <p className="text-2xl font-bold text-primary">
            {homeInn ? `${homeInn.totalRuns}/${homeInn.totalWickets}` : '—'}
          </p>
        </div>
        <p className="text-xs font-bold uppercase text-text-secondary">vs</p>
        <div className="text-end">
          <p className="text-xs font-semibold uppercase text-text-secondary">{match.awayTeam.name}</p>
          <p className="text-2xl font-bold text-primary">
            {awayInn ? `${awayInn.totalRuns}/${awayInn.totalWickets}` : inn && inn.battingTeamId === match.awayTeam.id ? `${inn.totalRuns}/${inn.totalWickets}` : '—'}
          </p>
        </div>
      </div>
      <p className="mt-2 text-sm font-semibold">
        {t('match.overs')} {overs} / {match.overs}
      </p>
      {batter || bowler ? (
        <p className="mt-1 text-xs text-text-secondary">
          {[batter ? `${t('playerHome.batter')}: ${batter}` : null, bowler ? `${t('playerHome.bowler')}: ${bowler}` : null]
            .filter(Boolean)
            .join(' · ')}
        </p>
      ) : null}
      {(events.data ?? []).length ? (
        <div className="mt-3">
          <p className="text-[11px] font-bold uppercase text-text-secondary">{t('playerHome.recentBalls')}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(events.data ?? []).slice(-8).map((ev) => (
              <span
                key={ev.sequence}
                className="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-bold"
              >
                {ballFeedBadge({
                  sequence: ev.sequence,
                  overNumber: ev.overNumber,
                  ballInOver: ev.ballInOver,
                  batsmanRuns: ev.batsmanRuns,
                  extraRuns: ev.extraRuns ?? 0,
                  extraType: ev.extraType,
                  isWicket: ev.isWicket,
                  bowlerName: '',
                  strikerName: '',
                })}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      <Link to={href} className="mt-4 block">
        <Button className="w-full" variant="primaryDark">
          {t('share.watchLiveScore')}
        </Button>
      </Link>
    </article>
  );
}
