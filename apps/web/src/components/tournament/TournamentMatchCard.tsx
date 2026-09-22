import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import type { Match } from '@/types/api';
import { Avatar } from '@/components/ui/Avatar';
import { formatOversFromBalls } from '@/lib/format';
import { matchGroupName } from '@/lib/match-meta';
import { isSameLocalDay } from '@/lib/tour';
import { formatLocalDate, toLocalDateInput } from '@/lib/datetime';
import { cn } from '@/lib/cn';
import { publicLivePath } from '@/lib/live';
import { SharePreview, ShareSheet } from '@/components/share/ShareSheet';
import { destinationsForMatch } from '@/lib/share-destinations';
import { canScoreThisMatch } from '@/lib/roles';

export function TournamentMatchCard({ match }: { match: Match }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [shareOpen, setShareOpen] = useState(false);
  const live = match.status === 'LIVE' || match.status === 'INNINGS_BREAK';
  const inn =
    match.innings?.find((i) => i.status === 'IN_PROGRESS') ?? match.innings?.[match.innings.length - 1] ?? null;
  const battingId = inn?.battingTeamId;
  const score = inn
    ? `${inn.totalRuns}-${inn.totalWickets} (${formatOversFromBalls(inn.totalBallsLegal, match.ballsPerOver)})`
    : null;
  const group = matchGroupName(match);
  const when = match.scheduledAt
    ? isSameLocalDay(match.scheduledAt)
      ? t('tournaments.today')
      : formatLocalDate(toLocalDateInput(match.scheduledAt))
    : '';
  const meta = [group ? t('match.groupMatch', { group }) : match.title, match.format, when].filter(Boolean).join(', ');
  const shareable = Boolean(match.publicSlug) && (match.publicLiveEnabled || match.visibility === 'PUBLIC' || match.visibility === 'UNLISTED');
  const href = shareable && match.publicSlug ? publicLivePath(match.publicSlug) : `/matches/${match.id}/centre`;
  const destinations = destinationsForMatch(match);
  const canScore = canScoreThisMatch(user, match);

  return (
    <article className="min-w-[85%] max-w-sm shrink-0 rounded-xl bg-bg p-4 shadow-[0_1px_8px_rgba(0,0,0,0.12)]">
      <Link to={href} className="block">
        <div className="mb-3 flex items-start justify-between gap-2">
          <p className="text-xs text-text-secondary">{meta}</p>
          {live ? (
            <span className="text-xs font-bold uppercase text-live">{t('match.live')}</span>
          ) : match.status === 'COMPLETED' ? (
            <span className="text-xs font-semibold uppercase">{t('match.final')}</span>
          ) : (
            <span className="text-xs font-semibold uppercase text-text-secondary">{t('match.upcoming')}</span>
          )}
        </div>
        <TeamLine team={match.homeTeam} score={battingId === match.homeTeam.id ? score : null} />
        <TeamLine team={match.awayTeam} score={battingId === match.awayTeam.id ? score : null} className="mt-2" />
      </Link>
      <div className="mt-3 flex flex-wrap gap-3">
        <Link to={href} className="min-h-touch text-sm font-semibold text-primary">
          {t('match.view')}
        </Link>
        {!canScore && live && shareable && match.publicSlug ? (
          <Link to={publicLivePath(match.publicSlug)} className="min-h-touch text-sm font-semibold text-primary">
            {t('share.watchLive')}
          </Link>
        ) : null}
        {canScore && live ? (
          <Link to={`/matches/${match.id}/score`} className="min-h-touch text-sm font-semibold text-primary">
            {t('match.resume')}
          </Link>
        ) : null}
        {destinations.length ? (
          <button type="button" className="min-h-touch text-sm font-semibold text-primary" onClick={() => setShareOpen(true)}>
            {t('common.share')}
          </button>
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
            score={inn ? `${inn.totalRuns}/${inn.totalWickets}` : undefined}
            overs={inn ? formatOversFromBalls(inn.totalBallsLegal, match.ballsPerOver) : undefined}
            tournament={match.tournament?.name}
          />
        }
      />
    </article>
  );
}

function TeamLine({
  team,
  score,
  className,
}: {
  team: Match['homeTeam'];
  score: string | null;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Avatar name={team.name} src={team.logoUrl} kind="team" size={28} />
      <p className="min-w-0 flex-1 truncate text-sm font-bold uppercase">{team.name}</p>
      {score ? <p className="shrink-0 text-sm font-bold tabular-nums">{score}</p> : null}
    </div>
  );
}
