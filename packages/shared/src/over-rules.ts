import { isLegalBall, type ExtraType, type LegalBallOptions } from './index';

export type OverRuleType = 'TARGET' | 'MAPPING' | 'CUSTOM';
export type OverRuleMappingKind = 'RUN' | 'WICKET' | 'OTHER';
export type OverRuleMappingRow = { kind: OverRuleMappingKind; count: number; value: number };

export type OverRuleRow = {
  ruleType: OverRuleType;
  name?: string | null;
  config: Record<string, unknown>;
};

export type OverRuleOutcome = {
  matched: boolean;
  bonusRuns: number;
  penaltyRuns: number;
  message: string;
};

export function defaultOverRuleName(overNumber: number): string {
  return `Over ${overNumber + 1} Rule`;
}

function positiveInt(value: unknown): number {
  const n = Math.trunc(Number(value) || 0);
  return Math.max(0, n);
}

/**
 * Evaluates one over's rule against the ACTUAL runs/wickets bowled in that over only —
 * never against any previously-applied rule bonus/penalty, per the "no compounding" requirement.
 */
export function evaluateOverRule(rule: OverRuleRow, actualRuns: number, actualWickets: number): OverRuleOutcome {
  const name = rule.name?.trim() || undefined;
  if (rule.ruleType === 'TARGET') {
    const target = positiveInt(rule.config.target);
    const achievedBonus = positiveInt(rule.config.achievedBonus);
    const notAchievedPenalty = positiveInt(rule.config.notAchievedPenalty);
    const achieved = actualRuns >= target;
    return {
      matched: true,
      bonusRuns: achieved ? achievedBonus : 0,
      penaltyRuns: achieved ? 0 : notAchievedPenalty,
      message: achieved
        ? `${name ?? 'Target Over'} — Target Achieved${achievedBonus ? ` +${achievedBonus} Bonus` : ''}`
        : `${name ?? 'Target Over'} — Target Failed${notAchievedPenalty ? ` -${notAchievedPenalty} Penalty` : ''}`,
    };
  }
  if (rule.ruleType === 'MAPPING') {
    const rows = Array.isArray(rule.config.mapping) ? (rule.config.mapping as Array<Record<string, unknown>>) : [];
    let bonusRuns = 0;
    let penaltyRuns = 0;
    for (const row of rows) {
      const value = positiveInt(row.value);
      if (!value) continue;
      const count = positiveInt(row.count);
      if (row.kind === 'WICKET') {
        if (count === actualWickets) penaltyRuns += value;
      } else if (row.kind === 'RUN') {
        if (count === actualRuns) bonusRuns += value;
      } else if (row.kind === 'OTHER') {
        bonusRuns += value;
      }
    }
    const parts = [bonusRuns ? `+${bonusRuns} Bonus` : null, penaltyRuns ? `-${penaltyRuns} Penalty` : null].filter(Boolean);
    return {
      matched: bonusRuns > 0 || penaltyRuns > 0,
      bonusRuns,
      penaltyRuns,
      message: parts.length ? `${name ?? 'Mapping Rule'} — ${parts.join(' / ')}` : `${name ?? 'Mapping Rule'} — No Adjustment`,
    };
  }
  if (rule.ruleType === 'CUSTOM') {
    const bonusRuns = positiveInt(rule.config.bonusRuns);
    const penaltyRuns = positiveInt(rule.config.penaltyRuns);
    const parts = [bonusRuns ? `+${bonusRuns} Bonus` : null, penaltyRuns ? `-${penaltyRuns} Penalty` : null].filter(Boolean);
    return {
      matched: bonusRuns > 0 || penaltyRuns > 0,
      bonusRuns,
      penaltyRuns,
      message: parts.length ? `${name ?? 'Custom Rule'} — ${parts.join(' / ')}` : `${name ?? 'Custom Rule'} — No Adjustment`,
    };
  }
  return { matched: false, bonusRuns: 0, penaltyRuns: 0, message: `${name ?? 'Rule'} — No Adjustment` };
}

export type OverActuals = {
  actualRuns: number;
  actualWickets: number;
  legalBalls: number;
  isOverComplete: boolean;
};

/**
 * Aggregates the ACTUAL runs/wickets bowled in one over, straight from raw ball events —
 * never from any rule-adjusted total. Excludes PENALTY-extraType events (the pre-existing
 * hattrick/boundary-bonus auto-injected pseudo-events) so an older rule's bonus can never
 * compound into a new over-rule's evaluation, and skips undone balls.
 */
export function overActuals(
  events: Array<{ overNumber: number; batsmanRuns: number; extraRuns: number; isWicket: boolean; extraType: ExtraType; isUndone?: boolean }>,
  overNumber: number,
  ballsPerOver: number,
  legalBallOptions: LegalBallOptions = {},
): OverActuals {
  let actualRuns = 0;
  let actualWickets = 0;
  let legalBalls = 0;
  for (const ev of events) {
    if (ev.isUndone) continue;
    if (ev.overNumber !== overNumber) continue;
    if (ev.extraType === 'PENALTY') continue;
    actualRuns += ev.batsmanRuns + ev.extraRuns;
    if (ev.isWicket) actualWickets += 1;
    if (isLegalBall(ev.extraType, legalBallOptions)) legalBalls += 1;
  }
  return { actualRuns, actualWickets, legalBalls, isOverComplete: legalBalls >= Math.max(1, ballsPerOver) };
}
