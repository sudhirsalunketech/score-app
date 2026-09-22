import { sanitizeMvpConfig, type MvpConfig } from './mvp';

export const RULE_SCOPES = ['TOURNAMENT', 'MATCH', 'INNINGS', 'OVER', 'BALL'] as const;
export type RuleScope = (typeof RULE_SCOPES)[number];

export const RULE_CATEGORIES = ['OVER_RULE', 'BALL_RULE', 'RUN_RULE', 'WICKET_RULE', 'TARGET_RULE', 'PENALTY_RULE'] as const;
export type RuleCategory = (typeof RULE_CATEGORIES)[number];

export const RULE_CONDITIONS = [
  'ALWAYS',
  'OVER_EQUALS',
  'OVER_RANGE',
  'BALL_EQUALS',
  'BALL_RANGE',
  'RUNS_EQUALS',
  'RUNS_GREATER_THAN',
  'RUNS_LESS_THAN',
  'WICKET',
  'EXTRA',
  'DOT_BALL',
  'BOUNDARY',
  'SIX',
  'TARGET_COMPLETED',
  'TARGET_FAILED',
  'HATTRICK',
  'BOUNDARY_STREAK',
] as const;
export type RuleCondition = (typeof RULE_CONDITIONS)[number];

export const RULE_ACTIONS = [
  'COUNT_NORMAL',
  'IGNORE_RUNS',
  'MULTIPLY_RUNS',
  'ADD_RUNS',
  'SUBTRACT_RUNS',
  'ADD_PENALTY',
  'SUBTRACT_PENALTY',
  'WICKET_BONUS',
  'WICKET_PENALTY',
  'DO_NOT_COUNT_OVER',
  'MARK_TARGET_COMPLETE',
  'MARK_TARGET_FAILED',
] as const;
export type RuleAction = (typeof RULE_ACTIONS)[number];

export type RuleAffects = {
  matchResult: boolean;
  tournamentPoints: boolean;
  nrr: boolean;
  playerStats: boolean;
  teamStats: boolean;
  displayOnly: boolean;
};

export const DEFAULT_RULE_AFFECTS: RuleAffects = {
  matchResult: true,
  tournamentPoints: true,
  nrr: false,
  playerStats: false,
  teamStats: false,
  displayOnly: false,
};

export type RuleConditionConfig = {
  over?: number;
  overFrom?: number;
  overTo?: number;
  ball?: number;
  ballFrom?: number;
  ballTo?: number;
  runs?: number;
  /** How many consecutive eligible deliveries complete the streak (HATTRICK / BOUNDARY_STREAK). Defaults to 3. */
  streakLength?: number;
  /** Restricts a BOUNDARY_STREAK rule to only fours (4) or only sixes (6). Omitted = either (legacy combined behavior). */
  boundaryRunValue?: 4 | 6;
};

export type RuleActionConfig = {
  multiplier?: number;
  runs?: number;
  target?: number;
  targetSource?: 'ACTUAL' | 'ADJUSTED';
  failAction?: 'DO_NOT_COUNT_OVER' | 'ADD_PENALTY' | 'COUNT_NORMAL';
  successAction?: 'COUNT_NORMAL' | 'MULTIPLY_RUNS' | 'ADD_RUNS';
};

export type TournamentRule = {
  id: string;
  name: string;
  category: RuleCategory;
  scope: RuleScope;
  condition: RuleCondition;
  conditionConfig: RuleConditionConfig;
  action: RuleAction;
  actionConfig: RuleActionConfig;
  priority: number;
  enabled: boolean;
  affects: RuleAffects;
};

export type RuleSetSnapshot = {
  enabled: boolean;
  version: number;
  rules: TournamentRule[];
  mvp?: MvpConfig;
};

export type RuleBallInput = {
  sequence: number;
  overNumber: number;
  ballInOver: number;
  actualRuns: number;
  extraType?: string;
  isWicket?: boolean;
  isUndone?: boolean;
  bowlerId?: string;
};

export type RuleBallResult = {
  sequence: number;
  overNumber: number;
  ballInOver: number;
  originalRuns: number;
  countedRuns: number;
  penaltyRuns: number;
  bonusRuns: number;
  multiplier: number;
  reason: string;
  display: string;
};

export type InningsRuleEvaluation = {
  balls: RuleBallResult[];
  actualTotal: number;
  countedTotal: number;
  overTargets: Array<{ overNumber: number; target: number; actual: number; completed: boolean; action: string }>;
};

const TARGET_CONDS = new Set<RuleCondition>(['TARGET_COMPLETED', 'TARGET_FAILED']);

export function parseRuleSnapshot(value: unknown): RuleSetSnapshot | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as RuleSetSnapshot;
  if (typeof row.enabled !== 'boolean' || !Array.isArray(row.rules)) return null;
  return {
    enabled: row.enabled,
    version: typeof row.version === 'number' ? row.version : 0,
    rules: row.rules,
    mvp: row.mvp != null ? sanitizeMvpConfig(row.mvp) : undefined,
  };
}

export function isAllowedCondition(value: string): value is RuleCondition {
  return (RULE_CONDITIONS as readonly string[]).includes(value);
}

export function isAllowedAction(value: string): value is RuleAction {
  return (RULE_ACTIONS as readonly string[]).includes(value);
}

export function sanitizeMultiplier(value: unknown): number {
  const n = Number(value);
  if (n === 0 || n === 1 || n === 2 || n === 3) return n;
  return 1;
}

export function sanitizeDelta(value: unknown): number {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n)) return 0;
  return Math.max(-50, Math.min(50, n));
}

/** Streak length (HATTRICK / BOUNDARY_STREAK) — how many consecutive deliveries are required. Defaults to 3, clamped to a sane range. */
export function sanitizeStreakLength(value: unknown): number {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n) || n < 1) return 3;
  return Math.min(10, n);
}

function inRange(value: number, from?: number, to?: number, exact?: number) {
  if (exact != null) return value === exact;
  if (from != null && value < from) return false;
  if (to != null && value > to) return false;
  return from != null || to != null;
}

export function ruleSpecificity(rule: TournamentRule): number {
  const c = rule.conditionConfig;
  if (rule.scope === 'BALL' || c.ball != null || c.ballFrom != null || rule.condition === 'BALL_EQUALS' || rule.condition === 'BALL_RANGE') {
    return 40;
  }
  if (rule.scope === 'OVER' || c.over != null || c.overFrom != null || rule.condition === 'OVER_EQUALS' || rule.condition === 'OVER_RANGE') {
    return 30;
  }
  if (rule.scope === 'INNINGS') return 20;
  if (rule.scope === 'MATCH') return 15;
  return 10; // TOURNAMENT scope — least specific, applied first in the priority chain.
}

/** General rules first, most specific last so ball rules override over rules. Higher priority wins last. */
export function sortRules(rules: TournamentRule[]): TournamentRule[] {
  return rules
    .filter((r) => r.enabled)
    .sort((a, b) => ruleSpecificity(a) - ruleSpecificity(b) || a.priority - b.priority || a.id.localeCompare(b.id));
}

/**
 * Sequences where a hattrick completes: `streakLength` (default 3) consecutive wicket-taking
 * LEGAL deliveries by the same bowler. Wides/no-balls that are not themselves a wicket are
 * skipped — they neither extend nor break an in-progress streak, since they're not "deliveries"
 * for hattrick purposes. Any legal non-wicket delivery resets the streak.
 */
export function computeHattrickSequences(balls: RuleBallInput[], streakLength = 3): Set<number> {
  const need = sanitizeStreakLength(streakLength);
  const hits = new Set<number>();
  let streakBowler: string | null = null;
  let streakCount = 0;
  for (const ball of balls) {
    const extra = ball.extraType ?? 'NONE';
    const isNonWicketExtraDelivery = (extra === 'WIDE' || extra === 'NO_BALL') && !ball.isWicket;
    if (isNonWicketExtraDelivery) continue;
    if (ball.isWicket && ball.bowlerId) {
      streakCount = ball.bowlerId === streakBowler ? streakCount + 1 : 1;
      streakBowler = ball.bowlerId;
      if (streakCount >= need) hits.add(ball.sequence);
    } else {
      streakBowler = null;
      streakCount = 0;
    }
  }
  return hits;
}

/**
 * One entry per hat-trick completed in this (non-undone) ball log, naming the credited bowler —
 * used to persist career "hat-tricks" statistics. Reuses computeHattrickSequences rather than a
 * separate achievements table, so an undone or never-replayed hat-trick is never counted: the
 * auto-inserted bonus/penalty ball that follows a real hat-trick (see scoring.service.ts) resets
 * the streak, so a longer run of consecutive wickets (e.g. 4+ in a row) is still only counted once.
 */
export function hatTrickBowlerIds(balls: RuleBallInput[]): string[] {
  const hits = computeHattrickSequences(balls);
  if (!hits.size) return [];
  const byId: string[] = [];
  for (const ball of balls) {
    if (hits.has(ball.sequence) && ball.bowlerId) byId.push(ball.bowlerId);
  }
  return byId;
}

/**
 * Sequences where a "N in a row" boundary streak completes: `streakLength` (default 3) consecutive
 * legal deliveries WITHIN THE SAME OVER (any batsman, any bowler) each scoring a 4 or 6 off the bat —
 * or, when `runValue` is given, only fours (4) or only sixes (6) count toward the streak (a boundary
 * of the other value breaks it, same as a dot ball would). Wides/no-balls are skipped — they aren't
 * fair deliveries — but any other legal ball that isn't a qualifying boundary (dot, single, bye,
 * wicket, a mismatched 4/6, etc.), or a boundary in a different over than the streak so far, resets it.
 */
export function computeBoundaryStreakSequences(balls: RuleBallInput[], opts?: { streakLength?: number; runValue?: 4 | 6 }): Set<number> {
  const need = sanitizeStreakLength(opts?.streakLength ?? 3);
  const runValue = opts?.runValue;
  const hits = new Set<number>();
  let streak = 0;
  let streakOver: number | null = null;
  for (const ball of balls) {
    const extra = ball.extraType ?? 'NONE';
    if (extra === 'WIDE' || extra === 'NO_BALL') continue;
    const isQualifyingBoundary =
      extra === 'NONE' && !ball.isWicket && (runValue != null ? ball.actualRuns === runValue : ball.actualRuns === 4 || ball.actualRuns === 6);
    if (isQualifyingBoundary) {
      streak = streak > 0 && ball.overNumber === streakOver ? streak + 1 : 1;
      streakOver = ball.overNumber;
      if (streak >= need) hits.add(ball.sequence);
    } else {
      streak = 0;
      streakOver = null;
    }
  }
  return hits;
}

function conditionMatches(
  rule: TournamentRule,
  ball: RuleBallInput,
  overState?: { completed?: boolean },
): boolean {
  const c = rule.conditionConfig;
  switch (rule.condition) {
    case 'ALWAYS':
      return true;
    case 'OVER_EQUALS':
      return ball.overNumber === (c.over ?? -1);
    case 'OVER_RANGE':
      return inRange(ball.overNumber, c.overFrom, c.overTo, undefined);
    case 'BALL_EQUALS':
      return ball.overNumber === (c.over ?? ball.overNumber) && ball.ballInOver === (c.ball ?? -1);
    case 'BALL_RANGE':
      return (
        (c.over == null || ball.overNumber === c.over) &&
        inRange(ball.ballInOver, c.ballFrom, c.ballTo, undefined)
      );
    case 'RUNS_EQUALS':
      return ball.actualRuns === (c.runs ?? 0);
    case 'RUNS_GREATER_THAN':
      return ball.actualRuns > (c.runs ?? 0);
    case 'RUNS_LESS_THAN':
      return ball.actualRuns < (c.runs ?? 0);
    case 'WICKET':
      return Boolean(ball.isWicket);
    case 'EXTRA':
      return Boolean(ball.extraType && ball.extraType !== 'NONE');
    case 'DOT_BALL':
      return ball.actualRuns === 0 && !ball.isWicket && (!ball.extraType || ball.extraType === 'NONE');
    case 'BOUNDARY':
      return ball.actualRuns === 4 || ball.actualRuns === 6;
    case 'SIX':
      return ball.actualRuns === 6;
    case 'TARGET_COMPLETED':
      return overState?.completed === true && (c.over == null || ball.overNumber === c.over);
    case 'TARGET_FAILED':
      return overState?.completed === false && (c.over == null || ball.overNumber === c.over);
    case 'HATTRICK':
    case 'BOUNDARY_STREAK':
      // Always excluded from the overlay evaluator via isAutoAppliedRule — the scoring engine
      // inserts these as real bonus/penalty deliveries the moment they trigger (see scoring.service.ts).
      return false;
    default:
      return false;
  }
}

function explain(rule: TournamentRule, original: number, counted: number): string {
  if (rule.condition === 'HATTRICK') {
    return `Hattrick Bonus +${Math.abs(sanitizeDelta(rule.actionConfig.runs))}`;
  }
  if (rule.action === 'IGNORE_RUNS' || rule.action === 'DO_NOT_COUNT_OVER') {
    return `${original} runs not counted because ${rule.name}`;
  }
  if (rule.action === 'MULTIPLY_RUNS') {
    return `${original} runs × ${sanitizeMultiplier(rule.actionConfig.multiplier)} because ${rule.name}`;
  }
  if (rule.action === 'WICKET_PENALTY' || rule.action === 'SUBTRACT_RUNS' || rule.action === 'SUBTRACT_PENALTY') {
    return `${Math.abs(sanitizeDelta(rule.actionConfig.runs))} run penalty because ${rule.name}`;
  }
  if (rule.action === 'WICKET_BONUS' || rule.action === 'ADD_RUNS' || rule.action === 'ADD_PENALTY') {
    return `${Math.abs(sanitizeDelta(rule.actionConfig.runs))} run adjustment because ${rule.name}`;
  }
  if (counted !== original) return `${original} → ${counted} because ${rule.name}`;
  return rule.name;
}

type BallState = {
  countedRuns: number;
  penaltyRuns: number;
  bonusRuns: number;
  multiplier: number;
  reasons: string[];
};

function applyAction(state: BallState, rule: TournamentRule, ball: RuleBallInput): BallState {
  const next = { ...state, reasons: [...state.reasons] };
  switch (rule.action) {
    case 'COUNT_NORMAL':
    case 'MARK_TARGET_COMPLETE':
    case 'MARK_TARGET_FAILED':
      return next;
    case 'IGNORE_RUNS':
    case 'DO_NOT_COUNT_OVER':
      next.countedRuns = 0;
      next.reasons.push(explain(rule, ball.actualRuns, 0));
      return next;
    case 'MULTIPLY_RUNS': {
      const m = sanitizeMultiplier(rule.actionConfig.multiplier);
      next.countedRuns *= m;
      next.multiplier *= m;
      next.reasons.push(explain(rule, ball.actualRuns, next.countedRuns));
      return next;
    }
    case 'ADD_RUNS':
    case 'WICKET_BONUS':
    case 'ADD_PENALTY': {
      if (rule.action === 'WICKET_BONUS' && !ball.isWicket) return next;
      const delta = Math.abs(sanitizeDelta(rule.actionConfig.runs));
      next.countedRuns += delta;
      next.bonusRuns += delta;
      next.reasons.push(explain(rule, ball.actualRuns, next.countedRuns));
      return next;
    }
    case 'SUBTRACT_RUNS':
    case 'WICKET_PENALTY':
    case 'SUBTRACT_PENALTY': {
      if (rule.action === 'WICKET_PENALTY' && !ball.isWicket) return next;
      const delta = Math.abs(sanitizeDelta(rule.actionConfig.runs));
      next.countedRuns -= delta;
      next.penaltyRuns -= delta;
      next.reasons.push(explain(rule, ball.actualRuns, next.countedRuns));
      return next;
    }
    default:
      return next;
  }
}

function displayOf(original: number, counted: number, multiplier: number): string {
  if (counted === original && multiplier === 1) return String(original);
  if (counted === 0 && original !== 0) return `${original} (0 counted)`;
  if (multiplier !== 1 && original * multiplier === counted) return `${original} × ${multiplier} = ${counted}`;
  return `${original} → ${counted}`;
}

function toResult(ball: RuleBallInput, state: BallState): RuleBallResult {
  return {
    sequence: ball.sequence,
    overNumber: ball.overNumber,
    ballInOver: ball.ballInOver,
    originalRuns: ball.actualRuns,
    countedRuns: state.countedRuns,
    penaltyRuns: state.penaltyRuns,
    bonusRuns: state.bonusRuns,
    multiplier: state.multiplier,
    reason: state.reasons.join(' ') || 'Standard scoring rules are being used.',
    display: displayOf(ball.actualRuns, state.countedRuns, state.multiplier),
  };
}

/**
 * Rules the SCORING ENGINE auto-applies as real ball events (see scoring.service.ts) —
 * hattrick bonuses and boundary bonuses are inserted directly into the ledger the moment
 * they trigger, rather than left as an invisible "counted vs actual" overlay adjustment.
 * Excluded here so they aren't double-counted by the overlay evaluator below.
 */
export function isAutoAppliedRule(rule: Pick<TournamentRule, 'condition' | 'action'>): boolean {
  return (
    rule.condition === 'HATTRICK' ||
    rule.condition === 'BOUNDARY_STREAK' ||
    (rule.condition === 'SIX' && rule.action === 'ADD_RUNS')
  );
}

export function rulesAffect(snapshot: RuleSetSnapshot | null | undefined, key: keyof RuleAffects): boolean {
  if (!snapshot?.enabled) return false;
  return snapshot.rules.some((r) => r.enabled && r.affects[key]);
}

/**
 * Names of enabled rules that actually affect the live "actual vs counted" overlay.
 * Auto-applied rules (hattrick/boundary bonuses) are excluded — the scoring engine inserts
 * them as real ball events the moment they trigger (see isAutoAppliedRule), so listing them
 * here would make the overlay banner claim to be "active" even when nothing has fired yet.
 */
export function publicRuleSummary(snapshot: RuleSetSnapshot | null | undefined): string[] {
  if (!snapshot?.enabled) return [];
  return snapshot.rules.filter((r) => r.enabled && !isAutoAppliedRule(r)).map((r) => r.name);
}

export function evaluateInningsRules(
  snapshot: RuleSetSnapshot | null | undefined,
  balls: RuleBallInput[],
): InningsRuleEvaluation {
  const live = balls.filter((b) => !b.isUndone);
  const actualTotal = live.reduce((sum, b) => sum + b.actualRuns, 0);
  if (!snapshot?.enabled || snapshot.rules.length === 0) {
    return {
      balls: live.map((b) =>
        toResult(b, { countedRuns: b.actualRuns, penaltyRuns: 0, bonusRuns: 0, multiplier: 1, reasons: [] }),
      ),
      actualTotal,
      countedTotal: actualTotal,
      overTargets: [],
    };
  }

  const ordered = sortRules(snapshot.rules);
  const pass1 = ordered.filter((r) => !TARGET_CONDS.has(r.condition) && r.category !== 'TARGET_RULE' && !isAutoAppliedRule(r));
  const targetRules = ordered.filter((r) => r.category === 'TARGET_RULE');
  const pass2 = ordered.filter((r) => TARGET_CONDS.has(r.condition));

  const states = new Map<number, BallState>();
  for (const ball of live) {
    let state: BallState = { countedRuns: ball.actualRuns, penaltyRuns: 0, bonusRuns: 0, multiplier: 1, reasons: [] };
    for (const rule of pass1) {
      if (!conditionMatches(rule, ball)) continue;
      if ((rule.scope === 'OVER' || rule.condition === 'OVER_EQUALS') && rule.conditionConfig.over != null && ball.overNumber !== rule.conditionConfig.over) {
        continue;
      }
      if ((rule.scope === 'BALL' || rule.condition === 'BALL_EQUALS') && rule.conditionConfig.ball != null && ball.ballInOver !== rule.conditionConfig.ball) {
        continue;
      }
      if (rule.conditionConfig.over != null && rule.condition !== 'ALWAYS' && ball.overNumber !== rule.conditionConfig.over && rule.condition !== 'OVER_RANGE') {
        if (rule.condition === 'BALL_EQUALS' || rule.condition === 'BALL_RANGE' || rule.scope === 'OVER' || rule.scope === 'BALL') {
          if (ball.overNumber !== rule.conditionConfig.over) continue;
        }
      }
      state = applyAction(state, rule, ball);
    }
    states.set(ball.sequence, state);
  }

  const overTargets: InningsRuleEvaluation['overTargets'] = [];
  const overs = [...new Set(live.map((b) => b.overNumber))];
  for (const overNumber of overs) {
    const overBalls = live.filter((b) => b.overNumber === overNumber);
    for (const rule of targetRules) {
      if (rule.conditionConfig.over != null && rule.conditionConfig.over !== overNumber) continue;
      const target = Math.max(0, Math.trunc(Number(rule.actionConfig.target ?? 0)));
      if (!target) continue;
      const source = rule.actionConfig.targetSource === 'ADJUSTED' ? 'countedRuns' : 'actual';
      const sum = overBalls.reduce((s, b) => s + (source === 'actual' ? b.actualRuns : (states.get(b.sequence)?.countedRuns ?? b.actualRuns)), 0);
      const completed = sum >= target;
      const action = completed ? (rule.actionConfig.successAction ?? 'COUNT_NORMAL') : (rule.actionConfig.failAction ?? 'COUNT_NORMAL');
      overTargets.push({ overNumber, target, actual: sum, completed, action });
      for (const ball of overBalls) {
        const state = states.get(ball.sequence)!;
        if (!completed && action === 'DO_NOT_COUNT_OVER') {
          states.set(ball.sequence, applyAction(state, { ...rule, action: 'DO_NOT_COUNT_OVER' }, ball));
        } else if (!completed && action === 'ADD_PENALTY' && ball === overBalls[overBalls.length - 1]) {
          states.set(ball.sequence, applyAction(state, { ...rule, action: 'ADD_PENALTY' }, ball));
        } else if (completed && action === 'MULTIPLY_RUNS') {
          states.set(ball.sequence, applyAction(state, { ...rule, action: 'MULTIPLY_RUNS' }, ball));
        } else if (completed && action === 'ADD_RUNS') {
          states.set(ball.sequence, applyAction(state, { ...rule, action: 'ADD_RUNS' }, ball));
        }
        for (const extra of pass2) {
          if (!conditionMatches(extra, ball, { completed })) continue;
          states.set(ball.sequence, applyAction(states.get(ball.sequence)!, extra, ball));
        }
      }
    }
  }

  const results = live.map((b) => toResult(b, states.get(b.sequence)!));
  return {
    balls: results,
    actualTotal,
    countedTotal: results.reduce((s, b) => s + b.countedRuns, 0),
    overTargets,
  };
}

export function previewTournamentRule(input: {
  snapshot: RuleSetSnapshot | null;
  over: number;
  ball: number;
  actualRuns: number;
  isWicket?: boolean;
}): { actual: number; counted: number; multiplier: number; display: string; reason: string } {
  const evaln = evaluateInningsRules(input.snapshot, [
    {
      sequence: 1,
      overNumber: input.over,
      ballInOver: input.ball,
      actualRuns: input.actualRuns,
      isWicket: input.isWicket,
    },
  ]);
  const ball = evaln.balls[0]!;
  return {
    actual: ball.originalRuns,
    counted: ball.countedRuns,
    multiplier: ball.multiplier,
    display: ball.display,
    reason: ball.reason,
  };
}

export function makeRule(partial: Partial<TournamentRule> & Pick<TournamentRule, 'id' | 'name' | 'action'>): TournamentRule {
  return {
    category: 'RUN_RULE',
    scope: 'OVER',
    condition: 'ALWAYS',
    conditionConfig: {},
    actionConfig: {},
    priority: 0,
    enabled: true,
    affects: { ...DEFAULT_RULE_AFFECTS },
    ...partial,
  };
}
