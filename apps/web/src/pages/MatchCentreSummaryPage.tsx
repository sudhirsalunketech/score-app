import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import { publicLiveUrl } from '@/lib/live';
import { centreFromLive, eventsToCentreBalls } from '@/lib/centre-model';
import { playerName } from '@/lib/format';
import { useAuth } from '@/context/AuthContext';
import { hasMatchPerm } from '@/lib/access';
import { liveRefetchMs, useMatchLiveSync } from '@/hooks/useMatchLiveSync';
import type { BallEvent, LiveData, ScorecardData } from '@/types/api';
import type { BallFeedEvent } from '@/lib/ball-feed';
import { ballsSummaryFromEvents, ballsSummaryFromSnapshot } from '@/lib/ball-feed';
import { MatchCentreHeader } from '@/components/centre/MatchCentreHeader';
import { MatchCentreView } from '@/components/centre/MatchCentreView';
import { CompletedMatchSummary } from '@/components/centre/CompletedMatchSummary';
import { MatchBallsTab } from '@/components/centre/MatchBallsTab';
import { MatchInfoTab } from '@/components/centre/MatchInfoTab';
import { MatchCentreSkeleton } from '@/components/centre/MatchSummary';
import { useSocketConnection } from '@/lib/socket';
import { UnderlineTabs } from '@/components/ui/Pills';
import { ScorecardView } from '@/components/scorecard/ScorecardView';
import { ErrorRetry, Spinner } from '@/components/ui/Feedback';
import { shouldShowQueryError, shouldShowQuerySpinner } from '@/lib/query-state';
import { SuperStarsList } from '@/components/match/SuperStarsList';
import { MatchRulesTab } from '@/components/scoring/MatchRulesTab';
import { LiveCommentary } from '@/components/live/LiveCommentary';
import { eventsToCommentaryBalls } from '@/lib/commentary-balls';
import { ruleBySequence } from '@/lib/custom-rules-display';
import { IconQuiz, IconShare } from '@/components/ui/Icons';
import { SharePreview, ShareSheet } from '@/components/share/ShareSheet';
import { destinationsForMatch } from '@/lib/share-destinations';
import { FanZone } from '@/components/fans/FanZone';
import type { FanQuizVisibility } from '@/lib/fan-quiz';

type Tab = 'summary' | 'scorecard' | 'rules' | 'stats' | 'stars' | 'balls' | 'info' | 'fans' | 'commentary';

export function MatchCentreSummaryPage() {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const nav = useNavigate();
  const connection = useSocketConnection();
  const [tab, setTab] = useState<Tab>('summary');
  const [scoreIdx, setScoreIdx] = useState<number | null>(null);
  const [inningsTab, setInningsTab] = useState<1 | 2>(1);
  const [shareOpen, setShareOpen] = useState(false);

  const live = useQuery({
    queryKey: keys.live(id),
    queryFn: () => api<LiveData>(`/api/v1/matches/${id}/live`),
    refetchInterval: (q) => liveRefetchMs(q.state.data?.match?.status),
    refetchIntervalInBackground: true,
  });

  const match = live.data?.match;
  const inningsList = match?.innings ?? [];
  const firstInnings = inningsList.find((inn) => inn.inningsNumber === 1) ?? null;
  const secondInnings = inningsList.find((inn) => inn.inningsNumber >= 2) ?? null;
  const ballsInnings = inningsTab === 2 ? secondInnings : firstInnings;
  const liveInningsId = live.data?.innings?.id;

  const liveEvents = useQuery({
    queryKey: keys.inningsEvents(liveInningsId ?? ''),
    queryFn: () => api<BallEvent[]>(`/api/v1/innings/${liveInningsId}/events`),
    enabled: Boolean(liveInningsId),
    refetchInterval: () => liveRefetchMs(match?.status),
    refetchIntervalInBackground: true,
  });

  const ballsEvents = useQuery({
    queryKey: keys.inningsEvents(ballsInnings?.id ?? ''),
    queryFn: () => api<BallEvent[]>(`/api/v1/innings/${ballsInnings!.id}/events`),
    enabled: tab === 'balls' && Boolean(ballsInnings?.id),
    refetchInterval: () => liveRefetchMs(match?.status),
    refetchIntervalInBackground: true,
  });

  const scorecard = useQuery({
    queryKey: keys.scorecard(id),
    queryFn: () => api<ScorecardData>(`/api/v1/matches/${id}/scorecard`),
    enabled: tab === 'summary' || tab === 'scorecard' || tab === 'stats' || tab === 'stars' || tab === 'balls',
    refetchInterval: (q) => (q.state.data ? liveRefetchMs(match?.status) : false),
  });
  const fanOverview = useQuery({
    queryKey: keys.fanOverview(id),
    queryFn: () => api<{ fanQuiz?: FanQuizVisibility }>(`/api/v1/matches/${id}/fan`),
  });
  const showFanQuiz = Boolean(fanOverview.data?.fanQuiz?.show);

  useMatchLiveSync(id);

  const seededInnings = useRef(false);
  useEffect(() => {
    if (seededInnings.current) return;
    const current = live.data?.innings?.inningsNumber;
    if (current === 1 || current === 2) {
      setInningsTab(current);
      seededInnings.current = true;
    }
  }, [live.data?.innings?.inningsNumber]);

  const snapshot = live.data?.snapshot ?? null;

  const model = useMemo(() => {
    if (!live.data) return null;
    const share =
      live.data.match.publicLiveEnabled && live.data.match.publicSlug
        ? publicLiveUrl(live.data.match.publicSlug)
        : null;
    const base = centreFromLive(live.data, share);
    return {
      ...base,
      recentBalls: liveEvents.data
        ? eventsToCentreBalls(
            liveEvents.data.map((ev) => ({
              ...ev,
              strikerName: playerName(live.data.match, ev.strikerId),
              bowlerName: playerName(live.data.match, ev.bowlerId),
            })),
          )
        : base.recentBalls,
    };
  }, [live.data, liveEvents.data]);

  const ballRows: BallFeedEvent[] = useMemo(() => {
    if (!match || !ballsEvents.data) return [];
    const adj = ruleBySequence(live.data?.customRules?.evaluations);
    return ballsEvents.data.map((ev) => ({
      sequence: ev.sequence,
      overNumber: ev.overNumber,
      ballInOver: ev.ballInOver,
      batsmanRuns: ev.batsmanRuns,
      extraRuns: ev.extraRuns,
      extraType: ev.extraType,
      isWicket: ev.isWicket,
      dismissalType: ev.dismissalType,
      commentary: ev.commentary,
      bowlerName: playerName(match, ev.bowlerId),
      strikerName: playerName(match, ev.strikerId),
      dismissedName: ev.dismissedPlayerId ? playerName(match, ev.dismissedPlayerId) : null,
      ruleLabel: adj.get(ev.sequence)?.label,
      ruleReason: adj.get(ev.sequence)?.reason,
    }));
  }, [ballsEvents.data, live.data?.customRules?.evaluations, match]);

  if (shouldShowQuerySpinner(live)) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-[1100px] flex-col overflow-x-hidden bg-bg">
        <MatchCentreHeader onBack={() => nav(isAuthenticated ? `/matches/${id}` : '/matches')} />
        <MatchCentreSkeleton />
      </div>
    );
  }
  if (shouldShowQueryError(live) || !match || !model) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-[1100px] flex-col overflow-x-hidden bg-bg">
        <MatchCentreHeader onBack={() => nav(isAuthenticated ? `/matches/${id}` : '/matches')} />
        <ErrorRetry
          message={t('match.unableToLoad')}
          retryLabel={t('match.tryAgain')}
          onRetry={() => void live.refetch()}
        />
      </div>
    );
  }

  const inningsSnaps = (scorecard.data?.innings ?? [])
    .filter((inn) => !inn.isSuperOver)
    .slice()
    .sort((a, b) => a.inningsNumber - b.inningsNumber)
    .map((inn) => ({
      battingTeamId: inn.battingTeamId,
      bowlingTeamId: inn.bowlingTeamId,
      inningsNumber: inn.inningsNumber,
      status: inn.status,
      snapshot: inn.snapshot,
    }));
  const finished = match.status === 'COMPLETED' || match.status === 'ABANDONED' || match.status === 'CANCELLED';

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1100px] flex-col overflow-x-hidden bg-bg">
      <MatchCentreHeader
        onBack={() => nav(isAuthenticated ? '/matches' : '/')}
        end={
          <div className="flex items-center">
            {hasMatchPerm(match, 'MATCH_SCORE') ? (
              <button
                type="button"
                className="me-1 min-h-touch px-2 text-sm font-semibold text-primary"
                onClick={() => nav(`/matches/${id}/score`)}
              >
                {t('access.scoreMatch')}
              </button>
            ) : null}
            {match.publicSlug ? (
              <button
                type="button"
                className="touch-target inline-flex items-center justify-center"
                aria-label={t('share.shareMatch')}
                onClick={() => setShareOpen(true)}
              >
                <IconShare size={18} />
              </button>
            ) : null}
            {showFanQuiz ? (
              <button
                type="button"
                className="touch-target inline-flex items-center justify-center"
                aria-label={t('fans.fanQuiz')}
                onClick={() => nav(`/matches/${id}/quiz`)}
              >
                <IconQuiz size={18} />
              </button>
            ) : null}
          </div>
        }
      />
      <UnderlineTabs
        value={tab}
        onChange={(v) => setTab(v as Tab)}
        tone="ink"
        caps={false}
        items={[
          { id: 'summary', label: t('match.summary') },
          { id: 'scorecard', label: t('scoring.scorecard') },
          { id: 'rules', label: t('scoring.rules') },
          { id: 'commentary', label: t('live.commentary') },
          { id: 'stats', label: t('scoring.stats') },
          { id: 'stars', label: t('scoring.superStars') },
          { id: 'balls', label: t('match.balls') },
          { id: 'info', label: t('match.info') },
          { id: 'fans', label: t('match.fans') },
        ]}
      />
      {tab === 'summary' ? (
        finished ? (
          <CompletedMatchSummary
            match={match}
            innings={scorecard.data?.innings?.length ? scorecard.data.innings : match.innings ?? []}
            mvp={scorecard.data?.mvp ?? live.data?.mvp ?? []}
          />
        ) : (
          <MatchCentreView model={model} connection={connection} />
        )
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
            showOverRulesLink={false}
          />
        )
      ) : null}
      {tab === 'rules' ? <MatchRulesTab match={match} /> : null}
      {tab === 'commentary' ? (
        <LiveCommentary balls={eventsToCommentaryBalls(liveEvents.data ?? [], (pid) => playerName(match, pid))} />
      ) : null}
      {tab === 'stats' ? (
        <div className="grid grid-cols-2 gap-3 p-[var(--gutter)]">
          <StatTile label={t('match.extras')} value={snapshot?.extras ?? 0} />
          <StatTile label={t('match.crr')} value={(snapshot?.currentRunRate ?? 0).toFixed(1)} />
          <StatTile label={t('scoring.fours')} value={snapshot?.batters.reduce((a, b) => a + b.fours, 0) ?? 0} />
          <StatTile label={t('scoring.sixes')} value={snapshot?.batters.reduce((a, b) => a + b.sixes, 0) ?? 0} />
        </div>
      ) : null}
      {tab === 'stars' ? <SuperStarsList rows={live.data?.mvp ?? []} /> : null}
      {tab === 'balls' ? (
        <MatchBallsTab
          events={ballRows}
          innings={inningsTab}
          onInningsChange={setInningsTab}
          loading={ballsEvents.isFetching && !ballsEvents.data}
          summary={
            (() => {
              const liveNum = live.data?.innings?.inningsNumber ?? 0;
              const snap =
                inningsTab === liveNum
                  ? snapshot
                  : (scorecard.data?.innings.find((inn) => inn.inningsNumber === inningsTab)?.snapshot ??
                      ballsInnings?.snapshot ??
                      null);
              const fromSnap = ballsSummaryFromSnapshot(snap, (pid) => playerName(match, pid), match.ballsPerOver);
              const fromEvents = ballsSummaryFromEvents(ballRows, match.ballsPerOver);
              if (!fromSnap) return fromEvents;
              return {
                ...fromSnap,
                striker: fromSnap.striker ?? fromEvents?.striker ?? null,
                nonStriker: fromSnap.nonStriker ?? fromEvents?.nonStriker ?? null,
                bowler: fromSnap.bowler ?? fromEvents?.bowler ?? null,
              };
            })()
          }
        />
      ) : null}
      {tab === 'info' ? <MatchInfoTab match={match} /> : null}
      {tab === 'fans' ? (
        <FanZone
          matchId={id}
          tournamentId={match.tournament?.id}
          compact
          loginNext={`/matches/${id}/centre`}
        />
      ) : null}
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
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border-b border-border py-4">
      <p className="text-xs text-text-secondary">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
