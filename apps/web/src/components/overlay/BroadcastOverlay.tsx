import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { resultHeadline } from '@/lib/match-result';
import type { MvpPlayerRow } from '@/types/api';
import {
  chaseFromLive,
  classifyOverlayBursts,
  currentOverBalls,
  displayName,
  filterBursts,
  finiteNumber,
  keyMoments,
  overlayEventId,
  overlayStatus,
  projectedScore,
  recentOverSummaries,
  structuredEventLabel,
  type OverlayBurst,
  type OverlayConfig,
  type OverlayStatus,
} from '@/lib/overlay-model';
import { OverlayChip, OverlayChipRow } from '@/components/overlay/OverlayChips';
import type { LiveConnection } from '@/hooks/usePublicLive';
import type { OverlaySponsor, PublicBatterDto, PublicLiveScoreDto } from '@/types/api';

export type Translate = (key: string, opts?: Record<string, unknown>) => string;

const BURST_MS: Record<OverlayBurst['kind'], number> = {
  FOUR: 1800,
  SIX: 2000,
  WICKET: 2800,
  PLAYER: 2200,
  MILESTONE: 2200,
  OVER: 2000,
};

function lastProcessedKey(matchId: string) {
  return `cs.ov.last.${matchId}`;
}

function readLastProcessed(matchId: string): string | null {
  try {
    return sessionStorage.getItem(lastProcessedKey(matchId));
  } catch {
    return null;
  }
}

function writeLastProcessed(matchId: string, eventId: string) {
  try {
    sessionStorage.setItem(lastProcessedKey(matchId), eventId);
  } catch {
    /* private mode */
  }
}

/** Diffs consecutive live snapshots into a queued, de-duped stream of "burst" events (four/six/wicket/milestones). */
export function useOverlayBurst(data: PublicLiveScoreDto, config: OverlayConfig): OverlayBurst | null {
  const prev = useRef<PublicLiveScoreDto | null>(null);
  const lastProcessed = useRef<string | null>(readLastProcessed(data.matchId));
  const primed = useRef(false);
  const [burst, setBurst] = useState<OverlayBurst | null>(null);
  const queue = useRef<OverlayBurst[]>([]);

  useEffect(() => {
    const eventId = overlayEventId(data);
    if (!primed.current) {
      primed.current = true;
      prev.current = data;
      if (eventId) {
        lastProcessed.current = eventId;
        writeLastProcessed(data.matchId, eventId);
      }
      return;
    }
    if (eventId && lastProcessed.current === eventId) {
      prev.current = data;
      return;
    }
    const nextBursts = filterBursts(classifyOverlayBursts(prev.current, data), config);
    prev.current = data;
    if (eventId) {
      lastProcessed.current = eventId;
      writeLastProcessed(data.matchId, eventId);
    }
    if (!nextBursts.length) return;
    queue.current = nextBursts;
    setBurst(nextBursts[0] ?? null);
    if (config.sound && nextBursts[0]) playBurstTone(nextBursts[0].kind);
  }, [data, config]);

  useEffect(() => {
    if (!burst) return;
    const timer = window.setTimeout(() => {
      queue.current = queue.current.slice(1);
      const next = queue.current[0] ?? null;
      setBurst(next);
      if (next && config.sound) playBurstTone(next.kind);
    }, BURST_MS[burst.kind]);
    return () => window.clearTimeout(timer);
  }, [burst, config.sound]);

  return burst;
}

export function BroadcastOverlay({
  data,
  connection,
  config,
}: {
  data: PublicLiveScoreDto;
  connection: LiveConnection;
  config: OverlayConfig;
}) {
  const { t } = useTranslation();
  const burst = useOverlayBurst(data, config);

  const status = overlayStatus(data.status);
  const batting =
    displayName(data.battingTeamId === data.awayTeam.id ? data.awayTeam.name : data.homeTeam.name) ??
    displayName(data.homeTeam.name);
  const bowling =
    displayName(data.bowlingTeamId === data.homeTeam.id ? data.homeTeam.name : data.awayTeam.name) ??
    displayName(data.awayTeam.name);
  const chase = chaseFromLive(data);
  const projected = config.projected ? projectedScore(data) : null;
  const overBalls = currentOverBalls(data.recentBalls);
  const overs = recentOverSummaries(data.recentBalls, 4);
  const moments = keyMoments(data.recentBalls, 4);
  const overRuns = overBalls.reduce((n, b) => n + (b.batsmanRuns ?? 0) + (b.extraRuns ?? 0), 0);
  const full = config.mode === 'full';
  const standard = config.mode === 'standard';
  const compact = config.mode === 'compact';
  const minimal = config.mode === 'minimal';
  const sponsor = config.sponsor ? data.broadcast?.sponsor : null;

  return (
    <div
      className={`cs-broadcast cs-ov-safe cs-ov-theme-${config.theme} pointer-events-none relative flex min-h-dvh flex-col justify-between overflow-hidden`}
      data-overlay-mode={config.mode}
      data-overlay-theme={config.theme}
    >
      <header className="relative z-10 flex items-start justify-between gap-4">
        <div className="min-w-0">
          {config.tournamentLogo && data.tournamentName ? (
            <div className="flex items-center gap-2">
              {data.tournamentLogoUrl ? (
                <img src={data.tournamentLogoUrl} alt="" className="h-8 w-8 rounded object-contain" />
              ) : null}
              <p className="cs-ov-brand truncate text-xs font-bold uppercase tracking-[0.16em]">{data.tournamentName}</p>
            </div>
          ) : null}
        </div>
        <StatusPill status={status} connection={connection} label={statusLabel(status, t)} reconnect={t('overlay.reconnecting')} offline={t('overlay.offline')} />
      </header>

      {sponsor ? <SponsorSlot sponsor={sponsor} t={t} /> : null}

      <div className="flex flex-1 items-center justify-center">
        {burst ? <BurstCard burst={burst} t={t} /> : null}
      </div>

      {status === 'COMPLETE' || status === 'ABANDONED' || status === 'CANCELLED' ? (
        <ResultCard data={data} status={status} t={t} />
      ) : status === 'INNINGS_BREAK' ? (
        <InningsBreakCard data={data} batting={batting} chase={chase} t={t} />
      ) : status === 'DRINKS' || status === 'RAIN' || status === 'DELAY' ? (
        <Glass className="mx-auto w-full max-w-lg text-center">
          <p className="cs-ov-kicker">{statusLabel(status, t)}</p>
          {batting ? (
            <p className="mt-2 truncate text-2xl font-black">
              {batting} {data.score.runs}/{data.score.wickets}
            </p>
          ) : null}
          <p className="cs-ov-muted mt-1 text-sm font-bold">
            {data.score.overs} {t('overlay.ov')}
          </p>
        </Glass>
      ) : status === 'UPCOMING' ? (
        <Glass className="mx-auto w-full max-w-lg text-center">
          <p className="cs-ov-kicker">{t('overlay.upcoming')}</p>
          <p className="mt-1 truncate text-lg font-bold uppercase">{displayName(data.homeTeam.name)}</p>
          <p className="cs-ov-muted text-xs font-bold tracking-[0.2em]">VS</p>
          <p className="truncate text-lg font-bold uppercase">{displayName(data.awayTeam.name)}</p>
        </Glass>
      ) : (
        <div className="flex w-full max-w-[1600px] flex-col gap-2 self-center">
          {config.header && batting && bowling ? (
            <VsHeader batting={batting} bowling={bowling} data={data} chase={chase} t={t} />
          ) : null}
          {full && config.moments && moments.length ? (
            <p className="cs-ov-hide-short cs-ov-muted text-center text-[11px] font-semibold tracking-wide">
              {moments
                .map((m) => {
                  const label =
                    m.kind === 'wicket' ? t('overlay.wicket') : m.kind === 'six' ? t('overlay.six') : t('overlay.four');
                  return m.name ? `${label} — ${m.name}` : label;
                })
                .join('   ·   ')}
            </p>
          ) : null}
          {!minimal && (config.batters || config.currentOver || config.bowler) ? (
            <div className="flex flex-wrap items-end justify-between gap-2">
              {config.batters && (data.striker || data.nonStriker) ? (
                <Glass className="min-w-[200px] flex-1">
                  <p className="cs-ov-kicker">{t('overlay.batters')}</p>
                  {data.striker && displayName(data.striker.name) ? (
                    <BatterLine batter={data.striker} strike detailed={full} />
                  ) : null}
                  {data.nonStriker && displayName(data.nonStriker.name) ? (
                    <BatterLine batter={data.nonStriker} detailed={full} />
                  ) : null}
                </Glass>
              ) : null}
              {config.currentOver && overBalls.length ? (
                <Glass className="min-w-[180px] flex-1">
                  <p className="cs-ov-kicker">{t('overlay.currentOver')}</p>
                  <OverlayChipRow balls={overBalls} />
                  <p className="cs-ov-muted mt-1 text-right text-[11px] font-semibold">
                    {t('overlay.overTotal')}: {overRuns}
                  </p>
                </Glass>
              ) : null}
              {config.bowler && (full || standard) && data.bowler && displayName(data.bowler.name) ? (
                <Glass className="min-w-[160px]">
                  <p className="cs-ov-kicker">{t('overlay.bowler')}</p>
                  <BowlerCard bowler={data.bowler} compact={!full} t={t} />
                </Glass>
              ) : null}
            </div>
          ) : null}
          {full && config.partnership && data.partnership && data.partnership.balls > 0 ? (
            <Glass className="cs-ov-hide-short self-start">
              <p className="cs-ov-kicker">{t('overlay.partnership')}</p>
              <p className="text-sm font-bold">
                {data.partnership.runs} {t('overlay.runs')} · {data.partnership.balls} {t('overlay.balls')}
              </p>
              {data.striker || data.nonStriker ? (
                <p className="cs-ov-muted text-[11px]">
                  {[data.striker, data.nonStriker]
                    .filter((p): p is NonNullable<typeof p> => Boolean(p && displayName(p.name)))
                    .map((p) => `${p.name} ${p.runs}`)
                    .join(' · ')}
                </p>
              ) : null}
            </Glass>
          ) : null}
          {full && config.recentOvers && overs.length > 1 ? (
            <div className="cs-ov-hide-short flex flex-wrap gap-1.5">
              {overs.slice(0, 5).map((ov) => (
                <span key={ov.overNumber} className="cs-ov-recent">
                  O{ov.overNumber + 1} {ov.runs}
                  {full ? (
                    <span className="mt-1 flex flex-wrap gap-0.5">
                      {ov.balls.map((b) => (
                        <OverlayChip key={b.sequence} ball={b} />
                      ))}
                    </span>
                  ) : null}
                </span>
              ))}
            </div>
          ) : null}
          {projected != null ? (
            <p className="cs-ov-hide-short cs-ov-muted text-[11px] font-semibold">
              {t('overlay.projected')}: {projected}
            </p>
          ) : null}
          {config.score && batting ? (
            <ScoreBar
              data={data}
              batting={batting}
              chase={chase}
              compact={compact || standard || full}
              minimal={minimal}
              lastEvent={full && data.lastBall ? structuredEventLabel(data.lastBall) : null}
              t={t}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

function VsHeader({
  batting,
  bowling,
  data,
  chase,
  t,
}: {
  batting: string;
  bowling: string;
  data: PublicLiveScoreDto;
  chase: ReturnType<typeof chaseFromLive>;
  t: Translate;
}) {
  const battingLogo = data.battingTeamId === data.homeTeam.id ? data.homeTeam.logoUrl : data.awayTeam.logoUrl;
  return (
    <Glass className="cs-ov-hide-short self-start">
      <div className="flex items-center gap-1.5">
        {battingLogo ? <img src={battingLogo} alt="" className="h-4 w-4 rounded object-contain" /> : null}
        <p className="truncate text-sm font-bold uppercase tracking-wide">{batting}</p>
      </div>
      <p className="text-2xl font-black tabular-nums">
        {data.score.runs}/{data.score.wickets}
      </p>
      <p className="cs-ov-muted text-[10px] font-bold tracking-[0.2em]">VS</p>
      <p className="truncate text-xs font-semibold uppercase">{bowling}</p>
      {chase ? (
        <p className="mt-1 text-xs font-semibold text-[var(--color-scoring)]">
          {t('overlay.target')} {chase.target} · {chase.needed} {t('overlay.needed')} · {chase.ballsLeft} {t('overlay.ballsLeft')} · {t('overlay.rrr')}{' '}
          {chase.rrr.toFixed(2)}
        </p>
      ) : null}
    </Glass>
  );
}

function ScoreBar({
  data,
  batting,
  chase,
  compact,
  minimal,
  lastEvent,
  t,
}: {
  data: PublicLiveScoreDto;
  batting: string;
  chase: ReturnType<typeof chaseFromLive>;
  compact: boolean;
  minimal: boolean;
  lastEvent: string | null;
  t: Translate;
}) {
  const crr = finiteNumber(data.score.runRate);
  const battingLogo = data.battingTeamId === data.homeTeam.id ? data.homeTeam.logoUrl : data.awayTeam.logoUrl;
  return (
    <div className="cs-ov-bar grid w-full grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-2.5 sm:grid-cols-[minmax(0,1.5fr)_auto_minmax(0,1.2fr)]">
      <div className="min-w-0">
        <p className="cs-ov-live-row mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-live)]">
          <span className="cs-live-dot h-2 w-2 rounded-full bg-[var(--color-live)]" />
          {t('overlay.live')}
        </p>
        <p className="flex items-center gap-1.5 truncate text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--color-primary-light)]">
          {battingLogo ? <img src={battingLogo} alt="" className="h-4 w-4 rounded object-contain" /> : null}
          {batting}
        </p>
        <p className="text-3xl font-black tabular-nums leading-none sm:text-4xl">
          {data.score.runs}
          <span className="text-2xl font-bold opacity-80">/{data.score.wickets}</span>
        </p>
      </div>
      <div className="text-center text-xs font-semibold uppercase tracking-wide">
        <p>
          {data.score.overs}
          {data.oversLimit ? ` / ${data.oversLimit}` : ''} {t('overlay.overs')}
        </p>
        {!minimal && crr != null ? (
          <p className="mt-0.5 text-[var(--color-primary-light)]">
            {t('match.crr')} {crr.toFixed(2)}
          </p>
        ) : null}
        {!minimal && chase ? (
          <p className="text-[var(--color-scoring)]">
            {t('overlay.rrr')} {chase.rrr.toFixed(2)}
          </p>
        ) : null}
      </div>
      {!minimal ? (
        <div className="min-w-0 text-end text-xs">
          {chase ? (
            <>
              <p className="font-bold text-[var(--color-scoring)]">
                {t('overlay.target')} {chase.target}
              </p>
              <p className="opacity-80">
                {chase.needed} {t('overlay.needed')} · {chase.ballsLeft} {t('overlay.ballsLeft')}
              </p>
            </>
          ) : compact && data.striker && displayName(data.striker.name) ? (
            <p className="truncate font-semibold">
              {data.striker.name}* {data.striker.runs}({data.striker.balls})
              {data.nonStriker && displayName(data.nonStriker.name)
                ? ` · ${data.nonStriker.name} ${data.nonStriker.runs}(${data.nonStriker.balls})`
                : ''}
            </p>
          ) : null}
          {lastEvent ? <p className="cs-ov-muted mt-1 truncate text-[11px] uppercase">{lastEvent}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function StatusPill({
  status,
  connection,
  label,
  reconnect,
  offline,
}: {
  status: OverlayStatus;
  connection: LiveConnection;
  label: string;
  reconnect: string;
  offline: string;
}) {
  const live = status === 'LIVE' && connection === 'connected';
  const text = connection === 'reconnecting' ? reconnect : connection === 'offline' ? offline : label;
  return (
    <span className="cs-ov-pill inline-flex items-center gap-1.5 rounded-pill px-3 py-1 text-[11px] font-bold uppercase tracking-wider">
      <span className={`h-2 w-2 rounded-full ${live ? 'cs-live-dot bg-[var(--color-live)]' : 'bg-current opacity-50'}`} />
      {text}
    </span>
  );
}

export function BurstCard({ burst, t }: { burst: OverlayBurst; t: Translate }) {
  if (burst.kind === 'FOUR') {
    return (
      <div className="cs-ov-burst cs-ov-burst-four text-center">
        <p className="text-sm font-bold tracking-[0.3em] text-[var(--color-scoring)]">{t('overlay.four')}</p>
        <p className="text-7xl font-black text-[var(--color-scoring)]">4</p>
      </div>
    );
  }
  if (burst.kind === 'SIX') {
    return (
      <div className="cs-ov-burst cs-ov-burst-six text-center">
        <p className="text-sm font-bold tracking-[0.3em] text-[var(--color-scoring)]">{t('overlay.six')}</p>
        <p className="text-8xl font-black text-[var(--color-scoring)]">6</p>
      </div>
    );
  }
  if (burst.kind === 'WICKET') {
    return (
      <div className="cs-ov-burst cs-ov-burst-wicket text-center">
        <p className="text-sm font-bold tracking-[0.3em] text-[var(--color-live)]">{t('overlay.wicket')}</p>
        {burst.name ? <p className="mt-1 text-2xl font-bold">{burst.name}</p> : null}
        {burst.detail ? <p className="mt-0.5 text-sm opacity-80">{burst.detail}</p> : null}
        <p className="text-5xl font-black text-[var(--color-live)]">W</p>
      </div>
    );
  }
  if (burst.kind === 'PLAYER') {
    return (
      <div className="cs-ov-burst text-center">
        <p className="text-sm font-bold tracking-[0.2em] text-[var(--color-primary-light)]">{t('overlay.playerMilestone', { runs: burst.runs })}</p>
        <p className="text-xl font-bold">{burst.name}</p>
        <p className="text-3xl font-black">
          {burst.runs} ({burst.balls})
        </p>
      </div>
    );
  }
  if (burst.kind === 'MILESTONE') {
    return (
      <div className="cs-ov-burst text-center">
        <p className="text-sm font-bold tracking-[0.2em] text-[var(--color-primary-light)]">{t('overlay.teamMilestone', { runs: burst.runs })}</p>
        <p className="text-xl font-bold">{burst.team}</p>
        <p className="text-3xl font-black">{burst.score}</p>
      </div>
    );
  }
  return (
    <div className="cs-ov-burst text-center">
      <p className="text-sm font-bold tracking-[0.2em]">{t('overlay.overN', { n: burst.over })}</p>
      <p className="text-2xl font-black">
        {burst.runs} {t('overlay.runs')}
      </p>
      <p className="opacity-70">{burst.score}</p>
    </div>
  );
}

function ResultCard({ data, status, t }: { data: PublicLiveScoreDto; status: OverlayStatus; t: Translate }) {
  const winner =
    data.result?.winnerTeamId === data.awayTeam.id
      ? data.awayTeam.name
      : data.result?.winnerTeamId === data.homeTeam.id
        ? data.homeTeam.name
        : null;
  const headline = resultHeadline({
    resultType: data.result?.resultType,
    winnerName: winner,
    marginType: data.result?.marginType,
    marginValue: data.result?.marginValue,
    labels: {
      completed: t('overlay.matchComplete'),
      wonBy: t('overlay.wonBy'),
      runs: t('match.runs'),
      wickets: t('overlay.wickets'),
      tie: t('overlay.tie'),
      noResult: t('overlay.noResult'),
      abandoned: t('overlay.abandoned'),
    },
  });
  const inns = data.result?.innings ?? [];
  const title = status === 'ABANDONED' ? t('overlay.abandoned') : status === 'CANCELLED' ? t('overlay.cancelled') : t('overlay.matchComplete');
  return (
    <Glass className="mx-auto w-full max-w-xl text-center">
      <p className="cs-ov-kicker">{title}</p>
      <div className="mt-2 grid grid-cols-2 gap-4 text-start">
        <TeamScore name={data.homeTeam.name} inn={inns.find((i) => i.battingTeamId === data.homeTeam.id)} />
        <TeamScore name={data.awayTeam.name} inn={inns.find((i) => i.battingTeamId === data.awayTeam.id)} />
      </div>
      {headline ? <p className="mt-3 text-sm font-bold uppercase tracking-wide text-[var(--color-primary-light)]">{headline}</p> : null}
      <Potm slug={data.publicSlug} enabled={data.share?.mvp !== false} />
    </Glass>
  );
}

function InningsBreakCard({
  data,
  batting,
  chase,
  t,
}: {
  data: PublicLiveScoreDto;
  batting: string | null;
  chase: ReturnType<typeof chaseFromLive>;
  t: Translate;
}) {
  const first = data.result?.innings.find((i) => i.inningsNumber === 1);
  const chasing = data.homeTeam.id === first?.battingTeamId ? data.awayTeam.name : data.homeTeam.name;
  if (!batting) return null;
  return (
    <Glass className="mx-auto w-full max-w-lg text-center">
      <p className="cs-ov-kicker">{t('overlay.inningsBreak')}</p>
      <p className="mt-1 truncate text-lg font-bold uppercase">{batting}</p>
      <p className="text-4xl font-black tabular-nums">
        {data.score.runs}/{data.score.wickets}
      </p>
      <p className="text-sm opacity-70">
        {data.score.overs} {t('overlay.overs')}
      </p>
      {first ? (
        <p className="mt-2 text-sm font-semibold text-[var(--color-scoring)]">
          {t('overlay.target')} {first.runs + 1}
        </p>
      ) : chase ? (
        <p className="mt-2 text-sm font-semibold text-[var(--color-scoring)]">
          {t('overlay.target')} {chase.target}
        </p>
      ) : null}
      {first ? <p className="cs-ov-muted mt-1 text-xs">{chasing}</p> : null}
    </Glass>
  );
}

function TeamScore({ name, inn }: { name: string; inn?: { runs: number; wickets: number; overs: string } }) {
  const label = displayName(name);
  if (!label) return null;
  if (!inn) return <p className="truncate font-semibold">{label}</p>;
  return (
    <div className="min-w-0">
      <p className="truncate text-xs font-bold uppercase opacity-70">{label}</p>
      <p className="text-2xl font-black tabular-nums">
        {inn.runs}/{inn.wickets}
      </p>
      <p className="text-[11px] opacity-60">{inn.overs}</p>
    </div>
  );
}

function Potm({ slug, enabled }: { slug: string | null; enabled: boolean }) {
  const { t } = useTranslation();
  const q = useQuery({
    queryKey: ['overlay-mvp', slug],
    queryFn: () => api<MvpPlayerRow[]>(`/api/v1/public/matches/${slug}/mvp`, { auth: false }),
    enabled: Boolean(slug) && enabled,
    retry: false,
  });
  const top = q.data?.[0];
  const name = displayName(top?.playerName);
  if (!name) return null;
  return (
    <div className="mt-3">
      <p className="cs-ov-kicker">{t('overlay.potm')}</p>
      <p className="text-sm font-bold">{name}</p>
    </div>
  );
}

function BatterLine({ batter, strike, detailed }: { batter: PublicBatterDto; strike?: boolean; detailed?: boolean }) {
  const sr = finiteNumber(batter.strikeRate);
  return (
    <div className={strike ? 'cs-ov-striker' : undefined}>
      <p className="truncate text-sm">
        <span className="font-bold">
          {strike ? '★ ' : ''}
          {batter.name}
          {strike ? '*' : ''}
        </span>{' '}
        <span className="tabular-nums">
          {batter.runs}({batter.balls})
        </span>
      </p>
      {detailed ? (
        <p className="cs-ov-muted text-[11px]">
          4s {batter.fours} · 6s {batter.sixes}
          {sr != null ? ` · SR ${sr.toFixed(1)}` : ''}
        </p>
      ) : null}
    </div>
  );
}

function BowlerCard({
  bowler,
  compact,
  t,
}: {
  bowler: NonNullable<PublicLiveScoreDto['bowler']>;
  compact: boolean;
  t: Translate;
}) {
  const eco = finiteNumber(bowler.economy);
  if (compact) {
    return (
      <>
        <p className="truncate text-sm font-bold uppercase">{bowler.name}</p>
        <p className="text-xs tabular-nums opacity-80">
          {bowler.overs} - {bowler.runs} - {bowler.wickets}
        </p>
        {eco != null ? (
          <p className="text-[11px] opacity-60">
            {t('overlay.eco')} {eco.toFixed(2)}
          </p>
        ) : null}
      </>
    );
  }
  return (
    <>
      <p className="truncate text-sm font-bold">{bowler.name}</p>
      <p className="text-xs tabular-nums opacity-80">
        {bowler.overs} {t('overlay.ov')} · {bowler.runs} {t('overlay.runs')} · {bowler.wickets} {t('overlay.wickets')}
      </p>
      {eco != null ? (
        <p className="text-[11px] opacity-60">
          {t('overlay.eco')} {eco.toFixed(2)}
        </p>
      ) : null}
    </>
  );
}

function SponsorSlot({ sponsor, t }: { sponsor: OverlaySponsor; t: Translate }) {
  const pos = sponsor.position ?? 'top-right';
  const style: CSSProperties =
    pos === 'top-left'
      ? { top: '3vh', left: '4vw' }
      : pos === 'top-right'
        ? { top: '3vh', right: '4vw', marginTop: '2.5rem' }
        : pos === 'bottom-left'
          ? { bottom: '22vh', left: '4vw' }
          : { bottom: '22vh', right: '4vw' };
  return (
    <div className="cs-ov-sponsor pointer-events-none absolute z-0 max-w-[180px]" style={style}>
      <p className="cs-ov-kicker">{t('overlay.poweredBy')}</p>
      {sponsor.logoUrl ? <img src={sponsor.logoUrl} alt="" className="mt-1 max-h-10 max-w-[140px] object-contain" /> : null}
      {sponsor.name ? <p className="truncate text-[11px] font-semibold">{sponsor.name}</p> : null}
    </div>
  );
}

export function Glass({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={`cs-ov-glass px-3 py-2 ${className ?? ''}`}>{children}</div>;
}

function statusLabel(status: OverlayStatus, t: Translate) {
  if (status === 'LIVE') return t('overlay.live');
  if (status === 'UPCOMING') return t('overlay.upcoming');
  if (status === 'INNINGS_BREAK') return t('overlay.inningsBreak');
  if (status === 'DRINKS') return t('overlay.drinks');
  if (status === 'RAIN') return t('overlay.rainDelay');
  if (status === 'DELAY') return t('overlay.matchDelay');
  if (status === 'COMPLETE') return t('overlay.matchComplete');
  if (status === 'ABANDONED') return t('overlay.abandoned');
  if (status === 'CANCELLED') return t('overlay.cancelled');
  return t('overlay.live');
}

function playBurstTone(kind: OverlayBurst['kind']) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = kind === 'WICKET' ? 220 : kind === 'SIX' ? 660 : 440;
    gain.gain.value = 0.04;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.18);
    window.setTimeout(() => void ctx.close(), 400);
  } catch {
    /* autoplay may be blocked */
  }
}
