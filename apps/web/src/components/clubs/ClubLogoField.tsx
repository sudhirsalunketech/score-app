import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { LOGO_ACCEPT, mediaSrc, readPhotoAsDataUrl, validateLogoFile } from '@/lib/media';
import { IconPlus } from '@/components/ui/Icons';

export function ClubLogoField({
  value,
  onChange,
  onBusyChange,
  dark = true,
}: {
  value?: string | null;
  onChange: (url: string) => void;
  onBusyChange?: (busy: boolean) => void;
  dark?: boolean;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState(false);

  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);

  useEffect(() => {
    return () => {
      if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const shown = preview ?? (value ? mediaSrc(value) : undefined);
  const hasLogo = Boolean(shown);

  const pick = () => inputRef.current?.click();

  const clear = () => {
    requestId.current += 1;
    if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);
    setPreview(null);
    setError(null);
    setUploaded(false);
    setBusy(false);
    onChange('');
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept={LOGO_ACCEPT}
        hidden
        aria-hidden
        tabIndex={-1}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          const invalid = validateLogoFile(file);
          if (invalid === 'PHOTO_TYPE') {
            setError(t('clubs.logoInvalidType'));
            return;
          }
          if (invalid === 'PHOTO_SIZE') {
            setError(t('clubs.logoTooLarge'));
            return;
          }
          const local = URL.createObjectURL(file);
          if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);
          setPreview(local);
          setError(null);
          setUploaded(false);
          setBusy(true);
          const id = ++requestId.current;
          try {
            const dataUrl = await readPhotoAsDataUrl(file);
            const result = await api<{ url: string }>('/api/v1/uploads', { method: 'POST', body: { dataUrl } });
            if (id !== requestId.current) return;
            onChange(result.url);
            setUploaded(true);
          } catch {
            if (id !== requestId.current) return;
            setError(t('clubs.logoFailed'));
            if (local.startsWith('blob:')) URL.revokeObjectURL(local);
            setPreview(null);
            onChange('');
          } finally {
            if (id === requestId.current) setBusy(false);
          }
        }}
      />
      <button
        type="button"
        onClick={pick}
        disabled={busy}
        aria-label={hasLogo ? t('clubs.changeLogo') : t('clubs.uploadLogo')}
        className={cn(
          'relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border',
          dark ? 'border-white/25 bg-white/5' : 'border-border bg-muted',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold',
          busy && 'opacity-80',
        )}
      >
        {shown ? (
          <img src={shown} alt="" className="h-full w-full object-cover" />
        ) : (
          <IconPlus size={28} className={dark ? 'text-gold' : 'text-primary'} />
        )}
        {busy ? (
          <span className="absolute inset-0 flex items-center justify-center bg-dark-chrome/55" aria-hidden>
            <span className="h-7 w-7 animate-spin rounded-full border-2 border-white/30 border-t-gold" />
          </span>
        ) : null}
      </button>
      {hasLogo ? (
        <div className="flex flex-wrap items-center justify-center gap-4">
          <button type="button" className={cn('min-h-touch text-sm font-semibold', dark ? 'text-gold' : 'text-primary')} disabled={busy} onClick={pick}>
            {t('clubs.changeLogo')}
          </button>
          <button type="button" className={cn('min-h-touch text-sm font-semibold', dark ? 'text-on-dark/70' : 'text-text-secondary')} disabled={busy} onClick={clear}>
            {t('clubs.removeLogo')}
          </button>
        </div>
      ) : (
        <button type="button" className={cn('inline-flex min-h-touch items-center gap-1 text-sm font-semibold', dark ? 'text-gold' : 'text-primary')} disabled={busy} onClick={pick}>
          <IconPlus size={16} />
          {t('clubs.uploadLogo')}
        </button>
      )}
      <p className={cn('text-center text-xs', dark ? 'text-on-dark/55' : 'text-text-secondary')}>{t('clubs.logoTypes')}</p>
      {busy ? (
        <p className={cn('text-xs', dark ? 'text-on-dark/70' : 'text-text-secondary')} role="status">
          {t('clubs.logoUploading')}
        </p>
      ) : null}
      {uploaded && !busy && hasLogo ? (
        <p className="text-xs text-success" role="status">
          {t('clubs.logoUploaded')}
        </p>
      ) : null}
      {error ? (
        <p className="text-center text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
