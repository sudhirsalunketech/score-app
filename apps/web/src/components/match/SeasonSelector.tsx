import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import { BottomSheet } from '@/components/ui/BottomSheet';
import type { Tournament } from '@/types/api';

export function SeasonSelector({
  open,
  onClose,
  selectedId,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  selectedId: string | null;
  onPick: (tournament: Tournament | null) => void;
}) {
  const { t } = useTranslation();
  const q = useQuery({
    queryKey: keys.tournaments,
    queryFn: () => api<Tournament[]>('/api/v1/tournaments'),
    enabled: open,
  });

  return (
    <BottomSheet open={open} title={t('match.season')} onClose={onClose} orange={false}>
      <button
        type="button"
        className="mb-2 min-h-touch w-full text-start text-sm text-text-secondary"
        onClick={() => {
          onPick(null);
          onClose();
        }}
      >
        {t('match.noSeason')}
      </button>
      <ul className="max-h-[50vh] divide-y divide-border overflow-y-auto">
        {(q.data ?? []).map((tn) => (
          <li key={tn.id}>
            <button
              type="button"
              className="flex min-h-touch w-full flex-col items-start py-2"
              onClick={() => {
                onPick(tn);
                onClose();
              }}
            >
              <span className={tn.id === selectedId ? 'font-bold text-primary' : 'font-semibold'}>{tn.name}</span>
              <span className="text-sm text-text-secondary">{tn.season ?? t('common.empty')}</span>
            </button>
          </li>
        ))}
      </ul>
    </BottomSheet>
  );
}
