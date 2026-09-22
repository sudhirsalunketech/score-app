import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconChevron } from '@/components/ui/Icons';

const PAGE_SIZE = 5;

export function RecentForm({
  battingHistory,
  bowlingHistory,
}: {
  battingHistory: Array<{ runs: number; notOut: boolean }>;
  bowlingHistory: string[];
}) {
  const { t } = useTranslation();
  const [page, setPage] = useState(0);
  if (!battingHistory.length && !bowlingHistory.length) return null;

  const pageCount = Math.max(Math.ceil(battingHistory.length / PAGE_SIZE), Math.ceil(bowlingHistory.length / PAGE_SIZE), 1);
  const start = page * PAGE_SIZE;
  const batting = battingHistory.slice(start, start + PAGE_SIZE);
  const bowling = bowlingHistory.slice(start, start + PAGE_SIZE);
  const atNewest = page === 0;
  const atOldest = page >= pageCount - 1;

  return (
    <section className="mt-5 w-full">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold">{t('profile.recentForm')}</h2>
        {pageCount === 1 ? <p className="text-[10px] font-semibold uppercase text-text-secondary">{t('profile.newToOld')}</p> : null}
      </div>
      {batting.length ? (
        <div className="mt-2 flex items-center gap-2">
          <span className="w-10 shrink-0 rounded-md bg-dark-chrome px-1.5 py-1 text-center text-[10px] font-bold text-on-dark">
            {t('profile.bat')}
          </span>
          <div className="flex gap-1.5 overflow-x-auto">
            {batting.map((row, i) => (
              <span
                key={`b-${i}`}
                className="inline-flex h-9 min-w-9 items-center justify-center rounded-full bg-muted text-xs font-bold"
              >
                {row.runs}
                {row.notOut ? '*' : ''}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      {bowling.length ? (
        <div className="mt-2 flex items-center gap-2">
          <span className="w-10 shrink-0 rounded-md bg-dark-chrome px-1.5 py-1 text-center text-[10px] font-bold text-on-dark">
            {t('profile.bowl')}
          </span>
          <div className="flex gap-1.5 overflow-x-auto">
            {bowling.map((fig, i) => (
              <span
                key={`w-${i}`}
                className="inline-flex h-9 min-w-9 items-center justify-center rounded-full bg-muted text-xs font-bold"
              >
                {fig}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      {pageCount > 1 ? (
        <div className="mt-2 flex items-center justify-center gap-3 text-[10px] font-bold uppercase tracking-wide text-text-secondary">
          <span>{t('profile.newLabel')}</span>
          <button
            type="button"
            disabled={atNewest}
            aria-label={t('profile.newerResults')}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="touch-target inline-flex items-center justify-center disabled:opacity-30"
          >
            <IconChevron size={16} className="rotate-180" />
          </button>
          <button
            type="button"
            disabled={atOldest}
            aria-label={t('profile.olderResults')}
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            className="touch-target inline-flex items-center justify-center disabled:opacity-30"
          >
            <IconChevron size={16} />
          </button>
          <span>{t('profile.oldLabel')}</span>
        </div>
      ) : null}
    </section>
  );
}
