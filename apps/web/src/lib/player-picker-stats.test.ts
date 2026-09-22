import { describe, expect, it } from 'vitest';
import {
  battingStatsMap,
  bowlingStatsMap,
  formatBattingStat,
  formatBowlingStat,
  lastCompletedOverBowlerId,
} from './player-picker-stats';

describe('player picker stats', () => {
  it('formats batting as runs(balls) and bowling as wickets/runs', () => {
    expect(formatBattingStat({ runs: 12, balls: 8 })).toBe('12(8)');
    expect(formatBattingStat(null)).toBe('0(0)');
    expect(formatBowlingStat({ wickets: 1, runs: 18 })).toBe('1/18');
    expect(formatBowlingStat(null)).toBe('0/0');
  });

  it('maps snapshot cards by player id', () => {
    expect(battingStatsMap([{ playerId: 'a', runs: 4, balls: 3 }])).toEqual({ a: '4(3)' });
    expect(bowlingStatsMap([{ playerId: 'b', wickets: 2, runs: 9 }])).toEqual({ b: '2/9' });
  });

  it('blocks the bowler who just finished an over', () => {
    const events = [
      { overNumber: 0, bowlerId: 'first', isUndone: false },
      { overNumber: 0, bowlerId: 'first', isUndone: false },
    ];
    expect(lastCompletedOverBowlerId(events, { currentOver: 1, ballsInCurrentOver: 0 })).toBe('first');
    expect(lastCompletedOverBowlerId(events, { currentOver: 1, ballsInCurrentOver: 2 })).toBeNull();
    expect(lastCompletedOverBowlerId(events, { currentOver: 0, ballsInCurrentOver: 0 })).toBeNull();
  });

  it('ignores undone balls', () => {
    const events = [
      { overNumber: 0, bowlerId: 'first', isUndone: true },
      { overNumber: 0, bowlerId: 'second', isUndone: false },
    ];
    expect(lastCompletedOverBowlerId(events, { currentOver: 1, ballsInCurrentOver: 0 })).toBe('second');
  });
});
