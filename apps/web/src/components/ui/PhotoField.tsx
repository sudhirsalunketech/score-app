import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { readPhotoAsDataUrl, type AvatarKind } from '@/lib/media';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';

export function PhotoField({
  kind,
  name,
  value,
  onUploaded,
  size = 88,
  compact,
  dark,
  label,
}: {
  kind: AvatarKind;
  name: string;
  value?: string | null;
  onUploaded: (url: string) => Promise<void> | void;
  size?: number;
  compact?: boolean;
  dark?: boolean;
  label?: string;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const actionLabel = busy ? t('common.loading') : (label ?? t('photo.upload'));

  return (
    <div className={compact ? 'flex flex-col items-start gap-1' : 'flex flex-col items-center gap-2'}>
      <Avatar name={name} src={value} kind={kind} size={size} />
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          setError(null);
          setBusy(true);
          try {
            const dataUrl = await readPhotoAsDataUrl(file);
            const uploaded = await api<{ url: string }>('/api/v1/uploads', { method: 'POST', body: { dataUrl } });
            await onUploaded(uploaded.url);
          } catch (err) {
            const code = err instanceof Error ? err.message : '';
            setError(
              code === 'PHOTO_TYPE' ? t('photo.invalidType') : code === 'PHOTO_SIZE' ? t('photo.tooLarge') : t('photo.failed'),
            );
          } finally {
            setBusy(false);
          }
        }}
      />
      {compact ? (
        <button
          type="button"
          className={dark ? 'min-h-8 text-sm font-semibold text-gold' : 'min-h-8 text-sm font-semibold text-primary'}
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {actionLabel}
        </button>
      ) : (
        <Button type="button" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
          {actionLabel}
        </Button>
      )}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
