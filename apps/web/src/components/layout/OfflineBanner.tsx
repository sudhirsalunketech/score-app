import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { useOfflineQueue } from '@/context/QueueContext';

export function OfflineBanner() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { online, items } = useOfflineQueue();
  if (pathname.includes('/overlay')) return null;

  const queued = items.filter((item) => item.status !== 'synced').length;
  if (online || !queued) return null;

  return (
    <div
      role="status"
      className="z-overlay border-b border-border bg-dark-chrome px-[var(--gutter)] py-2 text-center text-xs font-semibold uppercase tracking-wide text-on-dark"
    >
      <p>{t('offline.banner')}</p>
      <p className="mt-0.5 font-normal normal-case tracking-normal text-on-dark/80">{t('offline.syncHint')}</p>
    </div>
  );
}
