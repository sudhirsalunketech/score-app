import { describe, expect, it } from 'vitest';
import { overRuleUpsertSchema } from './over-rules.service';

describe('overRuleUpsertSchema — TARGET', () => {
  it('accepts a valid target config', () => {
    const result = overRuleUpsertSchema.safeParse({
      ruleType: 'TARGET',
      name: 'Power Over',
      config: { target: 10, achievedBonus: 2, notAchievedPenalty: 1 },
    });
    expect(result.success).toBe(true);
  });

  it('rejects a target config missing a required field', () => {
    expect(overRuleUpsertSchema.safeParse({ ruleType: 'TARGET', config: { target: 10 } }).success).toBe(false);
  });

  it('rejects a target config with a negative value', () => {
    expect(
      overRuleUpsertSchema.safeParse({ ruleType: 'TARGET', config: { target: -1, achievedBonus: 2, notAchievedPenalty: 1 } }).success,
    ).toBe(false);
  });

  it('rejects a MAPPING-shaped config submitted under ruleType TARGET', () => {
    expect(overRuleUpsertSchema.safeParse({ ruleType: 'TARGET', config: { mapping: [{ kind: 'RUN', count: 1, value: 1 }] } }).success).toBe(false);
  });

  it('allows an omitted or null name (defaults to "Over N Rule" downstream)', () => {
    expect(overRuleUpsertSchema.safeParse({ ruleType: 'TARGET', config: { target: 5, achievedBonus: 1, notAchievedPenalty: 1 } }).success).toBe(true);
    expect(
      overRuleUpsertSchema.safeParse({ ruleType: 'TARGET', name: null, config: { target: 5, achievedBonus: 1, notAchievedPenalty: 1 } }).success,
    ).toBe(true);
  });
});

describe('overRuleUpsertSchema — MAPPING', () => {
  it('accepts a valid mix of RUN/WICKET/OTHER mapping rows', () => {
    expect(
      overRuleUpsertSchema.safeParse({
        ruleType: 'MAPPING',
        config: { mapping: [{ kind: 'RUN', count: 1, value: 1 }, { kind: 'WICKET', count: 2, value: 2 }, { kind: 'OTHER', count: 0, value: 6 }] },
      }).success,
    ).toBe(true);
  });

  it('accepts an empty mapping array', () => {
    expect(overRuleUpsertSchema.safeParse({ ruleType: 'MAPPING', config: { mapping: [] } }).success).toBe(true);
  });

  it('rejects a mapping row with an unknown kind', () => {
    expect(overRuleUpsertSchema.safeParse({ ruleType: 'MAPPING', config: { mapping: [{ kind: 'SIX', count: 1, value: 1 }] } }).success).toBe(false);
  });

  it('rejects a mapping row with a non-integer count', () => {
    expect(overRuleUpsertSchema.safeParse({ ruleType: 'MAPPING', config: { mapping: [{ kind: 'RUN', count: 'six', value: 1 }] } }).success).toBe(
      false,
    );
  });

  it('rejects a mapping row with a zero or negative value', () => {
    expect(overRuleUpsertSchema.safeParse({ ruleType: 'MAPPING', config: { mapping: [{ kind: 'WICKET', count: 1, value: 0 }] } }).success).toBe(
      false,
    );
  });

  it('rejects a TARGET-shaped config submitted under ruleType MAPPING', () => {
    expect(overRuleUpsertSchema.safeParse({ ruleType: 'MAPPING', config: { target: 10, achievedBonus: 2, notAchievedPenalty: 1 } }).success).toBe(
      false,
    );
  });
});

describe('overRuleUpsertSchema — CUSTOM', () => {
  it('accepts a valid flat bonus/penalty config', () => {
    expect(overRuleUpsertSchema.safeParse({ ruleType: 'CUSTOM', name: 'Power Over', config: { bonusRuns: 2, penaltyRuns: 3 } }).success).toBe(true);
  });

  it('rejects a config missing a required field', () => {
    expect(overRuleUpsertSchema.safeParse({ ruleType: 'CUSTOM', config: { bonusRuns: 2 } }).success).toBe(false);
  });

  it('rejects a negative value', () => {
    expect(overRuleUpsertSchema.safeParse({ ruleType: 'CUSTOM', config: { bonusRuns: -1, penaltyRuns: 0 } }).success).toBe(false);
  });

  it('rejects a mapping-shaped config submitted under ruleType CUSTOM', () => {
    expect(overRuleUpsertSchema.safeParse({ ruleType: 'CUSTOM', config: { mapping: { '1': 1 } } }).success).toBe(false);
  });
});

describe('overRuleUpsertSchema — general', () => {
  it('rejects an unknown ruleType', () => {
    expect(overRuleUpsertSchema.safeParse({ ruleType: 'SOMETHING_ELSE', config: {} }).success).toBe(false);
  });

  it('rejects a rule name longer than 80 characters', () => {
    const result = overRuleUpsertSchema.safeParse({
      ruleType: 'TARGET',
      name: 'x'.repeat(81),
      config: { target: 1, achievedBonus: 1, notAchievedPenalty: 1 },
    });
    expect(result.success).toBe(false);
  });
});
