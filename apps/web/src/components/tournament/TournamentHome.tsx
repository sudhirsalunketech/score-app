import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import type { Match, Team, Tournament, TournamentDashboard, TournamentPlayerStats } from '@/types/api';
import { Avatar } from '@/components/ui/Avatar';
import { IconLeatherBall, IconMore, IconShare, IconTennisBall } from '@/components/ui/Icons';
import { TournamentMatchCard } from '@/components/tournament/TournamentMatchCard';
import { formatLocalDate, toLocalDateInput } from '@/lib/datetime';
import { tourDisplayId } from '@/lib/tour';
import { cn } from '@/lib/cn';
import { BigNumberCard, DashSection, EmptyStats, fmtAvg, PerformerCard, PlayerLink, SummaryGrid } from './dash-ui';

export function TournamentHome({
  tournament,
  teams,
  dash,
  onCreateGroup,
  onStartMatch,
  onMore,
  onShare,
  canSchedule,
  canCreateGroup,
}: {
  tournament: Tournament;
  teams: Team[];
  dash: TournamentDashboard | undefined;
  onCreateGroup: () => void;
  onStartMatch: () => void;
  onMore: () => void;
  onShare?: () => void;
  canSchedule?: boolean;
  canCreateGroup?: boolean;
}) {
  const { t } = useTranslation();
  const { isAuthenticated, user } = useAuth();
  const playerId = user?.player?.id;
  const mine = useQuery({
    queryKey: keys.playerTournamentStats(playerId ?? '', tournament.id),
    queryFn: () => api<TournamentPlayerStats>(`/api/v1/players/${playerId}/tournaments/${tournament.id}/statistics`),
    enabled: Boolean(playerId),
  });
  const matches = tournament.matches ?? [];
  const location =
    [tournament.club?.name, tournament.club?.city].filter(Boolean).join(', ') ||
    matches.find((m) => m.venueText)?.venueText ||
    '';
  const date = tournament.startDate ? formatLocalDate(toLocalDateInput(tournament.startDate)) : '';
  const tourId = tourDisplayId(tournament.name, tournament.id);
  const leather =
    matches.length > 0 && matches.every((m) => m.ballType === 'LEATHER');

  const share = () => {
    if (onShare) {
      onShare();
      return;
    }
    const url = window.location.href;
    if (navigator.share) {
      void navigator.share({ title: tournament.name, url });
      return;
    }
    void navigator.clipboard.writeText(url);
  };

  return (
    <div className="pb-10">
      <div className="h-44 w-full bg-muted">
        {tournament.coverImageUrl ? (
          <img src={tournament.coverImageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-primary to-primary-dark" />
        )}
      </div>

      <div className="flex gap-3 px-[var(--gutter)] pt-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-[22px] font-bold leading-tight">{tournament.name}</h1>
          {location ? <p className="mt-1 text-sm text-text-secondary">{location}</p> : null}
          {date ? <p className="text-sm text-text-secondary">{date}</p> : null}
          <p className="text-sm text-text-secondary">
            {t('tournaments.tourId')} : {tourId}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-center gap-2">
          <div className="flex gap-3">
            <button type="button" className="flex flex-col items-center text-text" onClick={share} aria-label={t('common.share')}>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-text">
                <IconShare size={18} />
              </span>
              <span className="mt-1 text-[11px]">{t('common.share')}</span>
            </button>
            {isAuthenticated ? (
            <button type="button" className="flex flex-col items-center text-text" onClick={onMore} aria-label={t('tournaments.more')}>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-text">
                <IconMore size={18} />
              </span>
              <span className="mt-1 text-[11px]">{t('tournaments.more')}</span>
            </button>
            ) : null}
          </div>
          {leather ? <IconLeatherBall size={22} /> : <IconTennisBall size={22} />}
        </div>
      </div>

      {canSchedule || canCreateGroup ? (
      <div className="mt-4 flex">
        {canSchedule ? (
        <button
          type="button"
          onClick={onStartMatch}
          className="flex min-h-[52px] flex-1 items-center justify-center bg-primary px-2 text-center text-[12px] font-bold uppercase leading-tight text-on-dark"
        >
          {t('tournaments.startSchedule')}
        </button>
        ) : null}
        {canSchedule && canCreateGroup ? <span className="w-px bg-white/70" aria-hidden /> : null}
        {canCreateGroup ? (
        <button
          type="button"
          className="flex min-h-[52px] flex-1 items-center justify-center bg-primary px-2 text-center text-[12px] font-bold uppercase leading-tight text-on-dark"
          onClick={onCreateGroup}
        >
          {t('tournaments.createGroup')}
        </button>
        ) : null}
      </div>
      ) : null}

      <div className="mt-4 px-[var(--gutter)]">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold uppercase text-text-secondary">
          {dash ? <span>{t(`tournaments.status.${dash.header.status}`)}</span> : null}
          {dash?.header.season || tournament.season ? <span>{dash?.header.season ?? tournament.season}</span> : null}
          {dash?.header.club || tournament.club?.name ? <span>{dash?.header.club ?? tournament.club?.name}</span> : null}
          {dash?.header.format ? <span>{dash.header.format}</span> : null}
          {dash?.header.overs != null ? <span>{dash.header.overs} {t('tournaments.overs')}</span> : null}
          {dash?.header.maxWickets != null ? <span>{dash.header.maxWickets} {t('profile.wickets')}</span> : null}
        </div>
      </div>

      {playerId && mine.data && (mine.data.matches > 0 || mine.data.runs > 0 || mine.data.wickets > 0) ? (
        <DashSection title={t('playerHome.myTournament')}>
          <SummaryGrid
            items={[
              { label: t('playerHome.tournamentRank'), value: mine.data.tournamentRank ?? '—' },
              { label: t('playerHome.mvpRank'), value: mine.data.mvpRank ?? '—' },
              { label: t('profile.matches'), value: mine.data.matches },
              { label: t('profile.runs'), value: mine.data.runs },
              { label: t('profile.wickets'), value: mine.data.wickets },
              { label: t('tournaments.strikeRate'), value: mine.data.strikeRate.toFixed(1) },
              { label: t('tournaments.economy'), value: mine.data.economy.toFixed(2) },
              { label: t('home.mvpPoints'), value: mine.data.mvpPoints ?? 0 },
            ]}
          />
          <Link to={`/tournaments/${tournament.id}/players/${playerId}`} className="mt-3 inline-block text-sm font-bold text-primary">
            {t('playerHome.viewPerformance')}
          </Link>
        </DashSection>
      ) : null}

      <SectionTitle>{t('tournaments.teamsSection')}</SectionTitle>
      {teams.length ? (
        <div className="flex gap-4 overflow-x-auto px-[var(--gutter)] py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {teams.map((team) => (
            <Link key={team.id} to={`/tournaments/${tournament.id}/teams/${team.id}`} className="flex w-24 shrink-0 flex-col items-center">
              <Avatar name={team.name} src={team.logoUrl} kind="team" size={72} />
              <p className="mt-2 line-clamp-2 text-center text-[11px] font-bold uppercase leading-tight">{team.name}</p>
            </Link>
          ))}
        </div>
      ) : (
        <p className="px-[var(--gutter)] py-4 text-sm text-text-secondary">{t('tournaments.noTeams')}</p>
      )}

      <DashSection title={t('tournaments.topPlayers')}>
        <div className="grid grid-cols-2 gap-3">
          <BigNumberCard label={t('tournaments.mostRuns')} value={dash?.performers.bestBatsman?.runs ?? 0}>
            {dash?.performers.bestBatsman ? (
              <PlayerLink tournamentId={tournament.id} player={dash.performers.bestBatsman}>
                <p className="mt-2 truncate text-sm font-bold">{dash.performers.bestBatsman.playerName}</p>
                <p className="truncate text-xs uppercase text-text-secondary">{dash.performers.bestBatsman.teamName}</p>
              </PlayerLink>
            ) : (
              <p className="mt-2 text-xs text-text-secondary">{t('tournaments.noStatsYet')}</p>
            )}
          </BigNumberCard>
          <BigNumberCard label={t('tournaments.mostWickets')} value={dash?.performers.bestBowler?.wickets ?? 0}>
            {dash?.performers.bestBowler ? (
              <PlayerLink tournamentId={tournament.id} player={dash.performers.bestBowler}>
                <p className="mt-2 truncate text-sm font-bold">{dash.performers.bestBowler.playerName}</p>
                <p className="truncate text-xs uppercase text-text-secondary">{dash.performers.bestBowler.teamName}</p>
              </PlayerLink>
            ) : (
              <p className="mt-2 text-xs text-text-secondary">{t('tournaments.noStatsYet')}</p>
            )}
          </BigNumberCard>
        </div>
      </DashSection>

      <DashSection title={t('tournaments.boundaries')}>
        <div className="grid grid-cols-2 gap-3">
          <BigNumberCard label={t('tournaments.sixes')} value={dash?.summary.sixes ?? 0} />
          <BigNumberCard label={t('tournaments.fours')} value={dash?.summary.fours ?? 0} />
        </div>
      </DashSection>

      {dash?.teams.some((x) => x.matches > 0) ? (
        <DashSection title={t('tournaments.points')}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase text-text-secondary">
                  <th className="py-2 text-start">{t('tournaments.teams')}</th>
                  <th className="py-2 text-end">{t('tournaments.played')}</th>
                  <th className="py-2 text-end">{t('tournaments.won')}</th>
                  <th className="py-2 text-end">{t('tournaments.lost')}</th>
                  <th className="py-2 text-end">{t('tournaments.tied')}</th>
                  <th className="py-2 text-end">{t('tournaments.noResult')}</th>
                  <th className="py-2 text-end">{t('tournaments.pts')}</th>
                </tr>
              </thead>
              <tbody>
                {[...dash.teams]
                  .sort((a, b) => b.points - a.points || b.won - a.won)
                  .map((row) => (
                    <tr key={row.teamId} className="border-b border-border">
                      <td className="py-2 font-semibold">{row.teamName}</td>
                      <td className="py-2 text-end tabular-nums">{row.matches}</td>
                      <td className="py-2 text-end tabular-nums">{row.won}</td>
                      <td className="py-2 text-end tabular-nums">{row.lost}</td>
                      <td className="py-2 text-end tabular-nums">{row.tied}</td>
                      <td className="py-2 text-end tabular-nums">{row.noResult}</td>
                      <td className="py-2 text-end tabular-nums font-bold">{row.points}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </DashSection>
      ) : null}

      <DashSection title={t('tournaments.performanceLeaders')}>
        {dash?.hasCompletedStats ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <PerformerCard
              tournamentId={tournament.id}
              title={t('tournaments.bestBatsman')}
              info={t('tournaments.infoBestBat')}
              player={dash.performers.bestBatsman}
              lines={
                dash.performers.bestBatsman
                  ? [
                      `${t('profile.runs')}: ${dash.performers.bestBatsman.runs}`,
                      `${t('tournaments.average')}: ${fmtAvg(dash.performers.bestBatsman.average)}`,
                      `${t('tournaments.strikeRate')}: ${dash.performers.bestBatsman.strikeRate.toFixed(1)}`,
                      `${t('tournaments.highest')}: ${dash.performers.bestBatsman.highest}`,
                    ]
                  : []
              }
              empty={t('tournaments.noStatsYet')}
            />
            <PerformerCard
              tournamentId={tournament.id}
              title={t('tournaments.bestBowler')}
              info={t('tournaments.infoBestBowler')}
              player={dash.performers.bestBowler}
              lines={
                dash.performers.bestBowler
                  ? [
                      `${t('profile.wickets')}: ${dash.performers.bestBowler.wickets}`,
                      `${t('tournaments.economy')}: ${dash.performers.bestBowler.economy.toFixed(2)}`,
                      `${t('tournaments.bestBowling')}: ${dash.performers.bestBowler.best}`,
                      `${t('tournaments.overs')}: ${dash.performers.bestBowler.overs}`,
                    ]
                  : []
              }
              empty={t('tournaments.noStatsYet')}
            />
            <PerformerCard
              tournamentId={tournament.id}
              title={t('tournaments.bestFielder')}
              info={t('tournaments.infoBestFielder')}
              player={dash.performers.bestFielder}
              lines={
                dash.performers.bestFielder
                  ? [
                      `${t('tournaments.catches')}: ${dash.performers.bestFielder.catches}`,
                      `${t('tournaments.runOuts')}: ${dash.performers.bestFielder.runOuts}`,
                      `${t('tournaments.stumpings')}: ${dash.performers.bestFielder.stumpings}`,
                    ]
                  : []
              }
              empty={t('tournaments.noStatsYet')}
            />
            <PerformerCard
              tournamentId={tournament.id}
              title={t('tournaments.tournamentMvp')}
              info={dash.mvpFormula}
              player={dash.performers.mvp}
              lines={
                dash.performers.mvp
                  ? [
                      `${t('tournaments.mvpScore')}: ${dash.performers.mvp.score.toFixed(1)}`,
                      ...(dash.performers.mvp.runs > 0 ? [`${t('profile.runs')}: ${dash.performers.mvp.runs}`] : []),
                      ...(dash.performers.mvp.wickets > 0 ? [`${t('profile.wickets')}: ${dash.performers.mvp.wickets}`] : []),
                    ]
                  : []
              }
              empty={t('tournaments.mvpPending')}
            />
          </div>
        ) : (
          <EmptyStats title={t('tournaments.noStatsYet')} hint={t('tournaments.statsAfterMatches')} />
        )}
      </DashSection>

      <SectionTitle>{t('tournaments.recentMatches')}</SectionTitle>
      <RecentCarousel matches={matches} />
    </div>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <div className="mt-2 bg-muted px-[var(--gutter)] py-2">
      <h2 className="text-sm font-bold text-text-secondary">{children}</h2>
    </div>
  );
}

function RecentCarousel({ matches }: { matches: Match[] }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  if (!matches.length) {
    return <p className="px-[var(--gutter)] py-4 text-sm text-text-secondary">{t('home.noMatches')}</p>;
  }
  return (
    <div className="py-4">
      <div
        ref={ref}
        className="flex gap-3 overflow-x-auto px-[var(--gutter)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onScroll={(e) => {
          const el = e.currentTarget;
          const card = el.firstElementChild as HTMLElement | null;
          const w = card ? card.offsetWidth + 12 : el.clientWidth;
          setIndex(Math.round(el.scrollLeft / w));
        }}
      >
        {matches.map((m) => (
          <TournamentMatchCard key={m.id} match={m} />
        ))}
      </div>
      {matches.length > 1 ? (
        <div className="mt-3 flex justify-center gap-1.5">
          {matches.slice(0, 8).map((m, i) => (
            <span key={m.id} className={cn('h-1.5 w-1.5 rounded-full', i === index ? 'bg-primary' : 'bg-border')} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
