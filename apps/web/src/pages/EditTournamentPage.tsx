import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import { cn } from '@/lib/cn';
import type { Tournament, TournamentRulesBundle } from '@/types/api';
import { Input, NumericInput, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { IconBack } from '@/components/ui/Icons';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { ErrorRetry, Spinner } from '@/components/ui/Feedback';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { QuizList } from '@/components/fans/QuizList';
import { ClubLogoField } from '@/components/clubs/ClubLogoField';
import { SeasonYearPicker } from '@/components/ui/SeasonYearPicker';
import { quizListPayload, toLocalDateTime, type FanQuizForm, type FanQuizStatus } from '@/lib/fan-quiz';
import { quizzesStepError, todayIsoDate } from '@/lib/tournament-create';
import {
  StreakBonusFields,
  HattrickFields,
  findPresetRules,
  streakBonusDraftFromRule,
  hattrickDraftFromRule,
  mergePresetRules,
  type StreakBonusDraft,
  type HattrickDraft,
} from '@/components/tournament/RulePresetFields';
import {
  OverRuleTemplateFields,
  overRuleTemplatePayload,
  overRuleTemplateRowFromPayload,
  type OverRuleTemplateRow,
} from '@/components/tournament/OverRuleTemplateFields';

const schema = z
  .object({
    name: z.string().trim().min(2).max(80),
    season: z.string().trim().max(40).optional(),
    coverImageUrl: z
      .string()
      .trim()
      .optional()
      .refine(
        (v) => !v || /^https?:\/\//i.test(v) || /^\/uploads\/[A-Za-z0-9._-]+$/.test(v),
        'Logo upload failed. Please try again.',
      ),
    startDate: z.string().trim().min(1, 'Tournament start date is required.'),
    endDate: z.string().trim().min(1, 'Tournament end date is required.'),
    visibility: z.enum(['PRIVATE', 'UNLISTED', 'PUBLIC']),
  })
  .refine((v) => v.startDate <= v.endDate, {
    message: 'End date cannot be before the start date.',
    path: ['endDate'],
  });

type Values = z.infer<typeof schema>;

type QuizConfigDto = {
  id: string;
  name: string;
  description: string | null;
  status: FanQuizStatus;
  startAt: string | null;
  endAt: string | null;
};

type QuizConfigsResponse = {
  enabled: boolean;
  quizzes: QuizConfigDto[];
};

export function EditTournamentPage() {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const nav = useNavigate();
  const qc = useQueryClient();
  const dark = false;
  const [quizEnabled, setQuizEnabled] = useState(false);
  const [quizzes, setQuizzes] = useState<FanQuizForm[]>([]);
  const [quizErrors, setQuizErrors] = useState<Record<number, string>>({});
  const [logoBusy, setLogoBusy] = useState(false);
  const [rulesSaveFailed, setRulesSaveFailed] = useState(false);
  const [winningBonusPoints, setWinningBonusPoints] = useState('');
  const [foursStreak, setFoursStreak] = useState<StreakBonusDraft>({ enabled: false, runs: '5' });
  const [sixesStreak, setSixesStreak] = useState<StreakBonusDraft>({ enabled: false, runs: '5' });
  const [hattrick, setHattrick] = useState<HattrickDraft>({ enabled: false, runs: '5' });
  const [hattrickTarget, setHattrickTarget] = useState<'WICKET' | 'RUNS'>('WICKET');
  const [bonusAmountMode, setBonusAmountMode] = useState<'SAME' | 'DIFFERENT'>('DIFFERENT');
  const [overWiseRulesEnabled, setOverWiseRulesEnabled] = useState(false);
  const [overRuleRows, setOverRuleRows] = useState<OverRuleTemplateRow[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const tn = useQuery({ queryKey: keys.tournament(id), queryFn: () => api<Tournament>(`/api/v1/tournaments/${id}`) });
  const settings = useQuery({
    queryKey: keys.fanQuizList(id),
    queryFn: () => api<QuizConfigsResponse>(`/api/v1/tournaments/${id}/fan/quiz-configs`),
    retry: false,
  });
  const bundle = useQuery({
    queryKey: keys.tournamentRules(id),
    queryFn: () => api<TournamentRulesBundle>(`/api/v1/tournaments/${id}/rules`),
  });
  const current = bundle.data?.current;
  const existingRules = current?.rules ?? [];
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: { name: '', season: '', coverImageUrl: '', startDate: todayIsoDate(), endDate: todayIsoDate(), visibility: 'PRIVATE' },
  });

  useEffect(() => {
    if (!tn.data) return;
    form.reset({
      name: tn.data.name,
      season: tn.data.season ?? '',
      coverImageUrl: tn.data.coverImageUrl ?? '',
      startDate: tn.data.startDate ? tn.data.startDate.slice(0, 10) : todayIsoDate(),
      endDate: tn.data.endDate ? tn.data.endDate.slice(0, 10) : todayIsoDate(),
      visibility: tn.data.visibility ?? 'PRIVATE',
    });
    setWinningBonusPoints(tn.data.winningBonusPoints ? String(tn.data.winningBonusPoints) : '');
    setOverWiseRulesEnabled(Boolean(tn.data.defaultOverWiseRulesEnabled));
    setOverRuleRows(Array.isArray(tn.data.defaultOverRules) ? tn.data.defaultOverRules.map(overRuleTemplateRowFromPayload) : []);
  }, [tn.data, form]);

  useEffect(() => {
    if (!settings.data) return;
    setQuizEnabled(settings.data.enabled);
    setQuizzes(
      settings.data.quizzes.map((q) => ({
        id: q.id,
        name: q.name,
        description: q.description ?? '',
        status: q.status,
        startAt: toLocalDateTime(q.startAt),
        endAt: toLocalDateTime(q.endAt),
      })),
    );
  }, [settings.data]);

  const { foursStreakRule, sixesStreakRule, hattrickRule, hattrickPenaltyRule } = findPresetRules(existingRules);

  useEffect(() => {
    setFoursStreak(streakBonusDraftFromRule(foursStreakRule));
  }, [foursStreakRule?.id, foursStreakRule?.enabled]);

  useEffect(() => {
    setSixesStreak(streakBonusDraftFromRule(sixesStreakRule));
  }, [sixesStreakRule?.id, sixesStreakRule?.enabled]);

  useEffect(() => {
    if (hattrickPenaltyRule?.enabled) {
      setHattrick(hattrickDraftFromRule(hattrickPenaltyRule));
      setHattrickTarget('RUNS');
    } else {
      setHattrick(hattrickDraftFromRule(hattrickRule));
      setHattrickTarget('WICKET');
    }
  }, [hattrickRule?.id, hattrickRule?.enabled, hattrickPenaltyRule?.id, hattrickPenaltyRule?.enabled]);

  /** In "same for all" mode, editing any one bonus's runs value mirrors it into the other two. */
  const syncRuns = (runs: string) => {
    setFoursStreak((v) => (v.runs === runs ? v : { ...v, runs }));
    setSixesStreak((v) => (v.runs === runs ? v : { ...v, runs }));
    setHattrick((v) => (v.runs === runs ? v : { ...v, runs }));
  };

  const changeFoursStreak = (next: StreakBonusDraft) => {
    setFoursStreak(next);
    if (bonusAmountMode === 'SAME' && next.runs !== foursStreak.runs) syncRuns(next.runs);
  };

  const changeSixesStreak = (next: StreakBonusDraft) => {
    setSixesStreak(next);
    if (bonusAmountMode === 'SAME' && next.runs !== sixesStreak.runs) syncRuns(next.runs);
  };

  const changeHattrick = (next: HattrickDraft) => {
    setHattrick(next);
    if (bonusAmountMode === 'SAME' && next.runs !== hattrick.runs) syncRuns(next.runs);
  };

  const changeBonusAmountMode = (mode: 'SAME' | 'DIFFERENT') => {
    setBonusAmountMode(mode);
    if (mode === 'SAME') syncRuns(foursStreak.runs);
  };

  const save = useMutation({
    mutationFn: (v: Values) =>
      api<Tournament>(`/api/v1/tournaments/${id}`, {
        method: 'PATCH',
        body: {
          name: v.name,
          season: v.season || undefined,
          coverImageUrl: v.coverImageUrl || undefined,
          startDate: v.startDate || undefined,
          endDate: v.endDate || undefined,
          visibility: v.visibility,
          winningBonusPoints: winningBonusPoints ? Number(winningBonusPoints) : 0,
          defaultOverWiseRulesEnabled: overWiseRulesEnabled,
          defaultOverRules: overWiseRulesEnabled ? overRuleRows.map(overRuleTemplatePayload).filter((r) => r !== null) : [],
          fanQuiz: settings.isSuccess ? quizListPayload(quizEnabled, quizzes) : undefined,
        },
      }),
    onSuccess: async () => {
      if (bundle.isSuccess) {
        try {
          // hattrickTarget picks whether the single hattrick control saves as a bowling-team bonus or a
          // batting-team penalty — both preset slots are always passed so switching targets retires
          // whichever one is no longer active instead of leaving a stale rule behind.
          const hattrickOff: HattrickDraft = { enabled: false, runs: hattrick.runs };
          const merged = mergePresetRules(existingRules, {
            foursStreak,
            sixesStreak,
            hattrick: hattrickTarget === 'WICKET' ? hattrick : hattrickOff,
            hattrickPenalty: hattrickTarget === 'RUNS' ? hattrick : hattrickOff,
          });
          let version = current?.version ?? 0;
          if (!version || current?.locked) {
            const created = await api<{ version: number }>(`/api/v1/tournaments/${id}/rulesets`, { method: 'POST' });
            version = created.version;
          }
          await api(`/api/v1/tournaments/${id}/rulesets/${version}`, { method: 'PUT', body: { rules: merged, mvp: current?.mvp } });
          // Once a match has started, the previously-active version is locked, so every edit lands in a
          // brand-new (unactivated) version above. Checking `current?.enabled` here only reflects that OLD
          // version — which stays true — so it must NOT gate activation of this new one, or every edit after
          // the first match starts silently saves into a version that never becomes live.
          if ((version !== current?.version || !current?.enabled) && merged.some((r) => r.enabled)) {
            await api(`/api/v1/tournaments/${id}/rulesets/${version}/activate`, { method: 'POST', body: { enabled: true } });
          }
          void qc.invalidateQueries({ queryKey: keys.tournamentRules(id) });
        } catch {
          // The tournament's basic details were still saved successfully, but the bonus rule change
          // was not. Stay on this page instead of navigating away so the user's edit isn't lost and
          // they can press Save again to retry just the rules.
          setRulesSaveFailed(true);
          return;
        }
      }
      setRulesSaveFailed(false);
      nav(`/tournaments/${id}`);
    },
  });
  const submitting = save.isPending || logoBusy;

  const remove = useMutation({
    mutationFn: () => api(`/api/v1/tournaments/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setConfirmDelete(false);
      void qc.invalidateQueries({ queryKey: keys.tournaments });
      nav('/tournaments', { replace: true });
    },
  });

  if (tn.isLoading) return <Spinner />;
  if (tn.isError || !tn.data) return <ErrorRetry onRetry={() => void tn.refetch()} />;

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
        <h1 className="text-lg font-bold">{t('tournaments.editTitle')}</h1>
      </header>

      <div className="mx-auto w-[calc(100%-2rem)] max-w-[42rem] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <form
          className="mt-6 flex flex-col gap-6"
          noValidate
          aria-busy={submitting}
          onSubmit={form.handleSubmit((v) => {
            if (submitting) return;
            const stepError = quizzesStepError(quizEnabled, quizzes);
            setQuizErrors(stepError ? { [stepError.index]: stepError.message } : {});
            if (stepError) return;
            save.mutate(v);
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
              <Input dark={dark} underline requiredMark label={t('tournaments.name')} {...form.register('name')} error={form.formState.errors.name?.message} />
              <SeasonYearPicker
                dark={dark}
                label={t('tournaments.season')}
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
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
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
                min={form.watch('startDate') || todayIsoDate()}
                label={t('tournaments.endDate')}
                {...form.register('endDate')}
                error={form.formState.errors.endDate?.message}
              />
            </div>
          </section>

          <section>
            <h2 className={cn('mb-4 border-b pb-2 text-sm font-bold uppercase tracking-wide', dark ? 'border-gold/35 text-gold' : 'border-border text-primary')}>
              {t('tournaments.sectionSettings')}
            </h2>
            <Select dark={dark} underline label={t('share.publicVisibility')} {...form.register('visibility')}>
              <option value="PRIVATE">{t('share.visibility.PRIVATE')}</option>
              <option value="UNLISTED">{t('share.visibility.UNLISTED')}</option>
              <option value="PUBLIC">{t('share.visibility.PUBLIC')}</option>
            </Select>
          </section>

          {bundle.isLoading ? (
            <Spinner />
          ) : (
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
                  {foursStreak.enabled || sixesStreak.enabled || hattrick.enabled ? (
                    <Select
                      dark={dark}
                      underline
                      className="mb-3"
                      label={t('tournamentRules.bonusAmountMode')}
                      value={bonusAmountMode}
                      onChange={(e) => changeBonusAmountMode(e.target.value as 'SAME' | 'DIFFERENT')}
                    >
                      <option value="DIFFERENT">{t('tournamentRules.bonusAmountDifferent')}</option>
                      <option value="SAME">{t('tournamentRules.bonusAmountSame')}</option>
                    </Select>
                  ) : null}
                  <StreakBonusFields
                    dark={dark}
                    idPrefix="fours-streak"
                    label={t('tournamentRules.foursStreakBonus')}
                    description={t('tournamentRules.foursStreakDesc')}
                    value={foursStreak}
                    onChange={changeFoursStreak}
                  />
                  <div className={cn('mt-4 border-t pt-4', dark ? 'border-gold/20' : 'border-border')}>
                    <StreakBonusFields
                      dark={dark}
                      idPrefix="sixes-streak"
                      label={t('tournamentRules.sixesStreakBonus')}
                      description={t('tournamentRules.sixesStreakDesc')}
                      value={sixesStreak}
                      onChange={changeSixesStreak}
                    />
                  </div>
                  <div className={cn('mt-4 border-t pt-4', dark ? 'border-gold/20' : 'border-border')}>
                    <HattrickFields
                      dark={dark}
                      label={t('tournamentRules.wicketHattrickBonus')}
                      description={hattrickTarget === 'RUNS' ? t('tournamentRules.wicketHattrickPenaltyDesc') : t('tournamentRules.wicketHattrickDesc')}
                      hattrick={hattrick}
                      onHattrickChange={changeHattrick}
                    />
                    {hattrick.enabled ? (
                      <Select
                        dark={dark}
                        underline
                        className="mt-3"
                        label={t('tournamentRules.hattrickTarget')}
                        value={hattrickTarget}
                        onChange={(e) => setHattrickTarget(e.target.value as 'WICKET' | 'RUNS')}
                      >
                        <option value="WICKET">{t('tournamentRules.hattrickTargetWicket')}</option>
                        <option value="RUNS">{t('tournamentRules.hattrickTargetRuns')}</option>
                      </Select>
                    ) : null}
                  </div>
                  <div className={cn('mt-4 border-t pt-4', dark ? 'border-gold/20' : 'border-border')}>
                    <Button type="button" variant="outline" className="w-full" onClick={() => nav(`/tournaments/${id}/rules?advanced=1`)}>
                      {t('tournamentRules.addMoreBonusRules')}
                    </Button>
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
          )}

          {settings.isSuccess ? (
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
              {quizEnabled ? (
                <Button type="button" variant="outline" className="mt-4 w-full" onClick={() => nav(`/tournaments/${id}/fan/admin`)}>
                  {t('fans.manageQuestions')}
                </Button>
              ) : null}
            </section>
          ) : null}

          {save.isError ? (
            <p className="text-sm text-danger" role="alert">
              {save.error.message}
            </p>
          ) : null}

          {rulesSaveFailed ? (
            <p className="text-sm text-danger" role="alert">
              {t('tournaments.rulesSaveFailedTitle')}
            </p>
          ) : null}

          <Button type="submit" variant="gold" className="h-[52px] w-full" disabled={submitting}>
            {save.isPending ? t('common.loading') : rulesSaveFailed ? t('common.retry') : t('common.save')}
          </Button>

          <section className="rounded-xl border border-danger/40 p-4">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-danger">{t('tournaments.dangerZone')}</h2>
            <Button type="button" variant="danger" className="w-full !bg-scoring !text-white" onClick={() => setConfirmDelete(true)}>
              {t('tournaments.deleteButton')}
            </Button>
            {remove.isError ? (
              <p className="mt-2 text-sm text-danger" role="alert">
                {remove.error instanceof ApiError ? remove.error.message : t('common.error')}
              </p>
            ) : null}
          </section>
        </form>
      </div>

      <BottomSheet open={confirmDelete} title={t('tournaments.deleteConfirmTitle')} onClose={() => setConfirmDelete(false)}>
        <p className="mb-4 text-sm text-text-secondary">{t('tournaments.deleteConfirmBody')}</p>
        <div className="flex gap-2">
          <Button className="flex-1" variant="outline" onClick={() => setConfirmDelete(false)}>
            {t('common.cancel')}
          </Button>
          <Button className="flex-1 !bg-scoring !text-white" variant="danger" disabled={remove.isPending} onClick={() => remove.mutate()}>
            {t('tournaments.deleteButton')}
          </Button>
        </div>
      </BottomSheet>
    </div>
  );
}
