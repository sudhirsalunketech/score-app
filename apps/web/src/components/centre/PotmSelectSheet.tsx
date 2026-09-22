import { useEffect, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/ui/Avatar';
import { IconClose } from '@/components/ui/Icons';
import { cn } from '@/lib/cn';
import { playerMatchTotals } from '@/lib/match-summary-highlights';
import type { Innings, MvpPlayerRow } from '@/types/api';

export function PotmSelectSheet({
  open,
  rows,
  innings,
  suggestedId,
  selectedId,
  photos,
  canSelect,
  onClose,
  onSelect,
}: {
  open: boolean;
  rows: MvpPlayerRow[];
  innings: Innings[];
  suggestedId: string | null;
  selectedId: string | null;
  photos?: Record<string, string | null | undefined>;
  canSelect?: boolean;
  onClose: () => void;
  onSelect: (playerId: string) => void;
}) {
  const { t } = useTranslation();
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const suggested = rows.find((row) => row.playerId === (selectedId ?? suggestedId)) ?? rows[0] ?? null;

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-sheet flex flex-col bg-bg">
      <header className="shrink-0 bg-primary px-2 pb-3 pt-[max(0.5rem,env(safe-area-inset-top))] text-on-dark">
        <div className="grid grid-cols-[3rem_1fr_3rem] items-center">
          <button
            type="button"
            className="inline-flex min-h-touch min-w-touch items-center justify-center text-on-dark"
            aria-label={t('common.close')}
            onClick={onClose}
          >
            <IconClose />
          </button>
          <h2 id={titleId} className="text-center text-lg font-bold">
            {t('match.selectPlayer')}
          </h2>
          <span />
        </div>
      </header>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} className="min-h-0 flex-1 overflow-y-auto">
        {suggested ? (
          <section className="px-[var(--gutter)] pb-2 pt-5">
            <div className="mb-1 flex items-end justify-between gap-2">
              <div>
                <h3 className="text-lg font-bold text-text">{t('match.playerOfTheMatch')}</h3>
                <p className="text-sm text-text-secondary">{t('match.suggested')}</p>
              </div>
              <StatHeadings />
            </div>
            <PotmPlayerRow
              row={suggested}
              innings={innings}
              photoUrl={photos?.[suggested.playerId]}
              selected={selectedId === suggested.playerId}
              canSelect={canSelect}
              suggested
              onSelect={onSelect}
            />
          </section>
        ) : (
          <p className="px-[var(--gutter)] py-8 text-sm text-text-secondary">{t('statistics.empty')}</p>
        )}
        {rows.length ? (
          <section className="px-[var(--gutter)] pb-8 pt-4">
            <div className="mb-2 flex items-end justify-between gap-2">
              <h3 className="text-lg font-bold text-text">{t('match.bestPerformers')}</h3>
              <StatHeadings />
            </div>
            <ul>
              {rows.map((row, index) => (
                <li key={row.playerId} className="border-b border-border">
                  <PotmPlayerRow
                    row={row}
                    innings={innings}
                    photoUrl={photos?.[row.playerId]}
                    rank={index + 1}
                    selected={selectedId === row.playerId}
                    canSelect={canSelect}
                    onSelect={onSelect}
                  />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function StatHeadings() {
  const { t } = useTranslation();
  return (
    <div className="grid w-[7.5rem] shrink-0 grid-cols-3 gap-1 text-end text-[11px] font-semibold text-text-secondary">
      <span>{t('profile.runs')}</span>
      <span>{t('match.wkts')}</span>
      <span>{t('match.pts')}</span>
    </div>
  );
}

function PotmPlayerRow({
  row,
  innings,
  photoUrl,
  rank,
  selected,
  suggested,
  canSelect,
  onSelect,
}: {
  row: MvpPlayerRow;
  innings: Innings[];
  photoUrl?: string | null;
  rank?: number;
  selected?: boolean;
  suggested?: boolean;
  canSelect?: boolean;
  onSelect: (playerId: string) => void;
}) {
  const stats = playerMatchTotals(innings, row.playerId);
  const body = (
    <>
      {rank != null ? (
        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-on-dark">
          {rank}
        </span>
      ) : null}
      <Avatar name={row.playerName} src={photoUrl} size={suggested ? 48 : 40} />
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate font-bold', suggested ? 'text-primary' : 'text-text')}>{row.playerName}</span>
        <span className="block truncate text-[11px] font-semibold uppercase text-text-secondary">{row.teamName}</span>
      </span>
      <span className="grid w-[7.5rem] shrink-0 grid-cols-3 gap-1 text-end text-sm tabular-nums">
        <span className="font-semibold">{stats.runs}</span>
        <span className="font-semibold">{stats.wickets}</span>
        <span className="font-bold">{row.total.toFixed(2)}</span>
      </span>
    </>
  );

  if (!canSelect) {
    return <div className="flex min-h-16 items-center gap-2.5 py-2">{body}</div>;
  }

  return (
    <button
      type="button"
      className={cn(
        'flex min-h-16 w-full items-center gap-2.5 py-2 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        selected && 'rounded-lg bg-hero px-1',
      )}
      onClick={() => onSelect(row.playerId)}
    >
      {body}
    </button>
  );
}
