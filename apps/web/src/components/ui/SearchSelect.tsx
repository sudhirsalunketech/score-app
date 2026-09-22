import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { IconChevron, IconSearch } from '@/components/ui/Icons';

type Option = { value: string; label: string };

/** Compact inline dropdown with a built-in search box — an app-styled alternative to a native `<select>` for longer or search-friendly option lists. */
export function SearchSelect({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  className,
  label,
  searchable = true,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  label?: string;
  /** Show the built-in search box (default true). Set false for very short lists where it adds no value. */
  searchable?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) setQ('');
  }, [open]);

  const selected = options.find((o) => o.value === value);
  const filtered = useMemo(
    () => (q ? options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase())) : options),
    [options, q],
  );

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      {label ? <span className="mb-1 block text-sm font-semibold">{label}</span> : null}
      <button
        type="button"
        disabled={disabled}
        className="cs-select flex min-h-touch w-full items-center justify-between gap-2 rounded-lg border border-border bg-bg px-3 text-start text-base disabled:opacity-50"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={cn('truncate', !selected && 'text-text-secondary')}>{selected ? selected.label : placeholder}</span>
        <IconChevron size={16} className={cn('shrink-0 transition-transform', open && 'rotate-180')} />
      </button>
      {open ? (
        <div className="absolute z-overlay mt-1 w-full min-w-[12rem] rounded-lg border border-border bg-bg shadow-lg">
          {searchable ? (
            <div className="flex items-center gap-2 border-b border-border px-2 py-1.5">
              <IconSearch size={14} className="shrink-0 text-text-secondary" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t('common.search')}
                className="min-w-0 flex-1 bg-transparent py-1 text-sm focus:outline-none"
              />
            </div>
          ) : null}
          <ul role="listbox" className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-text-secondary">{t('common.noResults')}</li>
            ) : (
              filtered.map((o) => (
                <li key={o.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={o.value === value}
                    className={cn(
                      'flex min-h-touch w-full items-center px-3 py-2 text-start text-sm hover:bg-muted',
                      o.value === value && 'bg-primary-light font-semibold text-primary',
                    )}
                    onClick={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                  >
                    {o.label}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
