import { useTranslation } from 'react-i18next';
import { BallResultChip } from '@/components/scoring/BallResultChip';

type RecentBall = {
  sequence: number;
  label: string;
  isWicket: boolean;
  overNumber?: number;
};

export function RecentBallsStrip({
  balls,
}: {
  balls: RecentBall[];
}) {
  const { t } = useTranslation();
  if (balls.length === 0) return null;

  const overNumber = balls[0]?.overNumber;
  const overLabel = overNumber != null ? t('overlay.overN', { n: overNumber + 1 }) : null;

  return (
    <section className="px-[var(--gutter)] py-2.5" aria-label={t('match.recentBalls')} aria-live="polite">
      <div className="mx-auto w-full min-w-0 max-w-3xl">
        {overLabel ? (
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">{overLabel}</p>
        ) : null}
        <div
          role="list"
          className="flex min-w-0 items-center gap-2 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {balls.map((b) => (
            <BallResultChip key={b.sequence} ball={b} />
          ))}
        </div>
      </div>
    </section>
  );
}
