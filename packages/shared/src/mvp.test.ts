import { describe, expect, it } from 'vitest';
import { computeMatchMvp, computeStreetMvp, DEFAULT_MVP_CONFIG, sanitizeMvpConfig } from './mvp';

describe('MVP engine', () => {
  it('uses the default street table when no tournament config is set', () => {
    const r = computeStreetMvp({ runs: 10, ballsFaced: 10, wickets: 1, maidenOvers: 0, catches: 0, stumpings: 0, runOuts: 0 });
    expect(r.batting).toBe(1);
    expect(r.bowling).toBe(2);
    expect(r.total).toBe(3);
  });

  it('isolates two tournaments with different wicket points', () => {
    const a = DEFAULT_MVP_CONFIG;
    const b = sanitizeMvpConfig({ bowling: { pointsPerWicket: 3 } });
    const stat = { runs: 0, ballsFaced: 0, wickets: 2, maidenOvers: 0, catches: 0, stumpings: 0, runOuts: 0 };
    expect(computeStreetMvp(stat, a).bowling).toBe(4);
    expect(computeStreetMvp(stat, b).bowling).toBe(6);
  });

  it('keeps a match on its snapshotted MVP config after the tournament changes', () => {
    const v1 = sanitizeMvpConfig({ bowling: { pointsPerWicket: 2 } });
    const v2 = sanitizeMvpConfig({ bowling: { pointsPerWicket: 5 } });
    const stat = { runs: 0, ballsFaced: 0, wickets: 1, maidenOvers: 0, catches: 0, stumpings: 0, runOuts: 0 };
    expect(computeStreetMvp(stat, v1).total).toBe(2);
    expect(computeStreetMvp(stat, v2).total).toBe(5);
  });

  it('does not award batting points below the 10-run minimum', () => {
    const r = computeStreetMvp({ runs: 9, ballsFaced: 4, wickets: 0, maidenOvers: 0, catches: 0, stumpings: 0, runOuts: 0 });
    expect(r.batting).toBe(0);
    expect(r.total).toBe(0);
  });

  it('ranks match Super Stars from actual cricket stats', () => {
    const rows = computeMatchMvp([
      { playerId: 'a', playerName: 'Akshay', teamName: 'Warriors', runs: 198, ballsFaced: 200, wickets: 0, maidenOvers: 0, catches: 1, stumpings: 0, runOuts: 0 },
      { playerId: 'b', playerName: 'Bowler', teamName: 'Warriors', runs: 0, ballsFaced: 0, wickets: 5, maidenOvers: 0, catches: 0, stumpings: 0, runOuts: 0 },
    ]);
    expect(rows[0]?.playerId).toBe('a');
    expect(rows[0]?.batting).toBe(21.8);
    expect(rows[1]?.bowling).toBe(12);
  });

  it('awards bowling points per maiden over', () => {
    const r = computeStreetMvp({ runs: 0, ballsFaced: 0, wickets: 0, maidenOvers: 3, catches: 0, stumpings: 0, runOuts: 0 });
    expect(r.bowling).toBe(3);
    expect(r.total).toBe(3);
  });
});
