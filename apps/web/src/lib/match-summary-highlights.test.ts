import { describe, expect, it } from 'vitest';
import { inningsScoreLine, playerMatchTotals, potmAchievementLine, topBatterHighlights, topBowlerHighlights } from './match-summary-highlights';
import type { BatterCard, BowlerCard } from '@/types/api';

const batter = (partial: Partial<BatterCard> & Pick<BatterCard, 'playerId'>): BatterCard => ({
  runs: 0,
  balls: 0,
  fours: 0,
  sixes: 0,
  isOut: true,
  ...partial,
});

const bowler = (partial: Partial<BowlerCard> & Pick<BowlerCard, 'playerId'>): BowlerCard => ({
  balls: 0,
  runs: 0,
  wickets: 0,
  maidens: 0,
  dots: 0,
  wides: 0,
  noBalls: 0,
  fours: 0,
  sixes: 0,
  ...partial,
});

describe('match summary highlights', () => {
  it('ranks batters by runs and marks not-out with *', () => {
    const rows = topBatterHighlights(
      [
        batter({ playerId: 'a', runs: 8, balls: 7, isOut: true }),
        batter({ playerId: 'b', runs: 21, balls: 16, isOut: false }),
        batter({ playerId: 'c', runs: 4, balls: 5, isOut: true }),
      ],
      (id) => id.toUpperCase(),
    );
    expect(rows.map((r) => `${r.name} ${r.line}`)).toEqual(['B 21(16)*', 'A 8(7)', 'C 4(5)']);
  });

  it('ranks bowlers by wickets then fewest runs', () => {
    const rows = topBowlerHighlights(
      [
        bowler({ playerId: 'x', wickets: 1, runs: 10 }),
        bowler({ playerId: 'y', wickets: 2, runs: 13 }),
        bowler({ playerId: 'z', wickets: 1, runs: 8 }),
      ],
      (id) => id,
    );
    expect(rows.map((r) => `${r.name} ${r.line}`)).toEqual(['y 2-13', 'z 1-8', 'x 1-10']);
  });

  it('formats innings score like 36-5 (5.0)', () => {
    expect(inningsScoreLine(36, 5, '5.0')).toBe('36-5 (5.0)');
  });

  it('sums a player runs and wickets across innings snapshots', () => {
    expect(
      playerMatchTotals(
        [
          {
            snapshot: {
              batters: [{ playerId: 'a', runs: 10 }],
              bowlers: [{ playerId: 'a', wickets: 1 }],
            },
          },
          {
            snapshot: {
              batters: [{ playerId: 'a', runs: 4 }],
              bowlers: [{ playerId: 'b', wickets: 2 }],
            },
          },
        ],
        'a',
      ),
    ).toEqual({ runs: 14, wickets: 1 });
  });

  it('builds a batting-only achievement line for a not-out innings', () => {
    expect(
      potmAchievementLine(
        [{ snapshot: { batters: [{ playerId: 'a', runs: 50, balls: 20, isOut: false }], bowlers: [] } }],
        'a',
      ),
    ).toBe('50(20)*');
  });

  it('combines batting and bowling across innings for an all-rounder', () => {
    expect(
      potmAchievementLine(
        [
          {
            snapshot: {
              batters: [{ playerId: 'a', runs: 45, balls: 30, isOut: true }],
              bowlers: [{ playerId: 'a', runs: 15, wickets: 2 }],
            },
          },
          {
            snapshot: {
              batters: [],
              bowlers: [{ playerId: 'a', runs: 5, wickets: 0 }],
            },
          },
        ],
        'a',
      ),
    ).toBe('45(30) & 2-20');
  });

  it('returns null when the player has no batting or bowling record', () => {
    expect(potmAchievementLine([{ snapshot: { batters: [], bowlers: [] } }], 'a')).toBeNull();
  });
});
