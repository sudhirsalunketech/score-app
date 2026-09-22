import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { AuthScreen } from './LoginPage';
import { resetPassword } from '@/lib/auth';
import { ApiError } from '@/lib/api';

const schema = z
  .object({
    password: z.string().min(8),
    confirm: z.string().min(8),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'mismatch' });

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { password: '', confirm: '' } });

  return (
    <AuthScreen title={t('auth.reset')} subtitle={t('auth.resetHint')}>
      {!token ? (
        <p className="text-sm text-danger">{t('auth.resetMissing')}</p>
      ) : done ? (
        <p className="text-sm text-text-secondary">{t('auth.resetDone')}</p>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={form.handleSubmit(async (v) => {
            setError(null);
            try {
              await resetPassword(token, v.password);
              setDone(true);
            } catch (e) {
              setError(e instanceof ApiError ? e.message : t('common.error'));
            }
          })}
        >
          <Input
            label={t('auth.newPassword')}
            type="password"
            autoComplete="new-password"
            underline
            {...form.register('password')}
            error={form.formState.errors.password?.message}
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
            {t('auth.resetSubmit')}
          </Button>
        </form>
      )}
      <Link to="/login" className="mt-4 block min-h-touch text-center text-sm text-primary">
        {t('auth.login')}
      </Link>
    </AuthScreen>
  );
}
