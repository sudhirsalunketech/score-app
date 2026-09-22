import { describe, expect, it } from 'vitest';
import { assignExclusiveRole, toggleSelectedPlayer } from './playing-xi';
import { playerRoleLabel, resultHeadline, shareResultText } from './match-result';
import { filterPlayersForSearch, playerMatchesQuery } from './player-search';

describe('Playing XI selection', () => {
  it('selects and deselects players', () => {
    expect(toggleSelectedPlayer([], 'p1', 8)).toEqual(['p1']);
    expect(toggleSelectedPlayer(['p1'], 'p1', 8)).toEqual([]);
  });

  it('assigns a single captain', () => {
    const next = assignExclusiveRole(
      [
        { playerId: 'a', isCaptain: true, isViceCaptain: false, isWicketKeeper: true },
        { playerId: 'b', isCaptain: false, isViceCaptain: true, isWicketKeeper: false },
      ],
      'b',
      'isCaptain',
    );
    expect(next.find((p) => p.isCaptain)?.playerId).toBe('b');
  });
});

describe('result display', () => {
  const labels = {
    completed: 'Match completed',
    wonBy: 'won by',
    runs: 'runs',
    wickets: 'wickets',
    tie: 'Match tied',
    noResult: 'No result',
    abandoned: 'Match abandoned',
  };

  it('shows runs and wickets margins', () => {
    expect(resultHeadline({ resultType: 'WIN', winnerName: 'ALPHA XI', marginType: 'RUNS', marginValue: 25, labels })).toBe(
      'ALPHA XI won by 25 runs',
    );
    expect(resultHeadline({ resultType: 'WIN', winnerName: 'BETA XI', marginType: 'WICKETS', marginValue: 4, labels })).toBe(
      'BETA XI won by 4 wickets',
    );
  });

  it('shows tie, no result and abandoned without a winner', () => {
    expect(resultHeadline({ resultType: 'TIE', labels })).toBe('Match tied');
    expect(resultHeadline({ resultType: 'NO_RESULT', labels })).toBe('No result');
    expect(resultHeadline({ resultType: 'ABANDONED', labels })).toBe('Match abandoned');
  });

  it('builds a share payload without internal ids', () => {
    const text = shareResultText({
      title: 'ALPHA XI vs BETA XI',
      homeName: 'ALPHA XI',
      awayName: 'BETA XI',
      homeScore: '165/7',
      awayScore: '140/8',
      headline: 'ALPHA XI won by 25 runs',
      url: 'https://example.test/live/match/alpha-xi-vs-beta-xi',
    });
    expect(text).toContain('ALPHA XI won by 25 runs');
    expect(text).not.toMatch(/[a-z0-9]{20,}/);
  });
});

describe('player roles', () => {
  it('maps stored role strings', () => {
    expect(playerRoleLabel('BATSMAN')).toBe('batter');
    expect(playerRoleLabel('ALL_ROUNDER')).toBe('allRounder');
    expect(playerRoleLabel('WICKET_KEEPER')).toBe('wk');
  });
});

describe('player search', () => {
  it('matches name, jersey and profile code and skips existing members', () => {
    const players = [
      { id: '1', name: 'Sudhir', profileCode: 'CS100001', role: 'ALL_ROUNDER', jerseyNo: 7 },
      { id: '2', name: 'Bhavin', profileCode: 'CS100002', role: 'BATTER', jerseyNo: 10 },
    ];
    expect(playerMatchesQuery(players[0]!, '#7')).toBe(true);
    expect(filterPlayersForSearch(players, 'Sudhir', ['1'])).toEqual([]);
    expect(filterPlayersForSearch(players, 'bhav', []).map((p) => p.id)).toEqual(['2']);
  });
});
