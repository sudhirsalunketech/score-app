import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import { cn } from '@/lib/cn';
import { isGlobalAdmin } from '@/lib/access';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { ErrorRetry, Spinner } from '@/components/ui/Feedback';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import type { Match, Tournament } from '@/types/api';

type Tester = {
  id: string;
  userId: string | null;
  invitationId: string | null;
  name: string;
  email: string;
  role: string;
  status: 'INVITED' | 'ACTIVE' | 'DISABLED';
  matchesAssigned: Array<{ id: string; title: string }>;
  lastLoginAt: string | null;
  expiresAt: string | null;
};

const STATUS_TONE: Record<Tester['status'], string> = {
  ACTIVE: 'bg-success/10 text-success',
  INVITED: 'bg-scoring/15 text-scoring-on',
  DISABLED: 'bg-danger/10 text-danger',
};

const USER_TYPES = ['PLAYER', 'SCORER', 'MATCH_ADMIN', 'VIEWER'] as const;

export function BetaTestersPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [userType, setUserType] = useState<(typeof USER_TYPES)[number]>('SCORER');
  const [tournamentId, setTournamentId] = useState('');
  const [matchId, setMatchId] = useState('');
  const testers = useQuery({
    queryKey: keys.betaTesters,
    queryFn: () => api<Tester[]>('/api/v1/beta/testers'),
    enabled: isGlobalAdmin(user?.role),
  });
  const tournaments = useQuery({
    queryKey: keys.tournaments,
    queryFn: () => api<Tournament[]>('/api/v1/tournaments'),
    enabled: open,
  });
  const matches = useQuery({
    queryKey: keys.matches,
    queryFn: () => api<Match[]>('/api/v1/matches'),
    enabled: open,
  });
  const invite = useMutation({
    mutationFn: () =>
      api<{ invited?: boolean; granted?: boolean; inviteUrl?: string }>('/api/v1/beta/testers/invite', {
        method: 'POST',
        body: {
          name,
          email,
          userType,
          tournamentId: tournamentId || undefined,
          matchId: matchId || undefined,
        },
      }),
    onSuccess: (data) => {
      setInviteUrl(data.inviteUrl ?? null);
      setError(null);
      void qc.invalidateQueries({ queryKey: keys.betaTesters });
      if (data.granted) setOpen(false);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : t('common.error')),
  });
  const disable = useMutation({
    mutationFn: (id: string) => api(`/api/v1/beta/testers/${id}/disable`, { method: 'POST' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.betaTesters }),
  });
  const enable = useMutation({
    mutationFn: (id: string) => api(`/api/v1/beta/testers/${id}/enable`, { method: 'POST' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.betaTesters }),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => api(`/api/v1/beta/invitations/${id}/revoke`, { method: 'POST' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.betaTesters }),
  });
  const rows = useMemo(() => testers.data ?? [], [testers.data]);

  if (!isGlobalAdmin(user?.role)) {
    return <p className="px-[var(--gutter)] py-8 text-center text-sm text-text-secondary">{t('access.deniedBody')}</p>;
  }
  if (testers.isLoading) return <Spinner />;
  if (testers.isError) return <ErrorRetry onRetry={() => void testers.refetch()} />;

  return (
    <div className="px-[var(--gutter)] py-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <AdminPageHeader
        title={t('beta.testers')}
        subtitle={`${rows.length} ${t('beta.users').toLowerCase()}`}
        info={<InfoTooltip topic={t('beta.testers')}>{t('info.beta.testers')}</InfoTooltip>}
        action={
          <Button
            variant="scoring"
            onClick={() => {
              setOpen(true);
              setInviteUrl(null);
              setError(null);
              setName('');
              setEmail('');
            }}
          >
            + {t('beta.inviteTester')}
          </Button>
        }
      />
      <ul className="divide-y divide-border rounded-card-lg border border-border bg-bg p-4 shadow-sm">
        {rows.map((row) => (
          <li key={row.id} className="py-3 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold">{row.name}</p>
                <p className="text-xs text-text-secondary">{row.email}</p>
              </div>
              <span className={cn('shrink-0 rounded-pill px-2 py-0.5 text-[11px] font-bold', STATUS_TONE[row.status])}>
                {t(`beta.status.${row.status}`)}
              </span>
            </div>
            <p className="mt-1 text-xs text-text-secondary">
              {row.role} · {t('beta.matchesAssigned')}: {row.matchesAssigned.length}
            </p>
            <p className="text-xs text-text-secondary">
              {t('beta.lastLogin')}: {row.lastLoginAt ? new Date(row.lastLoginAt).toLocaleString() : t('beta.never')}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {row.userId && row.status !== 'DISABLED' ? (
                <Button variant="outline" className="text-xs" onClick={() => disable.mutate(row.userId!)}>
                  {t('beta.disable')}
                </Button>
              ) : null}
              {row.userId && row.status === 'DISABLED' ? (
                <Button variant="outline" className="text-xs" onClick={() => enable.mutate(row.userId!)}>
                  {t('beta.enable')}
                </Button>
              ) : null}
              {row.invitationId && row.status === 'INVITED' ? (
                <Button variant="outline" className="text-xs" onClick={() => revoke.mutate(row.invitationId!)}>
                  {t('beta.revokeInvite')}
                </Button>
              ) : null}
              {row.userId ? (
                <Link to="/access" className="min-h-touch text-xs font-semibold text-primary">
                  {t('access.manageAccess')}
                </Link>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      <BottomSheet open={open} title={t('beta.inviteTester')} onClose={() => setOpen(false)} orange={false}>
        {inviteUrl ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm">{t('access.inviteCopy')}</p>
            <p className="break-all rounded-lg border border-border p-2 text-xs">{inviteUrl}</p>
            <Button
              variant="primaryDark"
              onClick={() => {
                void navigator.clipboard.writeText(inviteUrl);
              }}
            >
              {t('live.copyLink')}
            </Button>
          </div>
        ) : (
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              invite.mutate();
            }}
          >
            <Input label={t('common.name')} value={name} onChange={(e) => setName(e.target.value)} underline required />
            <Input label={t('common.email')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} underline required />
            <label className="text-sm font-semibold">
              {t('beta.userType')}
              <select
                className="mt-1 min-h-touch w-full rounded-lg border border-border bg-bg px-3 font-normal"
                value={userType}
                onChange={(e) => setUserType(e.target.value as (typeof USER_TYPES)[number])}
              >
                {USER_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`access.level.${type}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold">
              {t('beta.assignTournament')}
              <select
                className="mt-1 min-h-touch w-full rounded-lg border border-border bg-bg px-3 font-normal"
                value={tournamentId}
                onChange={(e) => setTournamentId(e.target.value)}
              >
                <option value="">{t('access.optional')}</option>
                {(tournaments.data ?? []).map((tn) => (
                  <option key={tn.id} value={tn.id}>
                    {tn.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold">
              {t('beta.assignMatch')}
              <select
                className="mt-1 min-h-touch w-full rounded-lg border border-border bg-bg px-3 font-normal"
                value={matchId}
                onChange={(e) => setMatchId(e.target.value)}
              >
                <option value="">{t('access.optional')}</option>
                {(matches.data ?? []).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>
            </label>
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <Button type="submit" variant="primaryDark" disabled={invite.isPending}>
              {t('access.sendInvite')}
            </Button>
          </form>
        )}
      </BottomSheet>
    </div>
  );
}
