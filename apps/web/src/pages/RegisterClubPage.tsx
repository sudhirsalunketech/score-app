import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import { cn } from '@/lib/cn';
import { BALL_TYPES, clubBallLabelKey } from '@/lib/ball-type';
import { clubRegisterSchema, CURRENT_YEAR, ESTABLISHED_YEARS, type ClubRegisterValues } from '@/lib/club-register';
import type { Club } from '@/types/api';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { IconBack } from '@/components/ui/Icons';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { ClubLogoField } from '@/components/clubs/ClubLogoField';

export function RegisterClubPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const qc = useQueryClient();
  const dark = false;
  const [logoBusy, setLogoBusy] = useState(false);
  const form = useForm<ClubRegisterValues>({
    resolver: zodResolver(clubRegisterSchema),
    mode: 'onTouched',
    defaultValues: {
      name: '',
      city: '',
      establishedYear: CURRENT_YEAR,
      logoUrl: '',
      ballTypes: ['TENNIS'],
    },
  });
  const selected = form.watch('ballTypes')[0];
  const create = useMutation({
    mutationFn: (v: ClubRegisterValues) =>
      api<Club>('/api/v1/clubs', {
        method: 'POST',
        body: { ...v, logoUrl: v.logoUrl || undefined },
      }),
    onSuccess: (club) => {
      qc.setQueryData(keys.club(club.id), club);
      qc.setQueryData(keys.clubs, (old: Club[] | undefined) => {
        const list = old ?? [];
        return list.some((row) => row.id === club.id) ? list : [...list, club];
      });
      void qc.invalidateQueries({ queryKey: keys.clubs });
      nav(`/clubs/${club.id}`, { replace: true });
    },
  });
  const submitting = create.isPending || logoBusy;

  return (
    <div className={cn('flex min-h-dvh flex-col', dark ? 'bg-dark-chrome text-on-dark' : 'bg-bg text-text')}>
      <header className={cn('sticky top-0 z-10 flex min-h-14 items-center gap-1 px-4 pt-[env(safe-area-inset-top)]', dark ? 'bg-dark-chrome' : 'bg-bg')}>
        <button
          type="button"
          className="touch-target -ms-2 inline-flex items-center justify-center md:hidden"
          aria-label={t('common.back')}
          onClick={() => nav(-1)}
        >
          <IconBack />
        </button>
        <h1 className="text-lg font-bold">{t('clubs.register')}</h1>
      </header>

      <div className="mx-auto w-[calc(100%-2rem)] max-w-[42rem] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <p className="mt-4 text-lg font-semibold leading-snug">{t('clubs.prompt')}</p>
        <p className={cn('mt-2 text-sm leading-relaxed', dark ? 'text-on-dark/65' : 'text-text-secondary')}>{t('clubs.description')}</p>

        <form
          className="mt-6 flex flex-col gap-6"
          aria-busy={submitting}
          onSubmit={form.handleSubmit((v) => {
            if (submitting) return;
            create.mutate(v);
          })}
        >
          <section>
            <h2 className={cn('mb-3 text-sm font-bold uppercase tracking-wide', dark ? 'text-gold' : 'text-primary')}>{t('clubs.clubLogo')}</h2>
            <ClubLogoField
              dark={dark}
              value={form.watch('logoUrl')}
              onChange={(url) => form.setValue('logoUrl', url, { shouldValidate: true })}
              onBusyChange={setLogoBusy}
            />
            {form.formState.errors.logoUrl ? (
              <p className="mt-2 text-center text-xs text-danger" role="alert">
                {form.formState.errors.logoUrl.message}
              </p>
            ) : null}
          </section>

          <section>
            <h2 className={cn('mb-4 border-b pb-2 text-sm font-bold uppercase tracking-wide', dark ? 'border-gold/35 text-gold' : 'border-border text-primary')}>
              {t('clubs.sectionInfo')}
            </h2>
            <div className="flex flex-col gap-5">
              <Input
                dark={dark}
                underline
                requiredMark
                autoComplete="organization"
                label={t('clubs.clubName')}
                {...form.register('name')}
                error={form.formState.errors.name?.message}
              />
              <Input
                dark={dark}
                underline
                requiredMark
                autoComplete="address-level2"
                label={t('clubs.city')}
                {...form.register('city')}
                error={form.formState.errors.city?.message}
              />
              <Select
                dark={dark}
                underline
                requiredMark
                label={t('clubs.established')}
                info={t('info.club.established')}
                {...form.register('establishedYear')}
                error={form.formState.errors.establishedYear?.message}
              >
                {ESTABLISHED_YEARS.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </Select>
            </div>
          </section>

          <section>
            <h2
              id="club-ball-type"
              className={cn('mb-3 inline-flex items-center gap-1 text-sm font-bold uppercase tracking-wide', dark ? 'text-gold' : 'text-primary')}
            >
              {t('clubs.ballTypeLabel')}
              <InfoTooltip topic={t('clubs.ballTypeLabel')} dark={dark}>
                {t('info.club.ballTypes')}
              </InfoTooltip>
            </h2>
            <div role="radiogroup" aria-labelledby="club-ball-type" className="flex flex-wrap gap-3">
              {BALL_TYPES.map((type) => {
                const active = selected === type;
                return (
                  <button
                    key={type}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => form.setValue('ballTypes', [type], { shouldValidate: true })}
                    className={cn(
                      'min-h-touch rounded-pill border px-4 text-sm font-semibold',
                      active
                        ? 'border-gold bg-gold text-dark-chrome'
                        : dark
                          ? 'border-white/45 bg-transparent text-on-dark'
                          : 'border-border bg-transparent text-text',
                    )}
                  >
                    {t(clubBallLabelKey(type))}
                  </button>
                );
              })}
            </div>
            {form.formState.errors.ballTypes ? (
              <p className="mt-2 text-xs text-danger" role="alert">
                {t('clubs.ballTypesRequired')}
              </p>
            ) : null}
          </section>

          {create.isError ? (
            <p className="text-sm text-danger" role="alert">
              {create.error.message}
            </p>
          ) : null}

          <Button type="submit" variant="gold" className="h-[52px] w-full" disabled={submitting}>
            {create.isPending ? t('clubs.submitting') : t('clubs.submit')}
          </Button>
        </form>
      </div>
    </div>
  );
}
