import { describe, expect, it } from 'vitest';
import { wicketFollowKind, wicketFormDelivery } from './wicket-followup';

describe('wicketFollowKind', () => {
  it('sends bowled and lbw immediately', () => {
    expect(wicketFollowKind('BOWLED')).toBe('immediate');
    expect(wicketFollowKind('LBW')).toBe('immediate');
    expect(wicketFollowKind('MANKAD')).toBe('immediate');
    expect(wicketFollowKind('RETIRED_HURT')).toBe('immediate');
  });

  it('opens follow-up screens for detailed dismissals', () => {
    expect(wicketFollowKind('CAUGHT')).toBe('caught');
    expect(wicketFollowKind('STUMPED')).toBe('stumped');
    expect(wicketFollowKind('RUN_OUT')).toBe('runOut');
    expect(wicketFollowKind('RETIRED_OUT')).toBe('retired');
    expect(wicketFollowKind('HIT_WICKET')).toBe('hitWicket');
    expect(wicketFollowKind('OVER_THE_FENCE')).toBe('extrasPad');
  });
});

describe('wicketFormDelivery', () => {
  it('uses completed runs as batsman runs on a legal ball', () => {
    expect(wicketFormDelivery({ completedRuns: 2, byeKind: null, illegal: null })).toEqual({
      batsmanRuns: 2,
    });
  });

  it('treats byes as extras', () => {
    expect(wicketFormDelivery({ completedRuns: 3, byeKind: 'BYE', illegal: null })).toEqual({
      batsmanRuns: 0,
      extraType: 'BYE',
      extraRuns: 3,
    });
  });

  it('adds the no-ball extra on top of batsman runs', () => {
    expect(wicketFormDelivery({ completedRuns: 1, byeKind: null, illegal: 'NO_BALL' })).toEqual({
      batsmanRuns: 1,
      extraType: 'NO_BALL',
      extraRuns: 1,
    });
  });

  it('counts bye runs as no-ball extras', () => {
    expect(wicketFormDelivery({ completedRuns: 2, byeKind: 'LEG_BYE', illegal: 'NO_BALL' })).toEqual({
      batsmanRuns: 0,
      extraType: 'NO_BALL',
      extraRuns: 3,
    });
  });

  it('adds completed runs onto a wide', () => {
    expect(wicketFormDelivery({ completedRuns: 2, byeKind: null, illegal: 'WIDE' })).toEqual({
      batsmanRuns: 0,
      extraType: 'WIDE',
      extraRuns: 3,
    });
  });
});
