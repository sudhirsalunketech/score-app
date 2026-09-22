import { describe, expect, it } from 'vitest';
import { applyCountedRunsToBatter, eventStatPolicy } from './event-stat-policy';

describe('eventStatPolicy', () => {
  it('counts a normal run and boundary toward player and team stats', () => {
    expect(eventStatPolicy({ extraType: 'NONE', batsmanRuns: 1 }).affectsBatterStats).toBe(true);
    expect(eventStatPolicy({ extraType: 'NONE', batsmanRuns: 4 }).affectsBowlerStats).toBe(true);
    expect(eventStatPolicy({ extraType: 'NONE', isWicket: true }).affectsMvp).toBe(true);
  });

  it('keeps extras on the team score but not always on the batter', () => {
    expect(eventStatPolicy({ extraType: 'WIDE', extraRuns: 1 }).affectsBatterStats).toBe(false);
    expect(eventStatPolicy({ extraType: 'WIDE', extraRuns: 1 }).affectsBowlerStats).toBe(true);
    expect(eventStatPolicy({ extraType: 'BYE', extraRuns: 1 }).affectsBatterStats).toBe(false);
    expect(eventStatPolicy({ extraType: 'PENALTY', extraRuns: -5 }).affectsPlayerStats).toBe(false);
    expect(eventStatPolicy({ extraType: 'PENALTY', extraRuns: -5 }).affectsTeamScore).toBe(true);
  });

  it('ignores undone events and honors rule playerStats=false', () => {
    expect(eventStatPolicy({ isUndone: true, batsmanRuns: 6 }).affectsTeamScore).toBe(false);
    expect(eventStatPolicy({ extraType: 'NONE', batsmanRuns: 6, ruleAffects: { playerStats: false } }).affectsPlayerStats).toBe(
      false,
    );
  });

  it('applies counted-run deltas only when player stats are affected', () => {
    expect(applyCountedRunsToBatter({ batsmanRuns: 4, originalRuns: 4, countedRuns: 8, affectsPlayerStats: true })).toBe(8);
    expect(applyCountedRunsToBatter({ batsmanRuns: 4, originalRuns: 4, countedRuns: 8, affectsPlayerStats: false })).toBe(4);
  });
});
