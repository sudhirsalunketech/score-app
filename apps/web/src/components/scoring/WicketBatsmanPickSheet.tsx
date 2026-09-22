import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/ui/Avatar';
import { BottomSheet } from '@/components/ui/BottomSheet';
import type { Player } from '@/types/api';

export function WicketBatsmanPickSheet({
  open,
  title,
  batsmen,
  onClose,
  onPick,
}: {
  open: boolean;
  title: string;
  batsmen: Player[];
  onClose: () => void;
  onPick: (player: Player) => void;
}) {
  const { t } = useTranslation();

  return (
    <BottomSheet open={open} title={title} onClose={onClose} titleAlign="start" titleClassName="text-scoring-on">
      <div className="flex justify-center gap-10 py-4">
        {batsmen.map((p) => (
          <button
            key={p.id}
            type="button"
            className="flex flex-col items-center gap-2"
            aria-label={t('scoring.selectTheBatsmanNamed', { name: p.name })}
            onClick={() => onPick(p)}
          >
            <Avatar name={p.name} src={p.photoUrl} size={72} className="shadow-md" />
            <span className="text-sm font-semibold text-scoring-on">{p.name}</span>
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}
