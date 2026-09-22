import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { IconBack } from '@/components/ui/Icons';

export function MatchCentreHeader({
  onBack,
  end,
}: {
  onBack: () => void;
  end?: ReactNode;
}) {
  const { t } = useTranslation();

  return (
    <header className="sticky top-0 z-20 flex min-h-16 items-center border-b border-border bg-bg pt-[env(safe-area-inset-top)]">
      <button
        type="button"
        className="touch-target inline-flex shrink-0 items-center justify-center"
        aria-label={t('common.back')}
        onClick={onBack}
      >
        <IconBack />
      </button>
      <h1 className="min-w-0 flex-1 truncate text-center text-lg font-bold">{t('match.centre')}</h1>
      <div className="touch-target flex shrink-0 items-center justify-center">{end}</div>
    </header>
  );
}
