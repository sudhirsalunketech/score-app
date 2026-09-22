import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorRetry, PageSkeleton } from '@/components/ui/Feedback';

type Note = {
  id: string;
  type: string;
  title: string;
  body: string;
  link?: string | null;
  readAt?: string | null;
  createdAt: string;
};

type Inbox = {
  unread: number;
  channels: Record<string, { configured: boolean; note?: string | null }>;
  items: Note[];
};

export function NotificationsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: keys.notifications, queryFn: () => api<Inbox>('/api/v1/notifications') });
  const readAll = useMutation({
    mutationFn: () => api('/api/v1/notifications/read-all', { method: 'POST' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.notifications }),
  });
  const readOne = useMutation({
    mutationFn: (id: string) => api(`/api/v1/notifications/${id}/read`, { method: 'PATCH' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.notifications }),
  });

  if (q.isLoading) return <PageSkeleton />;
  if (q.isError) return <ErrorRetry onRetry={() => void q.refetch()} />;
  const data = q.data!;

  return (
    <div className="px-[var(--gutter)] py-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h1 className="page-title">{t('notifications.title')}</h1>
        {data.items.some((n) => !n.readAt) ? (
          <Button variant="outline" onClick={() => readAll.mutate()} disabled={readAll.isPending}>
            {t('notifications.markAll')}
          </Button>
        ) : null}
      </div>
      {!data.channels.EMAIL?.configured ? (
        <p className="mb-3 rounded-card bg-muted px-3 py-2 text-sm text-text-secondary">{t('notifications.emailNotConfigured')}</p>
      ) : null}
      {!data.channels.PUSH?.configured ? (
        <p className="mb-3 text-xs text-text-secondary">{t('notifications.pushNotConfigured')}</p>
      ) : null}
      {!data.items.length ? <EmptyState title={t('notifications.empty')} /> : null}
      <ul className="divide-y divide-border rounded-card border border-border">
        {data.items.map((row) => (
          <li key={row.id} className={`px-3 py-3 ${row.readAt ? '' : 'bg-primary-light'}`}>
            <p className="text-xs font-bold uppercase text-primary">{t(`notifications.type.${row.type}`, { defaultValue: row.type })}</p>
            <p className="font-semibold">{row.title}</p>
            <p className="text-sm text-text-secondary">{row.body}</p>
            <div className="mt-2 flex gap-2">
              {row.link ? (
                <Link to={row.link} className="text-sm font-bold text-primary" onClick={() => readOne.mutate(row.id)}>
                  {t('notifications.open')}
                </Link>
              ) : null}
              {!row.readAt ? (
                <button type="button" className="text-sm font-semibold" onClick={() => readOne.mutate(row.id)}>
                  {t('notifications.markRead')}
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
