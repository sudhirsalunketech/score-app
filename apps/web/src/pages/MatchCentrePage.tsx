import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { computeFollowOnAvailability, computeLeadTrail, minOversFromProgress, minWicketsFromProgress } from '@crickscore/shared';
import { ApiError, api } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import { playerName, playingXiPlayers, teamById, fieldingSidePlayers } from '@/lib/format';
import { eventsToCommentaryBalls } from '@/lib/commentary-balls';
import { nextStrike } from '@/lib/strike';
import { flushQueue } from '@/lib/offline-queue';
import { dismissedIdsFromSnapshot } from '@/lib/dismissed-ids';
import { battingStatsMap, bowlingStatsMap, formatBattingStat, formatBowlingStat, lastCompletedOverBowlerId } from '@/lib/player-picker-stats';
import { useOfflineQueue } from '@/context/QueueContext';
import { useAuth } from '@/context/AuthContext';
import { canScoreThisMatch } from '@/lib/roles';
import { hasMatchPerm } from '@/lib/access';
import { liveRefetchMs, useMatchLiveSync } from '@/hooks/useMatchLiveSync';
import { useOverRuleToast } from '@/hooks/useOverRuleToast';
import { eventsToCentreBalls, groupRecentOvers } from '@/lib/centre-model';
import { ballsFacedThisOver, nextLocalBallsInOver, recentOverNumber } from '@/lib/over-progress';
import type { BallEvent, DismissalType, ExtraType, LiveData, MatchResultDto, PenaltyReason, Player, ScorecardData } from '@/types/api';
import { IconBack, IconGear, IconShare, IconSpeaker, IconSpeakerOff } from '@/components/ui/Icons';
import { UnderlineTabs } from '@/components/ui/Pills';
import { OrangeKeypad } from '@/components/scoring/OrangeKeypad';
import { WicketSheet } from '@/components/scoring/WicketSheet';
import { WicketChoiceSheet } from '@/components/scoring/WicketChoiceSheet';
import { WicketBatsmanPickSheet } from '@/components/scoring/WicketBatsmanPickSheet';
import { WicketDetailForm } from '@/components/scoring/WicketDetailForm';
import { wicketFollowKind, wicketFormDelivery } from '@/lib/wicket-followup';
import { ExtrasSheet, MoreRunsSheet } from '@/components/scoring/ExtrasSheet';
import { MoreActionsSheet } from '@/components/scoring/MoreActionsSheet';
import { MatchSettingsSheet } from '@/components/scoring/MatchSettingsSheet';
import { ScoringTables } from '@/components/scoring/ScoringTables';
import { RecentBallsStrip } from '@/components/scoring/RecentBallsStrip';
import { ScorecardView } from '@/components/scorecard/ScorecardView';
import { MatchRulesTab } from '@/components/scoring/MatchRulesTab';
import { DEFAULT_FORMAT, FormatModal, type FormatSettings } from '@/components/match/FormatModal';
import { PlayerPicker } from '@/components/match/PlayerPicker';
import { InningsSetupPanel, WicketReplacementPanel } from '@/components/match/InningsSetupPanel';
import { MatchResultBanner } from '@/components/match/MatchResultBanner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ErrorRetry, Spinner, Toast } from '@/components/ui/Feedback';
import { cn } from '@/lib/cn';
import { publicLiveUrl } from '@/lib/live';
import { resultHeadline, shareResultText } from '@/lib/match-result';
import { inningsScore } from '@/components/match/MatchResultBanner';
import { SuperStarsList } from '@/components/match/SuperStarsList';
import { LiveCommentary } from '@/components/live/LiveCommentary';
import { CustomRulesBanner } from '@/components/tournament/CustomRulesBanner';
import { SharePreview, ShareSheet } from '@/components/share/ShareSheet';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { destinationsForMatch } from '@/lib/share-destinations';
import { shouldShowQueryError, shouldShowQuerySpinner } from '@/lib/query-state';
import { shouldResetInningsPersonnel } from '@/lib/innings-personnel';
import { isScoringReady, shouldResetMatchPersonnel } from '@/lib/wicket-control';
import { parseMatchScoringSettings } from '@/lib/match-scoring-settings';
import { readStoredPersonnel, validateInningsPersonnel, writeStoredPersonnel } from '@/lib/innings-setup';

type CentreTab = 'scoring' | 'scorecard' | 'stats' | 'stars' | 'commentary' | 'rules';

type WicketStep =
  | { kind: 'hitWicket' }
  | { kind: 'hitBallTwice' }
  | { kind: 'retired' }
  | { kind: 'timedOut' }
  | { kind: 'caught' }
  | { kind: 'stumped' }
  | { kind: 'runOut' }
  | { kind: 'obstructing' };

export function MatchCentrePage() {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const queue = useOfflineQueue();
  const [tab, setTab] = useState<CentreTab>('scoring');
  const [strikerId, setStrikerId] = useState<string | null>(null);
  const [nonStrikerId, setNonStrikerId] = useState<string | null>(null);
  const [bowlerId, setBowlerId] = useState<string | null>(null);
  const [wicketOpen, setWicketOpen] = useState(false);
  const [wicketStep, setWicketStep] = useState<WicketStep | null>(null);
  const [fielderSlot, setFielderSlot] = useState<1 | 2 | null>(null);
  const [stumpedWide, setStumpedWide] = useState(false);
  const [runOutF1, setRunOutF1] = useState<Player | null>(null);
  const [runOutF2, setRunOutF2] = useState<Player | null>(null);
  const [extraOpen, setExtraOpen] = useState<ExtraType | null>(null);
  const [moreRunsOpen, setMoreRunsOpen] = useState(false);
  const [picker, setPicker] = useState<'striker' | 'nonStriker' | 'bowler' | null>(null);
  const [pendingWicket, setPendingWicket] = useState<DismissalType | null>(null);
  const [chooseNew, setChooseNew] = useState<'striker' | 'nonStriker' | null>(null);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [chooseBowler, setChooseBowler] = useState(false);
  const [lastOverBowlerId, setLastOverBowlerId] = useState<string | null>(null);
  const [ballsInOver, setBallsInOver] = useState<number | null>(null);
  const [muted, setMuted] = useState(() => {
    try {
      return localStorage.getItem('cs.scoreMute') === '1';
    } catch {
      return false;
    }
  });
  const [showResult, setShowResult] = useState(true);
  const [shareOpen, setShareOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [endInningsOpen, setEndInningsOpen] = useState(false);
  const [targetOpen, setTargetOpen] = useState(false);
  const [targetText, setTargetText] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [formatOpen, setFormatOpen] = useState(false);
  const [formatDraft, setFormatDraft] = useState<FormatSettings>(DEFAULT_FORMAT);
  const [formatError, setFormatError] = useState<string | null>(null);
  const [stopIntent, setStopIntent] = useState<'ABANDON' | 'CANCEL' | null>(null);
  const [ackedInningsBreakId, setAckedInningsBreakId] = useState<string | null>(null);
  const scoreLock = useRef(false);
  const closedRef = useRef(false);
  const lastInningsId = useRef<string | null>(null);
  const lastMatchId = useRef<string | null>(null);
  const hydratedFor = useRef<string | null>(null);
  const [locallyClosed, setLocallyClosed] = useState(false);
  const [setupConfirmed, setSetupConfirmed] = useState(false);

  const live = useQuery({
    queryKey: keys.live(id),
    queryFn: () => api<LiveData>(`/api/v1/matches/${id}/live`),
    refetchInterval: (q) => liveRefetchMs(q.state.data?.match?.status),
    refetchIntervalInBackground: true,
  });
  const scorecard = useQuery({
    queryKey: keys.scorecard(id),
    queryFn: () => api<ScorecardData>(`/api/v1/matches/${id}/scorecard`),
    enabled: tab === 'scorecard' || tab === 'stats',
    refetchInterval: () => liveRefetchMs(live.data?.match?.status),
  });

  useMatchLiveSync(id);
  const overRuleToast = useOverRuleToast();
  const [undoToast, setUndoToast] = useState<string | null>(null);

  const match = live.data?.match;
  const snapshot = live.data?.snapshot ?? null;
  const innings = live.data?.innings ?? null;

  const canScore = Boolean(match && hasMatchPerm(match, 'MATCH_SCORE'));
  const canUndo = Boolean(match && hasMatchPerm(match, 'MATCH_UNDO'));
  const canEdit = Boolean(match && hasMatchPerm(match, 'MATCH_EDIT'));
  const formatLocked = Boolean(match && ['COMPLETED', 'ABANDONED', 'CANCELLED'].includes(match.status));
  const canResult = Boolean(match && hasMatchPerm(match, 'MATCH_MANAGE_RESULT'));
  const canShare = Boolean(match && hasMatchPerm(match, 'MATCH_SHARE'));
  const canAccess = Boolean(match && hasMatchPerm(match, 'USER_MANAGE_ACCESS'));
  const scoringSettings = useMemo(() => parseMatchScoringSettings(match?.settings), [match?.settings]);

  const chase = useMemo(() => {
    if (!match || !innings || innings.targetRuns == null) return null;
    const totalBalls = match.overs * match.ballsPerOver;
    const ballsUsed = snapshot?.totalBallsLegal ?? 0;
    const ballsLeft = Math.max(0, totalBalls - ballsUsed);
    const needed = Math.max(0, innings.targetRuns - (snapshot?.totalRuns ?? 0));
    const rrr = ballsLeft > 0 ? (needed * match.ballsPerOver) / ballsLeft : 0;
    return { needed, ballsLeft, rrr };
  }, [match, innings, snapshot?.totalBallsLegal, snapshot?.totalRuns]);

  const projectedScore = useMemo(() => {
    if (!match || !innings || innings.targetRuns != null) return null;
    const ballsUsed = snapshot?.totalBallsLegal ?? 0;
    if (ballsUsed <= 0) return null;
    const totalBalls = match.overs * match.ballsPerOver;
    if (totalBalls <= ballsUsed) return null;
    const runs = snapshot?.totalRuns ?? 0;
    return Math.round((runs / ballsUsed) * totalBalls);
  }, [match, innings, snapshot?.totalBallsLegal, snapshot?.totalRuns]);

  useEffect(() => {
    if (!match || !user) return;
    if (!canScoreThisMatch(user, match) && !canScore) nav(`/matches/${id}/centre`, { replace: true });
  }, [match, user, id, nav, canScore]);

  const liveEvents = useQuery({
    queryKey: keys.inningsEvents(innings?.id ?? ''),
    queryFn: () => api<BallEvent[]>(`/api/v1/innings/${innings!.id}/events`),
    enabled: Boolean(innings?.id),
    refetchInterval: () => liveRefetchMs(match?.status),
  });

  useEffect(() => {
    if (!snapshot) return;
    const outIds = new Set([
      ...dismissedIds,
      ...(snapshot.batters ?? []).filter((b) => b.isOut).map((b) => b.playerId),
    ]);
    if (!chooseBowler) {
      setBowlerId((cur) => {
        if (cur && lastOverBowlerId && cur !== lastOverBowlerId) return cur;
        // Only the non-null case means "still holding the bowler who just finished an over and
        // must be replaced." When both are null (e.g. right after undo reverses that same over
        // completion — see undo's onSuccess resetting lastOverBowlerId), falling through lets the
        // next checks restore the correct bowler from the freshly-replayed snapshot instead of
        // getting stuck forcing a new-bowler prompt that no longer applies.
        if (cur !== null && cur === lastOverBowlerId) return null;
        if (cur) return cur;
        if (snapshot.bowlerId && snapshot.bowlerId !== lastOverBowlerId) return snapshot.bowlerId;
        return cur;
      });
    }
    if (chooseNew) return;
    setStrikerId((cur) => {
      if (cur && outIds.has(cur)) return null;
      if (cur) return cur;
      if (snapshot.strikerId && !outIds.has(snapshot.strikerId)) return snapshot.strikerId;
      return cur;
    });
    setNonStrikerId((cur) => {
      if (cur && outIds.has(cur)) return null;
      if (cur) return cur;
      if (snapshot.nonStrikerId && !outIds.has(snapshot.nonStrikerId)) return snapshot.nonStrikerId;
      return cur;
    });
    if (!chooseBowler) {
      setBallsInOver((cur) =>
        nextLocalBallsInOver({
          current: cur,
          snapshotBallsInOver: snapshot.ballsInCurrentOver,
          lastOverBowlerId,
        }),
      );
    }
  }, [snapshot, chooseNew, chooseBowler, dismissedIds, lastOverBowlerId]);

  useEffect(() => {
    if (!setupConfirmed || chooseNew) return;
    if (
      locallyClosed ||
      snapshot?.isComplete ||
      innings?.status === 'COMPLETED' ||
      match?.status !== 'LIVE'
    ) {
      return;
    }
    if (match && (snapshot?.totalWickets ?? 0) >= match.maxWickets) return;
    if (!strikerId && nonStrikerId) {
      setChooseNew('striker');
      setPicker('striker');
    } else if (!nonStrikerId && strikerId) {
      setChooseNew('nonStriker');
      setPicker('nonStriker');
    }
  }, [
    strikerId,
    nonStrikerId,
    chooseNew,
    match,
    innings?.status,
    snapshot?.totalWickets,
    snapshot?.isComplete,
    setupConfirmed,
    locallyClosed,
  ]);

  const battingTeam = match && innings ? teamById(match, innings.battingTeamId) : undefined;
  const bowlingTeam = match && innings ? teamById(match, innings.bowlingTeamId) : undefined;
  const batList = match ? playingXiPlayers(match, innings?.battingTeamId) : [];
  const bowlList = match ? playingXiPlayers(match, innings?.bowlingTeamId) : [];
  const bowlRoster = match ? fieldingSidePlayers(match, innings?.bowlingTeamId) : [];
  const bowlXiIds = bowlList.map((p) => p.id);
  const onFieldBatsmen: Player[] = [strikerId, nonStrikerId]
    .filter((pid): pid is string => Boolean(pid))
    .map((pid) => batList.find((p) => p.id === pid) ?? { id: pid, name: match ? playerName(match, pid) : pid });

  const afterOver = (finishedBowlerId: string) => {
    if (closedRef.current) return;
    setLastOverBowlerId(finishedBowlerId);
    setBowlerId(null);
    setChooseBowler(true);
    if (!chooseNew) setPicker('bowler');
  };

  const dismissedFor = (type: DismissalType) =>
    type === 'MANKAD' ? nonStrikerId : strikerId;

  const afterWicket = (
    type: DismissalType,
    dismissedId: string,
    ends: { strikerId: string; nonStrikerId: string },
  ) => {
    const nextWickets = (snapshot?.totalWickets ?? 0) + (type === 'RETIRED_HURT' ? 0 : 1);
    if (match && nextWickets >= match.maxWickets) {
      setChooseNew(null);
      setPicker(null);
      return;
    }
    if (type !== 'RETIRED_HURT') {
      setDismissedIds((ids) => (ids.includes(dismissedId) ? ids : [...ids, dismissedId]));
    }
    const slot: 'striker' | 'nonStriker' = dismissedId === ends.nonStrikerId ? 'nonStriker' : 'striker';
    if (slot === 'striker') setStrikerId(null);
    else setNonStrikerId(null);
    setChooseNew(slot);
    setPicker(slot);
  };

  const sendDelivery = (payload: {
    batsmanRuns: number;
    extraType?: ExtraType;
    extraRuns?: number;
    penaltyReason?: PenaltyReason;
    isWicket?: boolean;
    dismissalType?: DismissalType;
    dismissedPlayerId?: string;
    fielderId?: string;
  }) => {
    if (!setupConfirmed || !innings || !match || !strikerId || !nonStrikerId || !bowlerId) return null;
    if (
      match.status !== 'LIVE' ||
      innings.status === 'COMPLETED' ||
      snapshot?.isComplete ||
      closedRef.current ||
      scoreLock.current
    ) {
      return null;
    }
    if (
      payload.isWicket &&
      payload.dismissalType !== 'RETIRED_HURT' &&
      (snapshot?.totalWickets ?? 0) >= match.maxWickets
    ) {
      return null;
    }
    scoreLock.current = true;
    window.setTimeout(() => {
      scoreLock.current = false;
    }, 450);
    const extra = payload.extraType ?? 'NONE';
    const legal = extra !== 'WIDE' && extra !== 'NO_BALL' && extra !== 'PENALTY';
    const extraRuns =
      payload.extraRuns ?? (extra === 'WIDE' || extra === 'NO_BALL' ? 1 : extra === 'NONE' ? 0 : 0);
    const addRuns = payload.batsmanRuns + (extra === 'NONE' ? 0 : extraRuns);
    const ballsNow = ballsFacedThisOver({
      events: liveEvents.data ?? [],
      currentOver: snapshot?.currentOver ?? 0,
      snapshotBallsInOver: snapshot?.ballsInCurrentOver ?? 0,
      localBallsInOver: ballsInOver,
      chooseBowler,
    });
    const rotated = nextStrike({
      strikerId,
      nonStrikerId,
      batsmanRuns: payload.batsmanRuns,
      extraType: extra,
      extraRuns: payload.extraRuns,
      ballsInCurrentOver: ballsNow,
      ballsPerOver: match.ballsPerOver,
    });
    setStrikerId(rotated.strikerId);
    setNonStrikerId(rotated.nonStrikerId);
    const overDone = legal && ballsNow + 1 >= match.ballsPerOver;
    const oversDone = overDone && (snapshot?.currentOver ?? 0) + 1 >= match.overs;
    const wicketsDone =
      (snapshot?.totalWickets ?? 0) + (payload.isWicket && payload.dismissalType !== 'RETIRED_HURT' ? 1 : 0) >=
      match.maxWickets;
    const targetDone = innings.targetRuns != null && (snapshot?.totalRuns ?? 0) + addRuns >= innings.targetRuns;
    const inningsDone = Boolean(snapshot?.isComplete) || oversDone || wicketsDone || targetDone;
    if (inningsDone) {
      closedRef.current = true;
      setLocallyClosed(true);
    }
    if (legal) setBallsInOver(overDone ? 0 : ballsNow + 1);
    queue.enqueue(innings.id, id, {
      strikerId,
      nonStrikerId,
      bowlerId,
      ...payload,
    });
    void flushQueue().then(() => {
      void qc.invalidateQueries({ queryKey: keys.live(id) });
      void qc.invalidateQueries({ queryKey: keys.scorecard(id) });
      void qc.invalidateQueries({ queryKey: ['innings'] });
    });
    if (overDone && !inningsDone) afterOver(bowlerId);
    if (!muted) speakScore(payload.isWicket ? 'W' : payload.extraType && payload.extraType !== 'NONE' ? payload.extraType : String(payload.batsmanRuns));
    return rotated;
  };

  const closeWicketFollow = () => {
    setWicketStep(null);
    setFielderSlot(null);
    setStumpedWide(false);
    setRunOutF1(null);
    setRunOutF2(null);
  };

  const finishWicket = (
    type: DismissalType,
    dismissedId: string | null | undefined,
    extra?: {
      batsmanRuns?: number;
      extraType?: ExtraType;
      extraRuns?: number;
      fielderId?: string;
    },
  ) => {
    const id = dismissedId ?? dismissedFor(type);
    const ends = sendDelivery({
      batsmanRuns: extra?.batsmanRuns ?? 0,
      extraType: extra?.extraType,
      extraRuns: extra?.extraRuns,
      isWicket: true,
      dismissalType: type,
      dismissedPlayerId: id ?? undefined,
      fielderId: extra?.fielderId,
    });
    if (id && ends) afterWicket(type, id, ends);
    closeWicketFollow();
  };

  const undo = useMutation({
    mutationFn: () => api(`/api/v1/innings/${innings!.id}/undo`, { method: 'POST' }),
    onSuccess: async () => {
      closedRef.current = false;
      scoreLock.current = false;
      setLocallyClosed(false);
      setChooseNew(null);
      setChooseBowler(false);
      setLastOverBowlerId(null);
      setPicker(null);
      await qc.invalidateQueries({ queryKey: keys.live(id) });
      const next = await live.refetch();
      setDismissedIds((prev) => dismissedIdsFromSnapshot(next.data?.snapshot?.batters, prev));
      void qc.invalidateQueries({ queryKey: keys.scorecard(id) });
      void qc.invalidateQueries({ queryKey: ['innings'] });
      setUndoToast(t('scoring.undoSuccess'));
      window.setTimeout(() => setUndoToast(null), 2500);
    },
    onError: () => {
      setUndoToast(t('scoring.undoFailed'));
      window.setTimeout(() => setUndoToast(null), 3500);
    },
  });

  const createPlayer = async (name: string, teamId?: string) => {
    await api('/api/v1/players', { method: 'POST', body: { name, teamId } });
    void qc.invalidateQueries({ queryKey: keys.live(id) });
    void qc.invalidateQueries({ queryKey: keys.match(id) });
    await live.refetch();
  };

  const addPlayerByCode = async (code: string, teamId?: string) => {
    const resolved = teamId ?? (picker === 'bowler' ? bowlingTeam?.id : battingTeam?.id);
    if (!resolved) throw new Error(t('common.error'));
    const rows = await api<{ playerId: string; profileCode: string }[]>('/api/v1/players/lookup', {
      method: 'POST',
      body: { query: code, teamId: resolved },
    });
    const needle = code.trim().toUpperCase();
    const row = rows.find((r) => r.profileCode.toUpperCase() === needle) ?? (rows.length === 1 ? rows[0] : undefined);
    if (!row) throw new Error(t('match.playerNotFound'));
    try {
      await api(`/api/v1/teams/${resolved}/players`, { method: 'POST', body: { playerId: row.playerId } });
    } catch (e) {
      if (!(e instanceof ApiError && e.code === 'PLAYER_ALREADY_IN_TEAM')) throw e;
    }
    void qc.invalidateQueries({ queryKey: keys.live(id) });
    void qc.invalidateQueries({ queryKey: keys.match(id) });
    await live.refetch();
  };

  const outIds = new Set([
    ...dismissedIds,
    ...(snapshot?.batters ?? []).filter((b) => b.isOut).map((b) => b.playerId),
  ]);
  const otherEndId = picker === 'striker' ? nonStrikerId : picker === 'nonStriker' ? strikerId : null;
  const ballsNow = ballsInOver ?? snapshot?.ballsInCurrentOver ?? 0;
  const currentOver = snapshot?.currentOver ?? 0;
  const derivedLastBowler = lastCompletedOverBowlerId(liveEvents.data ?? [], {
    ballsInCurrentOver: ballsNow,
    currentOver,
  });
  const blockedBowlerId =
    picker === 'bowler' && (chooseBowler || (currentOver > 0 && ballsNow === 0))
      ? lastOverBowlerId ?? derivedLastBowler ?? (chooseBowler ? snapshot?.bowlerId ?? null : null)
      : null;
  const pickerPlayers: Player[] = picker === 'bowler' ? bowlList : batList;
  const pickerDisabledIds = new Set<string>();
  const pickerDisabledReason: Record<string, string> = {};
  if (picker === 'bowler') {
    if (blockedBowlerId) {
      pickerDisabledIds.add(blockedBowlerId);
      pickerDisabledReason[blockedBowlerId] = t('match.bowledLastOver');
    }
  } else {
    for (const id of outIds) {
      pickerDisabledIds.add(id);
      pickerDisabledReason[id] = t('match.playerOut');
    }
    if (otherEndId) {
      pickerDisabledIds.add(otherEndId);
      pickerDisabledReason[otherEndId] = t('match.alreadyBatting');
    }
  }
  const pickerStats =
    picker === 'bowler'
      ? {
          ...Object.fromEntries(bowlList.map((p) => [p.id, formatBowlingStat()])),
          ...bowlingStatsMap(snapshot?.bowlers),
        }
      : {
          ...Object.fromEntries(batList.map((p) => [p.id, formatBattingStat()])),
          ...battingStatsMap(snapshot?.batters),
        };

  const personnelError = validateInningsPersonnel({
    strikerId,
    nonStrikerId,
    bowlerId,
    battingPlayerIds: batList.map((p) => p.id),
    bowlingPlayerIds: bowlList.map((p) => p.id),
    dismissedIds: outIds,
  });
  const ready = Boolean(setupConfirmed && !personnelError);
  const finished = match?.status === 'COMPLETED' || match?.status === 'ABANDONED' || match?.status === 'CANCELLED';
  const superOverPending = match?.status === 'SUPER_OVER_PENDING';
  const isTest = match?.format === 'TEST';
  const inningsClosed = Boolean(
    finished ||
      locallyClosed ||
      match?.status === 'INNINGS_BREAK' ||
      superOverPending ||
      innings?.status === 'COMPLETED' ||
      innings?.status === 'DECLARED' ||
      snapshot?.isComplete,
  );
  const testLeadTrail = useMemo(() => {
    if (!isTest || !match) return null;
    const rows = (match.innings ?? []).map((i) => ({
      inningsNumber: i.inningsNumber,
      battingTeamId: i.battingTeamId,
      totalRuns: i.id === innings?.id ? snapshot?.totalRuns ?? i.totalRuns : i.totalRuns,
      totalWickets: i.id === innings?.id ? snapshot?.totalWickets ?? i.totalWickets : i.totalWickets,
      status: i.status as 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'DECLARED' | 'FORFEITED',
    }));
    return computeLeadTrail(rows, match.homeTeamId, match.awayTeamId);
  }, [isTest, match, innings?.id, snapshot?.totalRuns, snapshot?.totalWickets]);
  const testFollowOn = useMemo(() => {
    if (!isTest || !match) return null;
    const first = match.innings?.find((i) => i.inningsNumber === 1);
    const second = match.innings?.find((i) => i.inningsNumber === 2);
    if (!first || !second) return null;
    return computeFollowOnAvailability(
      { inningsNumber: 1, battingTeamId: first.battingTeamId, totalRuns: first.totalRuns, totalWickets: first.totalWickets, status: first.status as never },
      { inningsNumber: 2, battingTeamId: second.battingTeamId, totalRuns: second.totalRuns, totalWickets: second.totalWickets, status: second.status as never },
      match.testDurationDays,
    );
  }, [isTest, match]);
  const followOnPending = Boolean(
    isTest && match?.status === 'INNINGS_BREAK' && (match.innings?.length ?? 0) === 2 && testFollowOn?.available && match.followOnEnforced == null,
  );
  const scoringLocked = inningsClosed || (match?.status !== 'LIVE' && match?.status !== 'SUPER_OVER');
  const scoringReady = isScoringReady({
    setupConfirmed,
    strikerId,
    nonStrikerId,
    bowlerId,
    matchStatus: match?.status,
    inningsStatus: innings?.status,
    inningsComplete: inningsClosed,
    wickets: snapshot?.totalWickets,
    maxWickets: match?.maxWickets,
  });
  const showSetup = Boolean(canScore && !scoringLocked && !setupConfirmed && !chooseNew && !chooseBowler);

  useEffect(() => {
    if (!id || !innings?.id || scoringLocked) return;
    if (hydratedFor.current === innings.id) return;
    if (!batList.length || !bowlList.length) return;
    hydratedFor.current = innings.id;
    const battingIds = batList.map((p) => p.id);
    const bowlingIds = bowlList.map((p) => p.id);
    const fromSnap =
      snapshot?.strikerId && snapshot.nonStrikerId && snapshot.bowlerId
        ? {
            strikerId: snapshot.strikerId,
            nonStrikerId: snapshot.nonStrikerId,
            bowlerId: snapshot.bowlerId,
            confirmed: true as const,
          }
        : null;
    const stored = readStoredPersonnel(id, innings.id);
    const candidate = fromSnap ?? (stored?.confirmed ? stored : null);
    if (
      candidate &&
      !validateInningsPersonnel({
        ...candidate,
        battingPlayerIds: battingIds,
        bowlingPlayerIds: bowlingIds,
        dismissedIds: outIds,
      })
    ) {
      setStrikerId(candidate.strikerId);
      setNonStrikerId(candidate.nonStrikerId);
      setBowlerId(candidate.bowlerId);
      setSetupConfirmed(true);
      return;
    }
    // No restorable striker/non-striker/bowler for this innings — leave the slots empty
    // rather than guessing, so the scorer must explicitly pick each one.
    setStrikerId(null);
    setNonStrikerId(null);
    setBowlerId(null);
    setSetupConfirmed(false);
  }, [id, innings?.id, batList, bowlList, snapshot, scoringLocked, outIds]);

  useEffect(() => {
    if (!id || !innings?.id || !setupConfirmed) return;
    if (!strikerId || !nonStrikerId || !bowlerId) return;
    writeStoredPersonnel(id, innings.id, {
      strikerId,
      nonStrikerId,
      bowlerId,
      confirmed: true,
    });
  }, [id, innings?.id, strikerId, nonStrikerId, bowlerId, setupConfirmed]);

  useEffect(() => {
    if (!shouldResetMatchPersonnel(lastMatchId.current, id)) return;
    lastMatchId.current = id;
    lastInningsId.current = null;
    hydratedFor.current = null;
    closedRef.current = false;
    scoreLock.current = false;
    setLocallyClosed(false);
    setSetupConfirmed(false);
    setStrikerId(null);
    setNonStrikerId(null);
    setBowlerId(null);
    setDismissedIds([]);
    setChooseNew(null);
    setChooseBowler(false);
    setLastOverBowlerId(null);
    setPicker(null);
    setBallsInOver(null);
    setWicketOpen(false);
  }, [id]);

  useEffect(() => {
    if (!innings?.id) return;
    const switched = shouldResetInningsPersonnel(lastInningsId.current, innings.id);
    lastInningsId.current = innings.id;
    closedRef.current = false;
    setLocallyClosed(false);
    if (!switched) return;
    hydratedFor.current = null;
    setSetupConfirmed(false);
    setStrikerId(null);
    setNonStrikerId(null);
    setBowlerId(null);
    setDismissedIds([]);
    setChooseNew(null);
    setChooseBowler(false);
    setLastOverBowlerId(null);
    setPicker(null);
    setBallsInOver(null);
  }, [innings?.id]);

  useEffect(() => {
    if (inningsClosed || match?.status !== 'LIVE') {
      closedRef.current = true;
      setWicketOpen(false);
      setExtraOpen(null);
      setPendingWicket(null);
      setChooseBowler(false);
      setChooseNew(null);
      setPicker(null);
      return;
    }
    if (match?.status === 'LIVE' && innings?.status === 'IN_PROGRESS' && snapshot && !snapshot.isComplete) {
      closedRef.current = false;
    }
  }, [inningsClosed, match?.status, innings?.status, snapshot]);

  const limitMessage = (() => {
    if (!match) return null;
    if (finished) return t('scoring.matchComplete');
    if (snapshot?.totalWickets != null && snapshot.totalWickets >= match.maxWickets) return t('scoring.wicketsLimit');
    if ((snapshot?.currentOver ?? 0) >= match.overs) return t('scoring.oversLimit', { count: match.overs });
    if (innings?.targetRuns != null && (snapshot?.totalRuns ?? 0) >= innings.targetRuns) return t('scoring.targetReached');
    if (inningsClosed) return t('scoring.inningsComplete');
    return null;
  })();

  const endMatch = useMutation({
    mutationFn: () => api<MatchResultDto>(`/api/v1/matches/${id}/complete`, { method: 'POST', body: { intent: 'NO_RESULT' } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.live(id) });
      void qc.invalidateQueries({ queryKey: keys.scorecard(id) });
      setShowResult(true);
    },
  });

  const endInnings = useMutation({
    mutationFn: () => api(`/api/v1/innings/${innings!.id}/complete`, { method: 'POST' }),
    onSuccess: () => {
      setEndInningsOpen(false);
      setActionsOpen(false);
      closedRef.current = true;
      scoreLock.current = true;
      setLocallyClosed(true);
      void qc.invalidateQueries({ queryKey: keys.live(id) });
      void qc.invalidateQueries({ queryKey: keys.scorecard(id) });
    },
  });

  const declareInnings = useMutation({
    mutationFn: () => api(`/api/v1/innings/${innings!.id}/complete`, { method: 'POST', body: { asDeclaration: true } }),
    onSuccess: () => {
      setActionsOpen(false);
      closedRef.current = true;
      scoreLock.current = true;
      setLocallyClosed(true);
      void qc.invalidateQueries({ queryKey: keys.live(id) });
      void qc.invalidateQueries({ queryKey: keys.scorecard(id) });
    },
  });

  const drawMatch = useMutation({
    mutationFn: () => api<MatchResultDto>(`/api/v1/matches/${id}/draw`, { method: 'POST' }),
    onSuccess: () => {
      setActionsOpen(false);
      void qc.invalidateQueries({ queryKey: keys.live(id) });
      void qc.invalidateQueries({ queryKey: keys.scorecard(id) });
      setShowResult(true);
    },
  });

  const decideFollowOn = useMutation({
    mutationFn: (enforce: boolean) => api(`/api/v1/matches/${id}/follow-on`, { method: 'POST', body: { enforce } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.live(id) });
    },
  });

  const saveTarget = useMutation({
    mutationFn: (targetRuns: number) => api(`/api/v1/innings/${innings!.id}`, { method: 'PATCH', body: { targetRuns } }),
    onSuccess: () => {
      setTargetOpen(false);
      void qc.invalidateQueries({ queryKey: keys.live(id) });
    },
  });

  const saveScoringSettings = useMutation({
    mutationFn: (patch: Record<string, unknown>) => api(`/api/v1/matches/${id}`, { method: 'PATCH', body: patch }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.live(id) });
    },
  });
  const resumeMatch = useMutation({
    mutationFn: () => api(`/api/v1/matches/${id}/resume`, { method: 'POST' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.live(id) });
    },
  });

  const stopMatch = useMutation({
    mutationFn: (intent: 'ABANDON' | 'CANCEL') =>
      api<MatchResultDto>(`/api/v1/matches/${id}/${intent === 'CANCEL' ? 'cancel' : 'abandon'}`, { method: 'POST' }),
    onSuccess: () => {
      setStopIntent(null);
      void qc.invalidateQueries({ queryKey: keys.live(id) });
      void qc.invalidateQueries({ queryKey: keys.scorecard(id) });
      setShowResult(true);
    },
  });

  const startSecond = useMutation({
    mutationFn: async () => {
      if (!match || !innings) throw new Error(t('common.error'));
      const battingTeamId = innings.battingTeamId === match.homeTeam.id ? match.awayTeam.id : match.homeTeam.id;
      const bowlingTeamId = innings.battingTeamId;
      return api(`/api/v1/matches/${id}/innings`, { method: 'POST', body: { battingTeamId, bowlingTeamId } });
    },
    onSuccess: () => {
      closedRef.current = false;
      scoreLock.current = false;
      setLocallyClosed(false);
      setStrikerId(null);
      setNonStrikerId(null);
      setBowlerId(null);
      setDismissedIds([]);
      setChooseNew(null);
      setChooseBowler(false);
      setLastOverBowlerId(null);
      setBallsInOver(null);
      setPicker(null);
      setSetupConfirmed(false);
      hydratedFor.current = null;
      void qc.invalidateQueries({ queryKey: keys.live(id) });
      void qc.invalidateQueries({ queryKey: keys.scorecard(id) });
      void qc.invalidateQueries({ queryKey: ['innings'] });
    },
  });

  const resolveTieSharedPoints = useMutation({
    mutationFn: () => api<MatchResultDto>(`/api/v1/matches/${id}/tie/shared-points`, { method: 'POST' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.live(id) });
      void qc.invalidateQueries({ queryKey: keys.scorecard(id) });
      setShowResult(true);
    },
  });

  const startSuperOver = useMutation({
    mutationFn: () => api(`/api/v1/matches/${id}/super-over/start`, { method: 'POST' }),
    onSuccess: () => {
      closedRef.current = false;
      scoreLock.current = false;
      setLocallyClosed(false);
      setStrikerId(null);
      setNonStrikerId(null);
      setBowlerId(null);
      setDismissedIds([]);
      setChooseNew(null);
      setChooseBowler(false);
      setLastOverBowlerId(null);
      setBallsInOver(null);
      setPicker(null);
      setSetupConfirmed(false);
      hydratedFor.current = null;
      void qc.invalidateQueries({ queryKey: keys.live(id) });
      void qc.invalidateQueries({ queryKey: keys.scorecard(id) });
      void qc.invalidateQueries({ queryKey: ['innings'] });
    },
  });

  const [scoreIdx, setScoreIdx] = useState<number | null>(null);

  const inningsSnaps = useMemo(
    () =>
      (scorecard.data?.innings ?? [])
        .filter((inn) => !inn.isSuperOver)
        .slice()
        .sort((a, b) => a.inningsNumber - b.inningsNumber)
        .map((inn) => ({
          battingTeamId: inn.battingTeamId,
          bowlingTeamId: inn.bowlingTeamId,
          inningsNumber: inn.inningsNumber,
          status: inn.status,
          snapshot: inn.snapshot,
        })),
    [scorecard.data],
  );

  const recentBalls = useMemo(() => {
    const balls = eventsToCentreBalls(liveEvents.data ?? []);
    const grouped = groupRecentOvers(balls);
    if (chooseBowler) return grouped[0]?.balls ?? [];
    const overNumber = recentOverNumber({
      currentOver: snapshot?.currentOver ?? 0,
      ballsInCurrentOver: ballsInOver ?? snapshot?.ballsInCurrentOver ?? 0,
      chooseBowler: false,
    });
    return grouped.find((g) => g.overNumber === overNumber)?.balls ?? grouped[0]?.balls ?? [];
  }, [liveEvents.data, snapshot?.currentOver, snapshot?.ballsInCurrentOver, ballsInOver, chooseBowler]);

  const extrasCapped =
    scoringSettings.limitMaxBallsWithExtras &&
    (liveEvents.data ?? []).filter((e) => !e.isUndone && e.overNumber === (snapshot?.currentOver ?? 0)).length >=
      scoringSettings.maxBallsPerOverWithExtras;

  const shareMatch = () => {
    if (!match) return;
    const url = match.publicLiveEnabled && match.publicSlug ? publicLiveUrl(match.publicSlug) : window.location.href;
    const inns = (match.innings ?? []).map((inn) => ({
      battingTeamId: inn.battingTeamId,
      runs: inn.totalRuns,
      wickets: inn.totalWickets,
      overs: `${Math.floor(inn.totalBallsLegal / match.ballsPerOver)}.${inn.totalBallsLegal % match.ballsPerOver}`,
    }));
    const headline = resultHeadline({
      resultType: match.resultType,
      winnerName:
        match.resultWinnerTeamId === match.homeTeamId
          ? match.homeTeam.name
          : match.resultWinnerTeamId === match.awayTeamId
            ? match.awayTeam.name
            : null,
      marginType: match.marginType,
      marginValue: match.marginValue,
      labels: {
        completed: t('result.matchCompleted'),
        wonBy: t('result.wonBy'),
        runs: t('result.runs'),
        wickets: t('result.wickets'),
        tie: t('result.tie'),
        noResult: t('result.noResult'),
        abandoned: t('result.abandoned'),
      },
    });
    const text = shareResultText({
      title: match.title,
      homeName: match.homeTeam.name,
      awayName: match.awayTeam.name,
      homeScore: inningsScore(match.homeTeamId, inns),
      awayScore: inningsScore(match.awayTeamId, inns),
      headline,
      url,
    });
    if (navigator.share) void navigator.share({ title: match.title, text, url });
    else void navigator.clipboard.writeText(text);
  };

  const toggleMute = () => {
    setMuted((cur) => {
      const next = !cur;
      try {
        localStorage.setItem('cs.scoreMute', next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  if (shouldShowQuerySpinner(live)) return <Spinner />;
  if (shouldShowQueryError(live) || !match) return <ErrorRetry onRetry={() => void live.refetch()} />;

  if (!innings) {
    return (
      <div>
        <ScoringHeader onBack={() => nav(`/matches/${id}`)} />
        <p className="p-6 text-center text-text-secondary">{t('match.selectPlayers')}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1100px] flex-col overflow-x-hidden bg-bg">
      <ScoringHeader
        onBack={() => nav(-1)}
        viewerCount={live.data?.viewerCount ?? 0}
      />
      <UnderlineTabs
        value={tab}
        onChange={(v) => setTab(v as CentreTab)}
        tone="ink"
        caps={false}
        items={[
          { id: 'scoring', label: t('scoring.scoring') },
          { id: 'scorecard', label: t('scoring.scorecard') },
          { id: 'stats', label: t('scoring.stats') },
          { id: 'stars', label: t('scoring.superStars') },
          { id: 'commentary', label: t('live.commentary') },
          { id: 'rules', label: t('scoring.rules') },
        ]}
      />

      {match.status === 'DRINKS_BREAK' || match.status === 'RAIN_DELAY' || match.status === 'MATCH_DELAY' ? (
        <div className="mx-[var(--gutter)] my-2 rounded-card border border-border bg-muted px-3 py-2" role="status">
          <p className="text-sm font-semibold">
            {match.status === 'DRINKS_BREAK'
              ? t('match.drinksBreak')
              : match.status === 'RAIN_DELAY'
                ? t('match.rainDelay')
                : t('match.matchDelay')}
          </p>
          {canScore ? (
            <Button className="mt-2" variant="primaryDark" disabled={resumeMatch.isPending} onClick={() => resumeMatch.mutate()}>
              {t('match.resumePlay')}
            </Button>
          ) : null}
        </div>
      ) : null}

      {tab === 'scoring' ? (
        <div className="flex flex-1 flex-col">
          <div className="px-[var(--gutter)] pb-2 pt-5 text-center">
            <p className="text-base font-bold uppercase tracking-wide">{battingTeam?.name}</p>
            <p className="mt-0.5 text-sm text-text-secondary">
              {(innings.inningsNumber ?? 1) >= 2 ? t('match.secondInnings') : t('match.firstInnings')}
            </p>
            <p className="mt-3 flex items-start justify-center gap-1 leading-none">
              <span className="text-[56px] font-bold text-primary">
                {(live.data?.customRules?.affectsMatchResult && live.data.customRules.score
                  ? live.data.customRules.score.counted
                  : snapshot?.totalRuns) ?? 0}
                -{snapshot?.totalWickets ?? 0}
              </span>
              <span className="mt-2 text-lg font-semibold text-primary">({match.maxWickets})</span>
            </p>
            <CustomRulesBanner overlay={live.data?.customRules} compact />
            {limitMessage ? (
              <p className="mx-auto mt-3 max-w-md text-sm font-semibold text-danger" role="status">
                {limitMessage}
              </p>
            ) : null}
            {match.status === 'SUPER_OVER' ? (
              <p className="mt-3 inline-flex items-center justify-center gap-1 rounded-pill bg-danger px-3 py-1 text-xs font-bold uppercase tracking-wide text-on-dark">
                {t('scoring.superOver')}
              </p>
            ) : null}
            {match.status === 'INNINGS_BREAK' && innings && ackedInningsBreakId === innings.id ? (
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                {canScore ? (
                  <Button disabled={startSecond.isPending} onClick={() => void startSecond.mutate()}>
                    {t('scoring.startSecondInnings')}
                  </Button>
                ) : null}
                {canResult ? (
                  <Button variant="outline" disabled={endMatch.isPending} onClick={() => void endMatch.mutate()}>
                    {t('result.endMatch')}
                  </Button>
                ) : null}
              </div>
            ) : null}
            <div className="mt-4 flex items-center justify-center gap-2">
              <div className="inline-flex h-9 items-center rounded-lg bg-dark-chrome text-on-dark">
                <span className="px-3 text-sm font-semibold tabular-nums" aria-label={t('scoring.viewers')}>
                  {live.data?.viewerCount ?? 0}
                </span>
                  {canResult && match.status !== 'COMPLETED' && match.status !== 'ABANDONED' && match.status !== 'CANCELLED' ? (
                    <button
                      type="button"
                      className="inline-flex min-h-9 items-center px-2 text-xs font-semibold"
                      onClick={() => setActionsOpen(true)}
                    >
                      {t('result.matchActions')}
                    </button>
                  ) : null}
                  {canEdit || canAccess ? (
                  <button
                    type="button"
                    className="inline-flex min-h-9 min-w-9 items-center justify-center"
                    aria-label={t('common.settings')}
                    onClick={() => nav(canAccess && !canEdit ? `/matches/${id}/access` : `/matches/${id}`)}
                  >
                    <IconGear size={18} />
                  </button>
                  ) : null}
              </div>
              <div className="inline-flex items-center gap-2">
                <button
                  type="button"
                  className="inline-flex h-9 min-w-9 items-center justify-center rounded-lg bg-dark-chrome text-on-dark"
                  aria-label={muted ? t('scoring.unmute') : t('scoring.mute')}
                  aria-pressed={muted}
                  onClick={toggleMute}
                >
                  {muted ? <IconSpeakerOff size={18} /> : <IconSpeaker size={18} />}
                </button>
                {canShare && match.publicSlug ? (
                  <button
                    type="button"
                    className="inline-flex h-9 min-w-9 items-center justify-center rounded-lg bg-dark-chrome text-on-dark"
                    aria-label={t('live.shareLive')}
                    onClick={() => setShareOpen(true)}
                  >
                    <IconShare size={18} />
                  </button>
                ) : null}
                {canShare ? (
                  <button
                    type="button"
                    className="inline-flex h-9 min-w-9 items-center justify-center rounded-lg bg-dark-chrome text-on-dark text-[10px] font-bold"
                    aria-label={t('overlay.broadcast')}
                    onClick={() => nav(`/matches/${id}/broadcast`)}
                  >
                    TV
                  </button>
                ) : null}
              </div>
            </div>
            <p className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-text-secondary">
              <span>
                {t('match.extras')} - {snapshot?.extras ?? 0}
              </span>
              <span>
                {t('match.overs')} - {snapshot?.oversDisplay ?? '0.0'} / {match.overs}{' '}
                <InfoTooltip topic={t('match.overs')} compact>
                  {t('info.scoring.rules')}
                </InfoTooltip>
                {(snapshot?.currentOver ?? 0) >= match.overs ? ` · ${t('scoring.maxOversReached')}` : ''}
              </span>
              <span>
                {t('match.crr')} - {(snapshot?.currentRunRate ?? 0).toFixed(1)}
              </span>
              {projectedScore != null ? (
                <span>
                  {t('match.projectedScore')} - {projectedScore}
                </span>
              ) : null}
            </p>
            <p className="mt-1 text-sm text-text-secondary">
              {t('match.partnership')} -{' '}
              {snapshot?.partnership ? `${snapshot.partnership.runs}(${snapshot.partnership.balls})` : '0(0)'}
            </p>
            {chase ? (
              <p className="mt-1 text-sm font-semibold text-text">
                {t('match.runsNeeded', { runs: chase.needed, balls: chase.ballsLeft })} · {t('match.rrr')}{' '}
                {chase.rrr.toFixed(2)}
              </p>
            ) : null}
            {isTest && testLeadTrail ? (
              <p className="mt-1 text-sm font-semibold text-text">
                {testLeadTrail.leadingTeamId
                  ? t('match.leadBy', {
                      team: teamById(match, testLeadTrail.leadingTeamId)?.name ?? '',
                      runs: testLeadTrail.leadRuns,
                    })
                  : t('match.scoresLevel')}
              </p>
            ) : null}
          </div>
          <ScoringTables
            match={match}
            snapshot={snapshot}
            strikerId={strikerId}
            nonStrikerId={nonStrikerId}
            bowlerId={bowlerId}
            ballsPerOver={match.ballsPerOver}
            onChangeBatter={(which) => setPicker(which)}
            onChangeBowler={() => setPicker('bowler')}
            onSwapStrike={
              strikerId && nonStrikerId
                ? () => {
                    setStrikerId(nonStrikerId);
                    setNonStrikerId(strikerId);
                  }
                : undefined
            }
          />
          {showSetup ? (
            <InningsSetupPanel
              battingTeamName={battingTeam?.name}
              strikerName={strikerId ? playerName(match, strikerId) : null}
              nonStrikerName={nonStrikerId ? playerName(match, nonStrikerId) : null}
              bowlerName={bowlerId ? playerName(match, bowlerId) : null}
              validationKey={personnelError}
              onSelect={(slot) => setPicker(slot)}
              onStart={() => setSetupConfirmed(true)}
            />
          ) : null}
          {chooseNew && !scoringLocked ? (
            <WicketReplacementPanel
              dismissedName={
                snapshot?.batters.find((b) => b.isOut && (b.playerId === dismissedIds[dismissedIds.length - 1] || outIds.has(b.playerId)))
                  ? playerName(match, dismissedIds[dismissedIds.length - 1] ?? '')
                  : null
              }
              onSelect={() => setPicker(chooseNew)}
            />
          ) : null}
          {!ready && !scoringLocked && !showSetup && !chooseNew ? (
            <button
              type="button"
              className={cn(
                'mx-[var(--gutter)] my-3 min-h-touch font-bold',
                chooseBowler
                  ? 'rounded-pill bg-scoring text-scoring-on'
                  : 'rounded-lg bg-primary text-on-dark',
              )}
              onClick={() =>
                setPicker(
                  chooseBowler || !bowlerId
                    ? 'bowler'
                    : !strikerId
                      ? 'striker'
                      : !nonStrikerId
                        ? 'nonStriker'
                        : 'bowler',
                )
              }
            >
              {chooseBowler
                ? `${t('match.overComplete')} · ${t('match.chooseNewBowler')}`
                : t('match.selectPlayers')}
            </button>
          ) : null}
          <div className="mt-auto">
            <RecentBallsStrip balls={recentBalls} />
            <OrangeKeypad
              disabled={!scoringReady}
              extrasDisabled={extrasCapped}
              undoDisabled={finished || !canUndo || undo.isPending}
              onRun={(runs) => sendDelivery({ batsmanRuns: runs })}
              onExtra={(extra) => {
                if (scoringLocked) return;
                setExtraOpen(extra);
              }}
              onWicket={() => {
                if (scoringLocked) return;
                setWicketOpen(true);
              }}
              onUndo={canUndo && !finished && !undo.isPending ? () => undo.mutate() : undefined}
              onMore={() => {
                if (scoringLocked) return;
                setActionsOpen(true);
              }}
              onBonus={() => {
                if (scoringLocked) return;
                setExtraOpen('PENALTY');
              }}
              onMoreRuns={() => {
                if (scoringLocked) return;
                setMoreRunsOpen(true);
              }}
            />
          </div>
        </div>
      ) : null}

      {tab === 'scorecard' ? (
        scorecard.isLoading ? (
          <Spinner />
        ) : (
          <ScorecardView
            match={match}
            snapshots={inningsSnaps}
            selectedIndex={scoreIdx ?? 0}
            onSelectIndex={setScoreIdx}
          />
        )
      ) : null}

      {tab === 'stats' ? (
        <div className="grid grid-cols-2 gap-3 p-[var(--gutter)]">
          <StatTile label={t('match.extras')} value={snapshot?.extras ?? 0} />
          <StatTile label={t('match.crr')} value={(snapshot?.currentRunRate ?? 0).toFixed(2)} />
          <StatTile label={t('scoring.fours')} value={snapshot?.batters.reduce((a, b) => a + b.fours, 0) ?? 0} />
          <StatTile label={t('scoring.sixes')} value={snapshot?.batters.reduce((a, b) => a + b.sixes, 0) ?? 0} />
        </div>
      ) : null}

      {tab === 'stars' ? <SuperStarsList rows={live.data?.mvp ?? []} /> : null}
      {tab === 'commentary' ? (
        <LiveCommentary balls={eventsToCommentaryBalls(liveEvents.data ?? [], (pid) => playerName(match, pid))} />
      ) : null}
      {tab === 'rules' ? <MatchRulesTab match={match} /> : null}

      <MoreRunsSheet
        open={moreRunsOpen}
        onClose={() => setMoreRunsOpen(false)}
        onPick={(runs) => {
          setMoreRunsOpen(false);
          sendDelivery({ batsmanRuns: runs });
        }}
      />
      <WicketSheet
        open={wicketOpen}
        onClose={() => setWicketOpen(false)}
        onPick={(type) => {
          setWicketOpen(false);
          const kind = wicketFollowKind(type);
          if (kind === 'immediate') {
            finishWicket(type, dismissedFor(type));
            return;
          }
          if (kind === 'extrasPad') {
            setPendingWicket(type);
            setExtraOpen('NONE');
            return;
          }
          closeWicketFollow();
          setWicketStep({ kind } as WicketStep);
        }}
      />
      <WicketChoiceSheet
        open={wicketStep?.kind === 'hitWicket'}
        title={t('scoring.hitWicket')}
        options={[
          { id: 'LEGAL', label: t('scoring.legalBall') },
          { id: 'WIDE', label: t('scoring.wideBall') },
        ]}
        onClose={closeWicketFollow}
        onPick={(id) =>
          finishWicket('HIT_WICKET', strikerId, id === 'WIDE' ? { extraType: 'WIDE', extraRuns: 1 } : undefined)
        }
      />
      <WicketChoiceSheet
        open={wicketStep?.kind === 'hitBallTwice'}
        title={t('scoring.hitBallTwice')}
        options={[
          { id: 'LEGAL', label: t('scoring.legalBall') },
          { id: 'NO_BALL', label: t('scoring.noBallTitle') },
        ]}
        onClose={closeWicketFollow}
        onPick={(id) =>
          finishWicket(
            'HIT_BALL_TWICE',
            strikerId,
            id === 'NO_BALL' ? { extraType: 'NO_BALL', extraRuns: 1 } : undefined,
          )
        }
      />
      <WicketChoiceSheet
        open={wicketStep?.kind === 'retired'}
        title={t('scoring.retired')}
        titleAlign="center"
        options={[
          { id: 'RETIRED_HURT', label: t('scoring.moreMenu.retiredHurt') },
          { id: 'RETIRED_OUT', label: t('scoring.retiredOut') },
        ]}
        onClose={closeWicketFollow}
        onPick={(id) => finishWicket(id === 'RETIRED_HURT' ? 'RETIRED_HURT' : 'RETIRED_OUT', strikerId)}
      />
      <WicketBatsmanPickSheet
        open={wicketStep?.kind === 'timedOut'}
        title={t('scoring.timedOut')}
        batsmen={onFieldBatsmen}
        onClose={closeWicketFollow}
        onPick={(p) => finishWicket('TIMED_OUT', p.id)}
      />
      <WicketDetailForm
        open={wicketStep?.kind === 'runOut' || wicketStep?.kind === 'obstructing'}
        title={wicketStep?.kind === 'runOut' ? t('scoring.runOut') : t('scoring.obstructing')}
        batsmen={onFieldBatsmen}
        showFielders={wicketStep?.kind === 'runOut'}
        fielder1={runOutF1}
        fielder2={runOutF2}
        onClose={closeWicketFollow}
        onPickFielder={(slot) => setFielderSlot(slot)}
        onDone={(input) => {
          const extras = wicketFormDelivery(input);
          finishWicket(wicketStep?.kind === 'runOut' ? 'RUN_OUT' : 'OBSTRUCTING', input.batsmanId, {
            ...extras,
            fielderId: runOutF1?.id,
          });
        }}
      />
      <PlayerPicker
        variant="fielder"
        elevated={fielderSlot != null}
        open={wicketStep?.kind === 'caught' || wicketStep?.kind === 'stumped' || fielderSlot != null}
        title={
          wicketStep?.kind === 'stumped'
            ? t('scoring.stumpedBy')
            : wicketStep?.kind === 'caught'
              ? t('scoring.caughtBy')
              : t('scoring.selectFielder')
        }
        players={bowlRoster}
        playingIds={bowlXiIds}
        disabledIds={fielderSlot === 2 && runOutF1 ? [runOutF1.id] : fielderSlot === 1 && runOutF2 ? [runOutF2.id] : undefined}
        bodyTop={
          wicketStep?.kind === 'stumped' ? (
            <div>
              <p className="mb-2 text-sm font-bold text-black">{t('scoring.wideBallOptional')}</p>
              <button
                type="button"
                className={cn(
                  'mb-4 inline-flex min-h-11 min-w-[7rem] items-center justify-center rounded-md border border-black/20 text-sm font-bold',
                  stumpedWide ? 'bg-scoring text-scoring-on' : 'bg-white',
                )}
                onClick={() => setStumpedWide((v) => !v)}
              >
                {t('scoring.wideTitle')}
              </button>
              <p className="text-sm font-bold text-black">{t('scoring.selectWicketKeeper')}</p>
            </div>
          ) : null
        }
        onClose={() => {
          if (fielderSlot) setFielderSlot(null);
          else closeWicketFollow();
        }}
        onPick={(p) => {
          if (fielderSlot === 1) {
            setRunOutF1(p);
            setFielderSlot(null);
            return;
          }
          if (fielderSlot === 2) {
            setRunOutF2(p);
            setFielderSlot(null);
            return;
          }
          if (wicketStep?.kind === 'caught') {
            finishWicket('CAUGHT', strikerId, { fielderId: p.id });
            return;
          }
          if (wicketStep?.kind === 'stumped') {
            finishWicket('STUMPED', strikerId, {
              fielderId: p.id,
              extraType: stumpedWide ? 'WIDE' : undefined,
              extraRuns: stumpedWide ? 1 : undefined,
            });
          }
        }}
        onCreate={(name) => createPlayer(name, bowlingTeam?.id)}
        onAddByCode={(code) => addPlayerByCode(code, bowlingTeam?.id)}
      />
      <ExtrasSheet
        open={extraOpen !== null}
        extraType={extraOpen}
        pendingWicket={Boolean(pendingWicket)}
        onClose={() => {
          setExtraOpen(null);
          setPendingWicket(null);
        }}
        onConfirm={(extraRuns, batsmanRuns, penaltyReason) => {
          const extra = extraOpen;
          setExtraOpen(null);
          if (pendingWicket) {
            const dismissedId = dismissedFor(pendingWicket);
            const ends = sendDelivery({
              batsmanRuns,
              extraRuns,
              extraType: extra && extra !== 'NONE' ? extra : undefined,
              isWicket: true,
              dismissalType: pendingWicket,
              dismissedPlayerId: dismissedId ?? undefined,
            });
            if (dismissedId && ends) afterWicket(pendingWicket, dismissedId, ends);
            setPendingWicket(null);
            return;
          }
          if (!extra || extra === 'NONE') return;
          const magnitude = Math.abs(extraRuns);
          const addWideExtra = scoringSettings.addExtrasToWide;
          const addNbExtra = scoringSettings.addExtrasToNoBall;
          let signed = extraRuns;
          if (extra === 'WIDE' || extra === 'NO_BALL') {
            const add = extra === 'WIDE' ? addWideExtra : addNbExtra;
            if (add) {
              signed = extraRuns < 0 ? -Math.max(magnitude, 1) : Math.max(magnitude, 1);
            } else if (magnitude <= 1) {
              signed = 0;
            }
          }
          sendDelivery({
            batsmanRuns: extra === 'NO_BALL' ? batsmanRuns : 0,
            extraType: extra,
            extraRuns: signed,
            penaltyReason: extra === 'PENALTY' ? penaltyReason : undefined,
          });
        }}
      />
      {match ? (
        <ShareSheet
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          heading={t('share.shareMatch')}
          destinations={destinationsForMatch(match)}
          preview={
            <SharePreview
              home={match.homeTeam.name}
              away={match.awayTeam.name}
              homeLogo={match.homeTeam.logoUrl}
              awayLogo={match.awayTeam.logoUrl}
              live={match.status === 'LIVE' || match.status === 'INNINGS_BREAK'}
              tournament={match.tournament?.name}
            />
          }
        />
      ) : null}
      <PlayerPicker
        open={picker !== null}
        title={
          picker === 'bowler'
            ? chooseBowler
              ? t('match.chooseNewBowler')
              : t('match.selectBowler')
            : chooseNew
              ? t('match.chooseNewBatsman')
              : t('match.selectBatsman')
        }
        players={pickerPlayers}
        stats={pickerStats}
        disabledIds={pickerDisabledIds}
        disabledReason={pickerDisabledReason}
        onClose={() => setPicker(null)}
        onPick={(p) => {
          if (pickerDisabledIds.has(p.id)) return;
          if (picker === 'striker') setStrikerId(p.id);
          if (picker === 'nonStriker') setNonStrikerId(p.id);
          if (picker === 'bowler') {
            setBowlerId(p.id);
            if (chooseBowler) setChooseBowler(false);
            setPicker(null);
            return;
          }
          if (chooseNew && (picker === 'striker' || picker === 'nonStriker')) {
            setChooseNew(null);
            setPicker(chooseBowler ? 'bowler' : null);
            return;
          }
          if (!setupConfirmed) {
            setPicker(null);
            return;
          }
          if (picker === 'striker' && !nonStrikerId) setPicker('nonStriker');
          else if (picker === 'nonStriker' && !bowlerId) setPicker('bowler');
          else setPicker(null);
        }}
        onCreate={(name) => createPlayer(name, picker === 'bowler' ? bowlingTeam?.id : battingTeam?.id)}
        onAddByCode={addPlayerByCode}
        />
      <MoreActionsSheet
        open={actionsOpen}
        onClose={() => setActionsOpen(false)}
        canScore={canScore && (match?.status === 'LIVE' || match?.status === 'SUPER_OVER')}
        canResult={canResult && match?.status !== 'COMPLETED' && match?.status !== 'ABANDONED' && match?.status !== 'CANCELLED'}
        canEdit={canEdit}
        isTest={isTest}
        onDeclare={() => declareInnings.mutate()}
        onDraw={() => drawMatch.mutate()}
        onAbandon={() => {
          setActionsOpen(false);
          setStopIntent('ABANDON');
        }}
        onEndInnings={() => {
          setActionsOpen(false);
          setEndInningsOpen(true);
        }}
        onPenalty={() => {
          setActionsOpen(false);
          setExtraOpen('PENALTY');
        }}
        onRetiredHurt={() => {
          setActionsOpen(false);
          if (!strikerId) return;
          const ends = sendDelivery({
            batsmanRuns: 0,
            isWicket: true,
            dismissalType: 'RETIRED_HURT',
            dismissedPlayerId: strikerId,
          });
          if (ends) afterWicket('RETIRED_HURT', strikerId, ends);
        }}
        onDl={() => {
          setActionsOpen(false);
          setTargetText(innings?.targetRuns != null ? String(innings.targetRuns) : '');
          setTargetOpen(true);
        }}
        onChangeTarget={() => {
          setActionsOpen(false);
          setTargetText(innings?.targetRuns != null ? String(innings.targetRuns) : '');
          setTargetOpen(true);
        }}
        onHattrickBonus={() => {
          setActionsOpen(false);
          sendDelivery({
            batsmanRuns: 0,
            extraType: 'PENALTY',
            extraRuns: scoringSettings.hattrickBattingBonusRuns,
            penaltyReason: 'OTHER',
          });
        }}
        onHattrickPenalty={() => {
          setActionsOpen(false);
          sendDelivery({
            batsmanRuns: 0,
            extraType: 'PENALTY',
            extraRuns: -scoringSettings.hattrickWicketPenaltyRuns,
            penaltyReason: 'OTHER',
          });
        }}
        onOversFormat={() => {
          setActionsOpen(false);
          if (!match) return;
          setFormatDraft({
            ...DEFAULT_FORMAT,
            overs: match.overs,
            format: match.format,
            maxWickets: match.maxWickets,
            playingPerSide: match.playingPerSide ?? 8,
            ballsPerOver: match.ballsPerOver,
            ballType: match.ballType,
          });
          setFormatError(null);
          setFormatOpen(true);
        }}
        onSettings={() => {
          setActionsOpen(false);
          setSettingsOpen(true);
        }}
      />
      <MatchSettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        value={scoringSettings}
        ballsPerOver={match?.ballsPerOver ?? 6}
        ballsPerOverLocked={Boolean(snapshot && snapshot.totalBallsLegal > 0)}
        onChange={(patch) => {
          const { ballsPerOver, ...settingsPatch } = patch;
          const body: Record<string, unknown> = {};
          if (ballsPerOver != null) body.ballsPerOver = ballsPerOver;
          if (Object.keys(settingsPatch).length) body.settings = settingsPatch;
          void saveScoringSettings.mutate(body);
        }}
      />
      <FormatModal
        open={formatOpen}
        value={formatDraft}
        onChange={setFormatDraft}
        advanced={false}
        locked={formatLocked}
        busy={saveScoringSettings.isPending}
        error={formatError}
        minOvers={minOversFromProgress(snapshot?.totalBallsLegal ?? 0, match?.ballsPerOver ?? 6)}
        minWickets={minWicketsFromProgress(snapshot?.totalWickets ?? 0)}
        onClose={() => {
          setFormatOpen(false);
          setFormatError(null);
        }}
        onDone={() => {
          if (formatLocked) {
            setFormatOpen(false);
            setFormatError(null);
            return;
          }
          const body: Record<string, unknown> = {
            format: formatDraft.format,
            maxWickets: formatDraft.maxWickets,
            ballType: formatDraft.ballType,
          };
          if (formatDraft.format === 'HUNDRED') body.ballsPerOver = 5;
          else body.overs = formatDraft.overs;
          void saveScoringSettings
            .mutateAsync(body)
            .then(() => {
              setFormatOpen(false);
              setFormatError(null);
              void live.refetch();
            })
            .catch((e) => {
              setFormatError(e instanceof ApiError || e instanceof Error ? e.message : t('common.error'));
            });
        }}
      />
      <BottomSheet
        open={endInningsOpen}
        onClose={() => setEndInningsOpen(false)}
        title={t('scoring.moreMenu.endInnings')}
      >
        <p className="text-sm font-semibold">{t('scoring.confirmEndInnings')}</p>
        <div className="mt-4 flex gap-2">
          <Button className="flex-1" variant="outline" onClick={() => setEndInningsOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button className="flex-1" disabled={endInnings.isPending || !innings} onClick={() => endInnings.mutate()}>
            {t('result.confirmAction')}
          </Button>
        </div>
      </BottomSheet>
      <BottomSheet
        open={Boolean(match && innings && match.status === 'INNINGS_BREAK' && ackedInningsBreakId !== innings.id)}
        onClose={() => undefined}
        title={t('scoring.inningsCompleteTitle')}
      >
        <p className="text-sm font-semibold">{t('scoring.confirmEndInnings')}</p>
        <p className="mt-2 text-sm text-text-secondary">
          {t('match.scoreLabel')} {snapshot?.totalRuns ?? 0}-{snapshot?.totalWickets ?? 0} · {t('match.overs')}{' '}
          {snapshot?.oversDisplay ?? '0.0'}
        </p>
        <div className="mt-4 flex gap-2">
          <Button className="flex-1" variant="outline" disabled={undo.isPending} onClick={() => undo.mutate()}>
            {t('scoring.undo')}
          </Button>
          <Button className="flex-1" onClick={() => setAckedInningsBreakId(innings?.id ?? null)}>
            {t('scoring.moreMenu.endInnings')}
          </Button>
        </div>
      </BottomSheet>
      <BottomSheet
        open={superOverPending}
        onClose={() => undefined}
        title={t('scoring.tiedTitle')}
      >
        <p className="text-sm font-semibold">
          {match?.knockoutRound ? t('scoring.tiedKnockoutBody') : t('scoring.tiedBody')}
        </p>
        <div className="mt-4 flex flex-col gap-2">
          {!match?.knockoutRound && canResult ? (
            <Button
              variant="outline"
              disabled={resolveTieSharedPoints.isPending}
              onClick={() => resolveTieSharedPoints.mutate()}
            >
              {t('scoring.endMatchSharedPoints')}
            </Button>
          ) : null}
          {canScore ? (
            <Button disabled={startSuperOver.isPending} onClick={() => startSuperOver.mutate()}>
              {t('scoring.startSuperOver')}
            </Button>
          ) : null}
        </div>
      </BottomSheet>
      <BottomSheet open={followOnPending} onClose={() => undefined} title={t('scoring.followOnTitle')}>
        <p className="text-sm font-semibold">
          {testFollowOn
            ? t('scoring.followOnBody', {
                team: match ? teamById(match, match.innings?.find((i) => i.inningsNumber === 1)?.battingTeamId ?? '')?.name ?? '' : '',
                lead: testFollowOn.lead,
              })
            : ''}
        </p>
        <div className="mt-4 flex gap-2">
          <Button
            className="flex-1"
            variant="outline"
            disabled={decideFollowOn.isPending}
            onClick={() => decideFollowOn.mutate(false)}
          >
            {t('scoring.doNotEnforceFollowOn')}
          </Button>
          <Button className="flex-1" disabled={decideFollowOn.isPending} onClick={() => decideFollowOn.mutate(true)}>
            {t('scoring.enforceFollowOn')}
          </Button>
        </div>
      </BottomSheet>
      <BottomSheet open={targetOpen} onClose={() => setTargetOpen(false)} title={t('scoring.moreMenu.changeTarget')}>
        <Input
          label={t('scoring.targetRuns')}
          inputMode="numeric"
          value={targetText}
          onChange={(e) => setTargetText(e.target.value.replace(/\D/g, ''))}
        />
        <Button
          className="mt-4 w-full"
          disabled={saveTarget.isPending || !targetText}
          onClick={() => saveTarget.mutate(Number(targetText))}
        >
          {t('common.save')}
        </Button>
      </BottomSheet>
      <BottomSheet
        open={Boolean(stopIntent)}
        onClose={() => setStopIntent(null)}
        title={stopIntent === 'CANCEL' ? t('result.confirmCancelTitle') : t('result.confirmAbandonTitle')}
      >
        <p className="text-sm font-semibold">{t('result.confirmStop')}</p>
        <p className="mt-2 text-sm text-text-secondary">{t('result.confirmStopHint')}</p>
        <div className="mt-4 flex gap-2">
          <Button className="flex-1" variant="outline" onClick={() => setStopIntent(null)}>
            {t('common.cancel')}
          </Button>
          <Button
            className="flex-1"
            variant="danger"
            disabled={stopMatch.isPending}
            onClick={() => stopIntent && stopMatch.mutate(stopIntent)}
          >
            {t('result.confirmAction')}
          </Button>
        </div>
      </BottomSheet>
      {finished && showResult ? (
        <div className="fixed inset-0 z-30 overflow-y-auto bg-bg pt-[env(safe-area-inset-top)]">
          <MatchResultBanner
            result={{
              status: match.status,
              resultType: match.resultType,
              winnerTeamId: match.resultWinnerTeamId,
              marginType: match.marginType,
              marginValue: match.marginValue,
              home: { teamId: match.homeTeam.id, name: match.homeTeam.name },
              away: { teamId: match.awayTeam.id, name: match.awayTeam.name },
              innings: (match.innings ?? []).map((inn) => ({
                battingTeamId: inn.battingTeamId,
                runs: inn.totalRuns,
                wickets: inn.totalWickets,
                overs: `${Math.floor(inn.totalBallsLegal / match.ballsPerOver)}.${inn.totalBallsLegal % match.ballsPerOver}`,
              })),
            }}
            actions={{
              onScorecard: () => {
                setShowResult(false);
                setTab('scorecard');
              },
              onCentre: () => nav(`/matches/${id}/centre`),
              onShare: shareMatch,
            }}
          />
        </div>
      ) : null}
      <Toast open={Boolean(overRuleToast)} message={overRuleToast?.message ?? ''} />
      <Toast open={Boolean(undoToast)} message={undoToast ?? ''} />
    </div>
  );
}

function ScoringHeader({
  onBack,
  viewerCount = 0,
}: {
  onBack: () => void;
  viewerCount?: number;
}) {
  const { t } = useTranslation();
  return (
    <header className="sticky top-0 z-20 flex min-h-14 items-center border-b border-border bg-bg pt-[env(safe-area-inset-top)]">
      <button
        type="button"
        className="touch-target inline-flex shrink-0 items-center justify-center"
        aria-label={t('common.back')}
        onClick={onBack}
      >
        <IconBack />
      </button>
      <h1 className="min-w-0 flex-1 truncate text-center text-lg font-bold">{t('match.centre')}</h1>
      <div className="me-2 flex min-w-11 flex-col items-end justify-center gap-0.5">
        {viewerCount > 0 ? (
          <span className="text-[10px] font-bold uppercase text-text-secondary" aria-label={t('scoring.viewers')}>
            {viewerCount} {t('share.watching')}
          </span>
        ) : null}
      </div>
    </header>
  );
}

function speakScore(label: string) {
  try {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(label);
    u.rate = 1.05;
    window.speechSynthesis.speak(u);
  } catch {
    /* ignore */
  }
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-card bg-muted p-4">
      <p className="text-xs text-text-secondary">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
