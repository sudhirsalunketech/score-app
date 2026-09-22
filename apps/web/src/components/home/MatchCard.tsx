import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import type { Match } from '@/types/api';
import { Avatar } from '@/components/ui/Avatar';
import { canScoreThisMatch, isLiveMatch, isUpcomingMatch } from '@/lib/roles';
import { cn } from '@/lib/cn';
import { publicLivePath } from '@/lib/live';
import { formatMatchWhen, formatOversFromBalls } from '@/lib/format';
import { resultHeadline } from '@/lib/match-result';
import { SharePreview, ShareSheet } from '@/components/share/ShareSheet';
import { destinationsForMatch } from '@/lib/share-destinations';
import { InfoTooltip } from '@/components/ui/InfoTooltip';

const ACTION =
  'inline-flex min-h-touch min-w-touch items-center justify-center rounded-lg px-3 text-sm font-semibold transition-colors duration-[var(--motion)] active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40';

export function MatchCard({ match, layout = 'carousel' }: { match: Match; layout?: 'carousel' | 'list' }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const live = isLiveMatch(match.status);
  const upcoming = isUpcomingMatch(match.status);
  const inn = match.innings?.[0];
  const score = inn ? `${inn.totalRuns}-${inn.totalWickets}` : '0-0';
  const canScore = canScoreThisMatch(user, match);
  const [shareOpen, setShareOpen] = useState(false);
  const destinations = destinationsForMatch(match);
  const when = formatMatchWhen(match.scheduledAt);
  const winnerId = match.resultWinnerTeamId ?? null;
  const winner =
    winnerId === match.awayTeam.id ? match.awayTeam.name : winnerId === match.homeTeam.id ? match.homeTeam.name : null;
  const result =
    match.status === 'COMPLETED'
      ? resultHeadline({
          resultType: match.resultType,
          winnerName: winner,
          marginType: match.marginType,
          marginValue: match.marginValue,
          labels: {
            completed: t('match.final'),
            wonBy: t('result.wonBy'),
            runs: t('result.runs'),
            wickets: t('result.wickets'),
            tie: t('result.tie'),
            noResult: t('result.noResult'),
            abandoned: t('result.abandoned'),
          },
        })
      : null;
  const viewHref =
    match.publicSlug && (match.publicLiveEnabled || match.visibility === 'PUBLIC' || match.visibility === 'UNLISTED')
      ? publicLivePath(match.publicSlug)
      : `/matches/${match.id}/centre`;
  const scoreHref = `/matches/${match.id}/score`;
  const editHref = `/matches/${match.id}`;
  const showScoreAction = canScore && (live || upcoming);
  const meta = [match.format, when, match.tournament?.name].filter(Boolean).join(' · ');

  return (
    <article
      className={cn(
        'rounded-xl border border-border bg-bg p-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)]',
        layout === 'carousel' ? 'w-[78vw] max-w-sm shrink-0 sm:w-80' : 'w-full min-w-0',
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-[11px] font-medium text-text-secondary">{meta || '—'}</span>
        <StatusBadge status={match.status} live={live} />
      </div>
      <Link to={viewHref} className="block min-w-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
        <TeamRow
          team={match.homeTeam}
          innings={inningsForTeam(match, match.homeTeam.id)}
          ballsPerOver={match.ballsPerOver}
          winner={winnerId === match.homeTeam.id}
        />
        {upcoming && !match.innings?.length ? (
          <p className="py-1 text-center text-[10px] font-bold uppercase tracking-wide text-text-secondary">vs</p>
        ) : (
          <div className="h-2" />
        )}
        <TeamRow
          team={match.awayTeam}
          innings={inningsForTeam(match, match.awayTeam.id)}
          ballsPerOver={match.ballsPerOver}
          winner={winnerId === match.awayTeam.id}
        />
      </Link>
      {result ? (
        <p className="mt-3 truncate text-xs font-medium text-text-secondary">
          <span className="me-1 text-success" aria-hidden>
            ✓
          </span>
          {result}
        </p>
      ) : null}
      {match.myAccess ? (
        <p className="mt-2 text-[11px] font-medium text-text-secondary">
          {t('access.yourAccess')}: {t(`access.level.${match.myAccess.level}`)}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Link to={viewHref} className={cn(ACTION, showScoreAction ? 'border border-border text-primary hover:bg-muted' : 'bg-primary text-on-dark hover:bg-primary-dark')}>
          {t('match.view')}
        </Link>
        {showScoreAction ? (
          <Link to={live ? scoreHref : editHref} className={cn(ACTION, 'bg-primary text-on-dark hover:bg-primary-dark')}>
            {live ? t('match.resume') : t('match.score')}
          </Link>
        ) : null}
        {!canScore && live && match.publicSlug && match.publicLiveEnabled ? (
          <Link to={publicLivePath(match.publicSlug)} className={cn(ACTION, 'border border-border text-primary hover:bg-muted')}>
            {t('share.watchLive')}
          </Link>
        ) : null}
        {destinations.length ? (
          <button
            type="button"
            className={cn(ACTION, 'border border-border text-primary hover:bg-muted')}
            onClick={() => setShareOpen(true)}
          >
            {t('common.share')}
          </button>
        ) : null}
        {match.tournamentId ? (
          <Link to={`/tournaments/${match.tournamentId}`} className={cn(ACTION, 'text-primary hover:bg-muted')}>
            {t('home.viewTournament')}
          </Link>
        ) : null}
      </div>
      <ShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        heading={t('share.shareMatch')}
        destinations={destinations}
        preview={
          <SharePreview
            home={match.homeTeam.name}
            away={match.awayTeam.name}
            homeLogo={match.homeTeam.logoUrl}
            awayLogo={match.awayTeam.logoUrl}
            live={live}
            score={score.replace('-', '/')}
            tournament={match.tournament?.name}
          />
        }
      />
    </article>
  );
}

export function inningsForTeam(match: Match, teamId: string) {
  const inns = (match.innings ?? []).filter((row) => !row.isSuperOver && row.battingTeamId === teamId);
  return [...inns].sort((a, b) => a.inningsNumber - b.inningsNumber);
}

/** Joins a team's innings scores for display, e.g. "86-9 & 115-9" for a Test match, "73-0" for a single innings. */
export function teamScoreLine(innings: NonNullable<Match['innings']>): string {
  return innings.map((inn) => `${inn.totalRuns}-${inn.totalWickets}${inn.status === 'DECLARED' ? 'd' : ''}`).join(' & ');
}

function TeamRow({
  team,
  innings,
  ballsPerOver,
  winner,
}: {
  team: Match['homeTeam'];
  innings: NonNullable<Match['innings']>;
  ballsPerOver: number;
  winner: boolean;
}) {
  const score = teamScoreLine(innings);
  const overs = innings.length === 1 ? formatOversFromBalls(innings[0]!.totalBallsLegal, ballsPerOver) : null;
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Avatar name={team.name} src={team.logoUrl} kind="team" size={32} />
      <p className={cn('min-w-0 flex-1 truncate text-sm uppercase tracking-wide text-text', winner ? 'font-bold' : 'font-semibold')}>
        {team.name}
      </p>
      {innings.length ? (
        <div className="shrink-0 text-end">
          <p className="text-xl font-bold tabular-nums leading-none text-primary">{score}</p>
          {overs ? <p className="mt-0.5 text-[10px] font-medium tabular-nums text-text-secondary">{overs}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function StatusBadge({ status, live }: { status: Match['status']; live: boolean }) {
  const { t } = useTranslation();
  if (live) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-bold uppercase text-live">
        <span className="cs-live-dot h-1.5 w-1.5 rounded-full bg-live" />
        {t('match.live')}
      </span>
    );
  }
  if (status === 'CANCELLED') {
    return <span className="shrink-0 text-[11px] font-bold uppercase text-danger">{t('match.cancelled')}</span>;
  }
  if (status === 'ABANDONED') {
    return <span className="shrink-0 text-[11px] font-bold uppercase text-text-secondary">{t('match.abandoned')}</span>;
  }
  if (status === 'COMPLETED') {
    return <span className="shrink-0 text-[11px] font-bold uppercase text-success">{t('match.final')}</span>;
  }
  return <span className="shrink-0 text-[11px] font-bold uppercase text-primary">{t('match.upcoming')}</span>;
}

export function MatchCarousel({ matches }: { matches: Match[] }) {
  return (
    <div className="flex gap-3 overflow-x-auto px-[var(--gutter)] pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {matches.map((m) => (
        <MatchCard key={m.id} match={m} />
      ))}
    </div>
  );
}

export function matchStatusLabel(match: Match, t: (key: string) => string) {
  if (isLiveMatch(match.status)) return t('match.live');
  if (match.status === 'CANCELLED') return t('match.cancelled');
  if (match.status === 'COMPLETED' || match.status === 'ABANDONED') return t('match.completed');
  return t('match.upcoming');
}

export function MatchTable({ matches }: { matches: Match[] }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  return (
    <div className="table-scroll">
      <table className="w-full min-w-[44rem] text-start text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-text-secondary">
            <th className="py-3 pe-3 font-semibold">{t('match.teams')}</th>
            <th className="py-3 pe-3 font-semibold">{t('match.score')}</th>
            <th className="py-3 pe-3 font-semibold">{t('common.date')}</th>
            <th className="py-3 pe-3 font-semibold">{t('common.venue')}</th>
            <th className="py-3 pe-3 font-semibold">{t('common.tournaments')}</th>
            <th className="py-3 pe-3 font-semibold">
              <span className="inline-flex items-center gap-0.5">
                {t('match.status')}
                <InfoTooltip topic={t('match.status')} compact>
                  {t('info.match.statusFilter')}
                </InfoTooltip>
              </span>
            </th>
            <th className="py-3 font-semibold">{t('match.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {matches.map((match) => {
            const live = isLiveMatch(match.status);
            const homeInnings = inningsForTeam(match, match.homeTeam.id);
            const awayInnings = inningsForTeam(match, match.awayTeam.id);
            const homeScore = homeInnings.length ? teamScoreLine(homeInnings) : null;
            const awayScore = awayInnings.length ? teamScoreLine(awayInnings) : null;
            const canScore = canScoreThisMatch(user, match);
            const viewHref =
              match.publicSlug && (match.publicLiveEnabled || match.visibility === 'PUBLIC' || match.visibility === 'UNLISTED')
                ? publicLivePath(match.publicSlug)
                : `/matches/${match.id}/centre`;
            return (
              <tr key={match.id} className="border-b border-border">
                <td className="py-3 pe-3">
                  <p className="font-semibold">{match.homeTeam.name}</p>
                  <p className="text-text-secondary">{match.awayTeam.name}</p>
                </td>
                <td className="py-3 pe-3 font-bold tabular-nums">
                  {homeScore || awayScore ? (
                    <>
                      {homeScore ? <p>{homeScore}</p> : null}
                      {awayScore ? <p className="text-text-secondary">{awayScore}</p> : null}
                    </>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="py-3 pe-3 whitespace-nowrap">{formatMatchWhen(match.scheduledAt) || '—'}</td>
                <td className="max-w-[10rem] truncate py-3 pe-3">{match.venueText || '—'}</td>
                <td className="max-w-[10rem] truncate py-3 pe-3">{match.tournament?.name || '—'}</td>
                <td className={cn('py-3 pe-3 font-semibold uppercase', live && 'text-live', match.status === 'CANCELLED' && 'text-danger')}>
                  {matchStatusLabel(match, t)}
                </td>
                <td className="py-3">
                  <div className="flex flex-wrap gap-2">
                    <Link to={viewHref} className="min-h-touch font-semibold text-primary">
                      {t('match.view')}
                    </Link>
                    {canScore && (live || isUpcomingMatch(match.status)) ? (
                      <Link to={live ? `/matches/${match.id}/score` : `/matches/${match.id}`} className="min-h-touch font-semibold text-primary">
                        {live ? t('match.resume') : t('match.start')}
                      </Link>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function CarouselDots({ count, index }: { count: number; index: number }) {
  if (count < 2) return null;
  return (
    <div className="mt-2 flex justify-center gap-1.5">
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className={cn('h-1.5 w-1.5 rounded-full', i === index ? 'bg-primary' : 'bg-border')}
        />
      ))}
    </div>
  );
}
