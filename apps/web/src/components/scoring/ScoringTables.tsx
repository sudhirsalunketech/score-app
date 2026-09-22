import { useTranslation } from 'react-i18next';
import { IconPencil, IconSwap } from '@/components/ui/Icons';
import { cn } from '@/lib/cn';
import { economy, playerName, strikeRate } from '@/lib/format';
import type { InningsSnapshot, Match } from '@/types/api';

const BAT =
  'grid-cols-[minmax(0,1fr)_1.7rem_1.7rem_1.7rem_1.7rem_3.4rem] sm:grid-cols-[minmax(0,1fr)_2rem_2rem_2rem_2rem_3.75rem]';
const BOWL =
  'grid-cols-[minmax(0,1fr)_2rem_1.55rem_1.7rem_1.55rem_3.4rem] sm:grid-cols-[minmax(0,1fr)_2.25rem_1.75rem_2rem_1.75rem_3.75rem]';
const GRID = 'grid w-full min-w-0 items-center gap-x-1 sm:gap-x-2';
const COL = 'text-end text-[10px] font-semibold uppercase tracking-wide text-text-secondary';
const NUM = 'text-end text-sm tabular-nums whitespace-nowrap';
const FOCUS =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

export function ScoringTables({
  match,
  snapshot,
  strikerId,
  nonStrikerId,
  bowlerId,
  ballsPerOver,
  onChangeBatter,
  onChangeBowler,
  onSwapStrike,
}: {
  match: Match;
  snapshot: InningsSnapshot | null;
  strikerId: string | null;
  nonStrikerId: string | null;
  bowlerId: string | null;
  ballsPerOver: number;
  onChangeBatter: (which: 'striker' | 'nonStriker') => void;
  onChangeBowler: () => void;
  onSwapStrike?: () => void;
}) {
  const { t } = useTranslation();
  const cards = snapshot?.batters ?? [];
  const batterRows: { id: string | null; which: 'striker' | 'nonStriker' }[] = [
    { id: strikerId, which: 'striker' },
    { id: nonStrikerId, which: 'nonStriker' },
  ];
  const bowl = cardsBowler(snapshot, bowlerId);

  return (
    <div className="px-[var(--gutter)]">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
        <section className="overflow-hidden rounded-xl border border-border bg-bg">
          <div className={cn(GRID, BAT, 'border-b border-border bg-muted/70 px-2 py-1')}>
            <div className="flex min-w-0 items-center justify-between gap-1">
              <button
                type="button"
                className={cn('inline-flex min-h-touch min-w-0 items-center gap-1.5 text-start', FOCUS)}
                onClick={() => onChangeBatter(strikerId ? 'striker' : nonStrikerId ? 'nonStriker' : 'striker')}
              >
                <IconPencil size={16} className="shrink-0 text-scoring" />
                <span className="truncate text-[13px] font-bold uppercase tracking-wide text-text">{t('scoring.batsman')}</span>
              </button>
              {onSwapStrike && strikerId && nonStrikerId ? (
                <button
                  type="button"
                  aria-label={t('scoring.swapStrike')}
                  title={t('scoring.swapStrike')}
                  className={cn('inline-flex min-h-touch shrink-0 items-center px-1', FOCUS)}
                  onClick={onSwapStrike}
                >
                  <IconSwap size={16} className="shrink-0 text-scoring" />
                </button>
              ) : null}
            </div>
            <span className={COL}>{t('scoring.runs')}</span>
            <span className={COL}>{t('scoring.balls')}</span>
            <span className={COL}>{t('scoring.fours')}</span>
            <span className={COL}>{t('scoring.sixes')}</span>
            <span className={COL}>{t('scoring.sr')}</span>
          </div>
          {!strikerId && !nonStrikerId ? (
            <button
              type="button"
              className={cn(
                'm-2 inline-flex min-h-touch items-center rounded-pill bg-scoring px-3 py-0.5 text-sm font-semibold text-scoring-on',
                FOCUS,
              )}
              onClick={() => onChangeBatter('striker')}
            >
              {t('match.chooseNewBatsman')}
            </button>
          ) : (
            batterRows.map(({ id, which }, index) => {
              const waiting = !id && Boolean(which === 'striker' ? nonStrikerId : strikerId);
              if (!id) {
                if (!waiting) return null;
                return (
                  <button
                    key={which}
                    type="button"
                    className={cn(
                      'm-2 inline-flex min-h-touch items-center rounded-pill bg-scoring px-3 py-0.5 text-sm font-semibold text-scoring-on',
                      FOCUS,
                    )}
                    onClick={() => onChangeBatter(which)}
                  >
                    {t('match.chooseNewBatsman')}
                  </button>
                );
              }
              const c = cards.find((b) => b.playerId === id);
              const isStriker = which === 'striker';
              return (
                <div
                  key={id}
                  className={cn(GRID, BAT, 'px-2 py-1', index > 0 && 'border-t border-border')}
                >
                  <button
                    type="button"
                    className={cn(
                      'inline-flex min-h-touch min-w-0 max-w-full items-center rounded-md px-2 text-start text-sm font-semibold',
                      FOCUS,
                      isStriker ? 'bg-scoring text-scoring-on' : 'text-text',
                    )}
                    aria-current={isStriker ? 'true' : undefined}
                    onClick={() => onChangeBatter(which)}
                  >
                    <span className="truncate">
                      {playerName(match, id)}
                      {isStriker ? ' *' : ''}
                    </span>
                  </button>
                  <span className={cn(NUM, 'font-bold')}>{c?.runs ?? 0}</span>
                  <span className={NUM}>{c?.balls ?? 0}</span>
                  <span className={NUM}>{c?.fours ?? 0}</span>
                  <span className={NUM}>{c?.sixes ?? 0}</span>
                  <span className={NUM}>{strikeRate(c?.runs ?? 0, c?.balls ?? 0)}</span>
                </div>
              );
            })
          )}
        </section>

        <section className="overflow-hidden rounded-xl border border-border bg-bg">
          <div className={cn(GRID, BOWL, 'border-b border-border bg-muted/70 px-2 py-1')}>
            <button
              type="button"
              className={cn('inline-flex min-h-touch min-w-0 items-center gap-1.5 text-start', FOCUS)}
              onClick={onChangeBowler}
            >
              <IconPencil size={16} className="shrink-0 text-scoring" />
              <span className="truncate text-[13px] font-bold uppercase tracking-wide text-text">{t('scoring.bowler')}</span>
            </button>
            <span className={COL}>{t('scoring.oversCol')}</span>
            <span className={COL}>{t('scoring.maidens')}</span>
            <span className={COL}>{t('scoring.runs')}</span>
            <span className={COL}>{t('scoring.wicketsCol')}</span>
            <span className={COL}>{t('scoring.eco')}</span>
          </div>
          {bowlerId ? (
            <div className={cn(GRID, BOWL, 'px-2 py-1')}>
              <button
                type="button"
                className={cn('inline-flex min-h-touch min-w-0 max-w-full items-center rounded-md px-2 text-start text-sm font-semibold text-text', FOCUS)}
                onClick={onChangeBowler}
              >
                <span className="truncate">{playerName(match, bowlerId)}</span>
              </button>
              <span className={NUM}>
                {bowl ? `${Math.floor(bowl.balls / ballsPerOver)}.${bowl.balls % ballsPerOver}` : '0.0'}
              </span>
              <span className={NUM}>{bowl?.maidens ?? 0}</span>
              <span className={NUM}>{bowl?.runs ?? 0}</span>
              <span className={NUM}>{bowl?.wickets ?? 0}</span>
              <span className={NUM}>{economy(bowl?.runs ?? 0, bowl?.balls ?? 0, ballsPerOver)}</span>
            </div>
          ) : (
            <button
              type="button"
              className={cn(
                'm-2 inline-flex min-h-touch items-center rounded-pill bg-scoring px-3 py-0.5 text-sm font-semibold text-scoring-on',
                FOCUS,
              )}
              onClick={onChangeBowler}
            >
              {t('match.chooseNewBowler')}
            </button>
          )}
        </section>
      </div>
    </div>
  );
}

function cardsBowler(snapshot: InningsSnapshot | null, id: string | null) {
  if (!id) return undefined;
  return snapshot?.bowlers.find((b) => b.playerId === id);
}
