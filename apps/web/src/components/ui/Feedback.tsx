import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { InfoTooltip } from '@/components/ui/InfoTooltip';

export function Spinner({ label, className }: { label?: string; className?: string }) {
  const { t } = useTranslation();
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 py-10', className)} role="status">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      <p className="text-sm text-text-secondary">{label ?? t('common.loading')}</p>
    </div>
  );
}

export function ErrorRetry({
  message,
  retryLabel,
  onRetry,
}: {
  message?: string;
  retryLabel?: string;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-3 py-10">
      <p className="text-sm text-text-secondary">{message ?? t('common.error')}</p>
      <button type="button" className="min-h-touch font-bold text-primary" onClick={onRetry}>
        {retryLabel ?? t('common.retry')}
      </button>
    </div>
  );
}

export function EmptyState({ title, hint, info, action }: { title: string; hint?: string; info?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <p className="inline-flex items-center justify-center gap-1 text-lg font-semibold">
        {title}
        {info ? <InfoTooltip topic={title}>{info}</InfoTooltip> : null}
      </p>
      {hint ? <p className="max-w-sm text-sm text-text-secondary">{hint}</p> : null}
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-muted', className)} />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-4 px-[var(--gutter)] py-6" aria-hidden>
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

export function Toast({ message, open }: { message: string; open: boolean }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-x-0 bottom-20 z-[var(--z-toast)] mx-auto w-fit max-w-[90vw] rounded-pill bg-dark-chrome px-4 py-2 text-sm font-semibold text-on-dark shadow-lg"
      role="status"
    >
      {message}
    </div>
  );
}
