import { describe, expect, it } from 'vitest';
import { computeMatchResult, computeSuperOverResult, resultIsIdempotent } from './match-result';

const teams = { homeTeamId: 'alpha', awayTeamId: 'beta', maxWickets: 7 };

describe('match result', () => {
  it('awards a runs margin when the chasing side falls short', () => {
    const result = computeMatchResult({
      ...teams,
      innings: [
        { inningsNumber: 1, battingTeamId: 'alpha', totalRuns: 165, totalWickets: 7, isComplete: true },
        { inningsNumber: 2, battingTeamId: 'beta', totalRuns: 140, totalWickets: 8, isComplete: true },
      ],
    });
    expect(result).toMatchObject({
      resultType: 'WIN',
      winnerTeamId: 'alpha',
      marginType: 'RUNS',
      marginValue: 25,
      status: 'COMPLETED',
    });
  });

  it('awards a wickets margin when the chase succeeds', () => {
    const result = computeMatchResult({
      ...teams,
      innings: [
        { inningsNumber: 1, battingTeamId: 'alpha', totalRuns: 120, totalWickets: 5, isComplete: true },
        { inningsNumber: 2, battingTeamId: 'beta', totalRuns: 121, totalWickets: 3, isComplete: true },
      ],
    });
    expect(result).toMatchObject({
      resultType: 'WIN',
      winnerTeamId: 'beta',
      marginType: 'WICKETS',
      marginValue: 4,
      status: 'COMPLETED',
    });
  });

  it('returns a tie when scores are level', () => {
    const result = computeMatchResult({
      ...teams,
      innings: [
        { inningsNumber: 1, battingTeamId: 'alpha', totalRuns: 90, totalWickets: 4, isComplete: true },
        { inningsNumber: 2, battingTeamId: 'beta', totalRuns: 90, totalWickets: 6, isComplete: true },
      ],
    });
    expect(result).toMatchObject({ resultType: 'TIE', winnerTeamId: null, status: 'COMPLETED' });
  });

  it('returns no result when the second innings was not played', () => {
    const result = computeMatchResult({
      ...teams,
      innings: [{ inningsNumber: 1, battingTeamId: 'alpha', totalRuns: 80, totalWickets: 2, isComplete: true }],
    });
    expect(result).toMatchObject({ resultType: 'NO_RESULT', winnerTeamId: null, status: 'COMPLETED' });
  });

  it('marks abandoned without a winner', () => {
    const result = computeMatchResult({
      ...teams,
      intent: 'ABANDON',
      innings: [{ inningsNumber: 1, battingTeamId: 'alpha', totalRuns: 40, totalWickets: 1 }],
    });
    expect(result).toMatchObject({ resultType: 'ABANDONED', winnerTeamId: null, status: 'ABANDONED' });
  });

  it('treats a second complete as idempotent', () => {
    expect(resultIsIdempotent({ status: 'COMPLETED', resultType: 'WIN' }, 'COMPLETED')).toBe(true);
    expect(resultIsIdempotent({ status: 'LIVE', resultType: null }, 'COMPLETED')).toBe(false);
  });
});

describe('super over result', () => {
  it('awards the win to whoever scored more, with a runs margin', () => {
    const result = computeSuperOverResult({
      innings: [
        { battingTeamId: 'alpha', totalRuns: 14 },
        { battingTeamId: 'beta', totalRuns: 18 },
      ],
    });
    expect(result).toEqual({ resultType: 'WIN', winnerTeamId: 'beta', marginType: 'RUNS', marginValue: 4 });
  });

  it('awards the win to the team batting first when the chase falls short', () => {
    const result = computeSuperOverResult({
      innings: [
        { battingTeamId: 'alpha', totalRuns: 16 },
        { battingTeamId: 'beta', totalRuns: 12 },
      ],
    });
    expect(result).toEqual({ resultType: 'WIN', winnerTeamId: 'alpha', marginType: 'RUNS', marginValue: 4 });
  });

  it('reports a tie when the Super Over itself is level, so another Super Over is needed', () => {
    const result = computeSuperOverResult({
      innings: [
        { battingTeamId: 'alpha', totalRuns: 10 },
        { battingTeamId: 'beta', totalRuns: 10 },
      ],
    });
    expect(result).toEqual({ resultType: 'TIE', winnerTeamId: null, marginType: null, marginValue: null });
  });
});
