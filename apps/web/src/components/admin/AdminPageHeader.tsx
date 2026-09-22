import type { ReactNode } from 'react';

/** Shared header for the admin-only pages (Access, Beta Testers, Beta Feedback) — title + subtitle + optional CTA. */
export function AdminPageHeader({
  title,
  subtitle,
  action,
  info,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  info?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="inline-flex items-center gap-1 text-xl font-bold text-text md:text-2xl">
          {title}
          {info}
        </h1>
        {subtitle ? <p className="mt-1 text-sm text-text-secondary">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
