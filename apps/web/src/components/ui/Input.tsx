import { forwardRef, type ChangeEvent, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { LabelWithInfo } from '@/components/ui/InfoTooltip';
import { sanitizeNumericInput } from '@/lib/numeric-input';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  hint?: string;
  info?: string;
  requiredMark?: boolean;
  underline?: boolean;
  dark?: boolean;
};

const PICKER_TYPES = new Set(['date', 'time', 'datetime-local', 'month', 'week']);

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { label, error, hint, info, requiredMark, underline, dark, className, id, onClick, ...rest },
  ref,
) {
  const inputId = id ?? rest.name;
  return (
    <div className="flex flex-col gap-1">
      {label ? <LabelWithInfo label={label} info={info} requiredMark={requiredMark} dark={dark} htmlFor={inputId} /> : null}
      <input
        id={inputId}
        ref={ref}
        className={cn(
          'min-h-touch w-full bg-transparent px-0 py-2 text-base',
          underline
            ? 'border-0 border-b border-solid focus:outline-none'
            : 'rounded-lg border border-border px-3',
          dark
            ? 'border-gold text-on-dark placeholder:text-on-dark/40'
            : 'border-border text-text',
          className,
        )}
        onClick={(e) => {
          onClick?.(e);
          if (rest.type && PICKER_TYPES.has(rest.type) && !rest.disabled && !rest.readOnly) {
            (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
          }
        }}
        {...rest}
      />
      {error ? <span className="text-xs text-danger">{error}</span> : hint ? <span className={cn('text-xs', dark ? 'text-on-dark/55' : 'text-text-secondary')}>{hint}</span> : null}
    </div>
  );
});

type NumericInputProps = Omit<Props, 'type' | 'min' | 'max' | 'onChange'> & {
  min?: number;
  max?: number;
  decimal?: boolean;
  allowNegative?: boolean;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
};

/**
 * A digit-only text input for numeric fields (runs, overs, wickets, limits, etc).
 * Uses `type="text"` with `inputMode`/`pattern` for the numeric mobile keyboard
 * instead of `type="number"`, since number inputs let through non-numeric junk
 * (`e`, `+`, multiple `-`/`.`) that this filters at the source on every change,
 * including paste. `min`/`max` clamp the value once it's a complete number;
 * transitional states ('', '-', a trailing '.') are left alone so the field
 * stays typeable. Frontend-only UX — the backend remains the source of truth
 * for validation.
 */
export const NumericInput = forwardRef<HTMLInputElement, NumericInputProps>(function NumericInput(
  { decimal = false, allowNegative = false, min, max, onChange, ...rest },
  ref,
) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const sanitized = sanitizeNumericInput(e.target.value, { decimal, allowNegative, min, max });
    if (sanitized !== e.target.value) e.target.value = sanitized;
    onChange(e);
  };
  return (
    <Input
      ref={ref}
      type="text"
      inputMode={decimal ? 'decimal' : 'numeric'}
      pattern={decimal ? '[0-9]*[.,]?[0-9]*' : '[0-9]*'}
      onChange={handleChange}
      {...rest}
    />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & {
    label?: string;
    dark?: boolean;
    underline?: boolean;
    error?: string;
    hint?: string;
    info?: string;
    requiredMark?: boolean;
  }
>(function Select({ label, dark, underline, error, hint, info, requiredMark, className, id, children, ...rest }, ref) {
  const inputId = id ?? rest.name;
  return (
    <div className="flex flex-col gap-1">
      {label ? <LabelWithInfo label={label} info={info} requiredMark={requiredMark} dark={dark} htmlFor={inputId} /> : null}
      <select
        id={inputId}
        ref={ref}
        className={cn(
          'cs-select min-h-touch w-full text-base',
          underline
            ? 'border-0 border-b border-solid bg-transparent px-0 py-2 focus:outline-none'
            : 'rounded-lg border px-3',
          dark ? 'cs-select-dark border-gold text-on-dark [color-scheme:dark]' : 'border-border bg-bg text-text',
          !underline && dark && 'bg-dark-chrome',
          className,
        )}
        {...rest}
      >
        {children}
      </select>
      {error ? <span className="text-xs text-danger">{error}</span> : hint ? <span className={cn('text-xs', dark ? 'text-on-dark/55' : 'text-text-secondary')}>{hint}</span> : null}
    </div>
  );
});

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; info?: string }>(
  function TextArea({ label, info, className, id, ...rest }, ref) {
    const inputId = id ?? rest.name;
    return (
      <div className="flex flex-col gap-1">
        {label ? <LabelWithInfo label={label} info={info} htmlFor={inputId} /> : null}
        <textarea id={inputId} ref={ref} className={cn('w-full rounded-lg border border-border px-3 py-2', className)} {...rest} />
      </div>
    );
  },
);
