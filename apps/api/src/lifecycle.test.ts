import { describe, expect, it } from 'vitest';
import { MatchStatus } from '@prisma/client';
import { assertTransition, matchStructureLocked } from './domain/lifecycle';
import { isMatchStructureLocked } from './domain/structure-lock';

describe('match lifecycle', () => {
  it('allows scheduled → toss pending → toss completed → live', () => {
    expect(() => assertTransition(MatchStatus.SCHEDULED, MatchStatus.TOSS_PENDING)).not.toThrow();
    expect(() => assertTransition(MatchStatus.TOSS_PENDING, MatchStatus.TOSS_COMPLETED)).not.toThrow();
    expect(() => assertTransition(MatchStatus.TOSS_COMPLETED, MatchStatus.LIVE)).not.toThrow();
  });

  it('rejects live → draft', () => {
    expect(() => assertTransition(MatchStatus.LIVE, MatchStatus.DRAFT)).toThrow();
  });

  it('allows live scoring to be abandoned or cancelled', () => {
    expect(() => assertTransition(MatchStatus.LIVE, MatchStatus.ABANDONED)).not.toThrow();
    expect(() => assertTransition(MatchStatus.LIVE, MatchStatus.CANCELLED)).not.toThrow();
  });

  it('locks format and teams after scoring starts', () => {
    expect(matchStructureLocked(MatchStatus.SCHEDULED)).toBe(false);
    expect(matchStructureLocked(MatchStatus.TOSS_COMPLETED)).toBe(false);
    expect(matchStructureLocked(MatchStatus.LIVE)).toBe(true);
    expect(matchStructureLocked(MatchStatus.INNINGS_BREAK)).toBe(true);
    expect(matchStructureLocked(MatchStatus.DRINKS_BREAK)).toBe(true);
    expect(matchStructureLocked(MatchStatus.COMPLETED)).toBe(true);
    expect(isMatchStructureLocked(MatchStatus.TOSS_COMPLETED, 0)).toBe(false);
    expect(isMatchStructureLocked(MatchStatus.TOSS_COMPLETED, 1)).toBe(true);
    expect(isMatchStructureLocked(MatchStatus.LIVE, 0)).toBe(true);
  });

  it('allows live pause and resume', () => {
    expect(() => assertTransition(MatchStatus.LIVE, MatchStatus.DRINKS_BREAK)).not.toThrow();
    expect(() => assertTransition(MatchStatus.LIVE, MatchStatus.RAIN_DELAY)).not.toThrow();
    expect(() => assertTransition(MatchStatus.DRINKS_BREAK, MatchStatus.LIVE)).not.toThrow();
    expect(() => assertTransition(MatchStatus.DRAFT, MatchStatus.DRINKS_BREAK)).toThrow();
  });
});
