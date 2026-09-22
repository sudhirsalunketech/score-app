import { describe, expect, it } from 'vitest';
import { defaultOverRuleName, evaluateOverRule, overActuals } from './over-rules';

describe('defaultOverRuleName', () => {
  it('shows a 1-indexed over number when no custom name is set', () => {
    expect(defaultOverRuleName(0)).toBe('Over 1 Rule');
    expect(defaultOverRuleName(4)).toBe('Over 5 Rule');
  });
});

describe('evaluateOverRule — TARGET', () => {
  const rule = { ruleType: 'TARGET' as const, name: 'Power Over', config: { target: 10, achievedBonus: 2, notAchievedPenalty: 1 } };

  it('applies the achieved bonus when actual runs meet the target', () => {
    expect(evaluateOverRule(rule, 10, 0)).toEqual({
      matched: true,
      bonusRuns: 2,
      penaltyRuns: 0,
      message: 'Power Over — Target Achieved +2 Bonus',
    });
  });

  it('applies the achieved bonus when actual runs exceed the target', () => {
    expect(evaluateOverRule(rule, 15, 0)).toMatchObject({ bonusRuns: 2, penaltyRuns: 0 });
  });

  it('applies the failure penalty when actual runs miss the target', () => {
    expect(evaluateOverRule(rule, 8, 0)).toEqual({
      matched: true,
      bonusRuns: 0,
      penaltyRuns: 1,
      message: 'Power Over — Target Failed -1 Penalty',
    });
  });

  it('falls back to a default label when no custom name is set', () => {
    const unnamed = { ruleType: 'TARGET' as const, config: { target: 5, achievedBonus: 1, notAchievedPenalty: 1 } };
    expect(evaluateOverRule(unnamed, 5, 0).message).toBe('Target Over — Target Achieved +1 Bonus');
  });
});

describe('evaluateOverRule — MAPPING', () => {
  it('applies the configured bonus for an exact run-count match', () => {
    const rule = {
      ruleType: 'MAPPING' as const,
      name: 'Boundary Bonus',
      config: { mapping: [{ kind: 'RUN', count: 1, value: 1 }, { kind: 'RUN', count: 2, value: 2 }, { kind: 'RUN', count: 3, value: 3 }] },
    };
    expect(evaluateOverRule(rule, 2, 0)).toEqual({ matched: true, bonusRuns: 2, penaltyRuns: 0, message: 'Boundary Bonus — +2 Bonus' });
  });

  it('applies no bonus when the actual runs are not in the mapping', () => {
    const rule = { ruleType: 'MAPPING' as const, name: 'Boundary Bonus', config: { mapping: [{ kind: 'RUN', count: 1, value: 1 }] } };
    expect(evaluateOverRule(rule, 7, 0)).toEqual({ matched: false, bonusRuns: 0, penaltyRuns: 0, message: 'Boundary Bonus — No Adjustment' });
  });

  it('applies the configured penalty for an exact wicket-count match', () => {
    const rule = {
      ruleType: 'MAPPING' as const,
      name: 'Wicket Watch',
      config: { mapping: [{ kind: 'WICKET', count: 1, value: 1 }, { kind: 'WICKET', count: 2, value: 2 }] },
    };
    expect(evaluateOverRule(rule, 0, 2)).toEqual({ matched: true, bonusRuns: 0, penaltyRuns: 2, message: 'Wicket Watch — -2 Penalty' });
  });

  it('applies no penalty when no wickets fell', () => {
    const rule = { ruleType: 'MAPPING' as const, name: 'Wicket Watch', config: { mapping: [{ kind: 'WICKET', count: 1, value: 1 }] } };
    expect(evaluateOverRule(rule, 0, 0)).toEqual({ matched: false, bonusRuns: 0, penaltyRuns: 0, message: 'Wicket Watch — No Adjustment' });
  });

  it('an OTHER row always applies its bonus regardless of runs or wickets', () => {
    const rule = { ruleType: 'MAPPING' as const, name: 'Manual Adjustment', config: { mapping: [{ kind: 'OTHER', count: 0, value: 4 }] } };
    expect(evaluateOverRule(rule, 0, 0)).toEqual({ matched: true, bonusRuns: 4, penaltyRuns: 0, message: 'Manual Adjustment — +4 Bonus' });
    expect(evaluateOverRule(rule, 99, 9)).toMatchObject({ bonusRuns: 4 });
  });

  it('sums bonuses and penalties from multiple rows of mixed kinds in one rule', () => {
    const rule = {
      ruleType: 'MAPPING' as const,
      name: 'Mixed',
      config: {
        mapping: [
          { kind: 'RUN', count: 6, value: 3 },
          { kind: 'WICKET', count: 2, value: 5 },
          { kind: 'OTHER', count: 0, value: 1 },
        ],
      },
    };
    expect(evaluateOverRule(rule, 6, 2)).toEqual({ matched: true, bonusRuns: 4, penaltyRuns: 5, message: 'Mixed — +4 Bonus / -5 Penalty' });
  });
});

describe('evaluateOverRule — CUSTOM', () => {
  it('always applies the configured flat bonus and penalty, regardless of runs or wickets', () => {
    const rule = { ruleType: 'CUSTOM' as const, name: 'Power Over Special', config: { bonusRuns: 2, penaltyRuns: 3 } };
    expect(evaluateOverRule(rule, 0, 0)).toEqual({
      matched: true,
      bonusRuns: 2,
      penaltyRuns: 3,
      message: 'Power Over Special — +2 Bonus / -3 Penalty',
    });
    expect(evaluateOverRule(rule, 20, 5)).toMatchObject({ bonusRuns: 2, penaltyRuns: 3 });
  });

  it('reports no adjustment when both bonus and penalty are zero', () => {
    const rule = { ruleType: 'CUSTOM' as const, config: { bonusRuns: 0, penaltyRuns: 0 } };
    expect(evaluateOverRule(rule, 4, 0)).toEqual({ matched: false, bonusRuns: 0, penaltyRuns: 0, message: 'Custom Rule — No Adjustment' });
  });
});

describe('overActuals', () => {
  const bpo = 6;

  it('sums actual runs and wickets for only the requested over', () => {
    const events = [
      { overNumber: 0, batsmanRuns: 4, extraRuns: 0, isWicket: false, extraType: 'NONE' as const },
      { overNumber: 0, batsmanRuns: 1, extraRuns: 0, isWicket: true, extraType: 'NONE' as const },
      { overNumber: 1, batsmanRuns: 6, extraRuns: 0, isWicket: false, extraType: 'NONE' as const },
    ];
    expect(overActuals(events, 0, bpo)).toMatchObject({ actualRuns: 5, actualWickets: 1 });
  });

  it('excludes rule-adjustment PENALTY pseudo-events from actual runs (no compounding)', () => {
    const events = [
      { overNumber: 0, batsmanRuns: 4, extraRuns: 0, isWicket: false, extraType: 'NONE' as const },
      { overNumber: 0, batsmanRuns: 0, extraRuns: 2, isWicket: false, extraType: 'PENALTY' as const },
    ];
    expect(overActuals(events, 0, bpo).actualRuns).toBe(4);
  });

  it('excludes undone balls from actual runs and legal-ball counts', () => {
    const events = [
      { overNumber: 0, batsmanRuns: 4, extraRuns: 0, isWicket: false, extraType: 'NONE' as const },
      { overNumber: 0, batsmanRuns: 6, extraRuns: 0, isWicket: false, extraType: 'NONE' as const, isUndone: true },
    ];
    expect(overActuals(events, 0, bpo)).toMatchObject({ actualRuns: 4, legalBalls: 1 });
  });

  it('reports the over as complete once legal balls reach ballsPerOver', () => {
    const events = Array.from({ length: 6 }, () => ({ overNumber: 0, batsmanRuns: 1, extraRuns: 0, isWicket: false, extraType: 'NONE' as const }));
    expect(overActuals(events, 0, bpo).isOverComplete).toBe(true);
  });

  it('reports the over as incomplete when fewer than ballsPerOver legal balls have been bowled', () => {
    const events = [{ overNumber: 0, batsmanRuns: 1, extraRuns: 0, isWicket: false, extraType: 'NONE' as const }];
    expect(overActuals(events, 0, bpo).isOverComplete).toBe(false);
  });

  it('does not count illegal deliveries (wide/no-ball) toward legal-ball completion by default', () => {
    const events = [
      ...Array.from({ length: 5 }, () => ({ overNumber: 0, batsmanRuns: 1, extraRuns: 0, isWicket: false, extraType: 'NONE' as const })),
      { overNumber: 0, batsmanRuns: 0, extraRuns: 1, isWicket: false, extraType: 'WIDE' as const },
    ];
    expect(overActuals(events, 0, bpo)).toMatchObject({ legalBalls: 5, isOverComplete: false });
  });
});
