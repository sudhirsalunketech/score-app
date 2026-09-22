import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';

export type BallChipData = {
  sequence: number;
  label: string;
  isWicket: boolean;
};

export function BallResultChip({ ball }: { ball: BallChipData }) {
  const { t } = useTranslation();
  const circle = ball.label.length === 1;
  return (
    <span
      role="listitem"
      aria-label={ballChipAriaLabel(ball, t)}
      className={cn(
        'inline-flex shrink-0 items-center justify-center whitespace-nowrap tabular-nums leading-none',
        circle ? 'h-9 w-9 rounded-full text-sm' : 'h-9 min-w-9 rounded-pill px-2 text-[13px]',
        ballChipTone(ball),
      )}
    >
      {displayBallChipLabel(ball.label)}
    </span>
  );
}

export function displayBallChipLabel(label: string) {
  return /^\d+$/.test(label) ? label : label.toUpperCase();
}

export function ballChipTone(ball: Pick<BallChipData, 'label' | 'isWicket'>) {
  const raw = ball.label.toUpperCase();
  if (ball.isWicket || raw === 'W') return 'bg-live font-bold text-on-dark';
  if (ball.label === '6') return 'bg-primary-dark font-bold text-on-dark';
  if (ball.label === '4') return 'bg-primary font-bold text-on-dark';
  return 'bg-muted font-semibold text-text ring-1 ring-inset ring-border';
}

export function ballChipAriaLabel(
  ball: Pick<BallChipData, 'label' | 'isWicket'>,
  t: (key: string, opts?: Record<string, unknown>) => string,
) {
  const raw = ball.label.toUpperCase();
  if (ball.isWicket || raw === 'W') return t('match.wicket');
  if (ball.label === '0') return t('scoring.dot');
  if (/^\d+$/.test(ball.label)) return t('scoring.ballRunsAria', { n: ball.label });
  if (raw.startsWith('WD')) return t('scoring.wideTitle');
  if (raw.startsWith('NB')) return t('scoring.noBallTitle');
  if (raw.startsWith('LB')) return t('scoring.legByesTitle');
  if (raw.startsWith('B')) return t('scoring.byesTitle');
  return displayBallChipLabel(ball.label);
}
