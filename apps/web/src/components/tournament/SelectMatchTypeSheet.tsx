import { useTranslation } from 'react-i18next';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { IconChevron, IconFlag, IconTrophy } from '@/components/ui/Icons';
import type { TournamentGroup } from '@/types/api';

export const OTHER_MATCH_LABELS = ['Match', 'Series Match', 'Knockout', 'Qualifier', 'Eliminator', 'Quarter Final', 'Semi Final', 'Final'] as const;

/**
 * Opened from the tournament's "START / SCHEDULE MATCH" button. Preserves the two existing
 * match-type categories: a group from the tournament's own Points Table groups, or one of the
 * fixed knockout/match-title options. Selecting a group hands off to group/team validation in
 * the caller (`TournamentDetailPage`) before navigating to match creation.
 */
export function SelectMatchTypeSheet({
  open,
  onClose,
  groups,
  onSelectGroup,
  onSelectLabel,
  onNoGroups,
}: {
  open: boolean;
  onClose: () => void;
  groups: TournamentGroup[];
  onSelectGroup: (group: TournamentGroup) => void;
  onSelectLabel: (label: string) => void;
  onNoGroups: () => void;
}) {
  const { t } = useTranslation();
  return (
    <BottomSheet open={open} title={t('match.selectMatchType')} onClose={onClose} orange={false}>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          className="flex flex-col items-center gap-2 rounded-xl border border-border p-4"
          onClick={() => {
            if (!groups.length) onNoGroups();
          }}
        >
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary-light text-primary-dark">
            <IconTrophy size={22} />
          </span>
          <span className="text-sm font-bold">{t('match.pointsTable')}</span>
        </button>
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border p-4">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-danger/10 text-danger">
            <IconFlag size={22} />
          </span>
          <span className="text-sm font-bold">{t('match.otherMatches')}</span>
        </div>
      </div>

      <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-xs font-bold uppercase text-text-secondary">
        {t('match.groupsPointsTable')}
      </p>
      {groups.length ? (
        <ul className="divide-y divide-border">
          {groups.map((g) => (
            <li key={g.id}>
              <button
                type="button"
                className="flex min-h-touch w-full items-center justify-between gap-3 py-2 text-start"
                onClick={() => onSelectGroup(g)}
              >
                <span className="flex items-center gap-3">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary-light text-sm font-bold text-primary-dark">
                    {g.name.trim().slice(0, 1) || '#'}
                  </span>
                  <span className="font-semibold uppercase">{g.name}</span>
                </span>
                <IconChevron size={16} className="text-text-secondary" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <button type="button" className="w-full py-3 text-start text-sm text-text-secondary" onClick={onNoGroups}>
          {t('tournaments.noGroupsYet')}
        </button>
      )}

      <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-xs font-bold uppercase text-text-secondary">
        {t('match.titlesKnockouts')}
      </p>
      <ul className="divide-y divide-border">
        {OTHER_MATCH_LABELS.map((label) => (
          <li key={label}>
            <button
              type="button"
              className="flex min-h-touch w-full items-center justify-between gap-3 py-2 text-start"
              onClick={() => onSelectLabel(label)}
            >
              <span className="flex items-center gap-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-danger" aria-hidden />
                <span className="font-semibold">{label}</span>
              </span>
              <IconChevron size={16} className="text-text-secondary" />
            </button>
          </li>
        ))}
      </ul>
    </BottomSheet>
  );
}
