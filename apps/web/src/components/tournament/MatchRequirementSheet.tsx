import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';

/** Shared shape for the "Group Required" / "Teams Required" blocking prompts shown while
 * validating the START / SCHEDULE MATCH flow before it reaches match creation. */
export function MatchRequirementSheet({
  open,
  title,
  message,
  actionLabel,
  onAction,
  actionBusy,
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  actionLabel: string;
  onAction: () => void;
  actionBusy?: boolean;
  onClose: () => void;
}) {
  return (
    <BottomSheet open={open} title={title} onClose={onClose} orange={false}>
      <p className="text-sm text-text-secondary">{message}</p>
      <Button type="button" variant="primaryDark" className="mt-4 w-full" disabled={actionBusy} onClick={onAction}>
        {actionLabel}
      </Button>
    </BottomSheet>
  );
}
