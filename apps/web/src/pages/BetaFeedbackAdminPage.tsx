import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import { cn } from '@/lib/cn';
import { isGlobalAdmin } from '@/lib/access';
import { useAuth } from '@/context/AuthContext';
import { ErrorRetry, Spinner } from '@/components/ui/Feedback';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';

type Feedback = {
  id: string;
  title: string;
  description: string;
  screen?: string | null;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  createdAt: string;
  user: { name: string; email: string };
};

const STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED'] as const;

const SEVERITY_TONE: Record<Feedback['severity'], string> = {
  LOW: 'bg-muted text-text-secondary',
  MEDIUM: 'bg-scoring/15 text-scoring-on',
  HIGH: 'bg-danger/10 text-danger',
  CRITICAL: 'bg-danger text-on-dark',
};

export function BetaFeedbackAdminPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: keys.betaFeedback,
    queryFn: () => api<Feedback[]>('/api/v1/beta/feedback'),
    enabled: isGlobalAdmin(user?.role),
  });
  const patch = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Feedback['status'] }) =>
      api(`/api/v1/beta/feedback/${id}`, { method: 'PATCH', body: { status } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.betaFeedback }),
  });

  if (!isGlobalAdmin(user?.role)) {
    return <p className="px-[var(--gutter)] py-8 text-center text-sm text-text-secondary">{t('access.deniedBody')}</p>;
  }
  if (list.isLoading) return <Spinner />;
  if (list.isError) return <ErrorRetry onRetry={() => void list.refetch()} />;

  const open = (list.data ?? []).filter((row) => row.status !== 'RESOLVED').length;

  return (
    <div className="px-[var(--gutter)] py-4">
      <AdminPageHeader title={t('beta.feedback')} subtitle={`${open} ${t('beta.feedbackStatus.OPEN').toLowerCase()}`} />
      <ul className="divide-y divide-border rounded-card-lg border border-border bg-bg p-4 shadow-sm">
        {(list.data ?? []).map((row) => (
          <li key={row.id} className="py-3 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="font-semibold">{row.title}</p>
              <span className={cn('shrink-0 rounded-pill px-2 py-0.5 text-[11px] font-bold', SEVERITY_TONE[row.severity])}>
                {t(`beta.severityLevel.${row.severity}`)}
              </span>
            </div>
            <p className="text-xs text-text-secondary">
              {row.user.name} · {row.screen ?? '—'}
            </p>
            <p className="mt-1 text-sm">{row.description}</p>
            <select
              className="mt-2 min-h-touch w-full rounded-lg border border-border bg-bg px-3 text-sm"
              value={row.status}
              onChange={(e) => patch.mutate({ id: row.id, status: e.target.value as Feedback['status'] })}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`beta.feedbackStatus.${s}`)}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
    </div>
  );
}
