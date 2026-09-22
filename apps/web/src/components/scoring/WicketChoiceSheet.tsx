import { BottomSheet } from '@/components/ui/BottomSheet';

const BTN =
  'inline-flex min-h-12 min-w-[42%] items-center justify-center rounded-md border border-black/80 bg-transparent px-4 text-sm font-semibold text-scoring-on';

export function WicketChoiceSheet({
  open,
  title,
  titleAlign = 'start',
  options,
  onClose,
  onPick,
}: {
  open: boolean;
  title: string;
  titleAlign?: 'start' | 'center';
  options: { id: string; label: string }[];
  onClose: () => void;
  onPick: (id: string) => void;
}) {
  return (
    <BottomSheet open={open} title={title} onClose={onClose} titleAlign={titleAlign} titleClassName="text-scoring-on">
      <div className="flex justify-center gap-4 py-3">
        {options.map((opt) => (
          <button key={opt.id} type="button" className={BTN} onClick={() => onPick(opt.id)}>
            {opt.label}
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}
