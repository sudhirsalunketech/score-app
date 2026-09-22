import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/ui/Avatar';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { DEFAULT_MVP_CONFIG, MvpPointsTable } from '@/components/tournament/MvpPointsTable';
import type { MvpConfig, MvpPlayerRow } from '@/types/api';

export function SuperStarsList({ rows, config }: { rows: MvpPlayerRow[]; config?: MvpConfig | null }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const mvp = config ?? DEFAULT_MVP_CONFIG;
  if (!rows.length) {
    return <p className="px-[var(--gutter)] py-8 text-sm text-text-secondary">{t('statistics.empty')}</p>;
  }
  return (
    <div>
      <button type="button" className="mx-[var(--gutter)] mb-3 min-h-touch text-sm font-bold uppercase text-primary" onClick={() => setOpen(true)}>
        {t('mvp.rules')}
      </button>
      <ol className="px-[var(--gutter)] pb-8">
        {rows.map((row, i) => (
          <li key={row.playerId} className="flex items-center gap-3 border-b border-border py-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-on-dark">
              {i + 1}
            </span>
            <Avatar name={row.playerName} size={40} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{row.playerName}</p>
              <p className="text-xs uppercase text-text-secondary">{row.teamName}</p>
              <p className="text-xs text-text-secondary">
                {t('mvp.bat')} {row.batting.toFixed(1)}, {t('mvp.bowl')} {row.bowling.toFixed(1)}, {t('mvp.field')} {row.fielding.toFixed(1)}
              </p>
            </div>
            <p className="text-lg font-bold">{row.total.toFixed(1)}</p>
          </li>
        ))}
      </ol>
      <BottomSheet open={open} onClose={() => setOpen(false)} title={t('mvp.pointsSystem')}>
        <MvpPointsTable config={mvp} readOnly />
      </BottomSheet>
    </div>
  );
}
