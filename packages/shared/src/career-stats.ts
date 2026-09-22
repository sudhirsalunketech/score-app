type BatterLike = { playerId: string; runs: number; balls: number; fours: number; sixes: number; isOut: boolean };
type BowlerLike = { playerId: string; balls: number; runs: number; wickets: number; maidens: number };

export type MatchStatPlayerDelta = {
  playerId: string;
  matches: number;
  innings: number;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  fifties: number;
  hundreds: number;
  highestScore: number;
  notOuts: number;
  wickets: number;
  oversBowledBalls: number;
  runsConceded: number;
  maidens: number;
  catches: number;
  stumpings: number;
  runOuts: number;
  bestBowlWkts: number;
  bestBowlRuns: number;
  hatTricks: number;
};

export type MatchStatTeamDelta = {
  teamId: string;
  matches: number;
  wins: number;
  losses: number;
  ties: number;
  noResults: number;
  runs: number;
  wickets: number;
};

export type MatchStatsPayload = {
  version: 1;
  matchId: string;
  resultType: string | null;
  winnerTeamId: string | null;
  players: MatchStatPlayerDelta[];
  teams: MatchStatTeamDelta[];
};

export type PlayerCareerTotals = Omit<MatchStatPlayerDelta, 'playerId'>;

const emptyPlayer = (): PlayerCareerTotals => ({
  matches: 0,
  innings: 0,
  runs: 0,
  balls: 0,
  fours: 0,
  sixes: 0,
  fifties: 0,
  hundreds: 0,
  highestScore: 0,
  notOuts: 0,
  wickets: 0,
  oversBowledBalls: 0,
  runsConceded: 0,
  maidens: 0,
  catches: 0,
  stumpings: 0,
  runOuts: 0,
  bestBowlWkts: 0,
  bestBowlRuns: 0,
  hatTricks: 0,
});

function ensurePlayer(map: Map<string, MatchStatPlayerDelta>, playerId: string): MatchStatPlayerDelta {
  const existing = map.get(playerId);
  if (existing) return existing;
  const next = { playerId, ...emptyPlayer() };
  map.set(playerId, next);
  return next;
}

function teamOutcome(teamId: string, resultType: string | null, winnerTeamId: string | null) {
  if (resultType === 'WIN') {
    return winnerTeamId === teamId
      ? { wins: 1, losses: 0, ties: 0, noResults: 0 }
      : { wins: 0, losses: 1, ties: 0, noResults: 0 };
  }
  if (resultType === 'TIE') return { wins: 0, losses: 0, ties: 1, noResults: 0 };
  return { wins: 0, losses: 0, ties: 0, noResults: 1 };
}

function betterBowling(currentWkts: number, currentRuns: number, wkts: number, runs: number) {
  if (wkts > currentWkts) return true;
  if (wkts === currentWkts && currentWkts > 0 && runs < currentRuns) return true;
  if (currentWkts === 0 && wkts > 0) return true;
  return false;
}

export function buildMatchStatDeltas(input: {
  matchId: string;
  homeTeamId: string;
  awayTeamId: string;
  resultType: string | null;
  winnerTeamId: string | null;
  playingPlayerIds?: string[];
  innings: Array<{
    battingTeamId: string;
    bowlingTeamId: string;
    totalRuns: number;
    totalWickets: number;
    batters: BatterLike[];
    bowlers: BowlerLike[];
    fielding?: Array<{ dismissalType?: string | null; fielderId?: string | null }>;
    /** One entry per hat-trick completed in this innings, naming the bowler credited — see computeHattrickSequences. */
    hatTrickBowlerIds?: string[];
  }>;
}): MatchStatsPayload {
  const players = new Map<string, MatchStatPlayerDelta>();
  for (const id of input.playingPlayerIds ?? []) {
    ensurePlayer(players, id).matches = 1;
  }

  const teamRuns = new Map<string, { runs: number; wickets: number }>([
    [input.homeTeamId, { runs: 0, wickets: 0 }],
    [input.awayTeamId, { runs: 0, wickets: 0 }],
  ]);

  for (const inn of input.innings) {
    const batting = teamRuns.get(inn.battingTeamId) ?? { runs: 0, wickets: 0 };
    batting.runs += inn.totalRuns;
    batting.wickets += inn.totalWickets;
    teamRuns.set(inn.battingTeamId, batting);

    for (const batter of inn.batters) {
      const row = ensurePlayer(players, batter.playerId);
      row.matches = 1;
      const batted = batter.balls > 0 || batter.runs > 0 || batter.isOut;
      if (batted) {
        row.innings += 1;
        row.runs += batter.runs;
        row.balls += batter.balls;
        row.fours += batter.fours;
        row.sixes += batter.sixes;
        if (batter.runs >= 100) row.hundreds += 1;
        else if (batter.runs >= 50) row.fifties += 1;
        if (batter.runs > row.highestScore) row.highestScore = batter.runs;
        if (!batter.isOut) row.notOuts += 1;
      }
    }

    for (const bowler of inn.bowlers) {
      const row = ensurePlayer(players, bowler.playerId);
      row.matches = 1;
      row.wickets += bowler.wickets;
      row.oversBowledBalls += bowler.balls;
      row.runsConceded += bowler.runs;
      row.maidens += bowler.maidens;
      if (betterBowling(row.bestBowlWkts, row.bestBowlRuns, bowler.wickets, bowler.runs)) {
        row.bestBowlWkts = bowler.wickets;
        row.bestBowlRuns = bowler.runs;
      }
    }

    for (const bowlerId of inn.hatTrickBowlerIds ?? []) {
      ensurePlayer(players, bowlerId).hatTricks += 1;
    }

    for (const ev of inn.fielding ?? []) {
      if (!ev.fielderId) continue;
      const row = ensurePlayer(players, ev.fielderId);
      row.matches = 1;
      if (ev.dismissalType === 'CAUGHT') row.catches += 1;
      if (ev.dismissalType === 'STUMPED') row.stumpings += 1;
      if (ev.dismissalType === 'RUN_OUT' || ev.dismissalType === 'MANKAD') row.runOuts += 1;
    }
  }

  const teams: MatchStatTeamDelta[] = [input.homeTeamId, input.awayTeamId].map((teamId) => {
    const scored = teamRuns.get(teamId) ?? { runs: 0, wickets: 0 };
    return {
      teamId,
      matches: 1,
      ...teamOutcome(teamId, input.resultType, input.winnerTeamId),
      runs: scored.runs,
      wickets: scored.wickets,
    };
  });

  return {
    version: 1,
    matchId: input.matchId,
    resultType: input.resultType,
    winnerTeamId: input.winnerTeamId,
    players: [...players.values()],
    teams,
  };
}

export function applyPlayerDelta(current: PlayerCareerTotals, delta: MatchStatPlayerDelta): PlayerCareerTotals {
  const next = {
    matches: current.matches + delta.matches,
    innings: current.innings + delta.innings,
    runs: current.runs + delta.runs,
    balls: current.balls + delta.balls,
    fours: current.fours + delta.fours,
    sixes: current.sixes + delta.sixes,
    fifties: current.fifties + delta.fifties,
    hundreds: current.hundreds + delta.hundreds,
    highestScore: Math.max(current.highestScore, delta.highestScore),
    notOuts: current.notOuts + delta.notOuts,
    wickets: current.wickets + delta.wickets,
    oversBowledBalls: current.oversBowledBalls + delta.oversBowledBalls,
    runsConceded: current.runsConceded + delta.runsConceded,
    maidens: current.maidens + delta.maidens,
    catches: current.catches + delta.catches,
    stumpings: current.stumpings + delta.stumpings,
    runOuts: current.runOuts + delta.runOuts,
    bestBowlWkts: current.bestBowlWkts,
    bestBowlRuns: current.bestBowlRuns,
    hatTricks: current.hatTricks + delta.hatTricks,
  };
  if (betterBowling(current.bestBowlWkts, current.bestBowlRuns, delta.bestBowlWkts, delta.bestBowlRuns)) {
    next.bestBowlWkts = delta.bestBowlWkts;
    next.bestBowlRuns = delta.bestBowlRuns;
  }
  return next;
}

export function reversePlayerDelta(current: PlayerCareerTotals, delta: MatchStatPlayerDelta): PlayerCareerTotals {
  return {
    matches: Math.max(0, current.matches - delta.matches),
    innings: Math.max(0, current.innings - delta.innings),
    runs: Math.max(0, current.runs - delta.runs),
    balls: Math.max(0, current.balls - delta.balls),
    fours: Math.max(0, current.fours - delta.fours),
    sixes: Math.max(0, current.sixes - delta.sixes),
    fifties: Math.max(0, current.fifties - delta.fifties),
    hundreds: Math.max(0, current.hundreds - delta.hundreds),
    highestScore: current.highestScore,
    notOuts: Math.max(0, current.notOuts - delta.notOuts),
    wickets: Math.max(0, current.wickets - delta.wickets),
    oversBowledBalls: Math.max(0, current.oversBowledBalls - delta.oversBowledBalls),
    runsConceded: Math.max(0, current.runsConceded - delta.runsConceded),
    maidens: Math.max(0, current.maidens - delta.maidens),
    catches: Math.max(0, current.catches - delta.catches),
    stumpings: Math.max(0, current.stumpings - delta.stumpings),
    runOuts: Math.max(0, current.runOuts - delta.runOuts),
    bestBowlWkts: current.bestBowlWkts,
    bestBowlRuns: current.bestBowlRuns,
    hatTricks: Math.max(0, current.hatTricks - delta.hatTricks),
  };
}

export function applyTeamDelta(
  current: Omit<MatchStatTeamDelta, 'teamId'>,
  delta: MatchStatTeamDelta,
): Omit<MatchStatTeamDelta, 'teamId'> {
  return {
    matches: current.matches + delta.matches,
    wins: current.wins + delta.wins,
    losses: current.losses + delta.losses,
    ties: current.ties + delta.ties,
    noResults: current.noResults + delta.noResults,
    runs: current.runs + delta.runs,
    wickets: current.wickets + delta.wickets,
  };
}

export function reverseTeamDelta(
  current: Omit<MatchStatTeamDelta, 'teamId'>,
  delta: MatchStatTeamDelta,
): Omit<MatchStatTeamDelta, 'teamId'> {
  return {
    matches: Math.max(0, current.matches - delta.matches),
    wins: Math.max(0, current.wins - delta.wins),
    losses: Math.max(0, current.losses - delta.losses),
    ties: Math.max(0, current.ties - delta.ties),
    noResults: Math.max(0, current.noResults - delta.noResults),
    runs: Math.max(0, current.runs - delta.runs),
    wickets: Math.max(0, current.wickets - delta.wickets),
  };
}

export const emptyPlayerCareer = emptyPlayer;
