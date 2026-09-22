import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { IconChevron } from '@/components/ui/Icons';
import type { DismissalType } from '@/types/api';

const PRIMARY: { type: DismissalType; key: string }[] = [
  { type: 'BOWLED', key: 'scoring.bowled' },
  { type: 'CAUGHT', key: 'scoring.caught' },
  { type: 'STUMPED', key: 'scoring.stumped' },
  { type: 'LBW', key: 'scoring.lbw' },
  { type: 'RUN_OUT', key: 'scoring.runOut' },
  { type: 'MANKAD', key: 'scoring.mankad' },
  { type: 'RETIRED_OUT', key: 'scoring.retired' },
  { type: 'OVER_THE_FENCE', key: 'scoring.overTheFence' },
];

const MORE: { type: DismissalType; key: string }[] = [
  { type: 'ONE_HAND_ONE_BOUNCE', key: 'scoring.oneHandOneBounce' },
  { type: 'OBSTRUCTING', key: 'scoring.obstructing' },
  { type: 'HIT_WICKET', key: 'scoring.hitWicket' },
  { type: 'HIT_BALL_TWICE', key: 'scoring.hitBallTwice' },
  { type: 'TIMED_OUT', key: 'scoring.timedOut' },
];

const CHIP =
  'inline-flex min-h-11 items-center justify-center rounded-md border border-black/70 bg-[#F6E2B8] px-3 text-sm font-semibold text-scoring-on transition-opacity duration-[var(--motion)] active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/25';

export function WicketSheet({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (type: DismissalType) => void;
}) {
  const { t } = useTranslation();
  const [more, setMore] = useState(false);

  useEffect(() => {
    if (!open) setMore(false);
  }, [open]);

  return (
    <BottomSheet open={open} title={t('match.wicket')} onClose={onClose} titleAlign="start" titleClassName="text-scoring-on">
      <div className="flex flex-wrap gap-2">
        {PRIMARY.map((d) => (
          <button key={d.type} type="button" className={CHIP} onClick={() => onPick(d.type)}>
            {t(d.key)}
          </button>
        ))}
        {more
          ? MORE.map((d) => (
              <button key={d.type} type="button" className={CHIP} onClick={() => onPick(d.type)}>
                {t(d.key)}
              </button>
            ))
          : (
            <button
              type="button"
              className={CHIP}
              aria-expanded={false}
              onClick={() => setMore(true)}
            >
              {t('scoring.more')}
              <IconChevron size={16} className="ms-1 rotate-90" />
            </button>
          )}
      </div>
    </BottomSheet>
  );
}
