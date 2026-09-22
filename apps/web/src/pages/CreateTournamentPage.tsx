import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import { cn } from '@/lib/cn';
import type { Club, Tournament, TournamentRuleDto } from '@/types/api';
import { Input, NumericInput, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { IconBack } from '@/components/ui/Icons';
import { QuizList } from '@/components/fans/QuizList';
import { ClubLogoField } from '@/components/clubs/ClubLogoField';
import { SeasonYearPicker } from '@/components/ui/SeasonYearPicker';
import { quizListPayload, type FanQuizForm } from '@/lib/fan-quiz';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { StreakBonusFields, HattrickFields, presetRules, type StreakBonusDraft, type HattrickDraft } from '@/components/tournament/RulePresetFields';
import { OverRuleTemplateFields, overRuleTemplatePayload, type OverRuleTemplateRow } from '@/components/tournament/OverRuleTemplateFields';
import {
  quizzesStepError,
  todayIsoDate,
  tournamentCreateDefaults,
  tournamentCreateSchema,
  type TournamentCreateValues,
} from '@/lib/tournament-create';

async function applyPresetRules(tournamentId: string, rules: Omit<TournamentRuleDto, 'id'>[]) {
  if (!rules.length) return;
  const created = await api<{ version: number }>(`/api/v1/tournaments/${tournamentId}/rulesets`, { method: 'POST' });
  await api(`/api/v1/tournaments/${tournamentId}/rulesets/${created.version}`, { method: 'PUT', body: { rules } });
  await api(`/api/v1/tournaments/${tournamentId}/rulesets/${created.version}/activate`, { method: 'POST', body: { enabled: true } });
}

export function CreateTournamentPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const dark = false;
  const [quizEnabled, setQuizEnabled] = useState(false);
  const [quizzes, setQuizzes] = useState<FanQuizForm[]>([]);
  const [quizErrors, setQuizErrors] = useState<Record<number, string>>({});
  const [logoBusy, setLogoBusy] = useState(false);
  const [winningBonusPoints, setWinningBonusPoints] = useState('');
  const [foursStreak, setFoursStreak] = useState<StreakBonusDraft>({ enabled: false, runs: '5' });
  const [sixesStreak, setSixesStreak] = useState<StreakBonusDraft>({ enabled: false, runs: '5' });
  const [hattrick, setHattrick] = useState<HattrickDraft>({ enabled: false, runs: '5' });
  const [overWiseRulesEnabled, setOverWiseRulesEnabled] = useState(false);
  const [overRuleRows, setOverRuleRows] = useState<OverRuleTemplateRow[]>([]);
  const [rulesRetry, setRulesRetry] = useState<{ tournamentId: string } | null>(null);
  const clubs = useQuery({ queryKey: keys.clubs, queryFn: () => api<Club[]>('/api/v1/clubs') });
  const form = useForm<TournamentCreateValues>({
    resolver: zodResolver(tournamentCreateSchema),
    mode: 'onTouched',
    defaultValues: tournamentCreateDefaults(),
  });
  const values = form.watch();
  const create = useMutation({
    mutationFn: (v: TournamentCreateValues) =>
      api<Tournament>('/api/v1/tournaments', {
        method: 'POST',
        body: {
          name: v.name,
          clubId: v.clubId || undefined,
          season: v.season || undefined,
          coverImageUrl: v.coverImageUrl || undefined,
          startDate: v.startDate || undefined,
          endDate: v.endDate || undefined,
          visibility: v.visibility,
          stageType: v.stageType,
          winningBonusPoints: winningBonusPoints ? Number(winningBonusPoints) : undefined,
          defaultOverWiseRulesEnabled: overWiseRulesEnabled,
          defaultOverRules: overWiseRulesEnabled ? overRuleRows.map(overRuleTemplatePayload).filter((r) => r !== null) : undefined,
          fanQuiz: quizListPayload(quizEnabled, quizzes),
        },
      }),
    onSuccess: async (tn) => {
      try {
        await applyPresetRules(tn.id, presetRules({ foursStreak, sixesStreak, hattrick }));
        nav(`/tournaments/${tn.id}?tab=teams`);
      } catch {
        setRulesRetry({ tournamentId: tn.id });
      }
    },
  });
  const retryRules = useMutation({
    mutationFn: () => {
      if (!rulesRetry) return Promise.resolve();
      return applyPresetRules(rulesRetry.tournamentId, presetRules({ foursStreak, sixesStreak, hattrick }));
    },
    onSuccess: () => {
      if (rulesRetry) nav(`/tournaments/${rulesRetry.tournamentId}?tab=teams`);
    },
  });
  const submitting = create.isPending || logoBusy;

  if (rulesRetry) {
    return (
      <div className={cn('flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center', dark ? 'bg-dark-chrome text-on-dark' : 'bg-bg text-text')}>
        <p className="text-lg font-semibold">{t('tournaments.rulesSaveFailedTitle')}</p>
        <p className={cn('text-sm', dark ? 'text-on-dark/70' : 'text-text-secondary')}>{t('tournaments.rulesSaveFailedBody')}</p>
        {retryRules.isError ? (
          <p className="text-sm text-danger" role="alert">
            {t('tournaments.rulesSaveFailedTitle')}
          </p>
        ) : null}
        <div className="mt-2 flex w-full max-w-xs flex-col gap-3">
          <Button type="button" variant="gold" disabled={retryRules.isPending} onClick={() => retryRules.mutate()}>
            {retryRules.isPending ? t('tournaments.submitting') : t('common.retry')}
          </Button>
          <Button type="button" variant="outline" onClick={() => nav(`/tournaments/${rulesRetry.tournamentId}/rules`)}>
            {t('tournaments.rulesSaveFailedConfigureLater')}
          </Button>
        </div>
      </div>
    );
  }

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
        <h1 className="text-lg font-bold">{t('tournaments.createTitle')}</h1>
      </header>

      <div className="mx-auto w-[calc(100%-2rem)] max-w-[42rem] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <p className="mt-4 text-lg font-semibold leading-snug">{t('tournaments.prompt')}</p>
        <p className={cn('mt-2 text-sm leading-relaxed', dark ? 'text-on-dark/65' : 'text-text-secondary')}>{t('tournaments.createHint')}</p>

        <form
          className="mt-6 flex flex-col gap-6"
          noValidate
          aria-busy={submitting}
          onSubmit={form.handleSubmit((v) => {
            if (submitting) return;
            const stepError = quizzesStepError(quizEnabled, quizzes);
            setQuizErrors(stepError ? { [stepError.index]: stepError.message } : {});
            if (stepError) return;
            create.mutate(v);
          })}
        >
          <section>
            <h2 className={cn('mb-3 text-sm font-bold uppercase tracking-wide', dark ? 'text-gold' : 'text-primary')}>{t('tournaments.logo')}</h2>
            <ClubLogoField
              dark={dark}
              value={form.watch('coverImageUrl')}
              onChange={(url) => form.setValue('coverImageUrl', url, { shouldValidate: true })}
              onBusyChange={setLogoBusy}
            />
            {form.formState.errors.coverImageUrl ? (
              <p className="mt-2 text-center text-xs text-danger" role="alert">
                {form.formState.errors.coverImageUrl.message}
              </p>
            ) : null}
          </section>

          <section>
            <h2 className={cn('mb-4 border-b pb-2 text-sm font-bold uppercase tracking-wide', dark ? 'border-gold/35 text-gold' : 'border-border text-primary')}>
              {t('tournaments.sectionBasic')}
            </h2>
            <div className="flex flex-col gap-5">
              <Input
                dark={dark}
                underline
                requiredMark
                label={t('tournaments.name')}
                placeholder={t('tournaments.namePlaceholder')}
                {...form.register('name')}
                error={form.formState.errors.name?.message}
              />
              <Input dark={dark} underline label={t('tournaments.sport')} info={t('info.tournament.sport')} value={t('tournaments.sportCricket')} readOnly />
              <Select dark={dark} underline label={t('tournaments.club')} info={t('info.tournament.club')} {...form.register('clubId')}>
                <option value="">{t('tournaments.clubOptional')}</option>
                {(clubs.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.city ? `${c.name} · ${c.city}` : c.name}
                  </option>
                ))}
              </Select>
              <SeasonYearPicker
                dark={dark}
                requiredMark
                label={t('tournaments.season')}
                info={t('info.tournament.season')}
                value={form.watch('season')}
                onChange={(season) => form.setValue('season', season, { shouldValidate: true })}
                error={form.formState.errors.season?.message}
              />
              
            </div>
          </section>

          <section>
            <h2 className={cn('mb-4 border-b pb-2 text-sm font-bold uppercase tracking-wide', dark ? 'border-gold/35 text-gold' : 'border-border text-primary')}>
              {t('tournaments.sectionSchedule')}
            </h2>
            <div className="flex flex-col gap-5">
              <Input
                dark={dark}
                underline
                requiredMark
                type="date"
                min={todayIsoDate()}
                label={t('tournaments.startDate')}
                {...form.register('startDate')}
                error={form.formState.errors.startDate?.message}
              />
              <Input
                dark={dark}
                underline
                requiredMark
                type="date"
                min={values.startDate || todayIsoDate()}
                label={t('tournaments.endDate')}
                {...form.register('endDate')}
                error={form.formState.errors.endDate?.message}
              />
            </div>
          </section>

          <section>
            <h2 className={cn('mb-4 border-b pb-2 text-sm font-bold uppercase tracking-wide', dark ? 'border-gold/35 text-gold' : 'border-border text-primary')}>
              {t('tournaments.sectionRules')}
            </h2>
            <div className="flex flex-col gap-5">
              <NumericInput
                dark={dark}
                underline
                id="winningBonusPoints"
                label={t('tournamentRules.winningBonus')}
                info={t('info.rules.winningBonus')}
                min={0}
                max={20}
                value={winningBonusPoints}
                onChange={(e) => setWinningBonusPoints(e.target.value)}
              />
              <div className={cn('rounded-xl border p-4', dark ? 'border-gold/25' : 'border-border')}>
                <h3 className="mb-2 flex items-center gap-1 font-bold">
                  {t('tournamentRules.bonusRules')}
                  <InfoTooltip topic={t('tournamentRules.bonusRules')} dark={dark}>
                    {t('info.rules.bonusRules')}
                  </InfoTooltip>
                </h3>
                <StreakBonusFields
                  dark={dark}
                  idPrefix="fours-streak"
                  label={t('tournamentRules.foursStreakBonus')}
                  description={t('tournamentRules.foursStreakDesc')}
                  value={foursStreak}
                  onChange={setFoursStreak}
                />
                <div className={cn('mt-4 border-t pt-4', dark ? 'border-gold/20' : 'border-border')}>
                  <StreakBonusFields
                    dark={dark}
                    idPrefix="sixes-streak"
                    label={t('tournamentRules.sixesStreakBonus')}
                    description={t('tournamentRules.sixesStreakDesc')}
                    value={sixesStreak}
                    onChange={setSixesStreak}
                  />
                </div>
                <div className={cn('mt-4 border-t pt-4', dark ? 'border-gold/20' : 'border-border')}>
                  <HattrickFields
                    dark={dark}
                    label={t('tournamentRules.wicketHattrickBonus')}
                    description={t('tournamentRules.wicketHattrickDesc')}
                    hattrick={hattrick}
                    onHattrickChange={setHattrick}
                  />
                </div>
                <div className={cn('mt-4 border-t pt-4', dark ? 'border-gold/20' : 'border-border')}>
                  <p className={cn('text-xs', dark ? 'text-on-dark/60' : 'text-text-secondary')}>{t('tournamentRules.moreBonusRulesAfterCreate')}</p>
                </div>
              </div>
              <div className={cn('rounded-xl border p-4', dark ? 'border-gold/25' : 'border-border')}>
                <div className="flex min-h-touch items-center justify-between gap-2 text-sm font-semibold">
                  <span className="flex items-center gap-1">
                    <label htmlFor="overWiseRulesEnabled">{t('tournaments.overWiseRulesDefault')}</label>
                    <InfoTooltip topic={t('tournaments.overWiseRulesDefault')} dark={dark}>
                      {t('info.rules.overWiseDefault')}
                    </InfoTooltip>
                  </span>
                  <input
                    id="overWiseRulesEnabled"
                    type="checkbox"
                    checked={overWiseRulesEnabled}
                    onChange={(e) => setOverWiseRulesEnabled(e.target.checked)}
                  />
                </div>
                <p className={cn('mt-1 text-xs font-normal', dark ? 'text-on-dark/60' : 'text-text-secondary')}>{t('tournaments.overWiseRulesDefaultHint')}</p>
                {overWiseRulesEnabled ? (
                  <div className={cn('mt-3 border-t pt-3', dark ? 'border-gold/20' : 'border-border')}>
                    <OverRuleTemplateFields dark={dark} rows={overRuleRows} onChange={setOverRuleRows} />
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <section>
            <h2 className={cn('mb-4 border-b pb-2 text-sm font-bold uppercase tracking-wide', dark ? 'border-gold/35 text-gold' : 'border-border text-primary')}>
              {t('fans.fanQuiz')}
            </h2>
            <QuizList
              dark={dark}
              enabled={quizEnabled}
              onEnabledChange={(next) => {
                setQuizEnabled(next);
                setQuizErrors({});
              }}
              quizzes={quizzes}
              onQuizzesChange={(next) => {
                setQuizzes(next);
                setQuizErrors({});
              }}
              errors={quizErrors}
            />
            {quizEnabled ? <p className={cn('mt-3 text-xs', dark ? 'text-on-dark/60' : 'text-text-secondary')}>{t('fans.quizAddAfterCreate')}</p> : null}
          </section>

          {create.isError ? (
            <p className="text-sm text-danger" role="alert">
              {create.error.message}
            </p>
          ) : null}

          <Button type="submit" variant="gold" className="h-[52px] w-full" disabled={submitting}>
            {create.isPending ? t('tournaments.submitting') : t('tournaments.submit')}
          </Button>
        </form>
      </div>
    </div>
  );
}
