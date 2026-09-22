import { useTranslation } from 'react-i18next';
import { IconClose } from '@/components/ui/Icons';
import { cn } from '@/lib/cn';

export function PopupHeader({
  title,
  titleId,
  onClose,
  dark,
  titleClassName,
}: {
  title: string;
  titleId?: string;
  onClose: () => void;
  dark?: boolean;
  titleClassName?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        className={cn(
          'inline-flex min-h-touch min-w-touch shrink-0 items-center justify-center rounded-full',
          dark ? 'text-white/80 hover:bg-white/10 hover:text-white' : 'text-text-secondary hover:bg-muted hover:text-text',
        )}
        aria-label={t('common.close')}
        onClick={onClose}
      >
        <IconClose />
      </button>
      <h2
        id={titleId}
        className={cn('min-w-0 flex-1 text-start text-base font-bold', dark && 'font-medium text-white/80', titleClassName)}
      >
        {title}
      </h2>
    </div>
  );
}
