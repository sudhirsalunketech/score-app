import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { Input } from '@/components/ui/Input';
import { IconBack, IconEye, IconEyeOff } from '@/components/ui/Icons';
import { LoginArtPanel } from '@/components/auth/LoginArtPanel';
import { PillButton, LiveScoringBadge } from './LoginPage';
import { ApiError } from '@/lib/api';

const schema = z
  .object({
    name: z.string().min(2),
    email: z.string().email(),
    phone: z.string().max(20).optional(),
    password: z.string().min(8),
    confirmPassword: z.string().min(8),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], message: 'mismatch' });

type Values = z.infer<typeof schema>;

export function RegisterPage() {
  const { t } = useTranslation();
  const { register: doRegister } = useAuth();
  const nav = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', phone: '', password: '', confirmPassword: '' },
  });

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

      <h1 className="mt-8 font-display text-[2.25rem] font-semibold leading-none lg:text-[2.75rem]">{t('auth.registerTitle')}</h1>

      <form
        className="mt-10 flex flex-1 flex-col gap-4"
        onSubmit={form.handleSubmit(async (v) => {
          setError(null);
          try {
            await doRegister(v.email, v.password, v.name, v.phone);
            nav('/', { replace: true });
          } catch (e) {
            setError(e instanceof ApiError ? e.message : t('common.error'));
          }
        })}
      >
        <Input label={t('auth.name')} {...form.register('name')} error={form.formState.errors.name?.message} />
        <Input label={t('common.email')} type="email" autoComplete="username" {...form.register('email')} error={form.formState.errors.email?.message} />
        <Input
          label={t('auth.mobileOptional')}
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          {...form.register('phone')}
          error={form.formState.errors.phone?.message}
        />
        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold" htmlFor="register-password">
            {t('common.password')}
          </label>
          <div className="relative">
            <Input
              id="register-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
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
        <div className="flex flex-col gap-1">
          <label className="text-sm font-semibold" htmlFor="register-confirm-password">
            {t('auth.confirmPassword')}
          </label>
          <div className="relative">
            <Input
              id="register-confirm-password"
              type={showConfirm ? 'text' : 'password'}
              autoComplete="new-password"
              className="pr-10"
              {...form.register('confirmPassword')}
              error={form.formState.errors.confirmPassword ? t('auth.passwordMismatch') : undefined}
            />
            <button
              type="button"
              className="touch-target absolute right-2 top-1/2 inline-flex -translate-y-1/2 items-center justify-center text-text-secondary"
              aria-label={showConfirm ? t('auth.hidePassword') : t('auth.showPassword')}
              onClick={() => setShowConfirm((v) => !v)}
            >
              {showConfirm ? <IconEyeOff size={20} /> : <IconEye size={20} />}
            </button>
          </div>
        </div>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <PillButton disabled={form.formState.isSubmitting}>{t('auth.submitRegister')}</PillButton>
      </form>

      <div className="mt-auto pt-10 text-center">
        <p className="mt-4 text-sm text-text-secondary">
          {t('auth.haveAccount')}{' '}
          <Link to="/login" className="font-semibold text-primary">
            {t('auth.login')}
          </Link>
        </p>
      </div>
      </div>
      </div>
    </div>
  );
}
