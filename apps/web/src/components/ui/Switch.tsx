import { cn } from '@/lib/cn';

type Props = {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  dark?: boolean;
  ariaLabel?: string;
};

/** Pill toggle switch — same visual language as the switch already used in OverRulesPage/LiveSharePanel, extracted for reuse. */
export function Switch({ checked, onChange, disabled, dark, ariaLabel }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'inline-flex h-7 w-12 shrink-0 items-center rounded-pill p-0.5 transition-colors disabled:opacity-50',
        checked ? (dark ? 'bg-gold' : 'bg-primary') : dark ? 'bg-white/15' : 'bg-border',
      )}
    >
      <span className={cn('block h-6 w-6 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-5' : 'translate-x-0')} />
    </button>
  );
}
