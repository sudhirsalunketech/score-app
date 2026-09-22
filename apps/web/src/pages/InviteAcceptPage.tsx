import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import { persistTokens } from '@/lib/auth';
import { useAuth } from '@/context/AuthContext';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { AuthScreen } from './LoginPage';
import type { AuthPayload } from '@/types/api';

const schema = z
  .object({
    password: z.string().min(8),
    confirm: z.string().min(8),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'mismatch' });

export function InviteAcceptPage() {
  const { token = '' } = useParams();
  const { t } = useTranslation();
  const nav = useNavigate();
  const { refreshUser } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const peek = useQuery({
    queryKey: keys.invitePeek(token),
    queryFn: () => api<{ name: string; email: string; playerName: string; expiresAt: string; kind?: string }>(`/api/v1/invitations/${token}`, { auth: false }),
    enabled: Boolean(token),
    retry: false,
  });
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { password: '', confirm: '' } });

  return (
    <AuthScreen title={peek.data?.kind === 'BETA' ? t('beta.acceptTitle') : t('access.acceptInvite')} subtitle={peek.data?.playerName ?? peek.data?.name}>
      {!token || peek.isError ? (
        <p className="text-sm text-danger">{t('access.inviteMissing')}</p>
      ) : peek.isLoading ? (
        <p className="text-sm text-text-secondary">{t('common.loading')}</p>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={form.handleSubmit(async (v) => {
            setError(null);
            try {
              const data = await api<AuthPayload & { matchId?: string | null }>(`/api/v1/invitations/${token}/accept`, {
                method: 'POST',
                body: { password: v.password },
                auth: false,
              });
              persistTokens(data.accessToken, data.refreshToken);
              await refreshUser();
              nav('/', { replace: true });
            } catch (e) {
              setError(e instanceof ApiError ? e.message : t('common.error'));
            }
          })}
        >
          <p className="text-sm text-text-secondary">{peek.data?.email}</p>
          <Input
            label={t('auth.newPassword')}
            type="password"
            autoComplete="new-password"
            underline
            {...form.register('password')}
          />
          <Input
            label={t('auth.confirmPassword')}
            type="password"
            autoComplete="new-password"
            underline
            {...form.register('confirm')}
            error={form.formState.errors.confirm ? t('auth.passwordMismatch') : undefined}
          />
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button type="submit" variant="primaryDark" disabled={form.formState.isSubmitting}>
            {t('access.acceptSubmit')}
          </Button>
        </form>
      )}
      <Link to="/login" className="mt-4 block min-h-touch text-center text-sm text-primary">
        {t('auth.login')}
      </Link>
    </AuthScreen>
  );
}
