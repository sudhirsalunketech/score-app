import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import { cn } from '@/lib/cn';
import { Input } from '@/components/ui/Input';
import { PillTabs } from '@/components/ui/Pills';
import { Spinner, ErrorRetry } from '@/components/ui/Feedback';
import { isGlobalAdmin } from '@/lib/access';
import { useAuth } from '@/context/AuthContext';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';

type Overview = {
  users: Array<{ id: string; name: string; email: string; role: string; player?: { id: string; name: string } | null }>;
  invitations: Array<{ id: string; name: string; email: string; acceptedAt?: string | null; expiresAt: string }>;
  matchAccess: Array<{ id: string; level: string; status: string; user: { name: string; email: string }; match: { title: string } }>;
  tournamentAccess: Array<{ id: string; level: string; status: string; user: { name: string; email: string }; tournament: { name: string } }>;
};

export function AccessManagementPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [tab, setTab] = useState('users');
  const [q, setQ] = useState('');
  const [role, setRole] = useState('ALL');
  const overview = useQuery({
    queryKey: keys.accessOverview,
    queryFn: () => api<Overview>('/api/v1/access/overview'),
    enabled: isGlobalAdmin(user?.role),
  });
  const needle = q.trim().toLowerCase();
  const users = useMemo(
    () =>
      (overview.data?.users ?? []).filter((u) => {
        if (role !== 'ALL' && u.role !== role) return false;
        if (!needle) return true;
        return `${u.name} ${u.email}`.toLowerCase().includes(needle);
      }),
    [overview.data?.users, needle, role],
  );

  if (!isGlobalAdmin(user?.role)) {
    return <p className="px-[var(--gutter)] py-8 text-center text-sm text-text-secondary">{t('access.deniedBody')}</p>;
  }

  if (overview.isLoading) return <Spinner />;
  if (overview.isError) return <ErrorRetry onRetry={() => void overview.refetch()} />;

  return (
    <div className="px-[var(--gutter)] py-4">
      <AdminPageHeader title={t('access.dashboard')} subtitle={`${overview.data?.users.length ?? 0} ${t('beta.users')}`} />
      <div className="rounded-card-lg border border-border bg-bg p-4 shadow-sm">
        <Input label={t('common.search')} value={q} onChange={(e) => setQ(e.target.value)} underline />
        <div className="mt-3">
          <PillTabs
            value={tab}
            onChange={setTab}
            items={[
              { id: 'users', label: t('access.myUsers') },
              { id: 'invitations', label: t('access.invitations') },
              { id: 'match', label: t('access.matchAccess') },
              { id: 'tournament', label: t('access.tournamentAccess') },
            ]}
          />
        </div>
        {tab === 'users' ? (
          <div className="mt-3">
            <select className="mb-3 min-h-touch w-full rounded-lg border border-border bg-bg px-3" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="ALL">{t('access.filterAll')}</option>
              <option value="PLAYER">{t('access.level.PLAYER')}</option>
              <option value="SCORER">{t('access.level.SCORER')}</option>
              <option value="VIEWER">{t('access.level.VIEWER')}</option>
              <option value="ADMIN">{t('access.level.MATCH_ADMIN')}</option>
            </select>
            <ul className="divide-y divide-border">
              {users.map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-3 rounded-lg py-3 hover:bg-muted">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{u.name}</p>
                    <p className="truncate text-xs text-text-secondary">
                      {u.email}
                      {u.player ? ` · ${u.player.name}` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-pill bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">{u.role}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {tab === 'invitations' ? (
          <ul className="mt-3 divide-y divide-border">
            {(overview.data?.invitations ?? []).map((inv) => (
              <li key={inv.id} className="flex items-center justify-between gap-3 rounded-lg py-3 hover:bg-muted">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{inv.name}</p>
                  <p className="truncate text-xs text-text-secondary">{inv.email}</p>
                </div>
                <span
                  className={cn(
                    'shrink-0 rounded-pill px-2 py-0.5 text-[11px] font-bold',
                    inv.acceptedAt ? 'bg-success/10 text-success' : 'bg-scoring/15 text-scoring-on',
                  )}
                >
                  {inv.acceptedAt ? t('access.active') : t('access.pending')}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        {tab === 'match' ? (
          <ul className="mt-3 divide-y divide-border">
            {(overview.data?.matchAccess ?? []).map((row) => (
              <li key={row.id} className="rounded-lg py-3 hover:bg-muted">
                <p className="font-semibold">{row.user.name}</p>
                <p className="text-xs text-text-secondary">
                  {row.match.title} · {t(`access.level.${row.level}`)} · {t(`access.status.${row.status}`)}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
        {tab === 'tournament' ? (
          <ul className="mt-3 divide-y divide-border">
            {(overview.data?.tournamentAccess ?? []).map((row) => (
              <li key={row.id} className="rounded-lg py-3 hover:bg-muted">
                <p className="font-semibold">{row.user.name}</p>
                <p className="text-xs text-text-secondary">
                  {row.tournament.name} · {t(`access.level.${row.level}`)} · {t(`access.status.${row.status}`)}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <Link to="/settings/testers" className="mt-4 block min-h-touch text-center text-sm text-primary">
        {t('beta.testers')}
      </Link>
      <Link to="/" className="mt-2 block min-h-touch text-center text-sm text-primary">
        {t('common.home')}
      </Link>
    </div>
  );
}
