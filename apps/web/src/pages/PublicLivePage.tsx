import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { usePublicLive } from '@/hooks/usePublicLive';
import { setPageMeta, publicLiveUrl } from '@/lib/live';
import { centreFromPublic } from '@/lib/centre-model';
import { api } from '@/lib/api';
import type { BallFeedEvent } from '@/lib/ball-feed';
import { ballsSummaryFromEvents } from '@/lib/ball-feed';
import { MatchCentreHeader } from '@/components/centre/MatchCentreHeader';
import { MatchCentreView } from '@/components/centre/MatchCentreView';
import { BatsmanTable, BowlerTable, LiveIndicator, MatchCentreSkeleton } from '@/components/centre/MatchSummary';
import { MatchBallsTab } from '@/components/centre/MatchBallsTab';
import { UnderlineTabs } from '@/components/ui/Pills';
import { Button } from '@/components/ui/Button';
import { ErrorRetry } from '@/components/ui/Feedback';
import { SuperStarsList } from '@/components/match/SuperStarsList';
import { ruleBySequence } from '@/lib/custom-rules-display';
import { SharePreview, ShareSheet } from '@/components/share/ShareSheet';
import { destinationsForPublicLive } from '@/lib/share-destinations';
import { BetaBadge } from '@/components/beta/BetaBadge';
import type { BallEvent, ExtraType, MvpPlayerRow, ScorecardData } from '@/types/api';
import { ScorecardView } from '@/components/scorecard/ScorecardView';
import { FanZone } from '@/components/fans/FanZone';
import { YoutubeEmbed } from '@/components/live/YoutubeEmbed';
import { LiveCommentary } from '@/components/live/LiveCommentary';

type Tab =
  | 'summary'
  | 'scorecard'
  | 'commentary'
  | 'stats'
  | 'stars'
  | 'balls'
  | 'info'
  | 'fans'
  | 'video'
  | 'teams'
  | 'chat'
  | 'quiz';

export function PublicLivePage() {
  const { slug = '' } = useParams();
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const { data, error, reload, connection } = usePublicLive(slug);
  const requested = params.get('tab');
  const [tab, setTab] = useState<Tab>((requested as Tab) || 'summary');
  const [shareOpen, setShareOpen] = useState(false);
  const [inningsTab, setInningsTab] = useState<1 | 2>(1);
  const [scoreIdx, setScoreIdx] = useState<number | null>(null);
  const seededInnings = useRef(false);

  const mvpQ = useQuery({
    queryKey: ['public-mvp', slug],
    queryFn: () => api<MvpPlayerRow[]>(`/api/v1/public/matches/${slug}/mvp`, { auth: false }),
    enabled: tab === 'stars' && Boolean(slug) && data?.share?.mvp !== false,
    retry: false,
  });
  const scorecard = useQuery({
    queryKey: ['public-scorecard', slug],
    queryFn: () => api<ScorecardData>(`/api/v1/public/matches/${slug}/scorecard`, { auth: false }),
    enabled: tab === 'scorecard' && Boolean(slug) && data?.share?.scorecard !== false,
    retry: false,
  });
  const ballsEvents = useQuery({
    queryKey: ['public-events', slug, inningsTab],
    queryFn: () => api<BallEvent[]>(`/api/v1/public/matches/${slug}/events?innings=${inningsTab}`, { auth: false }),
    enabled: tab === 'balls' && Boolean(slug) && data?.share?.scorecard !== false,
    retry: false,
  });

  const model = useMemo(() => {
    if (!data) return null;
    return centreFromPublic(data, data.publicSlug ? publicLiveUrl(data.publicSlug) : window.location.href);
  }, [data]);

  const ballRows: BallFeedEvent[] = useMemo(() => {
    const adj = ruleBySequence(data?.customRules?.balls);
    if (ballsEvents.data?.length) {
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
        bowlerName: data?.bowler?.name || '—',
        strikerName: data?.striker?.name || '—',
        dismissedName: null,
        ruleLabel: adj.get(ev.sequence)?.label,
        ruleReason: adj.get(ev.sequence)?.reason,
      }));
    }
    if (!data) return [];
    return data.recentBalls.map((b) => ({
      sequence: b.sequence,
      overNumber: b.overNumber,
      ballInOver: b.ballInOver,
      batsmanRuns: b.batsmanRuns ?? 0,
      extraRuns: b.extraRuns ?? 0,
      extraType: (b.extraType ?? 'NONE') as ExtraType,
      isWicket: b.isWicket,
      commentary: b.commentary,
      bowlerName: b.bowlerName || data.bowler?.name || '—',
      strikerName: b.strikerName || data.striker?.name || '—',
      ruleLabel: adj.get(b.sequence)?.label,
      ruleReason: adj.get(b.sequence)?.reason,
    }));
  }, [ballsEvents.data, data]);

  const ballsSummary = useMemo(() => {
    const bpo = data?.ballsPerOver ?? 6;
    if (model) {
      const striker = model.batsmen.find((b) => b.onStrike) ?? null;
      const non = model.batsmen.find((b) => !b.onStrike) ?? null;
      return {
        striker: striker ? { name: striker.name, runs: striker.runs, balls: striker.balls } : null,
        nonStriker: non ? { name: non.name, runs: non.runs, balls: non.balls } : null,
        bowler: model.bowler
          ? {
              name: model.bowler.name,
              overs: model.bowler.overs,
              maidens: model.bowler.maidens,
              runs: model.bowler.runs,
              wickets: model.bowler.wickets,
            }
          : null,
        overs: model.overs,
        runs: model.runs,
        wickets: model.wickets,
      };
    }
    return ballsSummaryFromEvents(ballRows, bpo);
  }, [ballRows, data?.ballsPerOver, model]);

  useEffect(() => {
    if (seededInnings.current) return;
    if (data?.inningsNumber === 1 || data?.inningsNumber === 2) {
      setInningsTab(data.inningsNumber);
      seededInnings.current = true;
    }
  }, [data?.inningsNumber]);

  useEffect(() => {
    if (!data) {
      setPageMeta({
        title: 'Live cricket score | CrickScore',
        description: 'Live tennis-ball cricket score',
        url: window.location.href,
        robots: 'noindex,nofollow',
      });
      return;
    }
    const title = `${data.homeTeam.name} vs ${data.awayTeam.name} — Live Cricket Score | CrickScore`;
    setPageMeta({
      title,
      description: `${data.title}. ${data.score.runs}/${data.score.wickets} in ${data.score.overs} overs.`,
      url: data.publicSlug ? publicLiveUrl(data.publicSlug) : window.location.href,
      image: `${window.location.origin}/favicon.svg`,
      robots: 'index,follow',
    });
  }, [data]);

  if (!data && !error) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-[1100px] flex-col overflow-x-hidden bg-bg">
        <MatchCentreHeader onBack={() => window.history.back()} />
        <MatchCentreSkeleton />
      </div>
    );
  }
  if (error || !data || !model) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-[1100px] flex-col overflow-x-hidden bg-bg">
        <MatchCentreHeader onBack={() => window.history.back()} />
        <ErrorRetry message={t('match.unableToLoad')} retryLabel={t('match.tryAgain')} onRetry={() => void reload()} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1100px] flex-col overflow-x-hidden bg-bg">
      <MatchCentreHeader onBack={() => window.history.back()} />
      <div className="px-[var(--gutter)] pb-1">
        <BetaBadge publicPage />
      </div>
      {data.viewerCount ? (
        <p className="px-[var(--gutter)] text-xs text-text-secondary">👁 {data.viewerCount} {t('share.watching')}</p>
      ) : null}
      {data.status === 'SCHEDULED' || data.status === 'TOSS_PENDING' || data.status === 'TOSS_COMPLETED' || data.status === 'DRAFT' ? (
        <div className="mx-[var(--gutter)] mb-3 rounded-card border border-border p-4 text-center">
          <p className="text-xs font-bold uppercase text-text-secondary">{t('share.upcoming')}</p>
          <p className="mt-2 text-lg font-bold">
            {data.homeTeam.name} vs {data.awayTeam.name}
          </p>
          {data.scheduledAt ? <p className="mt-1 text-sm text-text-secondary">{new Date(data.scheduledAt).toLocaleString()}</p> : null}
          {data.venueText ? <p className="text-sm text-text-secondary">{data.venueText}</p> : null}
          <p className="text-sm text-text-secondary">
            {data.oversLimit} {t('match.overs')}
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-3"
            onClick={() => {
              try {
                localStorage.setItem(`cs.remind.${slug}`, data.scheduledAt ?? '');
              } catch {
                /* ignore */
              }
            }}
          >
            {t('share.setReminder')}
          </Button>
        </div>
      ) : null}
      <div className="px-[var(--gutter)] pb-2">
        <Button type="button" variant="outline" className="w-full" onClick={() => setShareOpen(true)}>
          {t('common.share')}
        </Button>
      </div>
      <UnderlineTabs
        value={tab}
        onChange={(v) => {
          setTab(v as Tab);
          setParams(
            (prev) => {
              const next = new URLSearchParams(prev);
              next.set('tab', v);
              return next;
            },
            { replace: true },
          );
        }}
        tone="ink"
        caps={false}
        items={[
          { id: 'summary', label: t('match.summary') },
          ...(data.youtube.enabled && data.youtube.videoId ? [{ id: 'video', label: t('live.watchLive') }] : []),
          ...(data.share?.scorecard === false ? [] : [{ id: 'scorecard', label: t('scoring.scorecard') }]),
          { id: 'commentary', label: t('live.commentary') },
          ...(data.share?.stats === false ? [] : [{ id: 'stats', label: t('scoring.stats') }]),
          ...(data.share?.mvp === false ? [] : [{ id: 'stars', label: t('scoring.superStars') }]),
          { id: 'balls', label: t('match.balls') },
          { id: 'teams', label: t('match.teams') },
          { id: 'info', label: t('match.info') },
          { id: 'chat', label: t('fans.chat') },
          { id: 'quiz', label: t('fans.quiz') },
          { id: 'fans', label: t('match.fans') },
        ]}
      />
      {tab === 'summary' ? (
        data.share?.live === false && (data.status === 'LIVE' || data.status === 'INNINGS_BREAK') ? (
          <p className="px-[var(--gutter)] py-8 text-sm text-text-secondary">{t('share.liveHidden')}</p>
        ) : (
          <MatchCentreView model={model} connection={connection} />
        )
      ) : null}
      {tab === 'video' && data.youtube.videoId ? (
        <div className="px-[var(--gutter)] py-4">
          <YoutubeEmbed videoId={data.youtube.videoId} title={`${t('live.watchLive')} — ${data.title}`} />
        </div>
      ) : null}
      {tab === 'commentary' ? <LiveCommentary balls={data.recentBalls} /> : null}
      {tab === 'scorecard' ? (
        scorecard.isLoading ? (
          <p className="px-[var(--gutter)] py-8 text-sm text-text-secondary">{t('common.loading')}</p>
        ) : scorecard.data ? (
          <ScorecardView
            match={scorecard.data.match}
            snapshots={scorecard.data.innings
              .filter((inn) => !inn.isSuperOver)
              .slice()
              .sort((a, b) => a.inningsNumber - b.inningsNumber)
              .map((inn) => ({
                battingTeamId: inn.battingTeamId,
                bowlingTeamId: inn.bowlingTeamId,
                inningsNumber: inn.inningsNumber,
                status: inn.status,
                snapshot: inn.snapshot,
              }))}
            selectedIndex={scoreIdx ?? 0}
            onSelectIndex={setScoreIdx}
          />
        ) : (
          <div className="pb-8">
            <BatsmanTable rows={model.batsmen} />
            <BowlerTable bowler={model.bowler} />
          </div>
        )
      ) : null}
      {tab === 'stats' ? (
        <div className="grid grid-cols-2 gap-3 p-[var(--gutter)]">
          <Stat label={t('match.extras')} value={model.extras} />
          <Stat label={t('match.crr')} value={model.crr.toFixed(1)} />
          <Stat label={t('scoring.fours')} value={model.batsmen.reduce((a, b) => a + b.fours, 0)} />
          <Stat label={t('scoring.sixes')} value={model.batsmen.reduce((a, b) => a + b.sixes, 0)} />
        </div>
      ) : null}
      {tab === 'stars' ? <SuperStarsList rows={mvpQ.data ?? []} /> : null}
      {tab === 'balls' ? (
        <MatchBallsTab
          events={ballRows}
          innings={inningsTab}
          onInningsChange={setInningsTab}
          loading={ballsEvents.isFetching && !ballsEvents.data}
          summary={ballsSummary}
        />
      ) : null}
      {tab === 'teams' ? <PublicTeams data={data} /> : null}
      {tab === 'chat' ? (
        <FanZone matchId={data.matchId} compact initialTab="chat" loginNext={`/live/match/${slug}?tab=chat`} />
      ) : null}
      {tab === 'quiz' ? (
        <FanZone matchId={data.matchId} compact initialTab="quiz" loginNext={`/live/match/${slug}?tab=quiz`} />
      ) : null}
      {tab === 'fans' ? (
        <FanZone matchId={data.matchId} compact loginNext={`/live/match/${slug}?tab=fans`} />
      ) : null}
      {tab === 'info' ? (
        <dl className="divide-y divide-border px-[var(--gutter)] pb-8">
          <div className="flex justify-between py-4">
            <dt className="text-sm text-text-secondary">{t('match.live')}</dt>
            <dd>
              <LiveIndicator status={data.status} />
            </dd>
          </div>
          <div className="flex justify-between py-4">
            <dt className="text-sm text-text-secondary">{t('common.venue')}</dt>
            <dd className="font-semibold">{data.venueText || '—'}</dd>
          </div>
          <div className="flex justify-between py-4">
            <dt className="text-sm text-text-secondary">{t('match.format')}</dt>
            <dd className="font-semibold">
              {data.oversLimit} {t('match.overs')} · {data.maxWickets} {t('match.wickets')}
            </dd>
          </div>
          <div className="flex justify-between gap-4 py-4">
            <dt className="text-sm text-text-secondary">{t('match.teamA')}</dt>
            <dd className="text-end font-semibold">{data.homeTeam.name}</dd>
          </div>
          <div className="flex justify-between gap-4 py-4">
            <dt className="text-sm text-text-secondary">{t('match.teamB')}</dt>
            <dd className="text-end font-semibold">{data.awayTeam.name}</dd>
          </div>
        </dl>
      ) : null}
      <ShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        heading={t('share.shareMatch')}
        destinations={destinationsForPublicLive(data)}
        preview={
          <SharePreview
            home={data.homeTeam.name}
            away={data.awayTeam.name}
            homeLogo={data.homeTeam.logoUrl}
            awayLogo={data.awayTeam.logoUrl}
            live={data.status === 'LIVE' || data.status === 'INNINGS_BREAK'}
            score={`${data.score.runs}/${data.score.wickets}`}
            overs={data.score.overs}
            tournament={data.tournamentName}
          />
        }
      />
    </div>
  );
}

function PublicTeams({ data }: { data: NonNullable<ReturnType<typeof usePublicLive>['data']> }) {
  const { t } = useTranslation();
  const sides = [
    { team: data.homeTeam, rows: data.playingXi?.home ?? [] },
    { team: data.awayTeam, rows: data.playingXi?.away ?? [] },
  ];
  return (
    <div className="px-[var(--gutter)] pb-8">
      {sides.map(({ team, rows }) => (
        <section key={team.id} className="mb-6">
          <h3 className="mb-2 font-bold">{team.name}</h3>
          {rows.length ? (
            <ul className="divide-y divide-border">
              {rows.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="font-semibold">{p.name}</span>
                  <span className="text-xs text-text-secondary">
                    {[p.isCaptain ? t('playingXI.captain') : null, p.isWicketKeeper ? t('playingXI.wk') : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-secondary">{t('common.empty')}</p>
          )}
        </section>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border-b border-border py-4">
      <p className="text-xs text-text-secondary">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

