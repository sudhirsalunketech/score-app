import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { AuthScreen } from './LoginPage';
import { forgotPassword } from '@/lib/auth';
import { ApiError } from '@/lib/api';

const schema = z.object({ email: z.string().email() });

export function ForgotPage() {
  const { t } = useTranslation();
  const [sent, setSent] = useState(false);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<{ email: string }>({ resolver: zodResolver(schema), defaultValues: { email: '' } });

  return (
    <AuthScreen title={t('auth.forgot')}>
      {sent ? (
        <div className="text-sm text-text-secondary">
          <p>{t('auth.sent')}</p>
          {devResetUrl ? (
            <p className="mt-3">
              <Link to={devResetUrl.replace(/^https?:\/\/[^/]+/, '')} className="font-semibold text-primary">
                {t('auth.devResetLink')}
              </Link>
            </p>
          ) : null}
        </div>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={form.handleSubmit(async (v) => {
            setError(null);
            try {
              const res = await forgotPassword(v.email);
              setDevResetUrl(res.devResetUrl ?? null);
              setSent(true);
            } catch (e) {
              setError(e instanceof ApiError ? e.message : t('common.error'));
            }
          })}
        >
          <Input label={t('common.email')} type="email" underline {...form.register('email')} error={form.formState.errors.email?.message} />
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button type="submit" variant="primaryDark" disabled={form.formState.isSubmitting}>
            {t('auth.submitForgot')}
          </Button>
        </form>
      )}
      <Link to="/login" className="mt-4 block min-h-touch text-center text-sm text-primary">
        {t('auth.login')}
      </Link>
    </AuthScreen>
  );
}
