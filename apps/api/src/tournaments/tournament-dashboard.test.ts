import { describe, expect, it } from 'vitest';
import {
  compareBestBowling,
  createTournamentPlayerAcc,
  MIN_BALLS_ECONOMY,
  MIN_BALLS_STRIKE_RATE,
  pickBestBatsman,
  pickBestBowler,
  pickBestFielder,
  playerStatsFromDashboard,
  type TournamentDashboard,
} from './tournament-dashboard';

describe('tournament dashboard ranking', () => {
  it('does not invent a best batsman when nobody has scored', () => {
    expect(pickBestBatsman([createTournamentPlayerAcc('p1', 'A')])).toBeNull();
  });

  it('ranks best batsman by tournament runs, then average', () => {
    const a = createTournamentPlayerAcc('a', 'Alpha', { runs: 40, innings: 2, notOuts: 0, balls: 30 });
    const b = createTournamentPlayerAcc('b', 'Beta', { runs: 80, innings: 2, notOuts: 0, balls: 50 });
    expect(pickBestBatsman([a, b])?.playerId).toBe('b');
  });

  it('ranks best bowler by wickets, then economy', () => {
    const cheap = createTournamentPlayerAcc('c', 'Cheap', { wickets: 3, bowlRuns: 12, bowlBalls: 24 });
    const expensive = createTournamentPlayerAcc('e', 'Expensive', { wickets: 3, bowlRuns: 30, bowlBalls: 24 });
    expect(pickBestBowler([expensive, cheap])?.playerId).toBe('c');
  });

  it('does not pick a bowler with zero wickets', () => {
    expect(pickBestBowler([createTournamentPlayerAcc('p', 'P', { bowlBalls: 6, bowlRuns: 1 })])).toBeNull();
  });

  it('ranks best fielder from actual fielding events only', () => {
    const fielder = createTournamentPlayerAcc('f', 'Fielder', { catches: 2, runOuts: 1 });
    const none = createTournamentPlayerAcc('n', 'None', { wickets: 4 });
    expect(pickBestFielder([none, fielder])?.playerId).toBe('f');
    expect(pickBestFielder([none])).toBeNull();
  });

  it('breaks bowling ties by fewer runs conceded', () => {
    expect(compareBestBowling({ wickets: 5, runs: 12, balls: 24 }, { wickets: 5, runs: 20, balls: 24 })).toBeLessThan(0);
    expect(compareBestBowling({ wickets: 4, runs: 8, balls: 24 }, { wickets: 5, runs: 20, balls: 24 })).toBeGreaterThan(0);
  });

  it('keeps strike-rate and economy sample-size floors', () => {
    expect(MIN_BALLS_STRIKE_RATE).toBe(10);
    expect(MIN_BALLS_ECONOMY).toBe(6);
  });
});

describe('tournament player stats isolation', () => {
  const emptyDash = (id: string, playerId: string, runs: number): TournamentDashboard =>
    ({
      tournamentId: id,
      header: {
        name: id,
        status: 'COMPLETED',
        season: null,
        club: null,
        format: 'T10',
        overs: 5,
        maxWickets: 7,
        teams: 2,
        matches: 1,
        completed: 1,
        live: 0,
        upcoming: 0,
        abandoned: 0,
        cancelled: 0,
      },
      summary: {
        teams: 2,
        matches: 1,
        completed: 1,
        upcoming: 0,
        live: 0,
        totalRuns: runs,
        totalWickets: 0,
        totalOvers: '5.0',
        totalBalls: 30,
        fours: 0,
        sixes: 0,
        extras: 0,
        liveTotals: null,
      },
      hasCompletedStats: true,
      performers: { bestBatsman: null, bestBowler: null, bestFielder: null, mvp: null },
      batting: [
        {
          playerId,
          playerName: 'X',
          photoUrl: null,
          teamId: 't',
          teamName: 'Team',
          matches: 1,
          innings: 1,
          runs,
          balls: 20,
          average: runs,
          strikeRate: (runs / 20) * 100,
          highest: runs,
          fours: 0,
          sixes: 0,
          notOuts: 0,
        },
      ],
      bowling: [],
      fielding: [],
      records: {
        mostRuns: null,
        highestScore: null,
        mostFours: null,
        mostSixes: null,
        bestStrikeRate: null,
        mostWickets: null,
        bestBowling: null,
        bestEconomy: null,
        mostCatches: null,
        mostRunOuts: null,
        mostStumpings: null,
        highestTeamScore: null,
        lowestTeamScore: null,
        largestWinningMargin: null,
        closestMatch: null,
        mostTeamWins: null,
      },
      players: [
        {
          playerId,
          playerName: 'X',
          photoUrl: null,
          teamId: 't',
          teamName: 'Team',
          matches: 1,
          runs,
          wickets: 0,
          catches: 0,
          runOuts: 0,
          stumpings: 0,
        },
      ],
      teams: [],
      matchAwards: [],
      scorecards: [],
      quizEnabled: false,
      mvpFormula: '',
    }) as TournamentDashboard;

  it('reads only the supplied tournament dashboard for a player', () => {
    const a = playerStatsFromDashboard(emptyDash('tn-a', 'px', 40), 'px');
    const b = playerStatsFromDashboard(emptyDash('tn-b', 'px', 12), 'px');
    expect(a?.runs).toBe(40);
    expect(b?.runs).toBe(12);
    expect(a?.tournamentId).toBe('tn-a');
    expect(b?.tournamentId).toBe('tn-b');
  });

  it('returns null when the player has no tournament row', () => {
    expect(playerStatsFromDashboard(emptyDash('tn-a', 'px', 40), 'other')).toBeNull();
  });
});
