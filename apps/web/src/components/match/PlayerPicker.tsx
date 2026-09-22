import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/ui/Avatar';
import { IconClose, IconMenu, IconPlus, IconSearch } from '@/components/ui/Icons';
import { Input } from '@/components/ui/Input';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import type { Player } from '@/types/api';

export function PlayerPicker({
  open,
  title,
  players,
  stats,
  disabledIds,
  disabledReason,
  variant = 'default',
  playingIds,
  bodyTop,
  searchPlaceholder,
  elevated,
  onClose,
  onPick,
  onCreate,
  onAddByCode,
}: {
  open: boolean;
  title: string;
  players: Player[];
  stats?: Record<string, string>;
  disabledIds?: Iterable<string>;
  disabledReason?: Record<string, string>;
  variant?: 'default' | 'fielder';
  playingIds?: Iterable<string>;
  bodyTop?: ReactNode;
  searchPlaceholder?: string;
  elevated?: boolean;
  onClose: () => void;
  onPick: (player: Player) => void;
  onCreate?: (name: string) => Promise<void>;
  onAddByCode?: (code: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [profileId, setProfileId] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const titleId = useId();
  const firstField = useRef<HTMLInputElement>(null);
  const canAdd = Boolean(onCreate || onAddByCode);
  const blocked = new Set(disabledIds ?? []);
  const playing = new Set(playingIds ?? []);
  const fielder = variant === 'fielder';
  const filtered = players.filter(
    (p) =>
      p.name.toLowerCase().includes(q.toLowerCase()) ||
      (p.profileCode ?? '').toLowerCase().includes(q.toLowerCase()),
  );

  useEffect(() => {
    if (!open) {
      setQ('');
      setAddOpen(false);
      setProfileId('');
      setName('');
      setError(null);
      setBusy(false);
    }
  }, [open]);

  useEffect(() => {
    if (!addOpen) return;
    firstField.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAddOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [addOpen]);

  if (!open) return null;

  const closeAdd = () => {
    if (busy) return;
    setAddOpen(false);
    setProfileId('');
    setName('');
    setError(null);
  };

  const submitAdd = async () => {
    const code = profileId.trim();
    const fullName = name.trim();
    if (!code && !fullName) {
      setError(t('match.enterPlayer'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (code) {
        if (!onAddByCode) throw new Error(t('common.error'));
        await onAddByCode(code);
      } else {
        if (!onCreate) throw new Error(t('common.error'));
        await onCreate(fullName);
      }
      setAddOpen(false);
      setProfileId('');
      setName('');
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={cn(
        'fixed inset-0 flex flex-col',
        elevated ? 'z-toast' : 'z-sheet',
        fielder ? 'bg-white' : 'bg-[#FDF6EC]',
      )}
    >
      <header className="shrink-0 bg-scoring px-2 pb-3 pt-[max(0.5rem,env(safe-area-inset-top))] text-white">
        <div className="grid grid-cols-[3rem_1fr_3rem] items-center">
          <button
            type="button"
            className="inline-flex min-h-touch min-w-touch items-center justify-center text-white"
            aria-label={t('common.close')}
            onClick={onClose}
          >
            <IconClose />
          </button>
          <h2 className="text-center text-lg font-bold text-white">{title}</h2>
          <span />
        </div>
        {fielder ? null : (
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('common.search')}
            className="mt-2 h-10 w-full rounded-lg bg-white/20 px-3 text-sm text-white placeholder:text-white/70 focus:outline-none"
          />
        )}
      </header>

      {bodyTop ? <div className="shrink-0 bg-white px-4 pt-4">{bodyTop}</div> : null}

      {fielder ? (
        <div className="shrink-0 bg-white px-4 pb-2 pt-3">
          <div className="relative">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={searchPlaceholder ?? t('scoring.searchNameOrId')}
              className="h-11 w-full rounded-pill bg-[#EFEFEF] pe-10 ps-4 text-sm text-black placeholder:text-text-secondary focus:outline-none"
            />
            <IconSearch size={18} className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          </div>
        </div>
      ) : null}

      <ul className="min-h-0 flex-1 overflow-y-auto">
        {filtered.map((p, i) => {
          const blockedRow = blocked.has(p.id);
          const reason = disabledReason?.[p.id];
          const isPlaying = playing.has(p.id);
          return (
            <li key={p.id} className="border-b border-black/10">
              <button
                type="button"
                disabled={blockedRow}
                className={`flex min-h-16 w-full items-center gap-3 px-4 py-2 text-start ${blockedRow ? 'opacity-45' : ''}`}
                onClick={() => {
                  if (!blockedRow) onPick(p);
                }}
              >
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#9E9E9E] text-xs font-bold text-white">
                  {i + 1}
                </span>
                <Avatar name={p.name} src={p.photoUrl} size={44} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold text-black">{p.name}</span>
                  {p.profileCode ? (
                    <span className="block truncate text-xs text-text-secondary">{p.profileCode.toLowerCase()}</span>
                  ) : null}
                </span>
                {fielder ? (
                  <span className="flex shrink-0 gap-1" aria-hidden>
                    <span
                      className={cn(
                        'inline-flex min-h-8 items-center rounded-md px-2 text-[11px] font-semibold',
                        isPlaying ? 'bg-scoring text-white' : 'bg-[#E8E8E8] text-text-secondary',
                      )}
                    >
                      {t('match.playing')}
                    </span>
                    <span className="inline-flex min-h-8 items-center rounded-md bg-[#E8E8E8] px-2 text-[11px] font-semibold text-text-secondary">
                      {t('match.bench')}
                    </span>
                  </span>
                ) : (
                  <span className="shrink-0 text-end">
                    <span className="block text-sm font-semibold text-black">{stats?.[p.id] ?? '0(0)'}</span>
                    {reason ? <span className="block text-[11px] font-semibold text-danger">{reason}</span> : null}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {canAdd ? (
        <div
          className={cn(
            'shrink-0 pb-[max(0.5rem,env(safe-area-inset-bottom))] text-on-dark',
            fielder ? 'bg-dark-chrome' : 'bg-primary',
          )}
        >
          <button
            type="button"
            className="flex min-h-14 w-full items-center justify-center gap-2 text-sm font-bold uppercase tracking-wide"
            onClick={() => setAddOpen(true)}
          >
            {fielder ? <IconPlus size={18} /> : <IconMenu size={18} />}
            {t('match.addPlayer')}
          </button>
        </div>
      ) : null}

      {addOpen ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center px-6">
          <button type="button" className="absolute inset-0 bg-black/45" aria-label={t('common.close')} onClick={closeAdd} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative w-full max-w-sm rounded-[28px] bg-white px-6 pb-6 pt-10 shadow-xl"
          >
            <button
              type="button"
              className="absolute left-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#2C2C2C] text-white"
              aria-label={t('common.close')}
              onClick={closeAdd}
            >
              <IconClose size={15} />
            </button>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submitAdd();
              }}
            >
              <h3 id={titleId} className="text-base font-bold text-black">
                {t('match.addPlayerById')}
              </h3>
              <Input
                ref={firstField}
                value={profileId}
                onChange={(e) => setProfileId(e.target.value)}
                placeholder={t('match.addPlayerIdPlaceholder')}
                underline
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                className="placeholder:text-text-secondary"
              />
              <p className="py-5 text-center text-sm font-semibold text-black">{t('match.or')}</p>
              <h3 className="text-base font-bold text-black">{t('match.createNewPlayer')}</h3>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('match.fullName')}
                underline
                className="placeholder:text-text-secondary"
              />
              {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
              <button
                type="submit"
                disabled={busy}
                className="mt-6 flex min-h-12 w-full items-center justify-center rounded-md bg-primary text-sm font-bold uppercase tracking-wide text-on-dark disabled:opacity-60"
              >
                {t('match.addPlayer')}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
