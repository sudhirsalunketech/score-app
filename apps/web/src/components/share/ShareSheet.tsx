import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Toast } from '@/components/ui/Feedback';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/cn';
import { copyText } from '@/lib/share-text';

export type ShareDestination = {
  id: string;
  label: string;
  url: string;
  text: string;
  title: string;
};

export function ShareSheet({
  open,
  onClose,
  heading,
  destinations,
  preview,
}: {
  open: boolean;
  onClose: () => void;
  heading: string;
  destinations: ShareDestination[];
  preview?: ReactNode;
}) {
  const { t } = useTranslation();
  const [dest, setDest] = useState(0);
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const current = destinations[Math.min(dest, Math.max(0, destinations.length - 1))];

  const destLabel = (d: ShareDestination) => t(`share.dest.${d.id}`, { defaultValue: d.label });

  const copiedMessage =
    current?.id === 'live' ? t('share.linkCopied') : current?.id === 'tn' || current?.id === 'tournament' ? t('share.tournamentLinkCopied') : t('share.linkCopiedGeneric');

  const markCopied = () => {
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const copy = async () => {
    if (!current) return;
    const ok = await copyText(current.url);
    if (ok) markCopied();
  };

  const nativeShare = async () => {
    if (!current) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: current.title, text: current.text, url: current.url });
        return;
      } catch {
        /* cancelled */
      }
    }
    await copy();
  };

  const openShare = (kind: 'whatsapp' | 'telegram' | 'facebook' | 'x' | 'linkedin') => {
    if (!current) return;
    const url = current.url;
    const text = current.text;
    const href =
      kind === 'whatsapp'
        ? `https://wa.me/?text=${encodeURIComponent(text)}`
        : kind === 'telegram'
          ? `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`
          : kind === 'facebook'
            ? `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`
            : kind === 'linkedin'
              ? `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`
              : `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(href, '_blank', 'noopener,noreferrer');
  };

  const makeQr = async () => {
    if (!current) return;
    const { default: QR } = await import('qrcode');
    setQr(await QR.toDataURL(current.url, { margin: 1, width: 280, color: { dark: '#111111', light: '#ffffff' } }));
  };

  const downloadQr = () => {
    if (!qr) return;
    const a = document.createElement('a');
    a.href = qr;
    a.download = 'crickscore-share.png';
    a.click();
  };

  return (
    <>
      <BottomSheet open={open} onClose={onClose} title={heading} orange={false}>
        {preview}
        {destinations.length > 1 ? (
          <div className="mb-3 flex flex-col gap-1">
            {destinations.map((d, i) => (
              <button
                key={d.id}
                type="button"
                className={cn(
                  'min-h-touch rounded-lg px-3 text-start text-sm font-semibold',
                  i === dest ? 'bg-primary-light text-primary-dark' : 'bg-muted',
                )}
                onClick={() => {
                  setDest(i);
                  setQr(null);
                }}
              >
                {destLabel(d)}
              </button>
            ))}
          </div>
        ) : null}
        <div className="flex flex-col gap-2">
          <Button type="button" variant="primaryDark" className="w-full" disabled={!current} onClick={() => void copy()}>
            {t('share.copyLink')}
          </Button>
          <Button type="button" variant="outline" className="w-full" disabled={!current} onClick={() => openShare('whatsapp')}>
            {t('share.whatsapp')}
          </Button>
          <Button type="button" variant="outline" className="w-full" disabled={!current} onClick={() => openShare('telegram')}>
            {t('share.telegram')}
          </Button>
          <Button type="button" variant="outline" className="w-full" disabled={!current} onClick={() => openShare('facebook')}>
            {t('share.facebook')}
          </Button>
          <Button type="button" variant="outline" className="w-full" disabled={!current} onClick={() => openShare('x')}>
            {t('share.x')}
          </Button>
          <Button type="button" variant="outline" className="w-full" disabled={!current} onClick={() => openShare('linkedin')}>
            {t('share.linkedin')}
          </Button>
          <Button type="button" variant="outline" className="w-full" disabled={!current} onClick={() => void nativeShare()}>
            {t('share.more')}
          </Button>
          <Button type="button" variant="outline" className="w-full" disabled={!current} onClick={() => void makeQr()}>
            {t('share.showQr')}
          </Button>
        </div>
        {qr ? (
          <div className="mt-4 flex flex-col items-center gap-2">
            <img src={qr} alt={t('share.qrCode')} className="h-40 w-40" />
            <p className="text-center text-xs text-text-secondary">{t('share.scanQr')}</p>
            <Button type="button" variant="outline" onClick={downloadQr}>
              {t('share.downloadQr')}
            </Button>
          </div>
        ) : null}
      </BottomSheet>
      <Toast open={copied} message={copiedMessage} />
    </>
  );
}

export function SharePreview({
  home,
  away,
  homeLogo,
  awayLogo,
  live,
  score,
  overs,
  tournament,
}: {
  home: string;
  away: string;
  homeLogo?: string | null;
  awayLogo?: string | null;
  live?: boolean;
  score?: string;
  overs?: string;
  tournament?: string | null;
}) {
  const { t } = useTranslation();
  return (
    <div className="mb-4 rounded-card border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Avatar name={home} src={homeLogo} kind="team" size={36} />
          <p className="truncate text-sm font-bold uppercase">{home}</p>
        </div>
        <p className="text-xs font-bold text-text-secondary">VS</p>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
          <p className="truncate text-end text-sm font-bold uppercase">{away}</p>
          <Avatar name={away} src={awayLogo} kind="team" size={36} />
        </div>
      </div>
      {live ? <p className="mt-2 text-center text-xs font-bold uppercase text-live">{t('share.liveNow')}</p> : null}
      {score ? <p className="mt-1 text-center text-2xl font-bold text-primary">{score}</p> : null}
      {overs ? (
        <p className="text-center text-xs text-text-secondary">
          {overs} {t('live.overs')}
        </p>
      ) : null}
      {tournament ? <p className="mt-1 text-center text-xs text-text-secondary">{tournament}</p> : null}
      {live ? <p className="mt-2 text-center text-sm font-semibold">{t('share.watchLiveScore')}</p> : null}
    </div>
  );
}
