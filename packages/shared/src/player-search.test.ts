import { describe, expect, it } from 'vitest';
import { filterPlayersForSearch, playerMatchesQuery } from './player-search';

const players = [
  { id: '1', name: 'Sudhir', profileCode: 'CS100001', role: 'ALL_ROUNDER', jerseyNo: 7 },
  { id: '2', name: 'Bhavin', profileCode: 'CS100002', role: 'BATTER', jerseyNo: 10 },
  { id: '3', name: 'Amit', profileCode: 'CS778899', role: 'BOWLER', jerseyNo: 3 },
];

describe('player search', () => {
  it('matches name, jersey and profile code', () => {
    expect(playerMatchesQuery(players[0]!, 'sud')).toBe(true);
    expect(playerMatchesQuery(players[0]!, '7')).toBe(true);
    expect(playerMatchesQuery(players[0]!, '#7')).toBe(true);
    expect(playerMatchesQuery(players[2]!, 'CS778899')).toBe(true);
    expect(playerMatchesQuery(players[1]!, 'bowler')).toBe(false);
  });

  it('excludes existing team members and limits results', () => {
    const found = filterPlayersForSearch(players, 'i', ['1'], 10);
    expect(found.map((p) => p.id)).toEqual(['2', '3']);
  });

  it('does not return duplicates of excluded ids', () => {
    expect(filterPlayersForSearch(players, 'Sudhir', ['1'])).toEqual([]);
  });
});
