import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { IconClose } from '@/components/ui/Icons';
import { cn } from '@/lib/cn';
import type { BallType, MatchFormat } from '@/types/api';

export type FormatSettings = {
  overs: number;
  format: MatchFormat;
  maxWickets: number;
  playingPerSide: number;
  ballsPerOver: number;
  ballType: BallType;
  overTheFence: boolean;
  mankad: boolean;
  lastMan: boolean;
  extrasToBatsman: boolean;
};

export const DEFAULT_FORMAT: FormatSettings = {
  overs: 5,
  format: 'T10',
  maxWickets: 7,
  playingPerSide: 8,
  ballsPerOver: 6,
  ballType: 'TENNIS',
  overTheFence: true,
  mankad: true,
  lastMan: true,
  extrasToBatsman: false,
};

const OVER_PRESETS = [10, 20, 30, 40, 50];
const FORMAT_OPTIONS: { id: MatchFormat; labelKey: string }[] = [
  { id: 'T10', labelKey: 'match.formatT10' },
  { id: 'T20', labelKey: 'match.formatT20' },
  { id: 'CLUB', labelKey: 'match.formatClub' },
  { id: 'HUNDRED', labelKey: 'match.formatHundred' },
  { id: 'ODI', labelKey: 'match.formatOdi' },
  { id: 'TEST', labelKey: 'match.formatTest' },
];

export function FormatModal({
  open,
  value,
  onChange,
  onClose,
  onDone,
  advanced = true,
  locked = false,
  busy = false,
  error,
  minOvers = 1,
  minWickets = 1,
}: {
  open: boolean;
  value: FormatSettings;
  onChange: (next: FormatSettings) => void;
  onClose: () => void;
  onDone?: () => void;
  advanced?: boolean;
  locked?: boolean;
  busy?: boolean;
  error?: string | null;
  minOvers?: number;
  minWickets?: number;
}) {
  const { t } = useTranslation();
  const [localError, setLocalError] = useState<string | null>(null);
  const set = (patch: Partial<FormatSettings>) => {
    if (locked) return;
    setLocalError(null);
    onChange({ ...value, ...patch });
  };
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const lastFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    lastFocus.current = document.activeElement as HTMLElement;
    const root = ref.current;
    const focusables = () =>
      Array.from(root?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? []);
    focusables()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key !== 'Tab') return;
      const items = focusables();
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
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      lastFocus.current?.focus();
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) setLocalError(null);
  }, [open]);

  if (!open) return null;

  const ballTypes: BallType[] = value.ballType === 'RUBBER' || advanced ? ['LEATHER', 'TENNIS', 'RUBBER'] : ['LEATHER', 'TENNIS'];

  return (
    <div className="fixed inset-0 z-sheet flex items-center justify-center px-5">
      <button type="button" className="absolute inset-0 bg-black/45" aria-label={t('common.close')} onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 max-h-[min(92dvh,40rem)] w-full max-w-sm overflow-y-auto rounded-[28px] bg-white px-6 pb-6 pt-10 shadow-xl"
      >
        <button
          type="button"
          className="absolute left-3 top-3 inline-flex h-10 w-10 items-center justify-center text-black"
          aria-label={t('common.close')}
          onClick={onClose}
        >
          <IconClose />
        </button>

        <h2 id={titleId} className="sr-only">
          {t('match.format')}
        </h2>

        {locked ? (
          <p className="mb-4 text-sm font-semibold text-text-secondary" role="status">
            {t('match.scoringRulesLocked')}
          </p>
        ) : null}

         <Section label={t('match.selectOvers')} required>
            <NumberLine
              value={value.overs}
              min={1}
              max={90}
              disabled={locked}
              ariaLabel={t('match.selectOvers')}
              onChange={(n) => set({ overs: n })}
            />
            <div className="mt-3 flex justify-between gap-2 px-1 text-sm font-semibold text-black">
              {OVER_PRESETS.map((n) => (
                <button
                  key={n}
                  type="button"
                  disabled={locked || n < minOvers}
                  className={cn('min-h-touch min-w-touch disabled:opacity-40', value.overs === n && 'text-primary')}
                  onClick={() => set({ overs: n })}
                >
                  {n}
                </button>
              ))}
            </div>
          </Section>
        

        <Section label={t('match.selectFormat')} required>
          <div className="grid grid-cols-3 gap-2">
            {FORMAT_OPTIONS.map((opt) => (
              <SelectChip
                key={opt.id}
                active={value.format === opt.id}
                disabled={locked}
                onClick={() =>
                  set({
                    format: opt.id,
                    ...(opt.id === 'HUNDRED' ? { ballsPerOver: 5 } : {}),
                    // Test innings have no over limit — 90 is a practical "unlimited" stand-in.
                    ...(opt.id === 'TEST' ? { overs: 90  } : value.format === 'TEST' ? { overs: DEFAULT_FORMAT.overs } : {}),
                  })
                }
              >
                {t(opt.labelKey)}
              </SelectChip>
            ))}
          </div>
        </Section>

        <Section label={t('match.wickets')}>
          <NumberLine
            value={value.maxWickets}
            min={1}
            max={10}
            disabled={locked}
            ariaLabel={t('match.wickets')}
            onChange={(n) => set({ maxWickets: n })}
          />
        </Section>

        <Section label={t('match.ballType')} required>
          <div className={cn('grid gap-2', ballTypes.length === 2 ? 'grid-cols-2' : 'grid-cols-3')}>
            {ballTypes.map((type) => (
              <SelectChip key={type} active={value.ballType === type} disabled={locked} onClick={() => set({ ballType: type })}>
                {type === 'LEATHER' ? t('match.leatherBall') : type === 'TENNIS' ? t('match.tennisBall') : t('match.rubber')}
              </SelectChip>
            ))}
          </div>
        </Section>

        {advanced ? (
          <>
            <Field label={t('match.playingPerSide')} info={t('info.match.playingPerSide')}>
              <div className="flex flex-wrap gap-2">
                {[6, 7, 8, 9, 10, 11].map((n) => (
                  <Chip key={n} active={value.playingPerSide === n} disabled={locked} onClick={() => set({ playingPerSide: n })}>
                    {n}
                  </Chip>
                ))}
              </div>
            </Field>
            <Field label={t('match.ballsPerOver')} info={t('info.match.ballsPerOver')}>
              <div className="flex flex-wrap gap-2">
                {[4, 5, 6, 7, 8].map((n) => (
                  <Chip key={n} active={value.ballsPerOver === n} disabled={locked} onClick={() => set({ ballsPerOver: n })}>
                    {n}
                  </Chip>
                ))}
              </div>
            </Field>
            <Toggle
              label={t('match.overTheFence')}
              info={t('info.match.overTheFence')}
              on={value.overTheFence}
              onToggle={() => set({ overTheFence: !value.overTheFence })}
            />
            <Toggle label={t('match.mankad')} info={t('info.match.mankad')} on={value.mankad} onToggle={() => set({ mankad: !value.mankad })} />
            <Toggle label={t('match.lastMan')} info={t('info.match.lastMan')} on={value.lastMan} onToggle={() => set({ lastMan: !value.lastMan })} />
            <Toggle
              label={t('match.extrasToBatsman')}
              info={t('info.match.extrasToBatsman')}
              on={value.extrasToBatsman}
              onToggle={() => set({ extrasToBatsman: !value.extrasToBatsman })}
            />
          </>
        ) : null}

        {localError || error ? <p className="mt-3 text-sm text-danger">{localError ?? error}</p> : null}

        <Button
          className="mt-6 w-full"
          variant="primaryDark"
          disabled={busy}
          onClick={() => {
            if (locked) {
              onDone?.() ?? onClose();
              return;
            }
            if (value.format !== 'HUNDRED' && value.overs < minOvers) {
              setLocalError(t('match.oversMinProgress', { min: minOvers }));
              return;
            }
            if (value.maxWickets < minWickets) {
              setLocalError(t('match.wicketsMinProgress', { min: minWickets }));
              return;
            }
            setLocalError(null);
            onDone?.() ?? onClose();
          }}
        >
          {t('common.done')}
        </Button>
      </div>
    </div>
  );
}

function Section({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="mb-5">
      <p className="mb-2 text-base font-bold text-black">
        {label}
        {required ? <span className="text-danger">*</span> : null}
      </p>
      {children}
    </div>
  );
}

function NumberLine({
  value,
  min,
  max,
  disabled,
  ariaLabel,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  ariaLabel: string;
  onChange: (n: number) => void;
}) {
  return (
    <input
      type="text"
      inputMode="numeric"
      aria-label={ariaLabel}
      disabled={disabled}
      value={String(value)}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, '');
        if (!digits) return;
        const n = Number(digits);
        if (!Number.isFinite(n)) return;
        onChange(Math.min(max, Math.max(min, n)));
      }}
      className="w-full border-0 border-b border-black/50 bg-transparent py-1 text-center text-lg font-semibold text-black focus:outline-none disabled:opacity-60"
    />
  );
}

function SelectChip({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        'min-h-11 rounded-md border px-2 text-sm font-semibold disabled:opacity-60',
        active ? 'border-primary-dark bg-primary-dark text-on-dark' : 'border-black bg-white text-black',
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function Field({ label, info, children }: { label: string; info?: string; children: ReactNode }) {
  return (
    <div className="mb-4">
      <p className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-text-secondary">
        {label}
        {info ? <InfoTooltip topic={label} compact>{info}</InfoTooltip> : null}
      </p>
      {children}
    </div>
  );
}

function Chip({ active, disabled, onClick, children }: { active: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        'min-h-touch min-w-touch rounded-pill px-3 text-sm font-semibold disabled:opacity-60',
        active ? 'bg-primary text-on-dark' : 'bg-muted text-text',
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function Toggle({ label, info, on, onToggle }: { label: string; info?: string; on: boolean; onToggle: () => void }) {
  return (
    <div className="mb-2 flex min-h-touch w-full items-center justify-between gap-2">
      <span className="inline-flex items-center gap-1 font-medium">
        {label}
        {info ? (
          <InfoTooltip topic={label} compact>
            {info}
          </InfoTooltip>
        ) : null}
      </span>
      <button type="button" className="shrink-0" onClick={onToggle} aria-pressed={on} aria-label={label}>
        <span className={cn('block h-6 w-11 rounded-pill p-0.5', on ? 'bg-success' : 'bg-border')}>
          <span className={cn('block h-5 w-5 rounded-full bg-bg transition-transform', on && 'translate-x-5')} />
        </span>
      </button>
    </div>
  );
}
