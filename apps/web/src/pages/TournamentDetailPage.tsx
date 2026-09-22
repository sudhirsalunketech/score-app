import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import { useAuth } from '@/context/AuthContext';
import { canManageThisTournament } from '@/lib/roles';
import { hasPerm } from '@/lib/access';
import type { PointsGroup, ShareVisibility, Team, Tournament, TournamentDashboard } from '@/types/api';
import { UnderlineTabs } from '@/components/ui/Pills';
import { IconBack } from '@/components/ui/Icons';
import { ErrorRetry, Spinner } from '@/components/ui/Feedback';
import { TeamPicker } from '@/components/match/TeamPicker';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { TournamentHome } from '@/components/tournament/TournamentHome';
import { TournamentPointsTab } from '@/components/tournament/TournamentPointsTab';
import { TournamentMatchesTab, TournamentScorecardsTab } from '@/components/tournament/TournamentMatchesTab';
import { TournamentStatsPanel } from '@/components/tournament/TournamentStatsPanel';
import { TournamentMvpPanel } from '@/components/tournament/TournamentMvpPanel';
import { TournamentPlayersTab, TournamentTeamsTab } from '@/components/tournament/TournamentPeople';
import { TournamentKnockoutTab } from '@/components/tournament/TournamentKnockoutTab';
import { ShareSheet } from '@/components/share/ShareSheet';
import { publicTournamentUrl } from '@/lib/live';
import { tournamentShareText } from '@/lib/share-text';
import { FanZone } from '@/components/fans/FanZone';
import { CreateTeamModal, type CreateTeamValues } from '@/components/forms/CreateTeamModal';
import { FollowButton } from '@/components/follow/FollowButton';
import { SelectMatchTypeSheet } from '@/components/tournament/SelectMatchTypeSheet';
import { MatchRequirementSheet } from '@/components/tournament/MatchRequirementSheet';

type Tab =
  | 'overview'
  | 'matches'
  | 'points'
  | 'scorecards'
  | 'statistics'
  | 'records'
  | 'players'
  | 'teams'
  | 'mvp'
  | 'quiz'
  | 'knockout'
  | 'groups';

export function TournamentDetailPage() {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const { isAuthenticated, user } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const rawTab = params.get('tab');
  const tab = ((rawTab === 'home' ? 'overview' : rawTab) as Tab | null) ?? 'overview';
  const setTab = (next: Tab) => {
    const copy = new URLSearchParams(params);
    copy.set('tab', next);
    setParams(copy, { replace: true });
  };
  const [pickingGroup, setPickingGroup] = useState<string | null>(null);
  const [createTeamOpen, setCreateTeamOpen] = useState(false);
  const [createTeamForGroup, setCreateTeamForGroup] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [matchTypeOpen, setMatchTypeOpen] = useState(false);
  const [noGroupOpen, setNoGroupOpen] = useState(false);
  const [teamsRequiredGroup, setTeamsRequiredGroup] = useState<{ id: string; name: string } | null>(null);

  const invalidateTournament = () => {
    void qc.invalidateQueries({ queryKey: keys.tournament(id) });
    void qc.invalidateQueries({ queryKey: keys.points(id) });
    void qc.invalidateQueries({ queryKey: keys.tournamentDashboard(id) });
  };

  const q = useQuery({ queryKey: keys.tournament(id), queryFn: () => api<Tournament>(`/api/v1/tournaments/${id}`) });
  const dash = useQuery({
    queryKey: keys.tournamentDashboard(id),
    queryFn: () => api<TournamentDashboard>(`/api/v1/tournaments/${id}/dashboard`),
  });
  const points = useQuery({
    queryKey: keys.points(id),
    queryFn: () => api<PointsGroup[] | { groups: PointsGroup[] }>(`/api/v1/tournaments/${id}/points-table`),
    enabled: tab === 'points' || tab === 'overview',
    retry: false,
  });

  const addGroup = useMutation({
    mutationFn: (name: string) => api<{ id: string }>(`/api/v1/tournaments/${id}/groups`, { method: 'POST', body: { name } }),
    onSuccess: invalidateTournament,
  });
  const createTeam = useMutation({
    mutationFn: (v: CreateTeamValues) => api<Team>('/api/v1/teams', { method: 'POST', body: v }),
    onSuccess: async (team) => {
      let gid = createTeamForGroup ?? pickingGroup ?? q.data?.groups?.[0]?.id;
      if (!gid) {
        const group = await api<{ id: string }>(`/api/v1/tournaments/${id}/groups`, { method: 'POST', body: { name: 'GROUP A' } });
        gid = group.id;
      }
      await api(`/api/v1/tournaments/${id}/groups/${gid}/teams`, { method: 'POST', body: { teamId: team.id } });
      setCreateTeamOpen(false);
      invalidateTournament();
      if (createTeamForGroup) {
        const gidForMatch = createTeamForGroup;
        setCreateTeamForGroup(null);
        const refreshed = await qc.fetchQuery({ queryKey: keys.tournament(id), queryFn: () => api<Tournament>(`/api/v1/tournaments/${id}`) });
        const freshGroup = refreshed?.groups?.find((g) => g.id === gidForMatch);
        if (freshGroup && freshGroup.teams.length >= 2) {
          nav(`/matches/new?tournamentId=${id}&groupId=${gidForMatch}`);
        } else if (freshGroup) {
          setTeamsRequiredGroup({ id: freshGroup.id, name: freshGroup.name });
        }
      }
    },
  });
  const addTeam = useMutation({
    mutationFn: ({ gid, teamId }: { gid: string; teamId: string }) =>
      api(`/api/v1/tournaments/${id}/groups/${gid}/teams`, { method: 'POST', body: { teamId } }),
    onSuccess: invalidateTournament,
  });
  const removeTeam = useMutation({
    mutationFn: ({ gid, teamId }: { gid: string; teamId: string }) =>
      api(`/api/v1/tournaments/${id}/groups/${gid}/teams/${teamId}`, { method: 'DELETE' }),
    onSuccess: invalidateTournament,
  });
  const removeGroup = useMutation({
    mutationFn: (gid: string) => api(`/api/v1/tournaments/${id}/groups/${gid}`, { method: 'DELETE' }),
    onSuccess: invalidateTournament,
  });

  if (q.isLoading) return <Spinner />;
  if (q.isError || !q.data) return <ErrorRetry onRetry={() => void q.refetch()} />;
  const tn = q.data;
  const canManage = hasPerm(tn.myPermissions, 'TOURNAMENT_EDIT') || canManageThisTournament(user, tn);
  const canTeams = hasPerm(tn.myPermissions, 'TOURNAMENT_MANAGE_TEAMS') || canManage;
  const canMatches = hasPerm(tn.myPermissions, 'TOURNAMENT_MANAGE_MATCHES') || canManage;
  const canRules = hasPerm(tn.myPermissions, 'TOURNAMENT_MANAGE_RULES');
  const canAccess = hasPerm(tn.myPermissions, 'USER_MANAGE_ACCESS');
  const openTournamentShare = () => {
    if (tn.publicSlug) {
      setShareOpen(true);
      return;
    }
    if (!canManage) return;
    void api(`/api/v1/tournaments/${id}`, {
      method: 'PATCH',
      body: { visibility: tn.visibility && tn.visibility !== 'PRIVATE' ? tn.visibility : 'UNLISTED' },
    }).then(() => q.refetch().then(() => setShareOpen(true)));
  };
  const groups = tn.groups ?? [];
  const groupTeams: Team[] = groups.flatMap((g) => g.teams.map((x) => x.team));
  const matchTeams = (tn.matches ?? []).flatMap((m) => [m.homeTeam, m.awayTeam]);
  const uniqueTeams = [...groupTeams, ...matchTeams].filter(
    (team, i, arr) => team && arr.findIndex((x) => x.id === team.id) === i,
  );
  const nextGroupName = `GROUP ${String.fromCharCode(65 + groups.length)}`;
  const pointGroups: PointsGroup[] = Array.isArray(points.data)
    ? points.data
    : points.data && 'groups' in points.data
      ? points.data.groups
      : groups.map((g) => ({
          id: g.id,
          name: g.name,
          rows: g.teams.map((x) => ({
            teamId: x.team.id,
            teamName: x.team.name,
            logoUrl: x.team.logoUrl,
            played: 0,
            won: 0,
            lost: 0,
            tied: 0,
            points: 0,
            nrr: 0,
          })),
        }));
  const logos = new Map(groups.flatMap((g) => g.teams.map((x) => [x.team.id, x.team.logoUrl] as const)));
  const pointGroupsWithLogos = pointGroups.map((g) => ({
    ...g,
    rows: g.rows.map((r) => ({ ...r, logoUrl: r.logoUrl ?? logos.get(r.teamId) ?? null })),
  }));

  return (
    <div className="flex min-h-dvh flex-col bg-bg pb-[env(safe-area-inset-bottom)]">
      <div className="sticky top-0 z-20 bg-bg pt-[env(safe-area-inset-top)]">
        <header className="relative flex min-h-14 items-center">
          <button type="button" className="touch-target inline-flex items-center justify-center" aria-label={t('common.back')} onClick={() => nav(-1)}>
            <IconBack />
          </button>
          <h1 className="absolute inset-x-12 truncate text-center text-lg font-bold">{tn.name}</h1>
          <div className="ms-auto me-2">
            <FollowButton targetType="TOURNAMENT" targetId={id} />
          </div>
        </header>
        <UnderlineTabs
          value={tab}
          onChange={(v) => {
            if (v === 'rules') {
              nav(`/tournaments/${id}/rules`);
              return;
            }
            if (v === 'settings') {
              nav(`/tournaments/${id}/edit`);
              return;
            }
            setTab(v as Tab);
          }}
          tone="ink"
          items={[
            { id: 'overview', label: t('tournaments.overview') },
            { id: 'groups', label: t('tournaments.groups') },
            { id: 'points', label: t('tournaments.points') },
            { id: 'matches', label: t('tournaments.fixtures') },
            { id: 'knockout', label: t('tournaments.knockout') },
            { id: 'statistics', label: t('tournaments.statistics') },
            { id: 'mvp', label: t('tournaments.mvp') },
            ...(dash.data?.quizEnabled ? [{ id: 'quiz', label: t('tournaments.fanQuiz') }] : []),
            { id: 'rules', label: t('tournamentRules.title') },
            { id: 'settings', label: t('common.settings') },
            { id: 'scorecards', label: t('tournaments.scorecards') },
            { id: 'records', label: t('tournaments.records') },
            { id: 'players', label: t('tournaments.players') },
            { id: 'teams', label: t('tournaments.teams') },
          ]}
        />
      </div>

      {tab === 'overview' ? (
        <TournamentHome
          tournament={tn}
          teams={uniqueTeams}
          dash={dash.data}
          onCreateGroup={() => addGroup.mutate(nextGroupName, { onSuccess: () => setTab('points') })}
          onStartMatch={() => setMatchTypeOpen(true)}
          onMore={() => setMoreOpen(true)}
          onShare={openTournamentShare}
          canSchedule={canMatches}
          canCreateGroup={canTeams}
        />
      ) : null}

      {tab === 'teams' || tab === 'groups' ? (
        <TournamentTeamsTab
          tournamentId={id}
          dash={dash.data}
          teams={uniqueTeams}
          canTeams={canTeams}
          onAddTeam={() => {
            if (groups[0]) {
              setPickingGroup(groups[0].id);
              return;
            }
            void addGroup.mutateAsync('GROUP A').then((group) => setPickingGroup(group.id));
          }}
          onCreateTeam={() => setCreateTeamOpen(true)}
        />
      ) : null}

      {tab === 'matches' ? (
        <TournamentMatchesTab matches={tn.matches ?? []} canStart={canMatches} tournamentId={id} />
      ) : null}
      {tab === 'knockout' ? (
        <TournamentKnockoutTab tournamentId={id} teams={uniqueTeams} canManage={canMatches} />
      ) : null}

      {tab === 'scorecards' ? (
        dash.isLoading || !dash.data ? <Spinner /> : <TournamentScorecardsTab dash={dash.data} />
      ) : null}
      {tab === 'statistics' ? (
        dash.isLoading || !dash.data ? <Spinner /> : <TournamentStatsPanel tournamentId={id} dash={dash.data} mode="statistics" />
      ) : null}
      {tab === 'records' ? (
        dash.isLoading || !dash.data ? <Spinner /> : <TournamentStatsPanel tournamentId={id} dash={dash.data} mode="records" />
      ) : null}
      {tab === 'players' ? (
        dash.isLoading || !dash.data ? <Spinner /> : <TournamentPlayersTab tournamentId={id} dash={dash.data} />
      ) : null}
      {tab === 'mvp' ? (
        dash.isLoading || !dash.data ? <Spinner /> : <TournamentMvpPanel tournamentId={id} dash={dash.data} />
      ) : null}

      {tab === 'points' ? (
        <TournamentPointsTab
          groups={pointGroupsWithLogos}
          loading={points.isFetching}
          canEdit={isAuthenticated}
          onRefresh={async () => {
            await Promise.all([q.refetch(), points.refetch()]);
          }}
          onAddTeam={(gid) => setPickingGroup(gid)}
          onRemoveTeam={(gid, teamId) => removeTeam.mutate({ gid, teamId })}
          onRemoveGroup={(gid) => removeGroup.mutate(gid)}
          onCreateGroup={() => addGroup.mutate(nextGroupName)}
          creatingGroup={addGroup.isPending}
        />
      ) : null}

      {tab === 'quiz' && dash.data?.quizEnabled ? (
        <FanZone tournamentId={id} initialTab="quiz" loginNext={`/tournaments/${id}`} />
      ) : null}

      {isAuthenticated ? (
      <TeamPicker
        open={Boolean(pickingGroup)}
        onClose={() => setPickingGroup(null)}
        excludeIds={groups.flatMap((g) => g.teams.map((x) => x.team.id))}
        onPick={(team) => {
          if (pickingGroup) addTeam.mutate({ gid: pickingGroup, teamId: team.id });
        }}
      />
      ) : null}
      {canTeams ? (
        <CreateTeamModal
          open={createTeamOpen}
          defaultClubId={tn.clubId ?? undefined}
          busy={createTeam.isPending}
          onClose={() => {
            setCreateTeamOpen(false);
            setCreateTeamForGroup(null);
          }}
          onCreate={async (v) => {
            await createTeam.mutateAsync(v);
          }}
        />
      ) : null}

      <SelectMatchTypeSheet
        open={matchTypeOpen}
        onClose={() => setMatchTypeOpen(false)}
        groups={groups}
        onNoGroups={() => {
          setMatchTypeOpen(false);
          setNoGroupOpen(true);
        }}
        onSelectGroup={(group) => {
          setMatchTypeOpen(false);
          if (group.teams.length < 2) {
            setTeamsRequiredGroup({ id: group.id, name: group.name });
          } else {
            nav(`/matches/new?tournamentId=${id}&groupId=${group.id}`);
          }
        }}
        onSelectLabel={(label) => {
          setMatchTypeOpen(false);
          nav(`/matches/new?tournamentId=${id}&matchLabel=${encodeURIComponent(label)}`);
        }}
      />

      <MatchRequirementSheet
        open={noGroupOpen}
        onClose={() => setNoGroupOpen(false)}
        title={t('match.groupRequiredTitle')}
        message={t('match.groupRequiredMessage')}
        actionLabel={t('tournaments.createGroup')}
        actionBusy={addGroup.isPending}
        onAction={() =>
          addGroup.mutate(nextGroupName, {
            onSuccess: () => {
              setNoGroupOpen(false);
              setMatchTypeOpen(true);
            },
          })
        }
      />

      <MatchRequirementSheet
        open={Boolean(teamsRequiredGroup)}
        onClose={() => setTeamsRequiredGroup(null)}
        title={t('match.teamsRequiredTitle')}
        message={t('match.teamsRequiredMessage')}
        actionLabel={t('teams.create')}
        onAction={() => {
          if (!teamsRequiredGroup) return;
          setCreateTeamForGroup(teamsRequiredGroup.id);
          setTeamsRequiredGroup(null);
          setCreateTeamOpen(true);
        }}
      />
      <BottomSheet open={moreOpen} title={t('tournaments.more')} onClose={() => setMoreOpen(false)} orange={false}>
        {canTeams ? (
        <button
          type="button"
          className="min-h-touch w-full text-start font-semibold"
          onClick={() => {
            setMoreOpen(false);
            if (groups[0]) {
              setPickingGroup(groups[0].id);
              return;
            }
            void addGroup.mutateAsync('GROUP A').then((group) => setPickingGroup(group.id));
          }}
        >
          {t('tournaments.addTeam')}
        </button>
        ) : null}
        {canTeams ? (
        <button
          type="button"
          className="min-h-touch w-full text-start font-semibold"
          onClick={() => {
            setMoreOpen(false);
            addGroup.mutate(nextGroupName, { onSuccess: () => setTab('points') });
          }}
        >
          {t('tournaments.createGroup')}
        </button>
        ) : null}
        {isAuthenticated && (canRules || hasPerm(tn.myPermissions, 'TOURNAMENT_VIEW')) ? (
        <button
          type="button"
          className="min-h-touch w-full text-start font-semibold"
          onClick={() => {
            setMoreOpen(false);
            nav(`/tournaments/${id}/rules`);
          }}
        >
          {t('tournamentRules.title')}
        </button>
        ) : null}
        {canManage ? (
        <button
          type="button"
          className="min-h-touch w-full text-start font-semibold"
          onClick={() => {
            setMoreOpen(false);
            nav(`/tournaments/${id}/edit`);
          }}
        >
          {t('tournaments.editTitle')}
        </button>
        ) : null}
        {hasPerm(tn.myPermissions, 'FAN_MANAGE') ? (
        <button
          type="button"
          className="min-h-touch w-full text-start font-semibold"
          onClick={() => {
            setMoreOpen(false);
            nav(`/tournaments/${id}/fan/admin`);
          }}
        >
          {t('fans.fanQuiz')}
        </button>
        ) : null}
        {canAccess ? (
        <button
          type="button"
          className="min-h-touch w-full text-start font-semibold"
          onClick={() => {
            setMoreOpen(false);
            nav(`/tournaments/${id}/access`);
          }}
        >
          {t('access.manageAccess')}
        </button>
        ) : null}
        <button
          type="button"
          className="min-h-touch w-full text-start font-semibold"
          onClick={() => {
            setMoreOpen(false);
            openTournamentShare();
          }}
        >
          {t('share.shareTournament')}
        </button>
        {canManage ? (
          <div className="mt-2 space-y-1 border-t border-border pt-2">
            <p className="text-xs font-semibold uppercase text-text-secondary">{t('share.publicVisibility')}</p>
            {(['PUBLIC', 'UNLISTED', 'PRIVATE'] as ShareVisibility[]).map((v) => (
              <button
                key={v}
                type="button"
                className={`min-h-touch w-full text-start text-sm ${
                  tn.visibility === v ? 'font-bold text-primary' : 'font-semibold'
                }`}
                onClick={() => {
                  void api(`/api/v1/tournaments/${id}`, { method: 'PATCH', body: { visibility: v } }).then(() => {
                    void q.refetch();
                    setMoreOpen(false);
                  });
                }}
              >
                {t(`share.visibility.${v}`)}
              </button>
            ))}
          </div>
        ) : null}
      </BottomSheet>
      <ShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        heading={t('share.shareTournament')}
        destinations={
          tn.publicSlug
            ? [
                {
                  id: 'tn',
                  label: t('share.shareTournament'),
                  url: publicTournamentUrl(tn.publicSlug),
                  title: tn.name,
                  text: tournamentShareText({ name: tn.name, season: tn.season, url: publicTournamentUrl(tn.publicSlug) }),
                },
              ]
            : []
        }
      />
    </div>
  );
}
