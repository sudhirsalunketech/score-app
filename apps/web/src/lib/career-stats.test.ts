import { describe, expect, it } from 'vitest';
import { battingAverage, bestBowling, bowlingAverage, formatAvg } from './career-stats';

describe('career stats', () => {
  it('computes batting average from dismissals', () => {
    expect(battingAverage({ runs: 40, innings: 5, notOuts: 1 })).toBe(10);
    expect(battingAverage({ runs: 12, innings: 0 })).toBeNull();
  });

  it('computes bowling average and best figures', () => {
    expect(bowlingAverage({ wickets: 4, runsConceded: 20 })).toBe(5);
    expect(bowlingAverage({ wickets: 0, runsConceded: 10 })).toBeNull();
    expect(bestBowling({ bestBowlWkts: 3, bestBowlRuns: 8 })).toBe('3-8');
    expect(bestBowling({ bestBowlWkts: 0, bestBowlRuns: 0 })).toBe('—');
    expect(formatAvg(9.84)).toBe('9.8');
  });
});
