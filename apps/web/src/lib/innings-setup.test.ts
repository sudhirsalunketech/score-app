import { afterEach, describe, expect, it } from 'vitest';
import {
  clearStoredPersonnel,
  readStoredPersonnel,
  suggestInningsPersonnel,
  validateInningsPersonnel,
  writeStoredPersonnel,
} from './innings-setup';

const batting = ['gamma-1', 'gamma-2', 'gamma-3'];
const bowling = ['alpha-1', 'alpha-2', 'alpha-3'];

describe('validateInningsPersonnel', () => {
  it('requires striker, non-striker and bowler', () => {
    expect(
      validateInningsPersonnel({
        strikerId: 'gamma-1',
        nonStrikerId: 'gamma-2',
        bowlerId: null,
        battingPlayerIds: batting,
        bowlingPlayerIds: bowling,
      }),
    ).toBe('personnelMissing');
  });

  it('rejects the same player at both ends', () => {
    expect(
      validateInningsPersonnel({
        strikerId: 'gamma-1',
        nonStrikerId: 'gamma-1',
        bowlerId: 'alpha-1',
        battingPlayerIds: batting,
        bowlingPlayerIds: bowling,
      }),
    ).toBe('personnelSameEnds');
  });

  it('requires both batsmen from the batting team', () => {
    expect(
      validateInningsPersonnel({
        strikerId: 'alpha-1',
        nonStrikerId: 'gamma-2',
        bowlerId: 'alpha-2',
        battingPlayerIds: batting,
        bowlingPlayerIds: bowling,
      }),
    ).toBe('personnelStrikerTeam');
    expect(
      validateInningsPersonnel({
        strikerId: 'gamma-1',
        nonStrikerId: 'alpha-2',
        bowlerId: 'alpha-1',
        battingPlayerIds: batting,
        bowlingPlayerIds: bowling,
      }),
    ).toBe('personnelNonStrikerTeam');
  });

  it('requires the bowler from the fielding team', () => {
    expect(
      validateInningsPersonnel({
        strikerId: 'gamma-1',
        nonStrikerId: 'gamma-2',
        bowlerId: 'gamma-3',
        battingPlayerIds: batting,
        bowlingPlayerIds: bowling,
      }),
    ).toBe('personnelBowlerTeam');
  });

  it('accepts a valid second-innings setup', () => {
    expect(
      validateInningsPersonnel({
        strikerId: 'gamma-1',
        nonStrikerId: 'gamma-2',
        bowlerId: 'alpha-1',
        battingPlayerIds: batting,
        bowlingPlayerIds: bowling,
      }),
    ).toBeNull();
  });

  it('rejects a dismissed batsman from returning to the crease', () => {
    expect(
      validateInningsPersonnel({
        strikerId: 'gamma-1',
        nonStrikerId: 'gamma-2',
        bowlerId: 'alpha-1',
        battingPlayerIds: batting,
        bowlingPlayerIds: bowling,
        dismissedIds: ['gamma-1'],
      }),
    ).toBe('personnelStrikerTeam');
  });
});

describe('suggestInningsPersonnel', () => {
  it('picks the first two batters and a bowler from the other side', () => {
    expect(
      suggestInningsPersonnel(
        [{ id: 'gamma-1' }, { id: 'gamma-2' }, { id: 'gamma-3' }],
        [{ id: 'alpha-1' }, { id: 'alpha-2' }],
      ),
    ).toEqual({
      strikerId: 'gamma-1',
      nonStrikerId: 'gamma-2',
      bowlerId: 'alpha-1',
      confirmed: false,
    });
  });

  it('does not invent players when a side is short', () => {
    expect(suggestInningsPersonnel([{ id: 'gamma-1' }], [{ id: 'alpha-1' }])).toBeNull();
  });
});

describe('stored innings personnel resume', () => {
  afterEach(() => {
    clearStoredPersonnel('match-2', 'inn-2');
  });

  it('restores a confirmed setup after reload', () => {
    writeStoredPersonnel('match-2', 'inn-2', {
      strikerId: 'gamma-1',
      nonStrikerId: 'gamma-2',
      bowlerId: 'alpha-1',
      confirmed: true,
    });
    expect(readStoredPersonnel('match-2', 'inn-2')).toEqual({
      strikerId: 'gamma-1',
      nonStrikerId: 'gamma-2',
      bowlerId: 'alpha-1',
      confirmed: true,
    });
  });

  it('returns null when nothing was stored so setup can be shown again', () => {
    expect(readStoredPersonnel('match-2', 'missing-innings')).toBeNull();
  });

  it('does not reuse first-innings personnel after the sides swap', () => {
    writeStoredPersonnel('match-2', 'inn-1', {
      strikerId: 'alpha-1',
      nonStrikerId: 'alpha-2',
      bowlerId: 'gamma-1',
      confirmed: true,
    });
    expect(readStoredPersonnel('match-2', 'inn-2')).toBeNull();
    expect(
      validateInningsPersonnel({
        strikerId: 'alpha-1',
        nonStrikerId: 'alpha-2',
        bowlerId: 'gamma-1',
        battingPlayerIds: batting,
        bowlingPlayerIds: bowling,
      }),
    ).toBe('personnelStrikerTeam');
  });
});
