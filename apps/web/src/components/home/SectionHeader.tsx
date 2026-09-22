import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { IconChevron } from '@/components/ui/Icons';

export function SectionHeader({ title, to, info }: { title: string; to?: string; info?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="mb-3 flex items-center justify-between px-[var(--gutter)]">
      <h2 className="inline-flex items-center gap-1 text-xl font-bold">
        {title}
        {info}
      </h2>
      {to ? (
        <Link to={to} className="inline-flex min-h-touch items-center text-text-secondary" aria-label={t('common.viewAll')}>
          <IconChevron />
          <IconChevron className="-ms-3" />
        </Link>
      ) : null}
    </div>
  );
}
