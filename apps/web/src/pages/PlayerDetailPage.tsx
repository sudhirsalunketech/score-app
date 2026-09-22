import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import type { Player } from '@/types/api';
import { PillTabs } from '@/components/ui/Pills';
import { PlayerProfileView } from '@/components/profile/PlayerProfileView';
import { ProfileStatsPanel } from '@/components/profile/ProfileStatsPanel';
import { InsightsPanel } from '@/components/profile/InsightsPanel';
import { ComparePanel } from '@/components/profile/ComparePanel';
import { MatchWiseList } from '@/components/profile/MatchWiseList';
import { RecentForm } from '@/components/profile/RecentForm';
import { YearlyOverviewCard } from '@/components/profile/YearlyOverviewCard';
import { BestAgainstTeamCard } from '@/components/profile/BestAgainstTeamCard';
import { PlayerAwardsCard } from '@/components/profile/PlayerAwardsCard';
import { JerseyWatermark } from '@/components/profile/JerseyWatermark';
import { ErrorRetry, Skeleton, Spinner } from '@/components/ui/Feedback';
import { Avatar } from '@/components/ui/Avatar';
import type { CareerStats } from '@/lib/career-stats';
import { recentFormHistory, type PlayerProfileStats } from '@/lib/player-profile';
import { parseProfileTab, parseStatsPanel } from '@/lib/profile-tab';
import { FollowButton } from '@/components/follow/FollowButton';
import type { MyTournamentCard } from '@/pages/MyTournamentsPage';
import type { MyTeamCard } from '@/pages/MyTeamsPage';
import type { Page } from '@/types/api';

type PlayerStats = PlayerProfileStats & {
  career?: CareerStats | null;
  batting?: { fifties?: number; hundreds?: number; fours?: number; sixes?: number; strikeRate?: number };
  bowling?: { economy?: number };
  mvp?: { total?: number };
};

export function PlayerDetailPage() {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const tab = parseProfileTab(params.get('tab'));
  const panel = parseStatsPanel(params.get('panel'), params.get('tab'));
  const setTab = (next: string) => {
    const copy = new URLSearchParams(params);
    copy.set('tab', next);
    if (next !== 'statistics') copy.delete('panel');
    setParams(copy, { replace: false });
  };
  const setPanel = (next: string) => {
    const copy = new URLSearchParams(params);
    copy.set('tab', 'statistics');
    copy.set('panel', next);
    setParams(copy, { replace: false });
  };
  const playerQ = useQuery({
    queryKey: keys.player(id),
    queryFn: () => api<Player>(`/api/v1/players/${id}`),
  });
  const stats = useQuery({
    queryKey: keys.playerStats(id),
    queryFn: () => api<PlayerStats>(`/api/v1/players/${id}/statistics`),
  });
  const tournaments = useQuery({
    queryKey: keys.playerTournaments(id),
    queryFn: () => api<Page<MyTournamentCard>>(`/api/v1/players/${id}/tournaments?limit=50`),
    enabled: tab === 'tournaments' || tab === 'overview',
  });
  const teamsQ = useQuery({
    queryKey: keys.playerTeams(id),
    queryFn: () => api<MyTeamCard[]>(`/api/v1/players/${id}/teams`),
    enabled: tab === 'teams',
  });
  const player = playerQ.data;

  if (playerQ.isLoading) return <Spinner />;
  if (playerQ.isError || !player) return <ErrorRetry onRetry={() => void playerQ.refetch()} />;

  return (
    <div className="mx-auto w-full max-w-xl px-[var(--gutter)] py-4 md:max-w-2xl md:py-6 xl:max-w-4xl xl:py-8">
      <div className="mb-3 flex justify-end">
        <FollowButton targetType="PLAYER" targetId={id} />
      </div>
      <PillTabs
        tone="ink"
        value={tab}
        onChange={setTab}
        items={[
          { id: 'overview', label: t('profile.overview') },
          { id: 'statistics', label: t('common.statistics') },
          { id: 'matches', label: t('common.matches') },
          { id: 'teams', label: t('common.teams') },
          { id: 'tournaments', label: t('common.tournaments') },
        ]}
      />
      <div className="mt-5" role="tabpanel">
        {tab === 'overview' ? (
          <>
            <PlayerProfileView
              name={player.name}
              photoUrl={player.photoUrl}
              role={player.role}
              battingStyle={player.battingStyle}
              bowlingStyle={player.bowlingStyle}
              profileCode={player.profileCode}
              city={player.city}
              stats={player.careerStats}
            />
            {stats.isLoading ? (
              <div className="mt-6 flex flex-col gap-3">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-40 w-full" />
              </div>
            ) : (
              <>
                {(() => {
                  const { battingHistory, bowlingHistory } = recentFormHistory(stats.data?.matches);
                  return <RecentForm battingHistory={battingHistory} bowlingHistory={bowlingHistory} />;
                })()}
                {stats.data?.yearly ? <YearlyOverviewCard thisYear={stats.data.yearly.thisYear} lastYear={stats.data.yearly.lastYear} /> : null}
                {stats.data?.bestAgainstTeam ? <BestAgainstTeamCard teams={stats.data.bestAgainstTeam} /> : null}
                <PlayerAwardsCard playerOfMatchCount={stats.data?.playerOfMatchCount ?? 0} />
              </>
            )}
            {(player.teams ?? []).length ? (
              <div className="mt-6">
                <h2 className="text-sm font-bold uppercase text-text-secondary">{t('playerHome.currentTeams')}</h2>
                <ul className="mt-2">
                  {(player.teams ?? []).map((row) => (
                    <li key={row.team.id}>
                      <Link to={`/teams/${row.team.id}`} className="flex items-center gap-3 py-2">
                        <Avatar name={row.team.name} src={row.team.logoUrl} kind="team" size={36} />
                        <span className="font-semibold">{row.team.name}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {(stats.data?.matches ?? []).length ? (
              <div className="mt-6">
                <h2 className="mb-2 text-sm font-bold uppercase text-text-secondary">{t('home.recent')}</h2>
                <MatchWiseList matches={(stats.data?.matches ?? []).slice(0, 3)} />
              </div>
            ) : null}
            {(tournaments.data?.items ?? [])[0] ? (
              <div className="mt-6">
                <h2 className="text-sm font-bold uppercase text-text-secondary">{t('playerHome.recentTournament')}</h2>
                <Link to={`/tournaments/${tournaments.data!.items[0]!.id}`} className="mt-2 block font-semibold text-primary">
                  {tournaments.data!.items[0]!.name}
                </Link>
              </div>
            ) : null}
            <JerseyWatermark jerseyNo={player.profile?.jerseyNo ?? player.teams?.[0]?.jerseyNo} />
          </>
        ) : null}
        {tab === 'statistics' ? (
          <>
            <div className="mb-4">
              <PillTabs
                tone="ink"
                value={panel}
                onChange={setPanel}
                items={[
                  { id: 'stats', label: t('common.statistics') },
                  { id: 'insights', label: t('profile.insights') },
                  { id: 'compare', label: t('profile.compare') },
                ]}
              />
            </div>
            {panel === 'stats' ? (
              stats.isLoading ? <Spinner label={t('statistics.fetching')} /> : <ProfileStatsPanel playerId={id} data={stats.data} />
            ) : null}
            {panel === 'insights' ? (
              stats.isLoading ? <Spinner /> : stats.data?.insights ? <InsightsPanel insights={stats.data.insights} /> : (
                <p className="py-8 text-center text-sm text-text-secondary">{t('profile.noStatsYet')}</p>
              )
            ) : null}
            {panel === 'compare' ? (
              stats.isLoading ? <Spinner /> : stats.data?.tables?.overall ? (
                <ComparePanel selfId={id} selfName={player.name} selfRole={player.role} self={stats.data.tables.overall} />
              ) : (
                <p className="py-8 text-center text-sm text-text-secondary">{t('profile.noStatsYet')}</p>
              )
            ) : null}
          </>
        ) : null}
        {tab === 'matches' ? (
          stats.isLoading ? <Spinner /> : <MatchWiseList matches={stats.data?.matches ?? []} playerId={id} />
        ) : null}
        {tab === 'teams' ? (
          teamsQ.isLoading ? (
            <Spinner />
          ) : (teamsQ.data ?? []).length ? (
            <>
              {(teamsQ.data ?? []).some((team) => team.current) ? (
                <div>
                  <h2 className="text-sm font-bold uppercase text-text-secondary">{t('playerHome.currentTeams')}</h2>
                  <ul>
                    {(teamsQ.data ?? []).filter((team) => team.current).map((team) => (
                      <li key={team.id}>
                        <Link to={`/teams/${team.id}`} className="flex min-h-touch items-center gap-3 py-3">
                          <Avatar name={team.name} src={team.logoUrl} kind="team" size={44} />
                          <span className="font-semibold">{team.name}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {(teamsQ.data ?? []).some((team) => !team.current) ? (
                <div className="mt-4">
                  <h2 className="text-sm font-bold uppercase text-text-secondary">{t('playerHome.formerTeams')}</h2>
                  <ul>
                    {(teamsQ.data ?? []).filter((team) => !team.current).map((team) => (
                      <li key={team.id}>
                        <Link to={`/teams/${team.id}`} className="flex min-h-touch items-center gap-3 py-3">
                          <Avatar name={team.name} src={team.logoUrl} kind="team" size={44} />
                          <span className="min-w-0">
                            <span className="block font-semibold">{team.name}</span>
                            <span className="block text-xs text-text-secondary">{t('playerHome.formerTeams')}</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          ) : (
            <p className="py-8 text-center text-sm text-text-secondary">{t('teams.noTeams')}</p>
          )
        ) : null}
        {tab === 'tournaments' ? (
          tournaments.isLoading ? (
            <Spinner />
          ) : (tournaments.data?.items ?? []).length ? (
            <ul className="flex flex-col gap-3">
              {(tournaments.data?.items ?? []).map((tn) => (
                <li key={tn.id}>
                  <Link to={`/tournaments/${tn.id}`} className="block rounded-xl border border-border p-3">
                    <p className="font-bold">{tn.name}</p>
                    <p className="text-xs text-text-secondary">{tn.season}</p>
                    <p className="mt-1 text-sm">
                      {tn.runs} {t('profile.runs')} · {tn.wickets} {t('profile.wickets')} · {tn.mvpPoints} {t('home.mvpPoints')}
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
    </div>
  );
}
