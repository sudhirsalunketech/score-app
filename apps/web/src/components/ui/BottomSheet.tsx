import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { IconClose } from '@/components/ui/Icons';

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  orange?: boolean;
  headerEnd?: ReactNode;
  closeSide?: 'start' | 'end';
  titleClassName?: string;
  titleAlign?: 'start' | 'center';
};

export function BottomSheet({
  open,
  title,
  onClose,
  children,
  orange = true,
  headerEnd,
  closeSide = 'start',
  titleClassName,
  titleAlign = 'center',
}: Props) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const lastFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    lastFocus.current = document.activeElement as HTMLElement;
    ref.current?.querySelector<HTMLElement>('button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      lastFocus.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-sheet flex items-end justify-center">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label={t('common.close')} onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          'relative z-10 flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-card-lg p-4 pb-[max(1rem,env(safe-area-inset-bottom))]',
          orange ? 'bg-scoring text-white' : 'bg-bg text-text',
        )}
      >
        <div className={cn('mx-auto mb-2 h-1 w-10 rounded-pill', orange ? 'bg-white/40' : 'bg-black/20')} />
        <div className="mb-3 flex min-h-touch items-center gap-1">
          {closeSide === 'start' ? (
            <button
              type="button"
              className={cn(
                'inline-flex min-h-touch min-w-touch shrink-0 items-center justify-center',
                orange ? 'text-scoring-on' : 'text-text',
              )}
              aria-label={t('common.close')}
              onClick={onClose}
            >
              <IconClose />
            </button>
          ) : null}
          <h2
            id={titleId}
            className={cn(
              'min-w-0 flex-1 text-base font-bold sm:text-lg',
              titleAlign === 'start' ? 'text-start' : 'text-center',
              orange ? 'text-white' : 'text-text',
              titleClassName,
            )}
          >
            {title}
          </h2>
          <div className={cn('flex shrink-0 items-center', orange ? 'text-white' : 'text-text')}>
            {headerEnd}
            {closeSide === 'end' ? (
              <button
                type="button"
                className="inline-flex min-h-touch min-w-touch items-center justify-center"
                aria-label={t('common.close')}
                onClick={onClose}
              >
                <IconClose />
              </button>
            ) : headerEnd || titleAlign === 'start' ? null : (
              <span className="inline-flex min-h-touch min-w-touch" aria-hidden />
            )}
          </div>
        </div>
        <div className="min-h-0 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
