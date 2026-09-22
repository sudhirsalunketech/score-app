import { useTranslation } from 'react-i18next';
import { NumericInput, Select } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import { cn } from '@/lib/cn';
import type { TournamentRuleDto } from '@/types/api';

export type HattrickDraft = { enabled: boolean; runs: string };
export type PenaltyDraft = { enabled: boolean; runs: string; reason: string };
export type StreakBonusDraft = { enabled: boolean; runs: string };
export type SixBonusDraft = { enabled: boolean; runs: string };

/** A hattrick is always 3 wickets in a row by definition — conditionConfig.streakLength is left unset (defaults to 3 in the engine). */
export function buildHattrickRule(runs: number): Omit<TournamentRuleDto, 'id'> {
  return {
    name: 'Hattrick Bonus',
    category: 'WICKET_RULE',
    scope: 'TOURNAMENT',
    condition: 'HATTRICK',
    conditionConfig: {},
    action: 'WICKET_BONUS',
    actionConfig: { runs },
    priority: 10,
    enabled: true,
    affects: { matchResult: true, tournamentPoints: true, nrr: false, playerStats: false, teamStats: false, displayOnly: false },
  };
}

export function buildHattrickPenaltyRule(runs: number): Omit<TournamentRuleDto, 'id'> {
  return {
    name: 'Hattrick Penalty',
    category: 'WICKET_RULE',
    scope: 'TOURNAMENT',
    condition: 'HATTRICK',
    conditionConfig: {},
    action: 'WICKET_PENALTY',
    actionConfig: { runs },
    priority: 10,
    enabled: true,
    affects: { matchResult: true, tournamentPoints: true, nrr: false, playerStats: false, teamStats: false, displayOnly: false },
  };
}

export function buildPenaltyRule(runs: number, reason: string): Omit<TournamentRuleDto, 'id'> {
  return {
    name: 'Penalty Runs',
    category: 'PENALTY_RULE',
    scope: 'TOURNAMENT',
    condition: 'ALWAYS',
    conditionConfig: {},
    action: runs < 0 ? 'SUBTRACT_PENALTY' : 'ADD_PENALTY',
    actionConfig: { runs: Math.abs(runs), reason },
    priority: 5,
    enabled: true,
    affects: { matchResult: true, tournamentPoints: true, nrr: false, playerStats: false, teamStats: false, displayOnly: true },
  };
}

/** 3 consecutive legal boundary balls of the given value (4s-only or 6s-only), same over — conditionConfig.streakLength is left unset (defaults to 3). */
export function buildStreakBoundaryRule(runs: number, runValue: 4 | 6): Omit<TournamentRuleDto, 'id'> {
  const label = runValue === 4 ? 'Fours' : 'Sixes';
  return {
    name: `${label} Streak Bonus`,
    category: 'RUN_RULE',
    scope: 'TOURNAMENT',
    condition: 'BOUNDARY_STREAK',
    conditionConfig: { boundaryRunValue: runValue },
    action: 'ADD_RUNS',
    actionConfig: { runs },
    priority: 5,
    enabled: true,
    affects: { matchResult: true, tournamentPoints: true, nrr: false, playerStats: false, teamStats: false, displayOnly: false },
  };
}

/** Extra bonus runs every time a six is hit. */
export function buildSixBonusRule(runs: number): Omit<TournamentRuleDto, 'id'> {
  return {
    name: 'Six Bonus',
    category: 'RUN_RULE',
    scope: 'TOURNAMENT',
    condition: 'SIX',
    conditionConfig: {},
    action: 'ADD_RUNS',
    actionConfig: { runs },
    priority: 5,
    enabled: true,
    affects: { matchResult: true, tournamentPoints: true, nrr: false, playerStats: false, teamStats: false, displayOnly: false },
  };
}

export type PresetRulesInput = {
  hattrick?: HattrickDraft;
  hattrickPenalty?: HattrickDraft;
  penalty?: PenaltyDraft;
  foursStreak?: StreakBonusDraft;
  sixesStreak?: StreakBonusDraft;
  sixBonus?: SixBonusDraft;
};

/**
 * Assembles the curated preset rules (skipping any that are disabled or not passed) — used both when
 * saving from the live Tournament Rules page (which manages every preset) and when queuing rules to
 * create/edit alongside a tournament (which may only manage a subset — see mergePresetRules).
 *
 */
export function presetRules(input: PresetRulesInput): Omit<TournamentRuleDto, 'id'>[] {
  const rules: Omit<TournamentRuleDto, 'id'>[] = [];
  if (input.hattrick?.enabled) rules.push(buildHattrickRule(Math.abs(Number(input.hattrick.runs)) || 0));
  if (input.hattrickPenalty?.enabled) rules.push(buildHattrickPenaltyRule(Math.abs(Number(input.hattrickPenalty.runs)) || 0));
  if (input.penalty?.enabled) rules.push(buildPenaltyRule(Number(input.penalty.runs) || 0, input.penalty.reason));
  if (input.foursStreak?.enabled) rules.push(buildStreakBoundaryRule(Math.abs(Number(input.foursStreak.runs)) || 0, 4));
  if (input.sixesStreak?.enabled) rules.push(buildStreakBoundaryRule(Math.abs(Number(input.sixesStreak.runs)) || 0, 6));
  if (input.sixBonus?.enabled) rules.push(buildSixBonusRule(Math.abs(Number(input.sixBonus.runs)) || 0));
  return rules;
}

/** Finds each preset's current rule (if any) inside a tournament's full rule list — the same shape TournamentRulesPage matches by condition/action. */
export function findPresetRules(rules: TournamentRuleDto[]) {
  return {
    hattrickRule: rules.find((r) => r.condition === 'HATTRICK' && r.action === 'WICKET_BONUS'),
    hattrickPenaltyRule: rules.find(
      (r) => r.condition === 'HATTRICK' && (r.action === 'WICKET_PENALTY' || r.action === 'SUBTRACT_PENALTY' || r.action === 'SUBTRACT_RUNS'),
    ),
    penaltyRule: rules.find((r) => r.category === 'PENALTY_RULE' && r.condition === 'ALWAYS'),
    foursStreakRule: rules.find((r) => r.condition === 'BOUNDARY_STREAK' && r.conditionConfig.boundaryRunValue === 4),
    sixesStreakRule: rules.find((r) => r.condition === 'BOUNDARY_STREAK' && r.conditionConfig.boundaryRunValue === 6),
    /** A combined "4s or 6s" streak rule saved before the fours/sixes split existed. Retired (see mergePresetRules) whenever either new slot is saved. */
    legacyBoundaryStreakRule: rules.find((r) => r.condition === 'BOUNDARY_STREAK' && r.conditionConfig.boundaryRunValue == null),
    sixBonusRule: rules.find((r) => r.condition === 'SIX' && r.action === 'ADD_RUNS'),
  };
}

export function hattrickDraftFromRule(rule?: TournamentRuleDto): HattrickDraft {
  return {
    enabled: Boolean(rule?.enabled),
    runs: rule ? String(rule.actionConfig.runs ?? 3) : '3',
  };
}

export function penaltyDraftFromRule(rule?: TournamentRuleDto): PenaltyDraft {
  return {
    enabled: Boolean(rule?.enabled),
    runs: rule
      ? String(rule.action === 'SUBTRACT_PENALTY' ? -Math.abs(Number(rule.actionConfig.runs ?? 5)) : Math.abs(Number(rule.actionConfig.runs ?? 5)))
      : '5',
    reason: rule ? String(rule.actionConfig.reason ?? 'TOURNAMENT_PENALTY') : 'TOURNAMENT_PENALTY',
  };
}

export function streakBonusDraftFromRule(rule?: TournamentRuleDto, defaultRuns = '5'): StreakBonusDraft {
  return {
    enabled: Boolean(rule?.enabled),
    runs: rule ? String(rule.actionConfig.runs ?? defaultRuns) : defaultRuns,
  };
}

export function sixBonusDraftFromRule(rule?: TournamentRuleDto): SixBonusDraft {
  return { enabled: Boolean(rule?.enabled), runs: rule ? String(rule.actionConfig.runs ?? 1) : '1' };
}

/**
 * Replaces just the preset slots a caller actually passes (an omitted key means "not managed by this
 * form") inside a tournament's existing rule list, leaving any other rule — including a preset only
 * managed elsewhere (e.g. Six Bonus set up on the Tournament Rules page) or one set up via the
 * Advanced Rules builder — untouched, so saving here can never silently drop a rule this form doesn't
 * show. Managing either boundary-streak slot also retires any pre-split legacy combined rule.
 */
export function mergePresetRules(existingRules: TournamentRuleDto[], presets: PresetRulesInput): Omit<TournamentRuleDto, 'id'>[] {
  const { hattrickRule, hattrickPenaltyRule, penaltyRule, foursStreakRule, sixesStreakRule, legacyBoundaryStreakRule, sixBonusRule } =
    findPresetRules(existingRules);
  const managingBoundaryStreak = presets.foursStreak !== undefined || presets.sixesStreak !== undefined;
  const managedIds = new Set(
    [
      presets.hattrick !== undefined ? hattrickRule?.id : undefined,
      presets.hattrickPenalty !== undefined ? hattrickPenaltyRule?.id : undefined,
      presets.penalty !== undefined ? penaltyRule?.id : undefined,
      presets.foursStreak !== undefined ? foursStreakRule?.id : undefined,
      presets.sixesStreak !== undefined ? sixesStreakRule?.id : undefined,
      managingBoundaryStreak ? legacyBoundaryStreakRule?.id : undefined,
      presets.sixBonus !== undefined ? sixBonusRule?.id : undefined,
    ].filter(Boolean),
  );
  const kept = existingRules.filter((r) => !managedIds.has(r.id)).map(({ id: _id, ...rest }) => rest);
  return [...kept, ...presetRules(presets)];
}

export function HattrickFields({
  dark,
  label,
  description,
  hattrick,
  onHattrickChange,
  hattrickPenalty,
  onHattrickPenaltyChange,
  disabled,
}: {
  dark?: boolean;
  label?: string;
  description?: string;
  hattrick: HattrickDraft;
  onHattrickChange: (next: HattrickDraft) => void;
  hattrickPenalty?: HattrickDraft;
  onHattrickPenaltyChange?: (next: HattrickDraft) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <>
      <label className="flex min-h-touch items-center justify-between gap-2 text-sm font-semibold">
        {label ?? t('tournamentRules.enableHattrick')}
        <Switch dark={dark} checked={hattrick.enabled} disabled={disabled} onChange={(v) => onHattrickChange({ ...hattrick, enabled: v })} />
      </label>
      {hattrick.enabled ? (
        <>
          {description ? <p className={cn('text-xs', dark ? 'text-on-dark/70' : 'text-text-secondary')}>{description}</p> : null}
          <NumericInput
            dark={dark}
            id="hattrick-bonus-runs"
            label={t('tournamentRules.bonusRuns')}
            min={0}
            value={hattrick.runs}
            disabled={disabled}
            onChange={(e) => onHattrickChange({ ...hattrick, runs: e.target.value })}
          />
        </>
      ) : null}
      {hattrickPenalty && onHattrickPenaltyChange ? (
        <>
          <label className="mt-3 flex min-h-touch items-center justify-between gap-2 text-sm font-semibold">
            {t('tournamentRules.enableHattrickPenalty')}
            <Switch dark={dark} checked={hattrickPenalty.enabled} disabled={disabled} onChange={(v) => onHattrickPenaltyChange({ ...hattrickPenalty, enabled: v })} />
          </label>
          {hattrickPenalty.enabled ? (
            <>
              <p className={cn('text-xs', dark ? 'text-on-dark/70' : 'text-text-secondary')}>{t('tournamentRules.hattrickPenaltyDesc')}</p>
              <NumericInput
                dark={dark}
                id="hattrick-penalty-runs"
                label={t('tournamentRules.hattrickPenaltyRuns')}
                min={0}
                value={hattrickPenalty.runs}
                disabled={disabled}
                onChange={(e) => onHattrickPenaltyChange({ ...hattrickPenalty, runs: e.target.value })}
              />
            </>
          ) : null}
        </>
      ) : null}
    </>
  );
}

export function PenaltyFields({
  dark,
  value,
  onChange,
  disabled,
}: {
  dark?: boolean;
  value: PenaltyDraft;
  onChange: (next: PenaltyDraft) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <>
      <label className="flex min-h-touch items-center justify-between gap-2 text-sm font-semibold">
        {t('tournamentRules.allowPenaltyRuns')}
        <Switch dark={dark} checked={value.enabled} disabled={disabled} onChange={(v) => onChange({ ...value, enabled: v })} />
      </label>
      {value.enabled ? (
        <>
          <NumericInput
            dark={dark}
            id="penalty-runs"
            label={t('tournamentRules.defaultPenaltyRuns')}
            allowNegative
            value={value.runs}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, runs: e.target.value })}
          />
          <Select dark={dark} id="penalty-reason" label={t('tournamentRules.reason')} value={value.reason} disabled={disabled} onChange={(e) => onChange({ ...value, reason: e.target.value })}>
            {['TOURNAMENT_PENALTY', 'SLOW_OVER_RATE', 'MISCONDUCT', 'ILLEGAL_EQUIPMENT', 'OTHER'].map((r) => (
              <option key={r} value={r}>
                {t(`scoring.penaltyReasons.${r}`)}
              </option>
            ))}
          </Select>
        </>
      ) : null}
    </>
  );
}

/** One streak-based boundary bonus (fours-only or sixes-only) — enable, bonus runs. Always 3 in a row. */
export function StreakBonusFields({
  dark,
  label,
  description,
  idPrefix,
  value,
  onChange,
  disabled,
}: {
  dark?: boolean;
  label: string;
  description?: string;
  idPrefix: string;
  value: StreakBonusDraft;
  onChange: (next: StreakBonusDraft) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <>
      <label className="flex min-h-touch items-center justify-between gap-2 text-sm font-semibold">
        {label}
        <Switch dark={dark} checked={value.enabled} disabled={disabled} onChange={(v) => onChange({ ...value, enabled: v })} />
      </label>
      {value.enabled ? (
        <>
          {description ? <p className={cn('text-xs', dark ? 'text-on-dark/70' : 'text-text-secondary')}>{description}</p> : null}
          <NumericInput
            dark={dark}
            id={`${idPrefix}-runs`}
            label={t('tournamentRules.bonusRuns')}
            min={0}
            value={value.runs}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, runs: e.target.value })}
          />
        </>
      ) : null}
    </>
  );
}

export function SixBonusFields({
  dark,
  value,
  onChange,
  disabled,
}: {
  dark?: boolean;
  value: SixBonusDraft;
  onChange: (next: SixBonusDraft) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <>
      <label className="flex min-h-touch items-center justify-between gap-2 text-sm font-semibold">
        {t('tournamentRules.sixBonus')}
        <Switch dark={dark} checked={value.enabled} disabled={disabled} onChange={(v) => onChange({ ...value, enabled: v })} />
      </label>
      {value.enabled ? (
        <>
          <p className={cn('text-xs', dark ? 'text-on-dark/70' : 'text-text-secondary')}>{t('tournamentRules.sixBonusDesc')}</p>
          <NumericInput
            dark={dark}
            id="six-bonus-runs"
            label={t('tournamentRules.bonusRuns')}
            min={0}
            value={value.runs}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, runs: e.target.value })}
          />
        </>
      ) : null}
    </>
  );
}
