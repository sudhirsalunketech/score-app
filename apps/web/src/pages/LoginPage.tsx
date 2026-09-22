import { useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { Input } from '@/components/ui/Input';
import { ApiError } from '@/lib/api';
import { BetaBadge } from '@/components/beta/BetaBadge';
import { IconArrowRight, IconBack, IconEye, IconEyeOff } from '@/components/ui/Icons';
import { LoginArtPanel } from '@/components/auth/LoginArtPanel';

const passwordSchema = z.object({
  identifier: z.string().min(3),
  password: z.string().min(1),
});

type PasswordValues = z.infer<typeof passwordSchema>;

/** Pill-shaped primary CTA with a circular arrow, matching the reference design. Accessible name stays exactly `children` since the icon is aria-hidden. */
export function PillButton({ children, disabled, type = 'submit', onClick }: { children: ReactNode; disabled?: boolean; type?: 'submit' | 'button'; onClick?: () => void }) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="relative flex min-h-touch w-full items-center justify-center rounded-full bg-scoring py-3.5 text-base font-bold uppercase tracking-wide text-scoring-on disabled:opacity-50"
    >
      {children}
      <span className="absolute inset-y-1.5 right-1.5 flex aspect-square items-center justify-center rounded-full bg-scoring-on/15">
        <IconArrowRight size={18} />
      </span>
    </button>
  );
}

/** Small brand chip echoing the app's live-scoring identity, shown beside the back button. */
export function LiveScoringBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-dark-chrome px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-on-dark">
      <span className="h-1.5 w-1.5 rounded-full bg-live cs-live-dot" />
      Live scoring
    </span>
  );
}

export function LoginPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [params] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const form = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema), defaultValues: { identifier: '', password: '' } });
  const nextRaw = params.get('next') || (loc.state as { from?: string } | null)?.from || '/';
  const next = nextRaw.startsWith('/') && !nextRaw.startsWith('//') ? nextRaw : '/';
  const expired = params.get('expired') === '1' || sessionStorage.getItem('cs.sessionExpired') === '1';

  const goNext = next.length > 1 ? next : '/';

  return (
    <div className="lg:flex lg:min-h-dvh">
      <LoginArtPanel />
      <div className="lg:flex-1 lg:overflow-y-auto lg:bg-bg">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-bg px-6 pb-10 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="touch-target -ms-2 inline-flex w-fit items-center justify-center"
          aria-label={t('common.back')}
          onClick={() => nav(-1)}
        >
          <IconBack />
        </button>
        <LiveScoringBadge />
      </div>

      <h1 className="mt-8 font-display text-[2.25rem] font-semibold leading-none lg:text-[2.75rem]">{t('auth.loginTitle')}</h1>
      {expired ? <p className="mt-3 text-sm text-danger">{t('auth.sessionExpired')}</p> : null}

      <form
        className="mt-10 flex flex-1 flex-col gap-4"
        onSubmit={form.handleSubmit(async (v) => {
          setError(null);
          try {
            sessionStorage.removeItem('cs.sessionExpired');
            await login(v.identifier, v.password);
            nav(goNext, { replace: true });
          } catch (e) {
            setError(e instanceof ApiError ? e.message : t('common.error'));
          }
        })}
      >
        <Input label={t('auth.emailOrMobile')} type="text" autoComplete="username" {...form.register('identifier')} error={form.formState.errors.identifier?.message} />
        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold" htmlFor="login-password">
            {t('common.password')}
          </label>
          <div className="relative">
            <Input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder={t('auth.passwordPlaceholder')}
              className="pr-10"
              {...form.register('password')}
              error={form.formState.errors.password?.message}
            />
            <button
              type="button"
              className="touch-target absolute right-2 top-1/2 inline-flex -translate-y-1/2 items-center justify-center text-text-secondary"
              aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? <IconEyeOff size={20} /> : <IconEye size={20} />}
            </button>
          </div>
        </div>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <PillButton disabled={form.formState.isSubmitting}>{t('auth.submitLogin')}</PillButton>
        <Link to="/forgot" className="min-h-touch text-center text-sm text-primary">
          {t('auth.forgotLink')}
        </Link>
      </form>

      <div className="mt-auto pt-10 text-center">
        <p className="mt-4 text-sm text-text-secondary">
          {t('auth.noAccount')}{' '}
          <Link to="/register" className="font-semibold text-primary">
            {t('auth.createAccount')}
          </Link>
        </p>
      </div>
      </div>
      </div>
    </div>
  );
}

export function AuthScreen({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-8">
        <p className="text-sm font-bold uppercase tracking-widest text-primary">
          {t('common.appName')} <BetaBadge />
        </p>
        <h1 className="mt-2 text-3xl font-bold">{title}</h1>
        {subtitle ? <p className="mt-1 text-text-secondary">{subtitle}</p> : null}
      </div>
      {children}
    </div>
  );
}
