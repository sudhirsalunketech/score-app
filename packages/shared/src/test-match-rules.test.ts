import { describe, expect, it } from 'vitest';
import { computeFollowOnAvailability, computeLeadTrail, computeTestMatchResult, followOnThreshold, type TestInningsInput } from './test-match-rules';

const A = 'teamA';
const B = 'teamB';
const teams = { homeTeamId: A, awayTeamId: B, maxWickets: 10 };

function inn(inningsNumber: number, battingTeamId: string, totalRuns: number, totalWickets: number, status: TestInningsInput['status'] = 'COMPLETED'): TestInningsInput {
  return { inningsNumber, battingTeamId, totalRuns, totalWickets, status };
}

describe('followOnThreshold', () => {
  it('follows the Law 14 / ICC duration table', () => {
    expect(followOnThreshold(5)).toBe(200);
    expect(followOnThreshold(4)).toBe(150);
    expect(followOnThreshold(3)).toBe(150);
    expect(followOnThreshold(2)).toBe(100);
    expect(followOnThreshold(1)).toBe(75);
  });

  it('defaults to the 5-day/200 threshold when duration is not configured', () => {
    expect(followOnThreshold(null)).toBe(200);
    expect(followOnThreshold(undefined)).toBe(200);
  });
});

describe('computeFollowOnAvailability', () => {
  it('is available once the lead reaches the threshold', () => {
    const first = inn(1, A, 500, 10);
    const second = inn(2, B, 250, 10);
    expect(computeFollowOnAvailability(first, second, 5)).toEqual({ available: true, lead: 250 });
  });

  it('is not available below the threshold', () => {
    const first = inn(1, A, 400, 10);
    const second = inn(2, B, 250, 10);
    expect(computeFollowOnAvailability(first, second, 5)).toEqual({ available: false, lead: 150 });
  });

  it('is not available until both first innings are terminal', () => {
    const first = inn(1, A, 500, 10);
    const second = inn(2, B, 100, 4, 'IN_PROGRESS');
    expect(computeFollowOnAvailability(first, second, 5).available).toBe(false);
  });
});

describe('computeLeadTrail', () => {
  it('reports the trailing team correctly, including live partial innings', () => {
    expect(computeLeadTrail([inn(1, A, 500, 10), inn(2, B, 300, 6, 'IN_PROGRESS')], A, B)).toEqual({
      leadingTeamId: A,
      leadRuns: 200,
    });
  });

  it('reports level scores', () => {
    expect(computeLeadTrail([inn(1, A, 500, 10), inn(2, B, 500, 8, 'IN_PROGRESS')], A, B)).toEqual({
      leadingTeamId: null,
      leadRuns: 0,
    });
  });

  it('flips lead to a chasing team once they pass the target', () => {
    expect(computeLeadTrail([inn(1, A, 500, 10), inn(2, B, 501, 4, 'IN_PROGRESS')], A, B)).toEqual({
      leadingTeamId: B,
      leadRuns: 1,
    });
  });
});

describe('computeTestMatchResult', () => {
  it('Scenario 1 — normal win by runs when the chase falls short', () => {
    const result = computeTestMatchResult({
      ...teams,
      innings: [inn(1, A, 450, 10), inn(2, B, 300, 10), inn(3, A, 250, 10), inn(4, B, 350, 10)],
    });
    expect(result).toMatchObject({ resultType: 'WIN', winnerTeamId: A, marginType: 'RUNS', marginValue: 50, status: 'COMPLETED' });
  });

  it('Scenario 3 — innings victory ends the match after only 3 innings', () => {
    const result = computeTestMatchResult({
      ...teams,
      innings: [inn(1, A, 500, 10), inn(2, B, 250, 10), inn(3, B, 200, 10)],
    });
    expect(result).toMatchObject({ resultType: 'WIN', winnerTeamId: A, marginType: 'INNINGS', marginValue: 50, status: 'COMPLETED' });
  });

  it('continues to a 4th innings when the follow-on side is not yet behind after batting twice', () => {
    const result = computeTestMatchResult({
      ...teams,
      innings: [inn(1, A, 500, 10), inn(2, B, 250, 10), inn(3, B, 260, 10)],
    });
    expect(result).toMatchObject({ resultType: 'NO_RESULT' });
  });

  it('chasing side wins by wickets when it overhauls the aggregate in its final innings', () => {
    const result = computeTestMatchResult({
      ...teams,
      innings: [inn(1, A, 400, 10), inn(2, B, 300, 10), inn(3, A, 200, 10), inn(4, B, 301, 4)],
    });
    expect(result).toMatchObject({ resultType: 'WIN', winnerTeamId: B, marginType: 'WICKETS', marginValue: 6, status: 'COMPLETED' });
  });

  it('Scenario 6 — a tie requires all 4 innings complete with exactly equal aggregates', () => {
    const result = computeTestMatchResult({
      ...teams,
      innings: [inn(1, A, 400, 10), inn(2, B, 350, 10), inn(3, A, 250, 10), inn(4, B, 300, 10)],
    });
    expect(result).toMatchObject({ resultType: 'TIE', winnerTeamId: null, status: 'COMPLETED' });
  });

  it('never returns a TIE before all 4 innings are terminal', () => {
    const result = computeTestMatchResult({
      ...teams,
      innings: [inn(1, A, 400, 10), inn(2, B, 400, 10), inn(3, A, 200, 10)],
    });
    expect(result.resultType).not.toBe('TIE');
  });

  it('supports an explicit draw intent instead of auto-declaring a winner', () => {
    const result = computeTestMatchResult({
      ...teams,
      intent: 'DRAW',
      innings: [inn(1, A, 400, 10), inn(2, B, 200, 6, 'IN_PROGRESS')],
    });
    expect(result).toEqual({ resultType: 'DRAW', winnerTeamId: null, marginType: null, marginValue: null, status: 'COMPLETED' });
  });

  it('counts a declared innings as terminal, same as all-out', () => {
    const result = computeTestMatchResult({
      ...teams,
      innings: [inn(1, A, 450, 5, 'DECLARED'), inn(2, B, 250, 10), inn(3, B, 150, 10)],
    });
    expect(result).toMatchObject({ resultType: 'WIN', winnerTeamId: A, marginType: 'INNINGS', marginValue: 50 });
  });
});
