import { memo, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { IconShare, IconSpeaker, IconSpeakerOff } from '@/components/ui/Icons';
import { BallResultChip } from '@/components/scoring/BallResultChip';
import type { CentreBall, CentreBatter, CentreBowler } from '@/lib/centre-model';
import type { SocketConnection } from '@/lib/socket';

export function LiveIndicator({
  status,
  connection,
}: {
  status: string;
  connection?: SocketConnection;
}) {
  const { t } = useTranslation();
  const live = status === 'LIVE' || status === 'INNINGS_BREAK';
  if (live && connection && connection !== 'connected') {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[11px] font-bold uppercase text-text-secondary" role="status" aria-live="polite">
        <span className="h-2 w-2 rounded-full bg-text-secondary" />
        {t('live.reconnecting')}
      </span>
    );
  }
  if (live) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[11px] font-bold uppercase text-live" role="status" aria-live="polite">
        <span className="cs-live-dot h-2 w-2 rounded-full bg-live" />
        {t('match.live')}
      </span>
    );
  }
  if (status === 'COMPLETED') {
    return <span className="text-xs font-bold uppercase text-text">{t('match.final')}</span>;
  }
  if (status === 'CANCELLED' || status === 'ABANDONED') {
    return <span className="text-xs font-bold uppercase text-text-secondary">{t('match.cancelled')}</span>;
  }
  return <span className="text-xs font-bold uppercase text-text-secondary">{t('match.upcoming')}</span>;
}

export function MatchActions({
  shareUrl,
  title,
}: {
  shareUrl: string | null;
  title: string;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  if (!shareUrl) return null;

  const share = async () => {
    if (navigator.share) {
      await navigator.share({ title, text: t('live.shareText', { title }), url: shareUrl });
      return;
    }
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const copy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const whatsapp = () => {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(`${t('live.shareText', { title })} ${shareUrl}`)}`,
      '_blank',
      'noopener,noreferrer',
    );
  };

  return (
    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
      <button
        type="button"
        className="inline-flex min-h-touch items-center gap-2 rounded-pill border border-border px-4 text-sm font-semibold"
        onClick={() => void share()}
      >
        <IconShare size={18} />
        {copied ? t('live.copied') : t('live.shareLive')}
      </button>
      <button type="button" className="min-h-touch px-3 text-sm font-semibold text-primary" onClick={() => void copy()}>
        {t('live.copyLink')}
      </button>
      <button type="button" className="min-h-touch px-3 text-sm font-semibold text-primary" onClick={whatsapp}>
        {t('live.whatsapp')}
      </button>
    </div>
  );
}

export const ScoreHeader = memo(function ScoreHeader({
  teamName,
  inningsNumber,
  runs,
  wickets,
  maxWickets,
  muted,
  onMute,
  onShare,
}: {
  teamName: string;
  inningsNumber: number;
  runs: number;
  wickets: number;
  maxWickets: number;
  muted?: boolean;
  onMute?: () => void;
  onShare?: () => void;
}) {
  const { t } = useTranslation();
  const prev = useRef({ runs, wickets, ready: false });
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    if (!prev.current.ready) {
      prev.current = { runs, wickets, ready: true };
      return;
    }
    const dW = wickets - prev.current.wickets;
    const dR = runs - prev.current.runs;
    prev.current = { runs, wickets, ready: true };
    let next: string | null = null;
    if (dW > 0) next = t('match.wicket');
    else if (dR === 4) next = '+4';
    else if (dR === 6) next = '+6';
    else if (dR > 0) next = `+${dR}`;
    if (!next) return;
    setFlash(next);
    const id = window.setTimeout(() => setFlash(null), 1100);
    return () => window.clearTimeout(id);
  }, [runs, t, wickets]);

  return (
    <div className="relative px-[var(--gutter)] pb-4 pt-5 text-center">
      <p className="text-[22px] font-bold uppercase leading-tight tracking-wide">{teamName}</p>
      <p className="mt-1 text-sm text-text-secondary">
        {inningsNumber >= 2 ? t('match.secondInnings') : t('match.firstInnings')}
      </p>
      <div className="relative mt-3 min-h-[4.5rem] w-full">
        {flash ? (
          <p className="cs-score-flash pointer-events-none absolute left-1/2 top-0 text-sm font-bold uppercase text-primary" aria-live="polite">
            {flash}
          </p>
        ) : null}
        <p className="flex items-start justify-center gap-1 pt-3 leading-none">
          <span className="text-[clamp(56px,15vw,72px)] font-bold text-primary tabular-nums">
            {runs}-{wickets}
          </span>
          <span className="mt-2 text-lg font-semibold text-primary">{t('match.wicketsMax', { count: maxWickets })}</span>
        </p>
        {onMute || onShare ? (
          <div className="absolute end-0 top-1/2 inline-flex h-9 -translate-y-1/2 items-center rounded-lg bg-dark-chrome px-1 text-on-dark">
            {onMute ? (
              <button
                type="button"
                className="inline-flex h-9 min-w-9 items-center justify-center"
                aria-label={muted ? t('scoring.unmute') : t('scoring.mute')}
                aria-pressed={muted}
                onClick={onMute}
              >
                {muted ? <IconSpeakerOff size={18} /> : <IconSpeaker size={18} />}
              </button>
            ) : null}
            {onShare ? (
              <button
                type="button"
                className="inline-flex h-9 min-w-9 items-center justify-center"
                aria-label={t('live.shareLive')}
                onClick={onShare}
              >
                <IconShare size={18} />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
});

export const MatchStats = memo(function MatchStats({
  extras,
  overs,
  oversLimit,
  crr,
  partnershipRuns,
  partnershipBalls,
}: {
  extras: number;
  overs: string;
  oversLimit: number;
  crr: number;
  partnershipRuns: number;
  partnershipBalls: number;
}) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-4 gap-1.5 px-[var(--gutter)] py-3">
      <StatBlock label={t('match.extras')} value={String(extras)} />
      <StatBlock label={t('match.overs')} value={`${overs} / ${oversLimit}`} />
      <StatBlock label={t('match.crr')} value={crr.toFixed(1)} />
      <StatBlock label={t('match.partnership')} value={`${partnershipRuns} (${partnershipBalls})`} />
    </div>
  );
});

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-bg px-1.5 py-2 text-center">
      <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-text-secondary">{label}</p>
      <p className="mt-1.5 text-[15px] font-bold tabular-nums leading-none">{value}</p>
    </div>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide">
      <span className="h-4 w-1 shrink-0 bg-primary" aria-hidden />
      {children}
    </h2>
  );
}

const col = 'grid-cols-[minmax(0,1fr)_repeat(5,minmax(1.7rem,2.2rem))]';

export const BatsmanTable = memo(function BatsmanTable({
  rows,
}: {
  rows: { id: string; name: string; runs: number; balls: number; fours: number; sixes: number; sr: string; onStrike: boolean }[];
}) {
  const { t } = useTranslation();
  return (
    <section className="border-t border-border px-[var(--gutter)] py-4">
      <SectionTitle>{t('live.currentBatsmen')}</SectionTitle>
      {rows.length === 0 ? (
        <p className="text-sm text-text-secondary">{t('match.noBatting')}</p>
      ) : (
        <div>
          <div className={cn('grid gap-x-1 text-sm', col)}>
            <span className="pb-2 text-xs font-semibold uppercase text-text-secondary">{t('scoring.batsman')}</span>
            <span className="pb-2 text-end text-xs font-semibold uppercase text-text-secondary">{t('scoring.runs')}</span>
            <span className="pb-2 text-end text-xs font-semibold uppercase text-text-secondary">{t('scoring.balls')}</span>
            <span className="pb-2 text-end text-xs font-semibold uppercase text-text-secondary">{t('scoring.fours')}</span>
            <span className="pb-2 text-end text-xs font-semibold uppercase text-text-secondary">{t('scoring.sixes')}</span>
            <span className="pb-2 text-end text-xs font-semibold uppercase text-text-secondary">{t('scoring.sr')}</span>
          </div>
          {rows.map((row) => (
            <div key={row.id} className={cn('grid items-center gap-x-1 px-1 py-2 text-sm', col)}>
              <p className="flex min-w-0 items-center gap-1.5 font-bold">
                {row.onStrike ? (
                  <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-label={t('scoring.striker')} />
                ) : (
                  <span className="inline-block h-1.5 w-1.5 shrink-0" aria-hidden />
                )}
                <span className="truncate">
                  {row.name}
                  {row.onStrike ? ' *' : ''}
                </span>
              </p>
              <span className="text-end tabular-nums">{row.runs}</span>
              <span className="text-end tabular-nums text-text-secondary">{row.balls}</span>
              <span className="text-end tabular-nums text-text-secondary">{row.fours}</span>
              <span className="text-end tabular-nums text-text-secondary">{row.sixes}</span>
              <span className="text-end font-semibold tabular-nums">{row.sr}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
});

export const BowlerTable = memo(function BowlerTable({
  bowler,
}: {
  bowler: { name: string; overs: string; maidens: number; runs: number; wickets: number; eco: string } | null;
}) {
  const { t } = useTranslation();
  return (
    <section className="border-t border-border px-[var(--gutter)] py-4">
      <SectionTitle>{t('match.currentBowler')}</SectionTitle>
      {!bowler ? (
        <p className="text-sm text-text-secondary">{t('match.noBowling')}</p>
      ) : (
        <div className={cn('grid gap-x-1 text-sm', col)}>
          <span className="pb-2 text-xs font-semibold uppercase text-text-secondary">{t('scoring.bowler')}</span>
          <span className="pb-2 text-end text-xs font-semibold uppercase text-text-secondary">{t('scoring.oversCol')}</span>
          <span className="pb-2 text-end text-xs font-semibold uppercase text-text-secondary">{t('scoring.maidens')}</span>
          <span className="pb-2 text-end text-xs font-semibold uppercase text-text-secondary">{t('scoring.runs')}</span>
          <span className="pb-2 text-end text-xs font-semibold uppercase text-text-secondary">{t('scoring.wicketsCol')}</span>
          <span className="pb-2 text-end text-xs font-semibold uppercase text-text-secondary">{t('scoring.eco')}</span>
          <p className="truncate font-bold">{bowler.name}</p>
          <span className="text-end tabular-nums">{bowler.overs}</span>
          <span className="text-end tabular-nums text-text-secondary">{bowler.maidens}</span>
          <span className="text-end tabular-nums text-text-secondary">{bowler.runs}</span>
          <span className="text-end tabular-nums text-text-secondary">{bowler.wickets}</span>
          <span className="text-end font-semibold tabular-nums">{bowler.eco}</span>
        </div>
      )}
    </section>
  );
});

export const RecentOvers = memo(function RecentOvers({
  overs,
  allBalls,
  batsmen,
  bowler,
  oversDisplay,
  totalRuns,
  wickets,
}: {
  overs: { overNumber: number; balls: CentreBall[] }[];
  allBalls: CentreBall[];
  batsmen: CentreBatter[];
  bowler: CentreBowler | null;
  oversDisplay: string;
  totalRuns: number;
  wickets: number;
}) {
  const { t } = useTranslation();

  return (
    <section className="mt-1">
      <div className="flex h-11 items-center justify-center bg-primary px-[var(--gutter)]">
        <h2 className="text-base font-bold text-on-dark">{t('match.recentOvers')}</h2>
      </div>
      <div className="min-h-16 px-[var(--gutter)] py-3">
        {overs.length === 0 ? (
          <p className="text-sm text-text-secondary">{t('match.noRecentOvers')}</p>
        ) : (
          <ul className="space-y-3">
            {overs.map((ov, i) => {
              const latest = i === 0;
              const overRunTotal = ov.balls.reduce((n, b) => n + b.runs, 0);
              const lastSeq = ov.balls[ov.balls.length - 1]?.sequence ?? 0;
              const through = allBalls.filter((b) => b.sequence <= lastSeq);
              const scoreRuns = latest ? totalRuns : through.reduce((n, b) => n + b.runs, 0);
              const scoreWkts = latest ? wickets : through.filter((b) => b.isWicket).length;
              const oversLabel = latest ? oversDisplay : `${ov.overNumber + 1}.0`;
              const cardBatters = latest && batsmen.length ? batsmen : overBatters(ov.balls);
              const cardBowlerName = latest && bowler?.name ? bowler.name : overBowlerName(ov.balls);
              const cardBowlerLine =
                latest && bowler
                  ? `${bowler.overs} - ${bowler.maidens} - ${bowler.runs} - ${bowler.wickets}`
                  : overBowlerFigures(ov.balls);
              return (
                <li key={ov.overNumber} className="rounded-xl bg-muted px-3 py-3">
                  <div
                    role="list"
                    className="flex min-w-0 items-center gap-2 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                  >
                    {ov.balls.map((b) => (
                      <BallResultChip key={b.sequence} ball={b} />
                    ))}
                  </div>
                  <div className="mt-3 flex items-start justify-between gap-3 text-sm">
                    <div className="min-w-0 space-y-0.5">
                      {cardBatters.map((bat) => (
                        <p key={bat.id} className="truncate font-semibold">
                          {bat.name}
                          {'runs' in bat && bat.runs != null && 'balls' in bat && bat.balls != null
                            ? ` ${bat.runs}(${bat.balls})`
                            : null}
                        </p>
                      ))}
                    </div>
                    {cardBowlerName ? (
                      <div className="shrink-0 text-end">
                        <p className="font-semibold">{cardBowlerName}</p>
                        {cardBowlerLine ? (
                          <p className="mt-0.5 tabular-nums text-text-secondary">{cardBowlerLine}</p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-sm font-semibold text-primary">
                    <span>
                      {t('match.overs')} {oversLabel}
                    </span>
                    <span>
                      {t('match.runs')} {overRunTotal}
                    </span>
                    <span>
                      {t('match.scoreLabel')} {scoreRuns}-{scoreWkts}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
});

function overBowlerName(balls: CentreBall[]): string | null {
  const counts = new Map<string, number>();
  for (const b of balls) {
    if (!b.bowlerName) continue;
    counts.set(b.bowlerName, (counts.get(b.bowlerName) ?? 0) + 1);
  }
  let best: string | null = null;
  let n = 0;
  for (const [name, c] of counts) {
    if (c >= n) {
      best = name;
      n = c;
    }
  }
  return best;
}

function overBatters(balls: CentreBall[]): Array<{ id: string; name: string; runs?: number | null; balls?: number | null }> {
  const seen = new Set<string>();
  const rows: Array<{ id: string; name: string; runs?: number | null; balls?: number | null }> = [];
  for (const b of balls) {
    if (!b.strikerName || seen.has(b.strikerName)) continue;
    seen.add(b.strikerName);
    rows.push({ id: b.strikerName, name: b.strikerName });
  }
  return rows;
}

function isIllegalDelivery(label: string): boolean {
  const raw = label.toLowerCase();
  return raw.startsWith('wd') || raw.startsWith('nb');
}

function overBowlerFigures(balls: CentreBall[]): string | null {
  if (!balls.length) return null;
  const legal = balls.filter((b) => !isIllegalDelivery(b.label)).length;
  const runs = balls.reduce((n, b) => n + b.runs, 0);
  const wickets = balls.filter((b) => b.isWicket).length;
  const complete = legal >= 6;
  const overs = complete ? '1.0' : `0.${legal}`;
  const maidens = complete && runs === 0 ? 1 : 0;
  return `${overs} - ${maidens} - ${runs} - ${wickets}`;
}

export function MatchCentreSkeleton() {
  return (
    <div className="animate-pulse pb-8" aria-hidden>
      <div className="px-[var(--gutter)] py-8">
        <div className="mx-auto h-5 w-40 rounded bg-muted" />
        <div className="mx-auto mt-3 h-4 w-24 rounded bg-muted" />
        <div className="mx-auto mt-6 h-16 w-44 rounded bg-muted" />
      </div>
      <div className="grid grid-cols-4 gap-1.5 px-[var(--gutter)] py-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 rounded-lg bg-muted" />
        ))}
      </div>
      <div className="px-[var(--gutter)] py-4">
        <div className="mb-3 h-4 w-40 rounded bg-muted" />
        <div className="h-12 rounded-lg bg-muted" />
        <div className="mt-2 h-12 rounded-lg bg-muted" />
      </div>
      <div className="px-[var(--gutter)] py-4">
        <div className="mb-3 h-4 w-36 rounded bg-muted" />
        <div className="h-12 rounded-lg bg-muted" />
      </div>
    </div>
  );
}

export function ReconnectingBanner({ show }: { show: boolean }) {
  const { t } = useTranslation();
  if (!show) return null;
  return (
    <p className="bg-muted px-[var(--gutter)] py-1.5 text-center text-xs font-semibold text-text-secondary" role="status">
      {t('live.reconnecting')}…
    </p>
  );
}
