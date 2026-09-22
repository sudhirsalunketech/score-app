import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import { publicLivePath } from '@/lib/live';
import { formatLocalDate, nowLocalDate, nowLocalTime, toIsoFromLocal, toLocalDateInput, toLocalTimeInput } from '@/lib/datetime';
import { matchGroupName, settingBool } from '@/lib/match-meta';
import { hasMatchPerm } from '@/lib/access';
import { useAuth } from '@/context/AuthContext';
import type { Match, Team, TossDecision, Tournament, User } from '@/types/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { IconBack, IconGear, IconLeatherBall, IconTennisBall } from '@/components/ui/Icons';
import { isLeatherBall, matchBallLabelKey } from '@/lib/ball-type';
import { ErrorRetry, Spinner } from '@/components/ui/Feedback';
import { TeamPicker } from '@/components/match/TeamPicker';
import { TeamCard } from '@/components/match/TeamCard';
import { TossModal } from '@/components/match/TossModal';
import { DEFAULT_FORMAT, FormatModal, type FormatSettings } from '@/components/match/FormatModal';
import { LiveSharePanel } from '@/components/live/LiveSharePanel';
import { ScorerSelector } from '@/components/match/ScorerSelector';
import { SeasonSelector } from '@/components/match/SeasonSelector';

export function OpenMatchPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const tournamentQueryId = params.get('tournamentId');
  const groupQueryId = params.get('groupId');
  const matchLabel = params.get('matchLabel');
  const isNew = !id;
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const existing = useQuery({
    queryKey: keys.match(id ?? ''),
    queryFn: () => api<Match>(`/api/v1/matches/${id}`),
    enabled: Boolean(id),
  });
  const [tournamentId, setTournamentId] = useState<string | null>(tournamentQueryId);
  const tournaments = useQuery({
    queryKey: keys.tournaments,
    queryFn: () => api<Tournament[]>('/api/v1/tournaments'),
  });
  const tournamentDetail = useQuery({
    queryKey: keys.tournament(tournamentId ?? ''),
    queryFn: () => api<Tournament>(`/api/v1/tournaments/${tournamentId}`),
    enabled: Boolean(tournamentId),
  });
  const scorers = useQuery({
    queryKey: keys.scorers,
    queryFn: () => api<User[]>('/api/v1/users/scorers'),
  });

  const [home, setHome] = useState<Team | null>(null);
  const [away, setAway] = useState<Team | null>(null);
  const [picking, setPicking] = useState<'home' | 'away' | null>(null);
  const [venue, setVenue] = useState('');
  const [date, setDate] = useState(nowLocalDate);
  const [time, setTime] = useState(nowLocalTime);
  const [format, setFormat] = useState<FormatSettings>(DEFAULT_FORMAT);
  const [formatOpen, setFormatOpen] = useState(false);
  const [tossOpen, setTossOpen] = useState(false);
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [decision, setDecision] = useState<TossDecision | null>(null);
  const [matchId, setMatchId] = useState<string | null>(id ?? null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [selectedScorers, setSelectedScorers] = useState<User[]>([]);
  const [scorerOpen, setScorerOpen] = useState(false);
  const [seasonOpen, setSeasonOpen] = useState(false);
  const dateRef = useRef<HTMLInputElement>(null);
  const timeRef = useRef<HTMLInputElement>(null);

  const match = existing.data;
  const scoringLocked = Boolean(
    match &&
      ['LIVE', 'INNINGS_BREAK', 'DRINKS_BREAK', 'RAIN_DELAY', 'MATCH_DELAY', 'COMPLETED', 'ABANDONED', 'CANCELLED'].includes(
        match.status,
      ),
  );
  const canEdit = isNew || hasMatchPerm(match, 'MATCH_EDIT');
  const canChangeFormat = canEdit && !scoringLocked;
  const canScore = isNew || hasMatchPerm(match, 'MATCH_SCORE');
  const canToss = isNew || hasMatchPerm(match, 'MATCH_MANAGE_TOSS');
  const canShare = isNew || hasMatchPerm(match, 'MATCH_SHARE');
  const canAccess = hasMatchPerm(match, 'USER_MANAGE_ACCESS');
  const canXi = isNew || hasMatchPerm(match, 'MATCH_MANAGE_PLAYING_XI') || hasMatchPerm(match, 'MATCH_VIEW');
  const homeTeam = home ?? match?.homeTeam ?? null;
  const awayTeam = away ?? match?.awayTeam ?? null;
  const selectedTournament =
    tournamentDetail.data ??
    (tournaments.data ?? []).find((x) => x.id === (tournamentId ?? match?.tournamentId)) ??
    match?.tournament ??
    null;
  const scopedGroup = isNew && groupQueryId ? selectedTournament?.groups?.find((g) => g.id === groupQueryId) ?? null : null;
  const scopedTeamIds = scopedGroup ? scopedGroup.teams.map((x) => x.teamId) : undefined;

  useEffect(() => {
    if (!isNew || !selectedTournament) return;
    setFormat((f) => ({
      ...f,
      overs: selectedTournament.defaultOvers ?? f.overs,
      maxWickets: selectedTournament.defaultMaxWickets ?? f.maxWickets,
    }));
  }, [isNew, selectedTournament?.id, selectedTournament?.defaultOvers, selectedTournament?.defaultMaxWickets]);

  useEffect(() => {
    if (!match) return;
    setVenue(match.venueText ?? '');
    setTournamentId(match.tournamentId ?? null);
    setFormat((f) => ({
      ...f,
      overs: match.overs,
      format: match.format,
      maxWickets: match.maxWickets,
      playingPerSide: match.playingPerSide ?? 8,
      ballsPerOver: match.ballsPerOver,
      ballType: match.ballType,
      overTheFence: settingBool(match.settings, 'overTheFence', true),
      mankad: settingBool(match.settings, 'mankad', true),
      lastMan: settingBool(match.settings, 'lastMan', true),
      extrasToBatsman: settingBool(match.settings, 'addWideToBatsman') || settingBool(match.settings, 'addNoBallToBatsman'),
    }));
    if (match.scheduledAt) {
      setDate(toLocalDateInput(match.scheduledAt));
      setTime(toLocalTimeInput(match.scheduledAt));
    }
    const sids = Array.isArray((match.settings as Record<string, unknown> | null)?.scorerIds)
      ? ((match.settings as Record<string, unknown>).scorerIds as string[])
      : [];
    if (sids.length && scorers.data) setSelectedScorers(scorers.data.filter((u) => sids.includes(u.id)));
  }, [match, scorers.data]);

  const groupName = matchGroupName(match) ?? scopedGroup?.name ?? (isNew && matchLabel ? null : selectedTournament?.groups?.[0]?.name) ?? null;
  const screenTitle = matchLabel && isNew ? matchLabel : groupName ? t('match.groupMatch', { group: groupName }) : t('match.openMatch');
  const formatLine = t('match.formatLine', {
    overs: format.overs,
    format: format.format,
    wickets: format.maxWickets,
  });
  const seasonLabel = selectedTournament?.season ?? t('match.selectSeason');

  const createBody = useMemo(() => {
    if (!homeTeam || !awayTeam) return null;
    return {
      homeTeamId: homeTeam.id,
      awayTeamId: awayTeam.id,
      format: format.format,
      overs: format.overs,
      ballsPerOver: format.ballsPerOver,
      maxWickets: format.maxWickets,
      playingPerSide: format.playingPerSide,
      ballType: format.ballType,
      venueText: venue || undefined,
      scheduledAt: toIsoFromLocal(date, time),
      tournamentId: tournamentId ?? undefined,
      settings: {
        overTheFence: format.overTheFence,
        mankad: format.mankad,
        lastMan: format.lastMan,
        addWideToBatsman: format.extrasToBatsman,
        addNoBallToBatsman: format.extrasToBatsman,
        scorerIds: selectedScorers.map((u) => u.id),
        ...(isNew && matchLabel ? { matchLabel } : {}),
      },
    };
  }, [homeTeam, awayTeam, format, venue, date, time, tournamentId, selectedScorers, isNew, matchLabel]);

  const requireLogin = () => {
    if (isAuthenticated) return true;
    nav('/login', { replace: false, state: { from: '/matches/new' } });
    return false;
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!createBody) throw new Error(t('match.selectTeam'));
      if (homeTeam && awayTeam && homeTeam.id === awayTeam.id) throw new Error(t('match.sameTeam'));
      if (matchId) {
        const body = scoringLocked
          ? {
              venueText: venue || undefined,
              scheduledAt: toIsoFromLocal(date, time),
              settings: { scorerIds: selectedScorers.map((u) => u.id) },
            }
          : createBody;
        return api<Match>(`/api/v1/matches/${matchId}`, { method: 'PATCH', body });
      }
      const created = await api<Match>('/api/v1/matches', { method: 'POST', body: createBody });
      setMatchId(created.id);
      return created;
    },
    onSuccess: (m) => {
      void qc.invalidateQueries({ queryKey: keys.matches });
      void qc.invalidateQueries({ queryKey: keys.match(m.id) });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1800);
    },
    onError: (e: Error) => setError(e.message),
  });

  const startScoring = async () => {
    if (!matchId || !winnerId || !decision || !homeTeam || !awayTeam) return;
    setError(null);
    try {
      await api(`/api/v1/matches/${matchId}/toss`, {
        method: 'POST',
        body: { tossWinnerTeamId: winnerId, tossDecision: decision },
      });
      const battingTeamId = decision === 'BAT' ? winnerId : winnerId === homeTeam.id ? awayTeam.id : homeTeam.id;
      const bowlingTeamId = battingTeamId === homeTeam.id ? awayTeam.id : homeTeam.id;
      await api(`/api/v1/matches/${matchId}/innings`, {
        method: 'POST',
        body: { battingTeamId, bowlingTeamId },
      });
      nav(`/matches/${matchId}/score`);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'));
    }
  };

  const onDoScoring = async () => {
    setError(null);
    try {
      let mid = matchId;
      if (!mid) {
        const created = await save.mutateAsync();
        mid = created.id;
      } else {
        await save.mutateAsync();
      }
      if (!mid) return;
      const current = await api<Match>(`/api/v1/matches/${mid}`);
      if (current.status === 'LIVE') {
        nav(`/matches/${mid}/score`);
        return;
      }
      if (current.status === 'INNINGS_BREAK') {
        const first = current.innings?.find((i) => i.inningsNumber === 1);
        if (!first) throw new Error(t('common.error'));
        const battingTeamId = first.battingTeamId === current.homeTeam.id ? current.awayTeam.id : current.homeTeam.id;
        await api(`/api/v1/matches/${mid}/innings`, {
          method: 'POST',
          body: { battingTeamId, bowlingTeamId: first.battingTeamId },
        });
        nav(`/matches/${mid}/score`);
        return;
      }
      if (current.status === 'TOSS_COMPLETED') {
        const winner = current.tossWinnerTeamId!;
        const dec = current.tossDecision!;
        const battingTeamId = dec === 'BAT' ? winner : winner === current.homeTeam.id ? current.awayTeam.id : current.homeTeam.id;
        const bowlingTeamId = battingTeamId === current.homeTeam.id ? current.awayTeam.id : current.homeTeam.id;
        await api(`/api/v1/matches/${mid}/innings`, { method: 'POST', body: { battingTeamId, bowlingTeamId } });
        nav(`/matches/${mid}/score`);
        return;
      }
      if (current.status === 'SCHEDULED' || current.status === 'DRAFT') {
        await api(`/api/v1/matches/${mid}/start`, { method: 'POST' });
      }
      setTossOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'));
    }
  };

  const viewMatch = () => {
    const m = match ?? (matchId ? { id: matchId, publicLiveEnabled: false, publicSlug: null } : null);
    if (!m?.id) return;
    if (match?.publicLiveEnabled && match.publicSlug) {
      nav(publicLivePath(match.publicSlug));
      return;
    }
    nav(`/matches/${m.id}/centre`);
  };

  if (id && existing.isLoading) return <Spinner />;
  if (id && existing.isError) return <ErrorRetry onRetry={() => void existing.refetch()} />;

  return (
    <div className="flex min-h-dvh flex-col bg-bg pb-[max(1rem,env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-20 flex min-h-14 items-center border-b border-border bg-bg pt-[env(safe-area-inset-top)]">
        <button type="button" className="touch-target inline-flex items-center justify-center md:hidden" aria-label={t('common.back')} onClick={() => nav(-1)}>
          <IconBack />
        </button>
        <h1 className="absolute inset-x-12 truncate text-center text-lg font-bold uppercase">{screenTitle}</h1>
        <button
          type="button"
          className="ms-auto me-2 touch-target inline-flex items-center justify-center"
          aria-label={t('match.format')}
          onClick={() => canChangeFormat && setFormatOpen(true)}
        >
          {canChangeFormat ? <IconGear /> : null}
        </button>
      </header>

      <div className="mx-auto w-full max-w-3xl flex-1 px-[var(--gutter)] pt-6">
        {scoringLocked ? (
          <p className="mb-4 rounded-card border border-border bg-muted px-3 py-2 text-sm font-semibold" role="status">
            {t('match.scoringRulesLocked')}
          </p>
        ) : null}
        <div className="mb-8 flex items-start justify-between">
          <TeamCard
            team={homeTeam}
            emptyLabel={t('match.teamA')}
            info={t('info.match.teamA')}
            onClick={() => canChangeFormat && setPicking('home')}
          />
          <TeamCard
            team={awayTeam}
            emptyLabel={t('match.teamB')}
            info={t('info.match.teamB')}
            onClick={() => canChangeFormat && setPicking('away')}
          />
        </div>

        <Input label={t('common.venue')} info={t('info.match.venue')} value={venue} onChange={(e) => canEdit && setVenue(e.target.value)} underline placeholder={t('common.venue')} readOnly={!canEdit} />

        <div className="mt-4 grid grid-cols-2 gap-6">
          <button type="button" className="flex min-h-touch flex-col items-start border-b border-border py-2 text-start" onClick={() => dateRef.current?.showPicker?.() ?? dateRef.current?.focus()}>
            <span className="text-sm font-semibold text-text-secondary">{t('common.date')}</span>
            <span className="text-base">{formatLocalDate(date) || date}</span>
            <input ref={dateRef} type="date" className="sr-only" value={date} onChange={(e) => setDate(e.target.value)} />
          </button>
          <button type="button" className="flex min-h-touch flex-col items-start border-b border-border py-2 text-start" onClick={() => timeRef.current?.showPicker?.() ?? timeRef.current?.focus()}>
            <span className="text-sm font-semibold text-text-secondary">{t('common.time')}</span>
            <span className="text-base">{time}</span>
            <input ref={timeRef} type="time" className="sr-only" value={time} onChange={(e) => setTime(e.target.value)} />
          </button>
        </div>

        <div className="mt-6 flex items-center gap-1 border-b border-border">
          <button type="button" className="min-h-touch flex-1 py-2 text-start text-[15px] font-semibold text-text-secondary" onClick={() => canChangeFormat && setFormatOpen(true)} disabled={!canChangeFormat}>
            {formatLine} - {t(matchBallLabelKey(format.ballType))}
          </button>
          <InfoTooltip topic={t('match.format')}>{t('info.match.format')}</InfoTooltip>
        </div>

        <div className="mt-2 flex items-center gap-1">
          <button type="button" className="min-h-touch flex-1 text-start text-[15px] text-text-secondary" onClick={() => setScorerOpen(true)}>
            {selectedScorers.length ? selectedScorers.map((u) => u.name).join(', ') : t('match.selectScorer')}
          </button>
          <InfoTooltip topic={t('match.selectScorer')}>{t('info.match.scorer')}</InfoTooltip>
        </div>

        <div className="mt-1 flex items-center gap-1">
          <button
            type="button"
            className="min-h-touch flex-1 text-start text-[15px] text-text-secondary"
            onClick={() => !scoringLocked && setSeasonOpen(true)}
            disabled={scoringLocked}
          >
            {t('match.season')}* - {seasonLabel}
          </button>
          <InfoTooltip topic={t('match.season')}>{t('info.match.season')}</InfoTooltip>
        </div>

        <div className="mt-3 flex items-center gap-2 text-sm text-text-secondary">
          {isLeatherBall(format.ballType) ? <IconLeatherBall size={22} /> : <IconTennisBall size={22} />}
          <span>{t(matchBallLabelKey(format.ballType))}</span>
        </div>

        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
        {saved ? <p className="mt-3 text-sm text-success">{t('match.saved')}</p> : null}

        <div className="mt-8 grid grid-cols-2 gap-4">
          {canEdit ? (
          <Button
            variant="primary"
            className="h-[54px] rounded-xl text-base"
            disabled={!homeTeam || !awayTeam || save.isPending}
            onClick={() => {
              if (!requireLogin()) return;
              void save.mutateAsync().then((m) => {
                if (isNew) nav(`/matches/${m.id}`, { replace: true });
              });
            }}
          >
            {isNew ? t('match.saveFixture') : t('match.save')}
          </Button>
          ) : <span />}
          {canScore || canToss ? (
          <Button
            variant="primary"
            className="h-[54px] rounded-xl text-base"
            disabled={!homeTeam || !awayTeam}
            onClick={() => {
              if (!requireLogin()) return;
              void onDoScoring();
            }}
          >
            {isNew ? t('match.startMatch') : t('match.doScoring')}
          </Button>
          ) : null}
        </div>

        {matchId && canXi ? (
          <Button variant="outline" className="mt-4 h-[54px] w-full rounded-xl text-base" onClick={() => nav(`/matches/${matchId}/playing-xi`)}>
            {t('playingXI.title')}
          </Button>
        ) : null}

        {matchId && canAccess ? (
          <Button variant="outline" className="mt-4 h-[54px] w-full rounded-xl text-base" onClick={() => nav(`/matches/${matchId}/access`)}>
            {t('access.manageAccess')}
          </Button>
        ) : null}

        {matchId && canEdit ? (
          <Button variant="outline" className="mt-4 h-[54px] w-full rounded-xl text-base" onClick={() => nav(`/matches/${matchId}/over-rules`)}>
            {t('overRules.title')}
          </Button>
        ) : null}

        {matchId ? (
          <Button variant="outline" className="mt-4 h-[54px] w-full rounded-xl text-base" onClick={viewMatch}>
            {t('match.viewMatch')}
          </Button>
        ) : null}

        {match && canShare ? (
          <LiveSharePanel
            match={match}
            onUpdated={() => {
              void qc.invalidateQueries({ queryKey: keys.match(match.id) });
              void existing.refetch();
            }}
          />
        ) : null}
      </div>

      <TeamPicker
        open={picking !== null}
        onClose={() => setPicking(null)}
        excludeId={picking === 'home' ? awayTeam?.id : homeTeam?.id}
        includeIds={scopedTeamIds}
        minPlayers={format.playingPerSide}
        onPick={(team) => {
          if (picking === 'home') {
            if (awayTeam && team.id === awayTeam.id) {
              setError(t('match.sameTeam'));
              return;
            }
            setHome(team);
          }
          if (picking === 'away') {
            if (homeTeam && team.id === homeTeam.id) {
              setError(t('match.sameTeam'));
              return;
            }
            setAway(team);
          }
          setError(null);
        }}
      />
      <FormatModal open={formatOpen} value={format} onChange={setFormat} onClose={() => setFormatOpen(false)} />
      <ScorerSelector
        open={scorerOpen}
        selectedIds={selectedScorers.map((u) => u.id)}
        onClose={() => setScorerOpen(false)}
        onPick={setSelectedScorers}
      />
      <SeasonSelector
        open={seasonOpen}
        selectedId={tournamentId}
        onClose={() => setSeasonOpen(false)}
        onPick={(tn) => setTournamentId(tn?.id ?? null)}
      />
      {homeTeam && awayTeam ? (
        <TossModal
          open={tossOpen}
          onClose={() => setTossOpen(false)}
          home={homeTeam}
          away={awayTeam}
          winnerId={winnerId}
          decision={decision}
          onWinner={setWinnerId}
          onDecision={setDecision}
          onStart={() => void startScoring()}
        />
      ) : null}
    </div>
  );
}
