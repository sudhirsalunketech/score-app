import { describe, expect, it } from 'vitest';
import { recentFormHistory, type PlayerProfileStats } from './player-profile';

function match(overrides: Partial<NonNullable<PlayerProfileStats['matches']>[number]>) {
  return {
    matchId: 'm1',
    title: 'Match',
    format: 'T20',
    status: 'COMPLETED',
    when: null,
    versus: 'Opponent',
    batting: null,
    bowling: null,
    ...overrides,
  };
}

describe('recentFormHistory', () => {
  it('returns empty history for no matches', () => {
    expect(recentFormHistory(undefined)).toEqual({ battingHistory: [], bowlingHistory: [] });
    expect(recentFormHistory([])).toEqual({ battingHistory: [], bowlingHistory: [] });
  });

  it('only includes matches with a batting or bowling entry, preserving order', () => {
    const { battingHistory, bowlingHistory } = recentFormHistory([
      match({ matchId: 'a', batting: { order: 1, runs: 30, balls: 20, fours: 3, sixes: 1, sr: 150, dismissal: 'CAUGHT' } }),
      match({ matchId: 'b' }),
      match({ matchId: 'c', bowling: { overs: '4.0', runs: 18, maidens: 0, wickets: 2, eco: 4.5 } }),
    ]);
    expect(battingHistory).toEqual([{ runs: 30, notOut: false }]);
    expect(bowlingHistory).toEqual(['2-18']);
  });

  it('treats a NOT_OUT or missing dismissal as not out', () => {
    const { battingHistory } = recentFormHistory([
      match({ batting: { order: 1, runs: 16, balls: 6, fours: 1, sixes: 1, sr: 266.7, dismissal: 'NOT_OUT' } }),
      match({ batting: { order: 2, runs: 5, balls: 4, fours: 0, sixes: 0, sr: 125, dismissal: null } }),
      match({ batting: { order: 3, runs: 0, balls: 3, fours: 0, sixes: 0, sr: 0, dismissal: 'BOWLED' } }),
    ]);
    expect(battingHistory).toEqual([
      { runs: 16, notOut: true },
      { runs: 5, notOut: true },
      { runs: 0, notOut: false },
    ]);
  });
});
