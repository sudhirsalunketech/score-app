import { describe, expect, it } from 'vitest';
import { buildKnockoutPlan, groupKnockoutSlots, openingRoundFor, seededPairs } from './knockout';

describe('knockout fixture generator', () => {
  it('builds SF + Final for 4 teams with stored feed relationships', () => {
    const plan = buildKnockoutPlan({ teamIds: ['a', 'b', 'c', 'd'], pairing: 'SEEDED' });
    expect(openingRoundFor(4)).toBe('SEMI_FINAL');
    expect(plan.filter((s) => s.round === 'SEMI_FINAL')).toHaveLength(2);
    expect(plan.filter((s) => s.round === 'FINAL')).toHaveLength(1);
    const final = plan.find((s) => s.round === 'FINAL')!;
    const semis = plan.filter((s) => s.round === 'SEMI_FINAL');
    expect(semis.every((s) => s.feedsIntoKey === final.key)).toBe(true);
    expect(semis.map((s) => s.feedsIntoSide).sort()).toEqual(['AWAY', 'HOME']);
    expect(seededPairs(4)).toEqual([
      [0, 3],
      [1, 2],
    ]);
    expect(semis[0]?.homeTeamId).toBe('a');
    expect(semis[0]?.awayTeamId).toBe('d');
  });

  it('builds QF + SF + Final for 8 teams', () => {
    const ids = ['1', '2', '3', '4', '5', '6', '7', '8'];
    const plan = buildKnockoutPlan({ teamIds: ids, pairing: 'SEEDED', includeThirdPlace: true });
    expect(plan.filter((s) => s.round === 'QUARTER_FINAL')).toHaveLength(4);
    expect(plan.filter((s) => s.round === 'SEMI_FINAL')).toHaveLength(2);
    expect(plan.filter((s) => s.round === 'FINAL')).toHaveLength(1);
    expect(plan.filter((s) => s.round === 'THIRD_PLACE')).toHaveLength(1);
    const grouped = groupKnockoutSlots(plan.map((s) => ({ knockoutRound: s.round, knockoutSlot: s.slot })));
    expect(grouped.map((g) => g.round)).toEqual(['QUARTER_FINAL', 'SEMI_FINAL', 'THIRD_PLACE', 'FINAL']);
  });

  it('rejects a single team and duplicates', () => {
    expect(() => buildKnockoutPlan({ teamIds: ['a'] })).toThrow(/two teams/i);
    expect(() => buildKnockoutPlan({ teamIds: ['a', 'a'] })).toThrow(/duplicate/i);
  });
});
