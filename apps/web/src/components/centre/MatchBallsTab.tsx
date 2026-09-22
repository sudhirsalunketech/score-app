import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import {
  ballFeedBadge,
  ballFeedDescriptionKey,
  ballFeedOver,
  dismissalI18nKey,
  latestOverBalls,
  type BallFeedEvent,
  type BallsSummary,
} from '@/lib/ball-feed';

export function InningsToggle({
  value,
  onChange,
}: {
  value: 1 | 2;
  onChange: (n: 1 | 2) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex gap-3 px-[var(--gutter)] py-4">
      {([1, 2] as const).map((n) => {
        const selected = value === n;
        return (
          <button
            key={n}
            type="button"
            className={cn(
              'min-h-10 flex-1 rounded-pill px-4 text-sm font-semibold',
              selected ? 'bg-primary text-on-dark' : 'border border-border bg-bg text-text-secondary',
            )}
            onClick={() => onChange(n)}
          >
            {n === 1 ? t('match.firstInnings') : t('match.secondInnings')}
          </button>
        );
      })}
    </div>
  );
}

export function MatchBallsTab({
  events,
  innings,
  onInningsChange,
  loading = false,
  summary = null,
}: {
  events: BallFeedEvent[];
  innings: 1 | 2;
  onInningsChange: (n: 1 | 2) => void;
  loading?: boolean;
  summary?: BallsSummary | null;
}) {
  const { t } = useTranslation();
  const rows = [...events].sort((a, b) => b.sequence - a.sequence);
  const latest = rows[0] ?? null;
  const overBalls = latestOverBalls(events);

  return (
    <div className="pb-8">
      <InningsToggle value={innings} onChange={onInningsChange} />
      {loading ? (
        <p className="px-[var(--gutter)] py-8 text-sm text-text-secondary">{t('common.loading')}</p>
      ) : rows.length === 0 ? (
        <p className="px-[var(--gutter)] py-8 text-sm text-text-secondary">{t('match.noBalls')}</p>
      ) : (
        <>
          {latest ? <StatusTicker event={latest} /> : null}
          {summary ? <OverSummaryCard balls={overBalls} summary={summary} /> : null}
          <ul>
            {rows.map((ev) => (
              <BallRow key={`${innings}-${ev.overNumber}-${ev.ballInOver}-${ev.sequence}`} event={ev} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function StatusTicker({ event }: { event: BallFeedEvent }) {
  const { t } = useTranslation();
  const text = event.isWicket
    ? t('match.ballDesc.gotOut', {
        type: t(dismissalI18nKey(event.dismissalType)),
        name: event.dismissedName || event.strikerName,
      })
    : ballLine(event, t);
  return (
    <p className="mb-3 flex items-start gap-2 px-[var(--gutter)] text-sm">
      <span className="mt-1 inline-block h-4 w-1 shrink-0 rounded-pill bg-live" aria-hidden />
      <span>{text}</span>
    </p>
  );
}

function OverSummaryCard({ balls, summary }: { balls: BallFeedEvent[]; summary: BallsSummary }) {
  const { t } = useTranslation();
  return (
    <section className="mx-[var(--gutter)] mb-4 rounded-xl bg-muted p-3">
      <div className="flex flex-wrap gap-1.5">
        {balls.map((b) => (
          <span
            key={b.sequence}
            className={cn(
              'inline-flex h-7 min-w-7 items-center justify-center rounded-full text-xs font-bold',
              overMarkClass(b),
            )}
          >
            {ballFeedBadge(b)}
          </span>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div className="min-w-0">
          {summary.striker ? <PlayerStat line={summary.striker} /> : null}
          {summary.nonStriker ? <PlayerStat line={summary.nonStriker} /> : null}
        </div>
        <div className="min-w-0 text-end">
          {summary.bowler ? (
            <>
              <p className="truncate font-semibold">{summary.bowler.name}</p>
              <p className="tabular-nums text-text-secondary">
                {summary.bowler.overs} - {summary.bowler.maidens} - {summary.bowler.runs} - {summary.bowler.wickets}
              </p>
            </>
          ) : (
            <p className="text-text-secondary">{t('match.noBowling')}</p>
          )}
        </div>
      </div>
      <p className="mt-3 flex flex-wrap justify-between gap-2 text-sm font-semibold text-primary">
        <span>
          {t('match.overs')} {summary.overs}
        </span>
        <span>
          {t('common.runs')} {summary.runs}
        </span>
        <span>
          {t('match.score')} {summary.runs}-{summary.wickets}
        </span>
      </p>
    </section>
  );
}

function PlayerStat({ line }: { line: { name: string; runs: number; balls: number } }) {
  return (
    <p className="truncate">
      <span className="font-semibold">{line.name}</span>{' '}
      <span className="tabular-nums text-text-secondary">
        {line.runs}({line.balls})
      </span>
    </p>
  );
}

function BallRow({ event }: { event: BallFeedEvent }) {
  const { t } = useTranslation();
  return (
    <li className="flex items-start gap-3 border-b border-border px-[var(--gutter)] py-3">
      <span className="w-8 shrink-0 pt-2 text-sm font-bold tabular-nums">{ballFeedOver(event)}</span>
      <span
        className={cn(
          'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold',
          timelineMarkClass(event),
        )}
      >
        {ballFeedBadge(event)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold">
          {t('match.bowlerToBatter', { bowler: event.bowlerName, batter: event.strikerName })}
        </p>
        <p className="text-sm text-text-secondary">{ballLine(event, t)}</p>
        {event.ruleLabel ? (
          <p className="text-xs font-semibold text-primary" title={event.ruleReason ?? undefined}>
            {event.ruleLabel}
          </p>
        ) : null}
      </div>
    </li>
  );
}

function ballLine(event: BallFeedEvent, t: (key: string, opts?: Record<string, unknown>) => string): string {
  if (event.commentary && looksFriendly(event.commentary) && !event.isWicket) {
    return event.commentary;
  }
  const desc = ballFeedDescriptionKey(event);
  if (desc.key === 'match.ballDesc.wicketLine') {
    return t(desc.key, { type: t(dismissalI18nKey(event.dismissalType)) });
  }
  return t(desc.key, { count: desc.count });
}

function timelineMarkClass(ev: BallFeedEvent): string {
  if (ev.isWicket) return 'bg-live text-on-dark';
  if (ev.extraType === 'NONE' && ev.batsmanRuns === 4) return 'bg-[#1E88E5] text-on-dark';
  if (ev.extraType === 'NONE' && ev.batsmanRuns === 6) return 'bg-primary-dark text-on-dark';
  return 'border-2 border-primary bg-bg text-primary';
}

function overMarkClass(ev: BallFeedEvent): string {
  if (ev.isWicket) return 'border border-live bg-bg text-live';
  return 'border border-primary/40 bg-bg text-text-secondary';
}

function looksFriendly(text: string): boolean {
  return /[a-z]/.test(text) && text !== text.toUpperCase() && !/^[A-Z_]+$/.test(text);
}
