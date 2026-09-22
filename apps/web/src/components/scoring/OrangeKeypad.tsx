import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { IconLeatherBall, IconUndo } from '@/components/ui/Icons';

const CELL =
  'flex min-h-14 min-w-0 items-center justify-center border-b border-r border-black/25 text-base font-bold text-white active:bg-black/10 disabled:opacity-40';

export function OrangeKeypad({
  disabled,
  extrasDisabled,
  undoDisabled,
  onRun,
  onExtra,
  onWicket,
  onUndo,
  onMore,
  onBonus,
  onMoreRuns,
}: {
  disabled?: boolean;
  extrasDisabled?: boolean;
  undoDisabled?: boolean;
  onRun: (runs: number) => void;
  onExtra: (extra: 'WIDE' | 'NO_BALL' | 'BYE' | 'LEG_BYE') => void;
  onWicket: () => void;
  onUndo?: () => void;
  onMore?: () => void;
  onBonus?: () => void;
  onMoreRuns?: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="bg-scoring pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <div className="grid grid-cols-5 border-l border-t border-black/25">
        {[1, 2, 3, 4, 6].map((n) => (
          <button key={n} type="button" disabled={disabled} className={CELL} onClick={() => onRun(n)}>
            {n}
          </button>
        ))}
        <button type="button" disabled={disabled} className={CELL} onClick={() => onExtra('LEG_BYE')}>
          {t('scoring.legBye')}
        </button>
        <button type="button" disabled={disabled} className={CELL} onClick={() => onExtra('BYE')}>
          {t('scoring.bye')}
        </button>
        <button type="button" disabled={disabled || extrasDisabled} className={CELL} onClick={() => onExtra('WIDE')}>
          {t('scoring.wide')}
        </button>
        <button type="button" disabled={disabled || extrasDisabled} className={CELL} onClick={() => onExtra('NO_BALL')}>
          {t('scoring.noBall')}
        </button>
        <button type="button" disabled={disabled} className={CELL} aria-label={t('scoring.dot')} onClick={() => onRun(0)}>
          •
        </button>
        <button
          type="button"
          disabled={disabled}
          className={cn(CELL, 'text-black')}
          onClick={() => onMore?.()}
        >
          {t('scoring.more')}
        </button>
        <button
          type="button"
          disabled={disabled}
          className={CELL}
          aria-label={t('scoring.bonusRuns')}
          onClick={() => onBonus?.()}
        >
          <IconLeatherBall size={28} />
        </button>
        <button type="button" disabled={disabled} className={cn(CELL, 'text-sm')} onClick={() => onMoreRuns?.()}>
          {t('scoring.moreRuns')}
        </button>
        <button type="button" disabled={undoDisabled ?? disabled} className={CELL} onClick={() => onUndo?.()}>
          <span className="inline-flex items-center justify-center gap-1">
            <IconUndo size={16} />
            {t('scoring.undo')}
          </span>
        </button>
        <button type="button" disabled={disabled} className={CELL} onClick={onWicket}>
          {t('scoring.wicket')}
        </button>
      </div>
    </div>
  );
}
