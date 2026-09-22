import { describe, expect, it } from 'vitest';
import { isScoringReady, isWicketControlEnabled, shouldResetMatchPersonnel } from './wicket-control';

const ready = {
  strikerId: 's1',
  nonStrikerId: 'ns1',
  bowlerId: 'b1',
  matchStatus: 'LIVE',
  inningsStatus: 'IN_PROGRESS',
  inningsComplete: false,
  wickets: 1,
  maxWickets: 7,
};

describe('isWicketControlEnabled', () => {
  it('enables Out when striker, non-striker, bowler and a live innings are present', () => {
    expect(isWicketControlEnabled(ready)).toBe(true);
  });

  it('stays disabled when any required player is missing', () => {
    expect(isWicketControlEnabled({ ...ready, bowlerId: null })).toBe(false);
    expect(isWicketControlEnabled({ ...ready, strikerId: null })).toBe(false);
    expect(isWicketControlEnabled({ ...ready, nonStrikerId: null })).toBe(false);
  });

  it('stays disabled after the wicket limit or when the innings is closed', () => {
    expect(isWicketControlEnabled({ ...ready, wickets: 7 })).toBe(false);
    expect(isWicketControlEnabled({ ...ready, inningsComplete: true, wickets: 3 })).toBe(false);
    expect(isWicketControlEnabled({ ...ready, matchStatus: 'INNINGS_BREAK' })).toBe(false);
  });
});

describe('isScoringReady', () => {
  it('enables Out only after a confirmed valid player setup and wickets remain', () => {
    expect(isScoringReady({ ...ready, setupConfirmed: true })).toBe(true);
    expect(isScoringReady({ ...ready, setupConfirmed: false })).toBe(false);
    expect(isScoringReady({ ...ready, setupConfirmed: true, wickets: 7 })).toBe(false);
  });
});

describe('shouldResetMatchPersonnel', () => {
  it('clears leftover scoring personnel when opening a different match', () => {
    expect(shouldResetMatchPersonnel('match-1', 'match-2')).toBe(true);
    expect(shouldResetMatchPersonnel(null, 'match-2')).toBe(true);
    expect(shouldResetMatchPersonnel('match-2', 'match-2')).toBe(false);
  });
});
