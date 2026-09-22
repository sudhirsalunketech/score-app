import { describe, expect, it } from 'vitest';
import { isHighFrequencyScoringPath } from './scoring-throttle';

describe('isHighFrequencyScoringPath', () => {
  it('skips live, scorecard, events, and undo', () => {
    expect(isHighFrequencyScoringPath('/api/v1/matches/abc/live')).toBe(true);
    expect(isHighFrequencyScoringPath('/matches/abc/scorecard')).toBe(true);
    expect(isHighFrequencyScoringPath('/api/v1/innings/inn1/events')).toBe(true);
    expect(isHighFrequencyScoringPath('/innings/inn1/undo?x=1')).toBe(true);
  });

  it('still throttles other match routes', () => {
    expect(isHighFrequencyScoringPath('/api/v1/matches')).toBe(false);
    expect(isHighFrequencyScoringPath('/api/v1/matches/abc')).toBe(false);
    expect(isHighFrequencyScoringPath('/api/v1/clubs')).toBe(false);
    expect(isHighFrequencyScoringPath('/api/v1/auth/login')).toBe(false);
  });
});
