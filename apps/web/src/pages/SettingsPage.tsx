import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { setLocale, type Locale } from '@/i18n';
import { changePassword, listSessions, logoutAll, revokeSession, updateMe, type AuthSession } from '@/lib/auth';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ApiError } from '@/lib/api';
import { isGlobalAdmin } from '@/lib/access';
import { canScoreThisMatch, isLiveMatch } from '@/lib/roles';
import { api } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import type { HomeData } from '@/types/api';
import { Link } from 'react-router-dom';
import { Modal } from '@/components/ui/Modal';
import { InfoTooltip } from '@/components/ui/InfoTooltip';

const LANGS: { id: Locale; key: string }[] = [
  { id: 'en', key: 'settings.english' },
  { id: 'hi', key: 'settings.hindi' },
  { id: 'mr', key: 'settings.marathi' },
];

const pwSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8),
    confirm: z.string().min(8),
  })
  .refine((v) => v.newPassword === v.confirm, { path: ['confirm'] });

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { user, refreshUser, logout } = useAuth();
  const qc = useQueryClient();
  const current = (i18n.language?.slice(0, 2) as Locale) || 'en';
  const [pwError, setPwError] = useState<string | null>(null);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [logoutBlocked, setLogoutBlocked] = useState(false);
  const sessions = useQuery({
    queryKey: ['me-sessions'],
    queryFn: listSessions,
  });
  const home = useQuery({
    queryKey: keys.home,
    queryFn: () => api<HomeData>('/api/v1/home'),
    staleTime: 60_000,
  });
  const scoringLiveMatch = (home.data?.myMatches ?? []).some((m) => isLiveMatch(m.status) && canScoreThisMatch(user, m));
  const form = useForm({
    resolver: zodResolver(pwSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirm: '' },
  });

  const pick = async (lng: Locale) => {
    setLocale(lng);
    try {
      await updateMe({ locale: lng });
      await refreshUser();
    } catch {
      /* locale still applied locally */
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-[var(--gutter)] py-4">
      <h2 className="mb-3 font-bold">{t('settings.language')}</h2>
      <div className="flex flex-col gap-2" role="radiogroup" aria-label={t('settings.language')}>
        {LANGS.map((l) => (
          <label
            key={l.id}
            className={cn(
              'flex min-h-touch cursor-pointer items-center gap-3 rounded-card border px-4 font-semibold',
              current === l.id ? 'border-primary bg-primary-light text-primary-dark' : 'border-border',
            )}
          >
            <input
              type="radio"
              name="language"
              value={l.id}
              checked={current === l.id}
              onChange={() => void pick(l.id)}
              className="h-4 w-4 accent-primary"
            />
            {t(l.key)}
          </label>
        ))}
      </div>

      <h2 className="mb-3 mt-8 font-bold">{t('settings.password')}</h2>
      <form
        className="flex flex-col gap-3"
        onSubmit={form.handleSubmit(async (v) => {
          setPwError(null);
          try {
            await changePassword(v.currentPassword, v.newPassword);
            form.reset();
            await logout();
          } catch (e) {
            setPwError(e instanceof ApiError ? e.message : t('common.error'));
          }
        })}
      >
        <Input label={t('settings.currentPassword')} type="password" underline {...form.register('currentPassword')} />
        <Input label={t('auth.newPassword')} type="password" underline {...form.register('newPassword')} />
        <Input
          label={t('auth.confirmPassword')}
          type="password"
          underline
          {...form.register('confirm')}
          error={form.formState.errors.confirm ? t('auth.passwordMismatch') : undefined}
        />
        {pwError ? <p className="text-sm text-danger">{pwError}</p> : null}
        <p className="text-xs text-text-secondary">{t('settings.passwordChangedLogout')}</p>
        <Button type="submit" variant="primaryDark" disabled={form.formState.isSubmitting}>
          {t('settings.changePassword')}
        </Button>
      </form>

      <h2 className="mb-3 mt-8 inline-flex items-center gap-1 font-bold">
        {t('settings.security')}
        <InfoTooltip topic={t('settings.logoutAll')}>{t('info.settings.logoutAll')}</InfoTooltip>
      </h2>
      <h3 className="mb-2 text-sm font-semibold">{t('settings.sessions')}</h3>
      <ul className="mb-4 divide-y divide-border rounded-card border border-border">
        {(sessions.data ?? []).map((row: AuthSession) => (
          <li key={row.id} className="flex items-center justify-between gap-3 px-3 py-3">
            <div className="min-w-0">
              <p className="font-semibold">{row.current ? t('settings.thisDevice') : t('settings.otherSession')}</p>
              <p className="text-xs text-text-secondary">
                {[row.device, row.browser].filter(Boolean).join(' · ') || t('settings.otherSession')}
              </p>
              <p className="text-xs text-text-secondary">
                {t('settings.lastActive')}: {new Date(row.lastActiveAt ?? row.createdAt).toLocaleString()}
              </p>
            </div>
            <Button
              variant="outline"
              className="shrink-0"
              onClick={async () => {
                await revokeSession(row.id);
                if (row.current) {
                  await logout();
                  return;
                }
                await qc.invalidateQueries({ queryKey: ['me-sessions'] });
              }}
            >
              {t('settings.logoutDevice')}
            </Button>
          </li>
        ))}
        {!sessions.data?.length && !sessions.isLoading ? (
          <li className="px-3 py-3 text-sm text-text-secondary">{t('settings.noSessions')}</li>
        ) : null}
      </ul>
      <Button variant="outline" className="w-full" onClick={() => (scoringLiveMatch ? setLogoutBlocked(true) : setLogoutOpen(true))}>
        {t('settings.logoutAll')}
      </Button>
      <Modal open={logoutOpen} title={t('settings.logoutAll')} onClose={() => setLogoutOpen(false)}>
        <p className="mb-4 text-sm text-text-secondary">{t('info.settings.logoutAll')}</p>
        <div className="flex gap-2">
          <Button className="flex-1" variant="outline" onClick={() => setLogoutOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            className="flex-1"
            variant="danger"
            onClick={async () => {
              setLogoutOpen(false);
              if (scoringLiveMatch) {
                setLogoutBlocked(true);
                return;
              }
              await logoutAll();
              await logout();
            }}
          >
            {t('settings.logoutAll')}
          </Button>
        </div>
      </Modal>
      <Modal open={logoutBlocked} title={t('auth.logoutBlockedTitle')} onClose={() => setLogoutBlocked(false)}>
        <p className="mb-4 text-sm text-text-secondary">{t('auth.logoutBlockedBody')}</p>
        <Button className="w-full" variant="primaryDark" onClick={() => setLogoutBlocked(false)}>
          {t('info.gotIt')}
        </Button>
      </Modal>
      {isGlobalAdmin(user?.role) ? (
        <div className="mt-8 flex flex-col gap-2">
          <h2 className="mb-1 inline-flex items-center gap-1 font-bold">
            {t('beta.users')}
            <InfoTooltip topic={t('beta.users')}>{t('info.beta.testers')}</InfoTooltip>
          </h2>
          <Link to="/settings/testers" className="min-h-touch font-semibold text-primary">
            {t('beta.testers')}
          </Link>
          <Link to="/settings/feedback" className="min-h-touch font-semibold text-primary">
            {t('beta.feedback')}
          </Link>
          <Link to="/access" className="min-h-touch font-semibold text-primary">
            {t('access.dashboard')}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
