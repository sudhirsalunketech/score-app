import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { LabelWithInfo } from '@/components/ui/InfoTooltip';
import { IconClose, IconSearch } from '@/components/ui/Icons';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { filterSeasonYears, seasonYearOptions } from '@/lib/season-years';

export function SeasonYearPicker({
  value,
  onChange,
  options: optionsProp,
  label,
  info,
  error,
  dark,
  requiredMark,
}: {
  value?: string;
  onChange: (value: string) => void;
  options?: string[];
  label: string;
  info?: string;
  error?: string;
  dark?: boolean;
  requiredMark?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);
  const triggerId = useId();
  const dialogId = useId();
  const titleId = useId();
  const listId = useId();
  const searchId = useId();
  const optionId = (index: number) => `${listId}-opt-${index}`;
  const desktop = useMediaQuery('(min-width: 768px)');
  const options = useMemo(() => {
    const list = optionsProp ?? seasonYearOptions();
    if (value && !list.includes(value)) return [value, ...list];
    return list;
  }, [optionsProp, value]);
  const visible = filterSeasonYears(options, query);

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    lastFocus.current = document.activeElement as HTMLElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const id = window.setTimeout(() => {
      searchRef.current?.focus();
      listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
    }, 40);
    return () => {
      window.clearTimeout(id);
      document.body.style.overflow = prevOverflow;
      lastFocus.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const selected = visible.findIndex((option) => option === value);
    setActiveIndex(selected >= 0 ? selected : 0);
  }, [open, query, value]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  function close() {
    setOpen(false);
  }

  function select(option: string) {
    onChange(option);
    close();
  }

  function onDialogKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, Math.max(visible.length - 1, 0)));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const option = visible[activeIndex];
      if (option) select(option);
      return;
    }
    if (e.key !== 'Tab' || !dialogRef.current) return;
    const items = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
    );
    if (!items.length) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  const popup =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div className="fixed inset-0 z-sheet flex flex-col">
            <button
              type="button"
              className="cs-season-backdrop absolute inset-0 bg-black/45"
              aria-label={t('common.close')}
              onClick={close}
            />
            <SeasonPanel
              desktop={desktop}
              trigger={triggerRef.current}
              dialogRef={dialogRef}
              dialogId={dialogId}
              titleId={titleId}
              listId={listId}
              searchId={searchId}
              label={label}
              query={query}
              onQueryChange={setQuery}
              searchRef={searchRef}
              listRef={listRef}
              visible={visible}
              value={value}
              activeIndex={activeIndex}
              optionId={optionId}
              onSelect={select}
              onClose={close}
              onKeyDown={onDialogKey}
            />
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="flex flex-col gap-1">
      <LabelWithInfo label={label} info={info} dark={dark} requiredMark={requiredMark} htmlFor={triggerId} />
      <button
        id={triggerId}
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        onClick={() => setOpen(true)}
        className={cn(
          'flex min-h-touch w-full items-center justify-between border-0 border-b border-solid bg-transparent px-0 py-2 text-start text-base',
          dark ? 'border-gold text-on-dark' : 'border-border text-text',
        )}
      >
        <span className={value ? undefined : dark ? 'text-on-dark/40' : 'text-text-secondary'}>
          {value || t('tournaments.seasonPlaceholder')}
        </span>
        <span className={cn('text-sm', dark ? 'text-gold' : 'text-text-secondary')} aria-hidden>
          ▾
        </span>
      </button>
      {error ? <span className="text-xs text-danger">{error}</span> : null}
      {popup}
    </div>
  );
}

function SeasonPanel({
  desktop,
  trigger,
  dialogRef,
  dialogId,
  titleId,
  listId,
  searchId,
  label,
  query,
  onQueryChange,
  searchRef,
  listRef,
  visible,
  value,
  activeIndex,
  optionId,
  onSelect,
  onClose,
  onKeyDown,
}: {
  desktop: boolean;
  trigger: HTMLButtonElement | null;
  dialogRef: RefObject<HTMLDivElement>;
  dialogId: string;
  titleId: string;
  listId: string;
  searchId: string;
  label: string;
  query: string;
  onQueryChange: (value: string) => void;
  searchRef: RefObject<HTMLInputElement>;
  listRef: RefObject<HTMLUListElement>;
  visible: string[];
  value?: string;
  activeIndex: number;
  optionId: (index: number) => string;
  onSelect: (value: string) => void;
  onClose: () => void;
  onKeyDown: (e: KeyboardEvent) => void;
}) {
  const { t } = useTranslation();
  const closeBtn = (
    <button
      type="button"
      className="inline-flex min-h-touch min-w-touch shrink-0 items-center justify-center rounded-full text-on-dark/80"
      aria-label={t('common.close')}
      onClick={onClose}
    >
      <IconClose />
    </button>
  );

  return (
    <div
      id={dialogId}
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onKeyDown={onKeyDown}
      style={desktop ? placePanel(trigger) : undefined}
      className={cn(
        'relative z-10 flex w-full flex-col overflow-hidden bg-dark-chrome text-on-dark shadow-xl',
        desktop
          ? 'cs-season-panel max-w-[calc(100vw-32px)] rounded-card-lg'
          : 'cs-season-sheet mt-auto rounded-t-card-lg pb-[env(safe-area-inset-bottom)]',
      )}
    >
      {desktop ? null : <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-pill bg-white/35" aria-hidden />}
      <div className="flex shrink-0 items-center gap-1 px-2 pt-1">
        {desktop ? closeBtn : null}
        <h2 id={titleId} className="min-w-0 flex-1 px-2 text-base font-bold text-gold">
          {label}
        </h2>
        {desktop ? null : closeBtn}
      </div>
      <div className="mx-4 mt-1 flex shrink-0 items-center gap-2 border-b border-white/15">
        <IconSearch size={18} className="shrink-0 text-on-dark/55" />
        <input
          id={searchId}
          ref={searchRef}
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={t('tournaments.seasonSearch')}
          aria-label={t('tournaments.seasonSearch')}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={visible[activeIndex] ? optionId(activeIndex) : undefined}
          autoComplete="off"
          className="cs-season-search min-h-touch w-full bg-transparent text-base text-on-dark placeholder:text-on-dark/40 focus:outline-none"
        />
      </div>
      <ul
        id={listId}
        ref={listRef}
        role="listbox"
        aria-label={label}
        className="cs-season-list overflow-x-hidden overflow-y-auto overscroll-contain"
      >
        {visible.length ? (
          visible.map((option, index) => {
            const selected = option === value;
            const active = index === activeIndex;
            return (
              <li key={option} className="border-b border-white/[0.08] last:border-b-0">
                <button
                  id={optionId(index)}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  data-active={active ? 'true' : undefined}
                  className={cn(
                    'flex min-h-12 w-full items-center justify-between px-4 py-3 text-start text-base',
                    selected ? 'bg-gold/15 font-semibold text-gold' : 'text-on-dark',
                    active && !selected ? 'bg-white/10' : null,
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onSelect(option)}
                >
                  <span>{option}</span>
                  {selected ? <span aria-hidden>✓</span> : null}
                </button>
              </li>
            );
          })
        ) : (
          <li className="px-4 py-8 text-center text-sm text-on-dark/55">{t('tournaments.noSeasons')}</li>
        )}
      </ul>
    </div>
  );
}

export function placePanel(trigger: HTMLButtonElement | null): CSSProperties {
  const gutter = 16;
  const width = Math.min(520, Math.max(280, window.innerWidth - gutter * 2));
  if (!trigger) {
    return {
      position: 'fixed',
      left: '50%',
      top: '50%',
      width,
      maxWidth: 'calc(100vw - 32px)',
      transform: 'translate(-50%, -50%)',
    };
  }
  const rect = trigger.getBoundingClientRect();
  let left = rect.left;
  if (left + width > window.innerWidth - gutter) left = window.innerWidth - gutter - width;
  if (left < gutter) left = gutter;
  const gap = 8;
  const spaceBelow = window.innerHeight - rect.bottom - gap - gutter;
  const spaceAbove = rect.top - gap - gutter;
  const openUp = spaceBelow < 280 && spaceAbove > spaceBelow;
  if (openUp) {
    return {
      position: 'fixed',
      left,
      width,
      maxWidth: 'calc(100vw - 32px)',
      bottom: window.innerHeight - rect.top + gap,
    };
  }
  return {
    position: 'fixed',
    left,
    width,
    maxWidth: 'calc(100vw - 32px)',
    top: rect.bottom + gap,
  };
}
