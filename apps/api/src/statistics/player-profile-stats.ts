export const PROFILE_FORMATS = ['T10', 'T20', 'CLUB', 'TEST'] as const;
export type ProfileFormat = (typeof PROFILE_FORMATS)[number];

export type SliceTotals = {
  matches: number;
  innings: number;
  runs: number;
  balls: number;
  highest: number;
  notOuts: number;
  ducks: number;
  thirties: number;
  fifties: number;
  hundreds: number;
  fours: number;
  sixes: number;
  bowlInnings: number;
  bowlBalls: number;
  bowlRuns: number;
  dots: number;
  maidens: number;
  wickets: number;
  threeW: number;
  fiveW: number;
  bestWkts: number;
  bestRuns: number;
  catches: number;
  stumpings: number;
  runOuts: number;
};

export type RunBucket = { 0: number; 1: number; 2: number; 3: number; 4: number; 6: number };

export function emptySlice(): SliceTotals {
  return {
    matches: 0,
    innings: 0,
    runs: 0,
    balls: 0,
    highest: 0,
    notOuts: 0,
    ducks: 0,
    thirties: 0,
    fifties: 0,
    hundreds: 0,
    fours: 0,
    sixes: 0,
    bowlInnings: 0,
    bowlBalls: 0,
    bowlRuns: 0,
    dots: 0,
    maidens: 0,
    wickets: 0,
    threeW: 0,
    fiveW: 0,
    bestWkts: 0,
    bestRuns: 0,
    catches: 0,
    stumpings: 0,
    runOuts: 0,
  };
}

export function emptyBuckets(): RunBucket {
  return { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 6: 0 };
}

export function addBatterInnings(
  slice: SliceTotals,
  batter: { runs: number; balls: number; fours: number; sixes: number; isOut: boolean },
) {
  slice.innings += 1;
  slice.runs += batter.runs;
  slice.balls += batter.balls;
  slice.fours += batter.fours;
  slice.sixes += batter.sixes;
  if (!batter.isOut) slice.notOuts += 1;
  if (batter.isOut && batter.runs === 0) slice.ducks += 1;
  if (batter.runs >= 100) slice.hundreds += 1;
  else if (batter.runs >= 50) slice.fifties += 1;
  else if (batter.runs >= 30) slice.thirties += 1;
  if (batter.runs > slice.highest) slice.highest = batter.runs;
}

export function addBowlerSpell(
  slice: SliceTotals,
  bowler: { balls: number; runs: number; wickets: number; maidens: number; dots: number },
) {
  slice.bowlInnings += 1;
  slice.bowlBalls += bowler.balls;
  slice.bowlRuns += bowler.runs;
  slice.wickets += bowler.wickets;
  slice.maidens += bowler.maidens;
  slice.dots += bowler.dots;
  if (bowler.wickets >= 5) slice.fiveW += 1;
  else if (bowler.wickets >= 3) slice.threeW += 1;
  if (
    bowler.wickets > slice.bestWkts ||
    (bowler.wickets === slice.bestWkts && bowler.wickets > 0 && bowler.runs < slice.bestRuns)
  ) {
    slice.bestWkts = bowler.wickets;
    slice.bestRuns = bowler.runs;
  }
}

export function markMatch(slice: SliceTotals) {
  slice.matches += 1;
}

export function countRunBucket(buckets: RunBucket, runs: number) {
  if (runs === 0) buckets[0] += 1;
  else if (runs === 1) buckets[1] += 1;
  else if (runs === 2) buckets[2] += 1;
  else if (runs === 3) buckets[3] += 1;
  else if (runs === 4) buckets[4] += 1;
  else if (runs === 6) buckets[6] += 1;
}

export function formatLabel(format: string): ProfileFormat | null {
  if (format === 'T10' || format === 'T20' || format === 'CLUB' || format === 'TEST') return format;
  if (format === 'HUNDRED' || format === 'CUSTOM') return 'CLUB';
  if (format === 'ODI') return 'TEST';
  return 'CLUB';
}

export function battingAverage(runs: number, innings: number, notOuts: number) {
  const outs = Math.max(0, innings - notOuts);
  return outs ? Number((runs / outs).toFixed(1)) : null;
}

export function strikeRate(runs: number, balls: number) {
  return balls ? Number(((runs / balls) * 100).toFixed(1)) : 0;
}

export function bowlingAverage(runs: number, wickets: number) {
  return wickets ? Number((runs / wickets).toFixed(1)) : null;
}

/**
 * `ballsPerOver` defaults to the standard 6-ball over: callers aggregating across
 * many matches (career stats) have no single correct over length to use, so economy
 * is reported in standard-over terms for cross-format comparability. Callers scoped
 * to one match should pass that match's actual `ballsPerOver`.
 */
export function economy(runs: number, balls: number, ballsPerOver = 6) {
  return balls ? Number((runs / (balls / ballsPerOver)).toFixed(1)) : 0;
}

export function bowlStrikeRate(balls: number, wickets: number) {
  return wickets ? Number((balls / wickets).toFixed(1)) : null;
}

export function presentSlice(slice: SliceTotals) {
  return {
    matches: slice.matches,
    innings: slice.innings,
    runs: slice.runs,
    balls: slice.balls,
    highest: slice.highest,
    average: battingAverage(slice.runs, slice.innings, slice.notOuts),
    sr: strikeRate(slice.runs, slice.balls),
    notOuts: slice.notOuts,
    ducks: slice.ducks,
    thirties: slice.thirties,
    fifties: slice.fifties,
    hundreds: slice.hundreds,
    sixes: slice.sixes,
    fours: slice.fours,
    bowlInnings: slice.bowlInnings,
    bowlBalls: slice.bowlBalls,
    bowlRuns: slice.bowlRuns,
    dots: slice.dots,
    maidens: slice.maidens,
    wickets: slice.wickets,
    bowlAverage: bowlingAverage(slice.bowlRuns, slice.wickets),
    economy: economy(slice.bowlRuns, slice.bowlBalls),
    best: slice.bestWkts ? `${slice.bestWkts}-${slice.bestRuns}` : '—',
    bowlSr: bowlStrikeRate(slice.bowlBalls, slice.wickets),
    threeW: slice.threeW,
    fiveW: slice.fiveW,
    catches: slice.catches,
    stumpings: slice.stumpings,
    runOuts: slice.runOuts,
  };
}
