import { describe, expect, it } from 'vitest';
import {
  assignExclusiveRole,
  playingXiLocked,
  toggleSelectedPlayer,
  validatePlayingXi,
} from './playing-xi';

const base = {
  teamId: 'home',
  matchTeamIds: ['home', 'away'] as [string, string],
  playingPerSide: 3,
  rosterPlayerIds: ['a', 'b', 'c', 'd'],
};

function xi(ids: string[], captain = 'a', vice = 'b', wk = 'c') {
  return ids.map((playerId) => ({
    playerId,
    isCaptain: playerId === captain,
    isViceCaptain: playerId === vice,
    isWicketKeeper: playerId === wk,
  }));
}

describe('Playing XI', () => {
  it('accepts a valid squad', () => {
    expect(validatePlayingXi({ ...base, players: xi(['a', 'b', 'c']) })).toEqual([]);
  });

  it('rejects duplicate players', () => {
    const players = [...xi(['a', 'b', 'c']), { playerId: 'a', isCaptain: false, isViceCaptain: false, isWicketKeeper: false }];
    expect(validatePlayingXi({ ...base, playingPerSide: 4, rosterPlayerIds: ['a', 'b', 'c', 'd'], players }).some((e) => e.code === 'DUPLICATE_PLAYER')).toBe(true);
  });

  it('rejects a player from the other team', () => {
    expect(
      validatePlayingXi({ ...base, rosterPlayerIds: ['a', 'b'], players: xi(['a', 'b', 'c']) }).some((e) => e.code === 'NOT_IN_ROSTER'),
    ).toBe(true);
  });

  it('rejects a team that is not in the match', () => {
    expect(validatePlayingXi({ ...base, teamId: 'other', players: xi(['a', 'b', 'c']) }).some((e) => e.code === 'WRONG_TEAM')).toBe(true);
  });

  it('requires captain, vice captain and wicket keeper from the XI', () => {
    const players = ['a', 'b', 'c'].map((playerId) => ({ playerId, isCaptain: false, isViceCaptain: false, isWicketKeeper: false }));
    const codes = validatePlayingXi({ ...base, players }).map((e) => e.code);
    expect(codes).toEqual(expect.arrayContaining(['CAPTAIN', 'VICE_CAPTAIN', 'WICKET_KEEPER']));
  });

  it('prevents captain and vice captain being the same player', () => {
    expect(validatePlayingXi({ ...base, players: xi(['a', 'b', 'c'], 'a', 'a', 'c') }).some((e) => e.code === 'CAPTAIN_EQUALS_VICE')).toBe(true);
  });

  it('uses playingPerSide instead of a hardcoded 11', () => {
    expect(validatePlayingXi({ ...base, playingPerSide: 2, players: xi(['a', 'b'], 'a', 'b', 'a') }).some((e) => e.code === 'COUNT')).toBe(false);
    expect(validatePlayingXi({ ...base, playingPerSide: 8, players: xi(['a', 'b', 'c']) }).some((e) => e.code === 'COUNT')).toBe(true);
  });

  it('locks after the first scoring event', () => {
    expect(playingXiLocked(0)).toBe(false);
    expect(playingXiLocked(1)).toBe(true);
  });

  it('toggles selection up to the squad size', () => {
    expect(toggleSelectedPlayer(['a'], 'b', 2)).toEqual(['a', 'b']);
    expect(toggleSelectedPlayer(['a', 'b'], 'c', 2)).toEqual(['a', 'b']);
    expect(toggleSelectedPlayer(['a', 'b'], 'a', 2)).toEqual(['b']);
  });

  it('assigns one captain and clears vice if needed', () => {
    const next = assignExclusiveRole(xi(['a', 'b', 'c'], 'a', 'b', 'c'), 'b', 'isCaptain');
    expect(next.find((p) => p.playerId === 'b')).toMatchObject({ isCaptain: true, isViceCaptain: false });
    expect(next.filter((p) => p.isCaptain)).toHaveLength(1);
  });
});
