import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '@/lib/api';
import { keys } from '@/lib/query-keys';
import { useAuth } from '@/context/AuthContext';
import { canManageThisTournament } from '@/lib/roles';
import { hasPerm } from '@/lib/access';
import type { Tournament, TournamentRuleDto, TournamentRulesBundle, MvpConfig } from '@/types/api';
import { Button } from '@/components/ui/Button';
import { Input, NumericInput, Select } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import { IconBack, IconChevron, IconMenu } from '@/components/ui/Icons';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { ErrorRetry, Spinner } from '@/components/ui/Feedback';
import { cn } from '@/lib/cn';
import { MvpPointsTable, DEFAULT_MVP_CONFIG } from '@/components/tournament/MvpPointsTable';
import {
  HattrickFields,
  PenaltyFields,
  StreakBonusFields,
  SixBonusFields,
  findPresetRules,
  hattrickDraftFromRule,
  penaltyDraftFromRule,
  streakBonusDraftFromRule,
  sixBonusDraftFromRule,
  mergePresetRules,
  type HattrickDraft,
  type PenaltyDraft,
  type StreakBonusDraft,
  type SixBonusDraft,
} from '@/components/tournament/RulePresetFields';

type Category = TournamentRuleDto['category'];
type Draft = {
  name: string;
  category: Category;
  scope: TournamentRuleDto['scope'];
  condition: string;
  over: string;
  ball: string;
  action: string;
  multiplier: string;
  runs: string;
  target: string;
  failAction: string;
  successAction: string;
  reason: string;
  priority: string;
  enabled: boolean;
  matchResult: boolean;
  tournamentPoints: boolean;
  nrr: boolean;
  playerStats: boolean;
  teamStats: boolean;
  displayOnly: boolean;
};

const CATEGORIES: Category[] = ['OVER_RULE', 'BALL_RULE', 'RUN_RULE', 'WICKET_RULE', 'TARGET_RULE', 'PENALTY_RULE'];

const NAV_SECTIONS = [
  { id: 'section-format', labelKey: 'tournamentRules.navFormat' },
  { id: 'section-hattrick', labelKey: 'tournamentRules.navHattrick' },
  { id: 'section-bonus', labelKey: 'tournamentRules.navBonus' },
  { id: 'section-mvp', labelKey: 'tournamentRules.navMvp' },
  { id: 'section-advanced', labelKey: 'tournamentRules.navAdvanced' },
] as const;

type FormatDraft = {
  overs: string;
  ballsPerOver: string;
  maxWickets: string;
  widesCountAsLegal: boolean;
  noBallsCountAsLegal: boolean;
  winningBonusPoints: string;
  tiePoints: string;
};

function formatDraftFromTournament(tn?: Tournament): FormatDraft {
  return {
    overs: tn?.defaultOvers != null ? String(tn.defaultOvers) : '',
    ballsPerOver: tn?.defaultBallsPerOver != null ? String(tn.defaultBallsPerOver) : '',
    maxWickets: tn?.defaultMaxWickets != null ? String(tn.defaultMaxWickets) : '',
    widesCountAsLegal: Boolean(tn?.defaultWidesCountAsLegal),
    noBallsCountAsLegal: Boolean(tn?.defaultNoBallsCountAsLegal),
    winningBonusPoints: tn?.winningBonusPoints ? String(tn.winningBonusPoints) : '',
    tiePoints: tn?.tiePoints != null ? String(tn.tiePoints) : '',
  };
}

function emptyDraft(category: Category): Draft {
  const defaults: Record<Category, Pick<Draft, 'scope' | 'condition' | 'action' | 'name'>> = {
    OVER_RULE: { scope: 'OVER', condition: 'OVER_EQUALS', action: 'MULTIPLY_RUNS', name: 'Over double runs' },
    BALL_RULE: { scope: 'BALL', condition: 'BALL_EQUALS', action: 'MULTIPLY_RUNS', name: 'Ball double runs' },
    RUN_RULE: { scope: 'TOURNAMENT', condition: 'ALWAYS', action: 'ADD_RUNS', name: 'Run bonus' },
    WICKET_RULE: { scope: 'TOURNAMENT', condition: 'WICKET', action: 'WICKET_PENALTY', name: 'Wicket penalty' },
    TARGET_RULE: { scope: 'OVER', condition: 'OVER_EQUALS', action: 'MARK_TARGET_FAILED', name: 'Over target' },
    PENALTY_RULE: { scope: 'OVER', condition: 'OVER_EQUALS', action: 'ADD_PENALTY', name: 'Penalty' },
  };
  return {
    ...defaults[category],
    category,
    over: category === 'OVER_RULE' || category === 'BALL_RULE' || category === 'TARGET_RULE' || category === 'PENALTY_RULE' ? '3' : '',
    ball: category === 'BALL_RULE' ? '2' : '',
    multiplier: '2',
    runs: '5',
    target: '10',
    failAction: 'DO_NOT_COUNT_OVER',
    successAction: 'COUNT_NORMAL',
    reason: 'specialRule',
    priority: '10',
    enabled: true,
    matchResult: true,
    tournamentPoints: true,
    nrr: false,
    playerStats: false,
    teamStats: false,
    displayOnly: false,
  };
}

function toPayload(d: Draft): Omit<TournamentRuleDto, 'id'> {
  return {
    name: d.name.trim() || d.category,
    category: d.category,
    scope: d.scope,
    condition: d.condition,
    conditionConfig: {
      ...(d.over ? { over: Number(d.over) } : {}),
      ...(d.ball ? { ball: Number(d.ball) } : {}),
    },
    action: d.action,
    actionConfig: {
      ...(d.action === 'MULTIPLY_RUNS' || d.successAction === 'MULTIPLY_RUNS' ? { multiplier: Number(d.multiplier) } : {}),
      ...(d.action.includes('RUNS') || d.action.includes('PENALTY') || d.action.includes('BONUS') ? { runs: Number(d.runs) } : {}),
      ...(d.category === 'TARGET_RULE' ? { target: Number(d.target), failAction: d.failAction, successAction: d.successAction } : {}),
      ...(d.category === 'PENALTY_RULE' ? { reason: d.reason, runs: Number(d.runs) } : {}),
    },
    priority: Number(d.priority) || 0,
    enabled: d.enabled,
    affects: {
      matchResult: d.matchResult,
      tournamentPoints: d.tournamentPoints,
      nrr: d.nrr,
      playerStats: d.playerStats,
      teamStats: d.teamStats,
      displayOnly: d.displayOnly,
    },
  };
}

function fromRule(rule: TournamentRuleDto): Draft {
  const cfg = rule.conditionConfig;
  const act = rule.actionConfig;
  return {
    name: rule.name,
    category: rule.category,
    scope: rule.scope,
    condition: rule.condition,
    over: cfg.over != null ? String(cfg.over) : '',
    ball: cfg.ball != null ? String(cfg.ball) : '',
    action: rule.action,
    multiplier: act.multiplier != null ? String(act.multiplier) : '2',
    runs: act.runs != null ? String(act.runs) : '5',
    target: act.target != null ? String(act.target) : '10',
    failAction: String(act.failAction ?? 'DO_NOT_COUNT_OVER'),
    successAction: String(act.successAction ?? 'COUNT_NORMAL'),
    reason: String(act.reason ?? 'specialRule'),
    priority: String(rule.priority),
    enabled: rule.enabled,
    matchResult: rule.affects.matchResult,
    tournamentPoints: rule.affects.tournamentPoints,
    nrr: rule.affects.nrr,
    playerStats: rule.affects.playerStats,
    teamStats: rule.affects.teamStats,
    displayOnly: rule.affects.displayOnly,
  };
}

export function TournamentRulesPage() {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [mvp, setMvp] = useState<MvpConfig>(DEFAULT_MVP_CONFIG);
  const [section, setSection] = useState<Category | 'preview'>('OVER_RULE');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmOn, setConfirmOn] = useState(false);
  const [jumpOpen, setJumpOpen] = useState(false);
  const [preview, setPreview] = useState<{ actual: number; counted: number; display: string; reason: string } | null>(null);
  const [test, setTest] = useState({ over: '3', ball: '2', actualRuns: '4', isWicket: false });
  const [advancedOpen, setAdvancedOpen] = useState(params.get('advanced') === '1');
  const [format, setFormat] = useState<FormatDraft>(formatDraftFromTournament());
  const [hattrick, setHattrick] = useState<HattrickDraft>({ enabled: false, runs: '3' });
  const [hattrickPenalty, setHattrickPenalty] = useState<HattrickDraft>({ enabled: false, runs: '3' });
  const [penalty, setPenalty] = useState<PenaltyDraft>({ enabled: false, runs: '5', reason: 'TOURNAMENT_PENALTY' });
  const [foursStreak, setFoursStreak] = useState<StreakBonusDraft>({ enabled: false, runs: '5' });
  const [sixesStreak, setSixesStreak] = useState<StreakBonusDraft>({ enabled: false, runs: '5' });
  const [sixBonus, setSixBonus] = useState<SixBonusDraft>({ enabled: false, runs: '1' });
  const [seededForId, setSeededForId] = useState<string | null>(null);

  const tn = useQuery({ queryKey: keys.tournament(id), queryFn: () => api<Tournament>(`/api/v1/tournaments/${id}`) });
  const bundle = useQuery({
    queryKey: keys.tournamentRules(id),
    queryFn: () => api<TournamentRulesBundle>(`/api/v1/tournaments/${id}/rules`),
  });
  const canEdit = hasPerm(tn.data?.myPermissions, 'TOURNAMENT_MANAGE_RULES') || canManageThisTournament(user, { createdById: tn.data?.createdById });
  const current = bundle.data?.current;
  const rules = current?.rules ?? [];
  const enabled = Boolean(current?.enabled);
  const locked = Boolean(current?.locked);

  const { hattrickRule, hattrickPenaltyRule, penaltyRule, foursStreakRule, sixesStreakRule, sixBonusRule } = findPresetRules(rules);

  /** What the form would show fresh from the server right now — the baseline "unsaved changes" is diffed against, and what Discard resets to. */
  const serverDraft = tn.data
    ? {
        format: formatDraftFromTournament(tn.data),
        hattrick: hattrickDraftFromRule(hattrickRule),
        hattrickPenalty: hattrickDraftFromRule(hattrickPenaltyRule),
        penalty: penaltyDraftFromRule(penaltyRule),
        foursStreak: streakBonusDraftFromRule(foursStreakRule),
        sixesStreak: streakBonusDraftFromRule(sixesStreakRule),
        sixBonus: sixBonusDraftFromRule(sixBonusRule),
        mvp: current?.mvp ?? DEFAULT_MVP_CONFIG,
      }
    : null;

  // Seed every draft from the server exactly once per tournament (on load, or if this same page instance
  // is reused for a different tournament id) — done inline during render rather than in a useEffect so
  // there's no first-paint flash of empty defaults. Deliberately does NOT re-seed on every subsequent rule
  // version bump: an independent Advanced Rules action (add/edit/delete a custom rule, on/off) also bumps
  // the version, and re-seeding then would silently wipe out in-progress unsaved edits in this form.
  if (serverDraft && tn.data && seededForId !== tn.data.id) {
    setFormat(serverDraft.format);
    setHattrick(serverDraft.hattrick);
    setHattrickPenalty(serverDraft.hattrickPenalty);
    setPenalty(serverDraft.penalty);
    setFoursStreak(serverDraft.foursStreak);
    setSixesStreak(serverDraft.sixesStreak);
    setSixBonus(serverDraft.sixBonus);
    setMvp(serverDraft.mvp);
    setSeededForId(tn.data.id);
  }

  const isDirty =
    Boolean(serverDraft) &&
    JSON.stringify({ format, hattrick, hattrickPenalty, penalty, foursStreak, sixesStreak, sixBonus, mvp }) !== JSON.stringify(serverDraft);

  const discardChanges = () => {
    if (!serverDraft) return;
    setFormat(serverDraft.format);
    setHattrick(serverDraft.hattrick);
    setHattrickPenalty(serverDraft.hattrickPenalty);
    setPenalty(serverDraft.penalty);
    setFoursStreak(serverDraft.foursStreak);
    setSixesStreak(serverDraft.sixesStreak);
    setSixBonus(serverDraft.sixBonus);
    setMvp(serverDraft.mvp);
  };

  const invalidate = () => void qc.invalidateQueries({ queryKey: keys.tournamentRules(id) });

  const saveFormat = useMutation({
    mutationFn: () =>
      api(`/api/v1/tournaments/${id}`, {
        method: 'PATCH',
        body: {
          defaultOvers: format.overs ? Number(format.overs) : undefined,
          defaultMaxWickets: format.maxWickets ? Number(format.maxWickets) : undefined,
          defaultBallsPerOver: format.ballsPerOver ? Number(format.ballsPerOver) : undefined,
          defaultWidesCountAsLegal: format.widesCountAsLegal,
          defaultNoBallsCountAsLegal: format.noBallsCountAsLegal,
          winningBonusPoints: format.winningBonusPoints ? Number(format.winningBonusPoints) : undefined,
          tiePoints: format.tiePoints ? Number(format.tiePoints) : undefined,
        },
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.tournament(id) }),
  });

  const saveRuleSet = useMutation({
    mutationFn: async (opts: { nextRules: Omit<TournamentRuleDto, 'id'>[]; activateAfter?: boolean }) => {
      let version = current?.version ?? 0;
      if (!version || locked) {
        const created = await api<{ version: number }>(`/api/v1/tournaments/${id}/rulesets`, { method: 'POST' });
        version = created.version;
      }
      await api(`/api/v1/tournaments/${id}/rulesets/${version}`, { method: 'PUT', body: { rules: opts.nextRules, mvp } });
      // Once a match has started, the previously-active version is locked, so every save above lands in
      // a brand-new (unactivated) version. `enabled` here only reflects that OLD version — which stays
      // true — so it must not gate activation of this new one, or edits after the first match starts
      // silently save into a version that never goes live.
      if (opts.activateAfter && (version !== current?.version || !enabled)) {
        await api(`/api/v1/tournaments/${id}/rulesets/${version}/activate`, { method: 'POST', body: { enabled: true } });
      }
    },
    onSuccess: invalidate,
  });

  /** Single "Save Changes" action — combines Match Format/Ball Rules/Winning-Tie (one PATCH) with
   * Hattrick/Penalties/Bonus Rules/MVP (one rules-PUT via mergePresetRules, reused from RulePresetFields) —
   * so what used to be 8 separate per-card saves now fires as one pair of requests. */
  const saveAll = async () => {
    const nextRules = mergePresetRules(rules, { hattrick, hattrickPenalty, penalty, foursStreak, sixesStreak, sixBonus });
    const activateAfter = hattrick.enabled || hattrickPenalty.enabled || penalty.enabled || foursStreak.enabled || sixesStreak.enabled || sixBonus.enabled;
    const [formatResult, ruleSetResult] = await Promise.allSettled([
      saveFormat.mutateAsync(),
      saveRuleSet.mutateAsync({ nextRules, activateAfter }),
    ]);
    if (formatResult.status === 'fulfilled' && ruleSetResult.status === 'fulfilled') nav(-1);
  };
  const saving = saveFormat.isPending || saveRuleSet.isPending;
  const saveError = saveFormat.error ?? saveRuleSet.error;

  const save = useMutation({
    mutationFn: async (nextRules: Omit<TournamentRuleDto, 'id'>[]) => {
      let version = current?.version ?? 0;
      const wasEnabled = Boolean(current?.enabled);
      if (!version || locked) {
        const created = await api<{ version: number }>(`/api/v1/tournaments/${id}/rulesets`, { method: 'POST' });
        version = created.version;
      }
      const saved = await api(`/api/v1/tournaments/${id}/rulesets/${version}`, { method: 'PUT', body: { rules: nextRules, mvp } });
      if (wasEnabled && locked) {
        await api(`/api/v1/tournaments/${id}/rulesets/${version}/activate`, { method: 'POST', body: { enabled: true } });
      }
      return saved;
    },
    onSuccess: invalidate,
  });
  const activate = useMutation({
    mutationFn: async (on: boolean) => {
      let version = current?.version ?? 0;
      if (!version) {
        const created = await api<{ version: number }>(`/api/v1/tournaments/${id}/rulesets`, { method: 'POST' });
        version = created.version;
      }
      return api(`/api/v1/tournaments/${id}/rulesets/${version}/activate`, { method: 'POST', body: { enabled: on } });
    },
    onSuccess: () => {
      setConfirmOn(false);
      invalidate();
    },
  });
  const previewMut = useMutation({
    mutationFn: () =>
      api<{ actual: number; counted: number; display: string; reason: string }>(`/api/v1/tournaments/${id}/rules/preview`, {
        method: 'POST',
        body: {
          over: Number(test.over),
          ball: Number(test.ball),
          actualRuns: Number(test.actualRuns),
          isWicket: test.isWicket,
          version: current?.version,
          rules: rules.map(({ id: _id, ...rest }) => rest),
        },
      }),
    onSuccess: setPreview,
  });

  const persist = (next: TournamentRuleDto[]) => {
    save.mutate(next.map(({ id: _id, ...rest }) => rest));
  };

  const saveDraft = () => {
    if (!draft) return;
    const payload = { ...toPayload(draft), id: 'draft' };
    persist([...rules.filter((r) => r.id !== editingId), payload as TournamentRuleDto]);
    setDraft(null);
    setEditingId(null);
  };

  const grouped = useMemo(() => {
    const map = new Map<Category, TournamentRuleDto[]>();
    for (const cat of CATEGORIES) map.set(cat, []);
    for (const rule of rules) map.get(rule.category)?.push(rule);
    return map;
  }, [rules]);

  const scrollToSection = (sectionId: string) => {
    if (sectionId === 'section-advanced') setAdvancedOpen(true);
    setJumpOpen(false);
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    if (params.get('advanced') === '1' && bundle.data) scrollToSection('section-advanced');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundle.data]);

  if (tn.isLoading || bundle.isLoading) return <Spinner />;
  if (bundle.isError || !bundle.data) return <ErrorRetry onRetry={() => void bundle.refetch()} />;

  return (
    <div className="flex min-h-dvh flex-col bg-dark-chrome text-on-dark">
      <header className="sticky top-0 z-20 bg-dark-chrome pt-[env(safe-area-inset-top)] shadow-md shadow-black/30">
        <div className="flex min-h-14 items-center gap-2 px-2 py-2">
          <button type="button" className="touch-target inline-flex w-11 shrink-0 items-center justify-center" aria-label={t('common.back')} onClick={() => nav(-1)}>
            <IconBack />
          </button>
          <div className="flex flex-1 flex-col items-center gap-0.5 text-center">
            <h1 className="flex items-center gap-1 text-lg font-bold">
              {t('tournamentRules.title')}
              <InfoTooltip topic={t('tournamentRules.title')} dark>{t('info.rules.custom')}</InfoTooltip>
            </h1>
            <p className="text-xs text-on-dark/60">{t('tournamentRules.subtitle')}</p>
          </div>
          <div className="flex w-11 shrink-0 items-center justify-end gap-2 lg:w-auto">
            <button
              type="button"
              className="touch-target inline-flex items-center justify-center lg:hidden"
              aria-label={t('tournamentRules.jumpToSection')}
              onClick={() => setJumpOpen(true)}
            >
              <IconMenu />
            </button>
            {canEdit ? (
              <div className="hidden items-center gap-2 lg:flex">
                {isDirty ? <span className="text-xs font-semibold text-gold">{t('tournamentRules.unsavedChanges')}</span> : null}
                <Button type="button" variant="ghost" disabled={!isDirty || saving} onClick={discardChanges}>
                  {t('tournamentRules.discard')}
                </Button>
                <Button type="button" variant="gold" disabled={!isDirty || saving} onClick={() => void saveAll()}>
                  {saving ? t('common.loading') : t('tournamentRules.saveChanges')}
                </Button>
              </div>
            ) : null}
          </div>
        </div>
        {saveError ? (
          <p className="px-4 pb-2 text-center text-xs text-danger">{saveError instanceof ApiError ? saveError.message : t('common.error')}</p>
        ) : null}
      </header>

      <div className={cn('flex flex-1 flex-col gap-4 px-[var(--gutter)] pt-4 lg:flex-row lg:items-start lg:gap-8', canEdit ? 'pb-28 lg:pb-8' : 'pb-8')}>
        <nav className="hidden shrink-0 lg:sticky lg:top-24 lg:block lg:w-52">
          <ul className="flex flex-col gap-1">
            {NAV_SECTIONS.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className="block w-full rounded-lg px-3 py-2 text-start text-sm font-semibold text-on-dark/70 transition-colors hover:bg-white/5 hover:text-on-dark"
                  onClick={() => scrollToSection(s.id)}
                >
                  {t(s.labelKey)}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div id="section-format" className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <RuleCard title={t('tournamentRules.matchFormat')} description={t('tournamentRules.matchFormatDesc')}>
              <div className="grid grid-cols-2 gap-3">
                <NumericInput
                  dark
                  label={t('tournamentRules.oversPerInnings')}
                  min={1}
                  max={90}
                  value={format.overs}
                  disabled={!canEdit}
                  onChange={(e) => setFormat({ ...format, overs: e.target.value })}
                />
                <NumericInput
                  dark
                  label={t('tournamentRules.maxWickets')}
                  min={1}
                  max={10}
                  value={format.maxWickets}
                  disabled={!canEdit}
                  onChange={(e) => setFormat({ ...format, maxWickets: e.target.value })}
                />
              </div>
            </RuleCard>

            <RuleCard title={t('tournamentRules.ballRules')} description={t('tournamentRules.ballRulesDesc')}>
              <NumericInput
                dark
                label={t('tournamentRules.ballsPerOver')}
                info={t('info.rules.ballsPerOver')}
                min={4}
                max={8}
                value={format.ballsPerOver}
                disabled={!canEdit}
                onChange={(e) => setFormat({ ...format, ballsPerOver: e.target.value })}
              />
              <label className="mt-3 flex min-h-touch items-center justify-between gap-2 text-sm font-semibold">
                {t('tournamentRules.widesCountAsLegal')}
                <Switch
                  dark
                  checked={format.widesCountAsLegal}
                  disabled={!canEdit}
                  onChange={(v) => setFormat({ ...format, widesCountAsLegal: v })}
                />
              </label>
              <label className="flex min-h-touch items-center justify-between gap-2 text-sm font-semibold">
                {t('tournamentRules.noBallsCountAsLegal')}
                <Switch
                  dark
                  checked={format.noBallsCountAsLegal}
                  disabled={!canEdit}
                  onChange={(v) => setFormat({ ...format, noBallsCountAsLegal: v })}
                />
              </label>
            </RuleCard>
          </div>

          <div id="section-hattrick" className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <RuleCard title={t('tournamentRules.hattrick')} description={t('tournamentRules.hattrickDesc')}>
              <HattrickFields
                dark
                hattrick={hattrick}
                onHattrickChange={setHattrick}
                hattrickPenalty={hattrickPenalty}
                onHattrickPenaltyChange={setHattrickPenalty}
                disabled={!canEdit}
              />
            </RuleCard>

            <RuleCard title={t('tournamentRules.penalties')} description={t('tournamentRules.penaltiesDesc')}>
              <PenaltyFields dark value={penalty} onChange={setPenalty} disabled={!canEdit} />
            </RuleCard>
          </div>

          <div id="section-bonus">
            <RuleCard title={t('tournamentRules.bonusRules')} description={t('tournamentRules.bonusRulesDesc')}>
              <SixBonusFields dark value={sixBonus} onChange={setSixBonus} disabled={!canEdit} />

              <div className="mt-4 border-t border-gold/15 pt-4">
                <StreakBonusFields
                  dark
                  idPrefix="fours-streak"
                  label={t('tournamentRules.foursStreakBonus')}
                  description={t('tournamentRules.foursStreakDesc')}
                  value={foursStreak}
                  onChange={setFoursStreak}
                  disabled={!canEdit}
                />
              </div>

              <div className="mt-4 border-t border-gold/15 pt-4">
                <StreakBonusFields
                  dark
                  idPrefix="sixes-streak"
                  label={t('tournamentRules.sixesStreakBonus')}
                  description={t('tournamentRules.sixesStreakDesc')}
                  value={sixesStreak}
                  onChange={setSixesStreak}
                  disabled={!canEdit}
                />
              </div>

              <div className="mt-4 border-t border-gold/15 pt-4">
                <NumericInput
                  dark
                  label={t('tournamentRules.winningBonus')}
                  info={t('info.rules.winningBonus')}
                  min={0}
                  max={20}
                  value={format.winningBonusPoints}
                  disabled={!canEdit}
                  onChange={(e) => setFormat({ ...format, winningBonusPoints: e.target.value })}
                />
                <NumericInput
                  dark
                  label={t('tournamentRules.tiePoints')}
                  info={t('info.rules.tiePoints')}
                  min={0}
                  max={20}
                  className="mt-3"
                  value={format.tiePoints}
                  disabled={!canEdit}
                  onChange={(e) => setFormat({ ...format, tiePoints: e.target.value })}
                />
              </div>
            </RuleCard>
          </div>

          <div id="section-mvp">
            <RuleCard title={t('mvp.title')} description={t('mvp.snapshotHint')}>
              <MvpPointsTable dark config={mvp} onChange={canEdit ? setMvp : undefined} readOnly={!canEdit} />
            </RuleCard>
          </div>

          <div id="section-advanced" className="border-t border-gold/25 pt-4">
            <button
              type="button"
              className="flex min-h-touch w-full items-center justify-between text-start font-bold"
              onClick={() => setAdvancedOpen((v) => !v)}
            >
              {t('tournamentRules.advancedRules')}
              <IconChevron size={18} className={cn('shrink-0 text-on-dark/70 transition-transform', advancedOpen ? 'rotate-90' : '')} />
            </button>
            <p className="text-sm text-on-dark/70">{t('tournamentRules.advancedDesc')}</p>

            {advancedOpen ? (
              <div className="mt-4 flex flex-col gap-3">
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={cn('min-h-touch flex-1 rounded-lg border font-bold', !enabled ? 'border-primary bg-primary-light text-primary-dark' : 'border-gold/25')}
                    onClick={() => canEdit && activate.mutate(false)}
                    disabled={!canEdit}
                  >
                    {t('tournamentRules.off')}
                  </button>
                  <button
                    type="button"
                    className={cn('min-h-touch flex-1 rounded-lg border font-bold', enabled ? 'border-primary bg-primary-light text-primary-dark' : 'border-gold/25')}
                    onClick={() => (canEdit ? setConfirmOn(true) : undefined)}
                    disabled={!canEdit}
                  >
                    {t('tournamentRules.on')}
                  </button>
                </div>

                {enabled ? null : <p className="text-sm text-on-dark/70">{t('tournamentRules.standard')}</p>}
                {bundle.data.hasLiveOrCompletedMatches ? <p className="text-sm text-danger">{t('tournamentRules.existingWarning')}</p> : null}
                {locked ? <p className="text-xs font-semibold uppercase text-on-dark/70">{t('tournamentRules.locked')}</p> : null}
                {current?.version ? (
                  <p className="text-xs text-on-dark/70">
                    {t('tournamentRules.version')} {current.version}
                  </p>
                ) : null}

                {enabled ? (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {CATEGORIES.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          className={cn(
                            'min-h-10 rounded-pill px-3 text-xs font-bold uppercase',
                            section === cat ? 'bg-primary text-on-dark' : 'border border-gold/25',
                          )}
                          onClick={() => setSection(cat)}
                        >
                          {t(`tournamentRules.category.${cat}`)}
                        </button>
                      ))}
                      <button
                        type="button"
                        className={cn(
                          'min-h-10 rounded-pill px-3 text-xs font-bold uppercase',
                          section === 'preview' ? 'bg-primary text-on-dark' : 'border border-gold/25',
                        )}
                        onClick={() => setSection('preview')}
                      >
                        {t('tournamentRules.preview')}
                      </button>
                    </div>

                    {section === 'preview' ? (
                      <div className="flex flex-col gap-3">
                        <NumericInput dark label={t('tournamentRules.over')} min={1} value={test.over} onChange={(e) => setTest({ ...test, over: e.target.value })} />
                        <NumericInput dark label={t('tournamentRules.ball')} min={1} value={test.ball} onChange={(e) => setTest({ ...test, ball: e.target.value })} />
                        <NumericInput dark label={t('tournamentRules.actual')} min={0} value={test.actualRuns} onChange={(e) => setTest({ ...test, actualRuns: e.target.value })} />
                        <label className="flex min-h-touch items-center justify-between gap-2 text-sm font-semibold">
                          {t('scoring.wicket')}
                          <Switch dark checked={test.isWicket} onChange={(v) => setTest({ ...test, isWicket: v })} />
                        </label>
                        <Button type="button" variant="primaryDark" disabled={previewMut.isPending} onClick={() => previewMut.mutate()}>
                          {t('tournamentRules.preview')}
                        </Button>
                        {preview ? (
                          <div className="rounded-lg border border-gold/25 p-3 text-sm">
                            <p>
                              {t('tournamentRules.actual')}: {preview.actual}
                            </p>
                            <p className="font-bold">
                              {t('tournamentRules.counted')}: {preview.counted}
                            </p>
                            <p>{preview.display}</p>
                            <p className="text-on-dark/70">{preview.reason}</p>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {(grouped.get(section) ?? []).map((rule) => (
                          <div key={rule.id} className="rounded-lg border border-gold/25 p-3">
                            <p className="font-bold">{rule.name}</p>
                            <p className="text-xs text-on-dark/70">
                              {rule.scope} · {rule.condition} · {rule.action} · {t('tournamentRules.priority')} {rule.priority}
                            </p>
                            {canEdit ? (
                              <div className="mt-2 flex gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="text-xs"
                                  onClick={() => {
                                    setEditingId(rule.id);
                                    setDraft(fromRule(rule));
                                  }}
                                >
                                  {t('profile.edit')}
                                </Button>
                                <Button type="button" variant="outline" className="text-xs" onClick={() => persist(rules.filter((r) => r.id !== rule.id))}>
                                  {t('tournaments.remove')}
                                </Button>
                              </div>
                            ) : null}
                          </div>
                        ))}
                        {canEdit ? (
                          <Button type="button" variant="primaryDark" onClick={() => { setEditingId(null); setDraft(emptyDraft(section)); }}>
                            {t('tournamentRules.addRule')}
                          </Button>
                        ) : null}
                      </div>
                    )}
                  </>
                ) : null}
              </div>
            ) : null}
          </div>

          {save.isError || activate.isError ? (
            <p className="text-sm text-danger">{(save.error ?? activate.error) instanceof ApiError ? (save.error ?? activate.error as ApiError).message : t('common.error')}</p>
          ) : null}
        </div>
      </div>

      {canEdit ? (
        <div className="fixed inset-x-0 bottom-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom))] z-30 flex items-center justify-between gap-3 border-t border-gold/25 bg-dark-chrome px-[var(--gutter)] pb-3 pt-3 md:bottom-0 md:pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
          <span className="text-xs font-semibold text-gold">{isDirty ? t('tournamentRules.unsavedChanges') : ' '}</span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" disabled={!isDirty || saving} onClick={discardChanges}>
              {t('tournamentRules.discard')}
            </Button>
            <Button type="button" variant="gold" disabled={!isDirty || saving} onClick={() => void saveAll()}>
              {saving ? t('common.loading') : t('tournamentRules.saveChanges')}
            </Button>
          </div>
        </div>
      ) : null}

      <BottomSheet open={jumpOpen} title={t('tournamentRules.jumpToSection')} onClose={() => setJumpOpen(false)} orange={false}>
        <div className="flex flex-col gap-1">
          {NAV_SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              className="rounded-lg px-3 py-3 text-start font-semibold text-text hover:bg-muted"
              onClick={() => scrollToSection(s.id)}
            >
              {t(s.labelKey)}
            </button>
          ))}
        </div>
      </BottomSheet>

      <BottomSheet open={Boolean(draft)} title={t('tournamentRules.addRule')} onClose={() => setDraft(null)} orange={false}>
        {draft ? (
          <form
            className="flex max-h-[70dvh] flex-col gap-3 overflow-y-auto"
            onSubmit={(e) => {
              e.preventDefault();
              saveDraft();
            }}
          >
            <Input label={t('tournamentRules.ruleName')} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            <NumericInput label={t('tournamentRules.over')} min={1} value={draft.over} onChange={(e) => setDraft({ ...draft, over: e.target.value })} />
            {draft.category === 'BALL_RULE' ? (
              <NumericInput label={t('tournamentRules.ball')} min={1} value={draft.ball} onChange={(e) => setDraft({ ...draft, ball: e.target.value })} />
            ) : null}
            <Select label={t('tournamentRules.condition')} value={draft.condition} onChange={(e) => setDraft({ ...draft, condition: e.target.value })}>
              {['ALWAYS', 'OVER_EQUALS', 'BALL_EQUALS', 'WICKET', 'BOUNDARY', 'SIX', 'DOT_BALL', 'EXTRA'].map((c) => (
                <option key={c} value={c}>
                  {t(`tournamentRules.conditions.${c}`)}
                </option>
              ))}
            </Select>
            <Select label={t('tournamentRules.action')} value={draft.action} onChange={(e) => setDraft({ ...draft, action: e.target.value })}>
              {(draft.category === 'WICKET_RULE'
                ? ['WICKET_PENALTY', 'WICKET_BONUS']
                : draft.category === 'TARGET_RULE'
                  ? ['MARK_TARGET_FAILED', 'MARK_TARGET_COMPLETE']
                  : ['COUNT_NORMAL', 'MULTIPLY_RUNS', 'IGNORE_RUNS', 'ADD_RUNS', 'SUBTRACT_RUNS', 'ADD_PENALTY']
              ).map((a) => (
                <option key={a} value={a}>
                  {t(`tournamentRules.actions.${a}`)}
                </option>
              ))}
            </Select>
            {draft.action === 'MULTIPLY_RUNS' ? (
              <Select label={t('tournamentRules.multiplier')} value={draft.multiplier} onChange={(e) => setDraft({ ...draft, multiplier: e.target.value })}>
                {['1', '2', '3', '0'].map((m) => (
                  <option key={m} value={m}>
                    {m}x
                  </option>
                ))}
              </Select>
            ) : null}
            {draft.action.includes('PENALTY') || draft.action.includes('RUNS') || draft.action.includes('BONUS') ? (
              <NumericInput label={t('tournamentRules.runs')} min={0} value={draft.runs} onChange={(e) => setDraft({ ...draft, runs: e.target.value })} />
            ) : null}
            {draft.category === 'TARGET_RULE' ? (
              <>
                <NumericInput label={t('tournamentRules.target')} min={0} value={draft.target} onChange={(e) => setDraft({ ...draft, target: e.target.value })} />
                <Select label={t('tournamentRules.failAction')} value={draft.failAction} onChange={(e) => setDraft({ ...draft, failAction: e.target.value })}>
                  {['DO_NOT_COUNT_OVER', 'ADD_PENALTY', 'COUNT_NORMAL'].map((a) => (
                    <option key={a} value={a}>
                      {t(`tournamentRules.actions.${a}`)}
                    </option>
                  ))}
                </Select>
                <Select label={t('tournamentRules.successAction')} value={draft.successAction} onChange={(e) => setDraft({ ...draft, successAction: e.target.value })}>
                  {['COUNT_NORMAL', 'MULTIPLY_RUNS', 'ADD_RUNS'].map((a) => (
                    <option key={a} value={a}>
                      {t(`tournamentRules.actions.${a}`)}
                    </option>
                  ))}
                </Select>
              </>
            ) : null}
            {draft.category === 'PENALTY_RULE' ? (
              <Select label={t('tournamentRules.reason')} value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value })}>
                {['overViolation', 'lateOver', 'specialRule', 'discipline', 'other'].map((r) => (
                  <option key={r} value={r}>
                    {t(`tournamentRules.reasons.${r}`)}
                  </option>
                ))}
              </Select>
            ) : null}
            <NumericInput label={t('tournamentRules.priority')} info={t('info.rules.priority')} min={0} value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value })} />
            {(
              [
                ['matchResult', 'matchResult', 'info.rules.matchResult'],
                ['tournamentPoints', 'tournamentPoints', 'info.rules.tournamentPoints'],
                ['nrr', 'nrr', 'info.rules.nrr'],
                ['playerStats', 'playerStats', ''],
                ['teamStats', 'teamStats', ''],
                ['displayOnly', 'displayOnly', 'info.rules.displayOnly'],
              ] as const
            ).map(([key, label, infoKey]) => (
              <label key={key} className="flex min-h-touch items-center justify-between gap-2 text-sm font-semibold">
                <span className="inline-flex items-center gap-1">
                  {t(`tournamentRules.affects.${label}`)}
                  {infoKey ? <InfoTooltip topic={t(`tournamentRules.affects.${label}`)} compact>{t(infoKey)}</InfoTooltip> : null}
                </span>
                <Switch checked={draft[key]} onChange={(v) => setDraft({ ...draft, [key]: v })} />
              </label>
            ))}
            <Button type="submit" variant="primaryDark" disabled={save.isPending}>
              {t('common.save')}
            </Button>
          </form>
        ) : null}
      </BottomSheet>

      <BottomSheet open={confirmOn} title={t('tournamentRules.title')} onClose={() => setConfirmOn(false)} orange={false}>
        <p className="mb-3 text-sm">{t('tournamentRules.activateConfirm')}</p>
        {bundle.data.hasLiveOrCompletedMatches ? <p className="mb-4 text-sm text-text-secondary">{t('tournamentRules.liveWarning')}</p> : null}
        <Button type="button" variant="primaryDark" disabled={activate.isPending} onClick={() => activate.mutate(true)}>
          {t('common.yes')}
        </Button>
      </BottomSheet>
    </div>
  );
}

function RuleCard({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="flex h-full flex-col gap-2 rounded-xl border border-gold/25 bg-white/[0.02] p-4 shadow-lg shadow-black/20">
      <h2 className="font-bold text-gold">{title}</h2>
      {description ? <p className="text-sm text-on-dark/70">{description}</p> : null}
      {children}
    </section>
  );
}
