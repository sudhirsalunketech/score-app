import { describe, expect, it } from 'vitest';
import {
  computeGroupStandings,
  computeStreetMvp,
  deliveryBlockedMessage,
  formatOvers,
  inningsStopReason,
  isLegalBall,
  minOversFromProgress,
  minWicketsFromProgress,
  netRunRate,
  nrrOvers,
  recalcBallPositions,
  replayInnings,
  type ScoringEvent,
} from './index';

function ev(partial: Partial<ScoringEvent> & Pick<ScoringEvent, 'sequence'>): ScoringEvent {
  return {
    overNumber: 0,
    ballInOver: 0,
    strikerId: 's',
    nonStrikerId: 'ns',
    bowlerId: 'b',
    batsmanRuns: 0,
    extraRuns: 0,
    extraType: 'NONE',
    isWicket: false,
    ...partial,
  };
}

describe('replayInnings', () => {
  it('scores a legal 1', () => {
    const s = replayInnings([ev({ sequence: 1, batsmanRuns: 1 })], { ballsPerOver: 6 });
    expect(s.totalRuns).toBe(1);
    expect(s.totalBallsLegal).toBe(1);
    expect(s.strikerId).toBe('ns');
  });

  it('does not count a wide as a legal ball', () => {
    const s = replayInnings([ev({ sequence: 1, extraType: 'WIDE', extraRuns: 1 })]);
    expect(s.totalRuns).toBe(1);
    expect(s.totalBallsLegal).toBe(0);
    expect(s.extrasBreakdown.wides).toBe(1);
  });

  it('counts a no-ball as extra and sets free hit', () => {
    const s = replayInnings([ev({ sequence: 1, extraType: 'NO_BALL', extraRuns: 1, batsmanRuns: 4 })]);
    expect(s.totalRuns).toBe(5);
    expect(s.totalBallsLegal).toBe(0);
    expect(s.freeHitNext).toBe(true);
  });

  it('records 4 and 6', () => {
    const s = replayInnings([
      ev({ sequence: 1, batsmanRuns: 4 }),
      ev({ sequence: 2, batsmanRuns: 6, strikerId: 's', nonStrikerId: 'ns' }),
    ]);
    expect(s.totalRuns).toBe(10);
    const bat = s.batters.find((b) => b.playerId === 's')!;
    expect(bat.fours + bat.sixes).toBeGreaterThan(0);
  });

  it('records a bowled wicket', () => {
    const s = replayInnings([
      ev({ sequence: 1, isWicket: true, dismissalType: 'BOWLED', dismissedPlayerId: 's' }),
    ]);
    expect(s.totalWickets).toBe(1);
    expect(s.bowlers[0]!.wickets).toBe(1);
    expect(s.fallOfWickets).toHaveLength(1);
  });

  it('does not give bowler credit for run out', () => {
    const s = replayInnings([
      ev({ sequence: 1, isWicket: true, dismissalType: 'RUN_OUT', dismissedPlayerId: 's' }),
    ]);
    expect(s.totalWickets).toBe(1);
    expect(s.bowlers[0]!.wickets).toBe(0);
  });

  it('credits mankad as a bowler wicket by default', () => {
    const s = replayInnings([
      ev({ sequence: 1, isWicket: true, dismissalType: 'MANKAD', dismissedPlayerId: 'ns' }),
    ]);
    expect(s.bowlers[0]!.wickets).toBe(1);
  });

  it('completes an over at ballsPerOver=5', () => {
    const balls = [1, 2, 3, 4, 5].map((n) => ev({ sequence: n, batsmanRuns: 0 }));
    const s = replayInnings(balls, { ballsPerOver: 5 });
    expect(s.currentOver).toBe(1);
    expect(s.ballsInCurrentOver).toBe(0);
    expect(s.bowlers[0]!.maidens).toBe(1);
  });

  it('ends innings at max wickets', () => {
    const events = [1, 2].map((n) =>
      ev({ sequence: n, isWicket: true, dismissalType: 'BOWLED', dismissedPlayerId: n === 1 ? 's' : 'ns' }),
    );
    const s = replayInnings(events, { maxWickets: 2 });
    expect(s.isComplete).toBe(true);
  });

  it('ends innings after the configured maximum overs', () => {
    const events = Array.from({ length: 30 }, (_, i) => ev({ sequence: i + 1, batsmanRuns: 0 }));
    const s = replayInnings(events, { ballsPerOver: 6, maxOvers: 5, maxWickets: 10 });
    expect(s.currentOver).toBe(5);
    expect(s.ballsInCurrentOver).toBe(0);
    expect(s.totalBallsLegal).toBe(30);
    expect(s.isComplete).toBe(true);
  });

  it('does not complete after 4 overs in a 5-over innings', () => {
    const events = Array.from({ length: 24 }, (_, i) => ev({ sequence: i + 1, batsmanRuns: 1 }));
    const s = replayInnings(events, { ballsPerOver: 6, maxOvers: 5, maxWickets: 10 });
    expect(s.currentOver).toBe(4);
    expect(s.isComplete).toBe(false);
  });

  it('ends innings when the chase target is reached', () => {
    const events = [ev({ sequence: 1, batsmanRuns: 6 }), ev({ sequence: 2, batsmanRuns: 4 })];
    const s = replayInnings(events, { maxOvers: 5, maxWickets: 10, targetRuns: 10 });
    expect(s.totalRuns).toBe(10);
    expect(s.isComplete).toBe(true);
  });

  it('ends innings at the wicket limit during an unfinished over', () => {
    const events = [1, 2, 3].map((n) =>
      ev({ sequence: n, isWicket: true, dismissalType: 'BOWLED', dismissedPlayerId: `p${n}` }),
    );
    const s = replayInnings(events, { ballsPerOver: 6, maxOvers: 5, maxWickets: 3 });
    expect(s.totalWickets).toBe(3);
    expect(s.totalBallsLegal).toBe(3);
    expect(s.currentOver).toBe(0);
    expect(s.isComplete).toBe(true);
  });

  it('ignores undone events', () => {
    const s = replayInnings([
      ev({ sequence: 1, batsmanRuns: 6, isUndone: true }),
      ev({ sequence: 2, batsmanRuns: 1 }),
    ]);
    expect(s.totalRuns).toBe(1);
  });

  it('adds no-ball extra plus batsman boundary', () => {
    const s = replayInnings([ev({ sequence: 1, extraType: 'NO_BALL', extraRuns: 1, batsmanRuns: 4 })]);
    expect(s.totalRuns).toBe(5);
    expect(s.totalBallsLegal).toBe(0);
    expect(s.batters[0]!.fours).toBe(1);
  });

  it('adds wide plus additional runs without a legal ball', () => {
    const s = replayInnings([ev({ sequence: 1, extraType: 'WIDE', extraRuns: 3 })]);
    expect(s.totalRuns).toBe(3);
    expect(s.totalBallsLegal).toBe(0);
  });

  it('credits bye runs to extras not the batter', () => {
    const s = replayInnings([ev({ sequence: 1, extraType: 'BYE', extraRuns: 2, batsmanRuns: 0 })]);
    expect(s.totalRuns).toBe(2);
    expect(s.batters[0]!.runs).toBe(0);
    expect(s.extrasBreakdown.byes).toBe(2);
  });

  it('credits leg-bye runs to extras', () => {
    const s = replayInnings([ev({ sequence: 1, extraType: 'LEG_BYE', extraRuns: 1 })]);
    expect(s.totalRuns).toBe(1);
    expect(s.batters[0]!.runs).toBe(0);
  });

  it('rotates on a single bye', () => {
    const s = replayInnings([ev({ sequence: 1, extraType: 'BYE', extraRuns: 1, batsmanRuns: 0 })]);
    expect(s.strikerId).toBe('ns');
    expect(s.totalBallsLegal).toBe(1);
  });

  it('rotates on a no-ball plus one off the bat', () => {
    const s = replayInnings([ev({ sequence: 1, extraType: 'NO_BALL', extraRuns: 1, batsmanRuns: 1 })]);
    expect(s.strikerId).toBe('ns');
    expect(s.totalBallsLegal).toBe(0);
    expect(s.totalRuns).toBe(2);
  });

  it('rotates when batters run an extra on a wide', () => {
    const s = replayInnings([ev({ sequence: 1, extraType: 'WIDE', extraRuns: 2 })]);
    expect(s.strikerId).toBe('ns');
    expect(s.totalBallsLegal).toBe(0);
  });

  it('allows run-out with runs scored', () => {
    const s = replayInnings([
      ev({
        sequence: 1,
        batsmanRuns: 1,
        isWicket: true,
        dismissalType: 'RUN_OUT',
        dismissedPlayerId: 's',
      }),
    ]);
    expect(s.totalRuns).toBe(1);
    expect(s.totalWickets).toBe(1);
    expect(s.bowlers[0]!.wickets).toBe(0);
  });

  it('does not credit penalty runs against the bowler', () => {
    const s = replayInnings([
      ev({ sequence: 1, batsmanRuns: 1 }),
      ev({ sequence: 2, extraType: 'PENALTY', extraRuns: 5 }),
    ]);
    expect(s.totalRuns).toBe(6);
    expect(s.bowlers[0]!.runs).toBe(1);
  });

  it('does not credit penalty runs to the batter either', () => {
    const s = replayInnings([ev({ sequence: 1, extraType: 'PENALTY', extraRuns: 5 })]);
    expect(s.batters[0]!.runs).toBe(0);
  });

  it('treats a wide as a legal ball when widesCountAsLegal is set', () => {
    const s = replayInnings([ev({ sequence: 1, extraType: 'WIDE', extraRuns: 1 })], { widesCountAsLegal: true });
    expect(s.totalBallsLegal).toBe(1);
  });

  it('treats a no-ball as a legal ball when noBallsCountAsLegal is set', () => {
    const s = replayInnings([ev({ sequence: 1, extraType: 'NO_BALL', extraRuns: 1 })], { noBallsCountAsLegal: true });
    expect(s.totalBallsLegal).toBe(1);
  });

  it('replaying the same events twice produces identical totals', () => {
    const events = [
      ev({ sequence: 1, batsmanRuns: 4 }),
      ev({ sequence: 2, extraType: 'WIDE', extraRuns: 1 }),
      ev({ sequence: 3, extraType: 'PENALTY', extraRuns: 5 }),
      ev({ sequence: 4, isWicket: true, dismissalType: 'BOWLED', dismissedPlayerId: 's' }),
    ];
    const a = replayInnings(events, { ballsPerOver: 6 });
    const b = replayInnings(events, { ballsPerOver: 6 });
    expect(a).toEqual(b);
  });
});

describe('isLegalBall', () => {
  it('a penalty is never a legal ball, regardless of options', () => {
    expect(isLegalBall('PENALTY')).toBe(false);
    expect(isLegalBall('PENALTY', { widesCountAsLegal: true, noBallsCountAsLegal: true })).toBe(false);
  });

  it('defaults wide/no-ball to illegal when no options are given', () => {
    expect(isLegalBall('WIDE')).toBe(false);
    expect(isLegalBall('NO_BALL')).toBe(false);
  });

  it('respects widesCountAsLegal / noBallsCountAsLegal independently', () => {
    expect(isLegalBall('WIDE', { widesCountAsLegal: true })).toBe(true);
    expect(isLegalBall('NO_BALL', { widesCountAsLegal: true })).toBe(false);
    expect(isLegalBall('NO_BALL', { noBallsCountAsLegal: true })).toBe(true);
  });

  it('ordinary and bye/leg-bye deliveries are always legal', () => {
    expect(isLegalBall('NONE')).toBe(true);
    expect(isLegalBall('BYE')).toBe(true);
    expect(isLegalBall('LEG_BYE')).toBe(true);
  });
});

describe('formatOvers', () => {
  it('formats 7 legal balls as 1.1', () => {
    expect(formatOvers(7, 6)).toBe('1.1');
  });
});

describe('recalcBallPositions', () => {
  it('re-derives over/ball labels from sequence order alone, ignoring stale stamped values', () => {
    const events = [
      ev({ sequence: 1, overNumber: 9, ballInOver: 9 }),
      ev({ sequence: 2, overNumber: 9, ballInOver: 9 }),
      ev({ sequence: 3, overNumber: 9, ballInOver: 9, extraType: 'WIDE', extraRuns: 1 }),
      ev({ sequence: 4, overNumber: 9, ballInOver: 9 }),
      ev({ sequence: 5, overNumber: 9, ballInOver: 9 }),
      ev({ sequence: 6, overNumber: 9, ballInOver: 9 }),
      ev({ sequence: 7, overNumber: 9, ballInOver: 9 }),
    ];
    const out = recalcBallPositions(events, { ballsPerOver: 6 });
    expect(out.map((o) => `${o.overNumber}.${o.ballInOver}`)).toEqual([
      '0.0', '0.1', '0.2', '0.2', '0.3', '0.4', '0.5',
    ]);
  });

  it('excludes undone balls from the legal-ball count, same as replayInnings', () => {
    const events = [
      ev({ sequence: 1 }),
      ev({ sequence: 2, isUndone: true }),
      ev({ sequence: 3 }),
    ];
    const out = recalcBallPositions(events, { ballsPerOver: 6 });
    expect(out.map((o) => `${o.overNumber}.${o.ballInOver}`)).toEqual(['0.0', '0.1', '0.1']);
  });

  it('respects widesCountAsLegal when re-deriving positions', () => {
    const events = [
      ev({ sequence: 1, extraType: 'WIDE', extraRuns: 1 }),
      ev({ sequence: 2 }),
    ];
    const out = recalcBallPositions(events, { ballsPerOver: 6, widesCountAsLegal: true });
    expect(out.map((o) => `${o.overNumber}.${o.ballInOver}`)).toEqual(['0.0', '0.1']);
  });
});

describe('minOversFromProgress / minWicketsFromProgress', () => {
  it('keeps overs at 1 before any ball', () => {
    expect(minOversFromProgress(0, 6)).toBe(1);
  });

  it('allows 1 over after a completed first over, but not after the next over has started', () => {
    expect(minOversFromProgress(6, 6)).toBe(1);
    expect(minOversFromProgress(7, 6)).toBe(2);
    expect(minOversFromProgress(12, 6)).toBe(2);
    expect(minOversFromProgress(13, 6)).toBe(3);
  });

  it('does not allow wickets below the number already fallen', () => {
    expect(minWicketsFromProgress(0)).toBe(1);
    expect(minWicketsFromProgress(2)).toBe(2);
    expect(minWicketsFromProgress(10)).toBe(10);
  });
});

describe('MVP street', () => {
  it('matches screenshot tables including decimal runs/10', () => {
    const r = computeStreetMvp({
      runs: 198,
      ballsFaced: 100,
      wickets: 7,
      maidenOvers: 0,
      catches: 5,
      stumpings: 0,
      runOuts: 0,
    });
    expect(r.batting).toBe(22.8);
    expect(r.bowling).toBe(16);
    expect(r.fielding).toBe(5);
    expect(r.total).toBe(43.8);
  });

  it('adds strike-rate bonus only with min 10 runs', () => {
    const r = computeStreetMvp({
      runs: 19,
      ballsFaced: 10,
      wickets: 2,
      maidenOvers: 0,
      catches: 1,
      stumpings: 0,
      runOuts: 0,
    });
    expect(r.batting).toBe(2.9);
    expect(r.bowling).toBe(4);
    expect(r.fielding).toBe(1);
    expect(r.total).toBe(7.9);
  });
});

describe('NRR', () => {
  it('uses full overs when all out', () => {
    const nrr = netRunRate({
      runsFor: 80,
      ballsFaced: 48,
      allOutFor: true,
      runsAgainst: 70,
      ballsBowled: 60,
      maxOvers: 10,
      ballsPerOver: 6,
    });
    expect(nrr).toBeCloseTo(80 / 10 - 70 / 10, 2);
  });

  it('credits allotted overs per all-out innings when combining matches', () => {
    const oversFaced =
      nrrOvers({ balls: 48, allOut: true, maxOvers: 10, ballsPerOver: 6 }) +
      nrrOvers({ balls: 30, allOut: false, maxOvers: 5, ballsPerOver: 6 });
    const oversBowled =
      nrrOvers({ balls: 60, allOut: false, maxOvers: 10, ballsPerOver: 6 }) +
      nrrOvers({ balls: 26, allOut: true, maxOvers: 5, ballsPerOver: 6 });
    expect(oversFaced).toBe(15);
    expect(oversBowled).toBe(15);
    expect(
      netRunRate({
        runsFor: 130,
        runsAgainst: 115,
        oversFaced,
        oversBowled,
      }),
    ).toBe(1);
  });
});

describe('group standings', () => {
  it('awards 2 points for a win, 1 for a tie, and ranks by NRR', () => {
    const rows = computeGroupStandings(
      [
        { teamId: 'a', teamName: 'Amol Champs' },
        { teamId: 'b', teamName: 'Raj Champs' },
        { teamId: 'c', teamName: 'Harmesh Champs' },
      ],
      [
        {
          homeTeamId: 'a',
          awayTeamId: 'b',
          overs: 5,
          ballsPerOver: 6,
          maxWickets: 7,
          innings: [
            { battingTeamId: 'a', bowlingTeamId: 'b', totalRuns: 50, totalBallsLegal: 30, totalWickets: 2 },
            { battingTeamId: 'b', bowlingTeamId: 'a', totalRuns: 40, totalBallsLegal: 30, totalWickets: 4 },
          ],
        },
        {
          homeTeamId: 'a',
          awayTeamId: 'c',
          overs: 5,
          ballsPerOver: 6,
          maxWickets: 7,
          innings: [
            { battingTeamId: 'a', bowlingTeamId: 'c', totalRuns: 45, totalBallsLegal: 30, totalWickets: 1 },
            { battingTeamId: 'c', bowlingTeamId: 'a', totalRuns: 45, totalBallsLegal: 30, totalWickets: 3 },
          ],
        },
      ],
    );
    expect(rows.map((r) => r.teamId)).toEqual(['a', 'c', 'b']);
    expect(rows[0]).toMatchObject({ played: 2, won: 1, tied: 1, points: 3, nrr: 1 });
    expect(rows.find((r) => r.teamId === 'b')).toMatchObject({ played: 1, won: 0, lost: 1, points: 0 });
  });

  it('uses stored winner and counts no-result without changing NRR twice', () => {
    const rows = computeGroupStandings(
      [
        { teamId: 'a', teamName: 'A' },
        { teamId: 'b', teamName: 'B' },
      ],
      [
        {
          homeTeamId: 'a',
          awayTeamId: 'b',
          overs: 5,
          ballsPerOver: 6,
          maxWickets: 7,
          resultType: 'WIN',
          winnerTeamId: 'b',
          innings: [
            { battingTeamId: 'a', bowlingTeamId: 'b', totalRuns: 100, totalBallsLegal: 30, totalWickets: 2 },
            { battingTeamId: 'b', bowlingTeamId: 'a', totalRuns: 101, totalBallsLegal: 24, totalWickets: 3 },
          ],
        },
        {
          homeTeamId: 'a',
          awayTeamId: 'b',
          overs: 5,
          ballsPerOver: 6,
          maxWickets: 7,
          resultType: 'NO_RESULT',
          winnerTeamId: null,
          innings: [{ battingTeamId: 'a', bowlingTeamId: 'b', totalRuns: 999, totalBallsLegal: 6, totalWickets: 0 }],
        },
      ],
    );
    expect(rows.find((r) => r.teamId === 'b')).toMatchObject({ played: 2, won: 1, lost: 0, noResult: 1, points: 3 });
    expect(rows.find((r) => r.teamId === 'a')).toMatchObject({ played: 2, won: 0, lost: 1, noResult: 1, points: 1 });
  });

  it('adds a configured winning bonus on top of the standard 2 points per win', () => {
    const matches = [
      {
        homeTeamId: 'a',
        awayTeamId: 'b',
        overs: 5,
        ballsPerOver: 6,
        maxWickets: 7,
        resultType: 'WIN' as const,
        winnerTeamId: 'a',
        innings: [
          { battingTeamId: 'a', bowlingTeamId: 'b', totalRuns: 60, totalBallsLegal: 30, totalWickets: 2 },
          { battingTeamId: 'b', bowlingTeamId: 'a', totalRuns: 40, totalBallsLegal: 30, totalWickets: 4 },
        ],
      },
    ];
    const teams = [
      { teamId: 'a', teamName: 'A' },
      { teamId: 'b', teamName: 'B' },
    ];
    const withoutBonus = computeGroupStandings(teams, matches);
    expect(withoutBonus.find((r) => r.teamId === 'a')).toMatchObject({ won: 1, bonusPoints: 0, points: 2 });

    const withBonus = computeGroupStandings(teams, matches, { winningBonusPoints: 3 });
    expect(withBonus.find((r) => r.teamId === 'a')).toMatchObject({ won: 1, bonusPoints: 3, points: 5 });
    expect(withBonus.find((r) => r.teamId === 'b')).toMatchObject({ lost: 1, bonusPoints: 0, points: 0 });
  });

  it('awards the configured tie-points value to both teams on a tie, defaulting to 1', () => {
    const matches = [
      {
        homeTeamId: 'a',
        awayTeamId: 'b',
        overs: 5,
        ballsPerOver: 6,
        maxWickets: 7,
        resultType: 'TIE' as const,
        winnerTeamId: null,
        innings: [
          { battingTeamId: 'a', bowlingTeamId: 'b', totalRuns: 50, totalBallsLegal: 30, totalWickets: 2 },
          { battingTeamId: 'b', bowlingTeamId: 'a', totalRuns: 50, totalBallsLegal: 30, totalWickets: 4 },
        ],
      },
    ];
    const teams = [
      { teamId: 'a', teamName: 'A' },
      { teamId: 'b', teamName: 'B' },
    ];
    const defaultRows = computeGroupStandings(teams, matches);
    expect(defaultRows.find((r) => r.teamId === 'a')).toMatchObject({ tied: 1, points: 1 });
    expect(defaultRows.find((r) => r.teamId === 'b')).toMatchObject({ tied: 1, points: 1 });

    const configuredRows = computeGroupStandings(teams, matches, { tiePoints: 2 });
    expect(configuredRows.find((r) => r.teamId === 'a')).toMatchObject({ tied: 1, points: 2 });
    expect(configuredRows.find((r) => r.teamId === 'b')).toMatchObject({ tied: 1, points: 2 });
  });

  it('ignores matches against teams outside the group', () => {
    const rows = computeGroupStandings(
      [{ teamId: 'a', teamName: 'A' }],
      [
        {
          homeTeamId: 'a',
          awayTeamId: 'out',
          overs: 5,
          ballsPerOver: 6,
          maxWickets: 7,
          innings: [
            { battingTeamId: 'a', bowlingTeamId: 'out', totalRuns: 80, totalBallsLegal: 30, totalWickets: 1 },
            { battingTeamId: 'out', bowlingTeamId: 'a', totalRuns: 10, totalBallsLegal: 30, totalWickets: 7 },
          ],
        },
      ],
    );
    expect(rows[0]).toMatchObject({ played: 0, points: 0, nrr: 0 });
  });

  it('folds manually-entered matches into the same totals before deriving points/NRR', () => {
    const teams = [{ teamId: 'a', teamName: 'A' }];
    const rows = computeGroupStandings(teams, [], {}, [
      { teamId: 'a', played: 1, won: 1, lost: 0, tied: 0, noResult: 0, runsFor: 60, runsAgainst: 40, oversFaced: 5, oversBowled: 5 },
    ]);
    expect(rows[0]).toMatchObject({ played: 1, won: 1, points: 2, nrr: 4 });
  });

  it('combines a real match and a manual match for the same team', () => {
    const teams = [{ teamId: 'a', teamName: 'A' }, { teamId: 'b', teamName: 'B' }];
    const matches = [
      {
        homeTeamId: 'a',
        awayTeamId: 'b',
        overs: 5,
        ballsPerOver: 6,
        maxWickets: 7,
        resultType: 'WIN' as const,
        winnerTeamId: 'a',
        innings: [
          { battingTeamId: 'a', bowlingTeamId: 'b', totalRuns: 50, totalBallsLegal: 30, totalWickets: 2 },
          { battingTeamId: 'b', bowlingTeamId: 'a', totalRuns: 40, totalBallsLegal: 30, totalWickets: 4 },
        ],
      },
    ];
    const rows = computeGroupStandings(teams, matches, {}, [
      { teamId: 'a', played: 1, won: 0, lost: 1, tied: 0, noResult: 0, runsFor: 30, runsAgainst: 45, oversFaced: 5, oversBowled: 5 },
    ]);
    // real: won=1 lost=0; manual: won=0 lost=1 -> combined played=2, won=1, lost=1, points=2 (win only)
    expect(rows.find((r) => r.teamId === 'a')).toMatchObject({ played: 2, won: 1, lost: 1, points: 2 });
    expect(rows.find((r) => r.teamId === 'b')).toMatchObject({ played: 1, won: 0, lost: 1, points: 0 });
  });

  it('applies the configured winning bonus to manual wins too, since they fold into the same won count', () => {
    const teams = [{ teamId: 'a', teamName: 'A' }];
    const rows = computeGroupStandings(teams, [], { winningBonusPoints: 3 }, [
      { teamId: 'a', played: 1, won: 1, lost: 0, tied: 0, noResult: 0, runsFor: 60, runsAgainst: 40, oversFaced: 5, oversBowled: 5 },
    ]);
    expect(rows[0]).toMatchObject({ won: 1, bonusPoints: 3, points: 5 });
  });

  it('is a no-op when no manual entries are supplied for a team', () => {
    const teams = [{ teamId: 'a', teamName: 'A' }];
    const withManualArg = computeGroupStandings(teams, [], {}, []);
    const withoutManualArg = computeGroupStandings(teams, []);
    expect(withManualArg).toEqual(withoutManualArg);
  });
});

describe('deliveryBlockedMessage', () => {
  const open = { isComplete: false, totalWickets: 0, currentOver: 0, totalRuns: 0 };

  it('allows a legal delivery while the innings is open', () => {
    expect(deliveryBlockedMessage(open, { maxOvers: 5, maxWickets: 7 })).toBeNull();
    expect(inningsStopReason(open, { maxOvers: 5, maxWickets: 7 })).toBeNull();
  });

  it('rejects over 6 after a 5-over innings is complete', () => {
    const snap = { isComplete: true, totalWickets: 2, currentOver: 5, totalRuns: 40 };
    expect(inningsStopReason(snap, { maxOvers: 5, maxWickets: 7 })).toBe('overs');
    expect(deliveryBlockedMessage(snap, { maxOvers: 5, maxWickets: 7 })).toBe(
      'This match is limited to 5 overs. No additional overs can be added.',
    );
  });

  it('rejects another wicket after the configured limit', () => {
    const snap = { isComplete: true, totalWickets: 7, currentOver: 2, totalRuns: 18 };
    expect(inningsStopReason(snap, { maxOvers: 5, maxWickets: 7 })).toBe('wickets');
    expect(deliveryBlockedMessage(snap, { maxOvers: 5, maxWickets: 7 }, { isWicket: true, dismissalType: 'BOWLED' })).toBe(
      'The maximum number of wickets for this innings has been reached.',
    );
  });

  it('rejects another ball after the chase target is reached', () => {
    const snap = { isComplete: true, totalWickets: 1, currentOver: 3, totalRuns: 101 };
    expect(inningsStopReason(snap, { maxOvers: 5, maxWickets: 7, targetRuns: 101 })).toBe('target');
    expect(deliveryBlockedMessage(snap, { maxOvers: 5, maxWickets: 7, targetRuns: 101 })).toBe(
      'The target has been reached. No additional balls can be added.',
    );
  });
});
