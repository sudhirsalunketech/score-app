import { describe, expect, it } from 'vitest';
import { applyPlayerDelta, applyTeamDelta, buildMatchStatDeltas, emptyPlayerCareer, reversePlayerDelta } from './career-stats';

const innings = [
  {
    battingTeamId: 'alpha',
    bowlingTeamId: 'beta',
    totalRuns: 165,
    totalWickets: 2,
    batters: [
      { playerId: 'p1', runs: 80, balls: 40, fours: 8, sixes: 4, isOut: true },
      { playerId: 'p2', runs: 55, balls: 30, fours: 4, sixes: 2, isOut: false },
    ],
    bowlers: [{ playerId: 'p3', balls: 24, runs: 40, wickets: 2, maidens: 1, dots: 8 }],
    fielding: [{ dismissalType: 'CAUGHT' as const, fielderId: 'p4' }],
  },
  {
    battingTeamId: 'beta',
    bowlingTeamId: 'alpha',
    totalRuns: 140,
    totalWickets: 4,
    batters: [{ playerId: 'p3', runs: 20, balls: 15, fours: 2, sixes: 0, isOut: true }],
    bowlers: [{ playerId: 'p1', balls: 18, runs: 30, wickets: 1, maidens: 0, dots: 4 }],
    fielding: [],
  },
];

describe('career stats from replay cards', () => {
  it('builds batting, bowling and fielding totals for a win', () => {
    const payload = buildMatchStatDeltas({
      matchId: 'm1',
      homeTeamId: 'alpha',
      awayTeamId: 'beta',
      resultType: 'WIN',
      winnerTeamId: 'alpha',
      playingPlayerIds: ['p1', 'p2', 'p5'],
      innings,
    });
    const p1 = payload.players.find((p) => p.playerId === 'p1')!;
    expect(p1).toMatchObject({ matches: 1, innings: 1, runs: 80, fours: 8, sixes: 4, fifties: 1, wickets: 1 });
    const p2 = payload.players.find((p) => p.playerId === 'p2')!;
    expect(p2).toMatchObject({ innings: 1, runs: 55, fifties: 1, notOuts: 1 });
    const p4 = payload.players.find((p) => p.playerId === 'p4')!;
    expect(p4.catches).toBe(1);
    const p5 = payload.players.find((p) => p.playerId === 'p5')!;
    expect(p5).toMatchObject({ matches: 1, innings: 0, runs: 0 });
    expect(payload.teams.find((t) => t.teamId === 'alpha')).toMatchObject({
      matches: 1,
      wins: 1,
      losses: 0,
      noResults: 0,
      runs: 165,
      wickets: 2,
    });
    expect(payload.teams.find((t) => t.teamId === 'beta')).toMatchObject({ wins: 0, losses: 1, runs: 140 });
  });

  it('does not treat no-result as a win', () => {
    const payload = buildMatchStatDeltas({
      matchId: 'm2',
      homeTeamId: 'alpha',
      awayTeamId: 'beta',
      resultType: 'NO_RESULT',
      winnerTeamId: null,
      innings: [innings[0]!],
    });
    expect(payload.teams.every((t) => t.wins === 0 && t.noResults === 1)).toBe(true);
  });

  it('applies player totals once and reverses additive fields', () => {
    const payload = buildMatchStatDeltas({
      matchId: 'm1',
      homeTeamId: 'alpha',
      awayTeamId: 'beta',
      resultType: 'WIN',
      winnerTeamId: 'alpha',
      innings,
    });
    const delta = payload.players.find((p) => p.playerId === 'p1')!;
    const once = applyPlayerDelta(emptyPlayerCareer(), delta);
    const twice = applyPlayerDelta(once, delta);
    expect(twice.runs).toBe(160);
    expect(reversePlayerDelta(twice, delta).runs).toBe(80);
  });

  it('counts ties on both teams', () => {
    const payload = buildMatchStatDeltas({
      matchId: 'm3',
      homeTeamId: 'alpha',
      awayTeamId: 'beta',
      resultType: 'TIE',
      winnerTeamId: null,
      innings,
    });
    expect(payload.teams.every((t) => t.ties === 1 && t.wins === 0)).toBe(true);
  });

  it('accumulates tournament-style team totals without doubling a no-result win', () => {
    const win = buildMatchStatDeltas({
      matchId: 'm1',
      homeTeamId: 'alpha',
      awayTeamId: 'beta',
      resultType: 'WIN',
      winnerTeamId: 'alpha',
      innings,
    }).teams.find((t) => t.teamId === 'alpha')!;
    const nr = buildMatchStatDeltas({
      matchId: 'm2',
      homeTeamId: 'alpha',
      awayTeamId: 'beta',
      resultType: 'NO_RESULT',
      winnerTeamId: null,
      innings: [],
    }).teams.find((t) => t.teamId === 'alpha')!;
    const totals = applyTeamDelta(applyTeamDelta({ matches: 0, wins: 0, losses: 0, ties: 0, noResults: 0, runs: 0, wickets: 0 }, win), nr);
    expect(totals).toMatchObject({ matches: 2, wins: 1, noResults: 1, losses: 0 });
  });
});
