import { useTranslation } from 'react-i18next';
import { chipKind, chipLabel, displayName, structuredEventLabel } from '@/lib/overlay-model';
import type { PublicBallDto } from '@/types/api';
import { cn } from '@/lib/cn';

const KIND_CLASS: Record<ReturnType<typeof chipKind>, string> = {
  four: 'bg-scoring text-scoring-on',
  six: 'bg-scoring text-scoring-on',
  wicket: 'bg-live text-on-dark',
  extra: 'bg-gold text-dark-chrome',
  dot: 'bg-muted text-text',
  run: 'bg-muted text-text',
};

export function LiveCommentary({ balls }: { balls: PublicBallDto[] }) {
  const { t } = useTranslation();
  const rows = [...balls].sort((a, b) => b.sequence - a.sequence);
  if (!rows.length) {
    return <p className="px-[var(--gutter)] py-8 text-sm text-text-secondary">{t('match.noBalls')}</p>;
  }
  return (
    <ol className="divide-y divide-border px-[var(--gutter)] pb-8">
      {rows.map((ball) => {
        const who = displayName(ball.strikerName);
        const label = structuredEventLabel(ball);
        const kind = chipKind(ball);
        return (
          <li key={ball.sequence} className="flex items-start gap-3 py-3">
            <span className="w-10 shrink-0 text-xs font-bold tabular-nums text-text-secondary">
              {ball.overNumber}.{ball.ballInOver + 1}
            </span>
            <span className={cn('inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-xs font-bold', KIND_CLASS[kind])}>
              {chipLabel(ball)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold uppercase tracking-wide">{label}</p>
              {who ? <p className="truncate text-sm text-text-secondary">{who}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
