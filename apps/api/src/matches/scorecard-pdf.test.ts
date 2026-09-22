import { describe, expect, it } from 'vitest';
import {
  extrasParts,
  howOutText,
  overCells,
  renderScorecardPdf,
  stumpsBallLabel,
  type ScorecardPdfInput,
} from './scorecard-pdf';

const names = new Map([
  ['p1', 'Sudhir'],
  ['p2', 'Amit'],
  ['p3', 'Bhavin'],
  ['p4', 'Giri'],
]);

const baseMatch: ScorecardPdfInput['match'] = {
  title: 'Alpha XI vs Raghus Challengers',
  format: 'T10',
  venueText: 'Raghus Ground',
  scheduledAt: '2026-08-17T22:36:00.000Z',
  overs: 5,
  ballsPerOver: 6,
  playingPerSide: 8,
  resultType: 'WIN',
  marginType: 'RUNS',
  marginValue: 7,
  tossDecision: 'BOWL',
  tossWinnerTeamId: 'away',
  publicSlug: 'bhmu2277',
  homeTeamId: 'home',
  awayTeamId: 'away',
  homeTeam: { name: 'Alpha XI', club: { name: 'Maitri Cricket Club' } },
  awayTeam: { name: 'Raghus Challengers' },
  resultWinner: { name: 'Alpha XI' },
  tournament: { name: 'Raghus Premier League' },
  settings: { playerOfTheMatchId: 'p1' },
};

describe('scorecard PDF helpers', () => {
  it('formats caught and run out like the Stumps report', () => {
    expect(
      howOutText(
        { playerId: 'p1', runs: 21, balls: 16, fours: 2, sixes: 1, isOut: true, dismissalType: 'CAUGHT' },
        [{ sequence: 1, overNumber: 0, strikerId: 'p1', nonStrikerId: 'p2', bowlerId: 'p3', batsmanRuns: 0, extraRuns: 0, isWicket: true, dismissalType: 'CAUGHT', dismissedPlayerId: 'p1', fielderId: 'p4' }],
        names,
      ),
    ).toBe('c Giri b Bhavin');
    expect(
      howOutText(
        { playerId: 'p2', runs: 0, balls: 2, fours: 0, sixes: 0, isOut: true, dismissalType: 'RUN_OUT' },
        [{ sequence: 1, overNumber: 0, strikerId: 'p2', nonStrikerId: 'p1', bowlerId: 'p3', batsmanRuns: 0, extraRuns: 0, isWicket: true, dismissalType: 'RUN_OUT', dismissedPlayerId: 'p2', fielderId: 'p1' }],
        names,
      ),
    ).toBe('runout (Sudhir)');
    expect(
      howOutText({ playerId: 'p1', runs: 1, balls: 1, fours: 0, sixes: 0, isOut: false }, [], names),
    ).toBe('not out');
  });

  it('labels extras and balls the Stumps way', () => {
    expect(extrasParts({ inningsNumber: 1, extrasWides: 4, snapshot: { extras: 4, extrasBreakdown: { wides: 4, noBalls: 0, byes: 0, legByes: 0, penalty: 0 } } }).label).toBe('( WD 4 )');
    expect(stumpsBallLabel({ sequence: 1, overNumber: 0, strikerId: 'p1', nonStrikerId: 'p2', bowlerId: 'p3', batsmanRuns: 0, extraRuns: 1, extraType: 'WIDE' })).toBe('Wd');
    expect(stumpsBallLabel({ sequence: 1, overNumber: 0, strikerId: 'p1', nonStrikerId: 'p2', bowlerId: 'p3', batsmanRuns: 0, extraRuns: 0, isWicket: true })).toBe('W');
  });

  it('builds over comparison cells with score and figures', () => {
    const cells = overCells(
      {
        inningsNumber: 1,
        events: [
          { sequence: 1, overNumber: 0, strikerId: 'p1', nonStrikerId: 'p2', bowlerId: 'p3', batsmanRuns: 4, extraRuns: 0, extraType: 'NONE' },
          { sequence: 2, overNumber: 0, strikerId: 'p1', nonStrikerId: 'p2', bowlerId: 'p3', batsmanRuns: 0, extraRuns: 0, extraType: 'NONE', isWicket: true, dismissalType: 'BOWLED', dismissedPlayerId: 'p1' },
        ],
      },
      names,
      6,
    );
    expect(cells[0]?.balls).toEqual(['4', 'W']);
    expect(cells[0]?.footer).toContain('Score 4-1');
    expect(cells[0]?.bowlerName).toBe('Bhavin');
  });
});

describe('scorecard PDF', () => {
  const innings = [
    {
      inningsNumber: 1,
      battingTeamId: 'home',
      extrasWides: 1,
      snapshot: {
        totalRuns: 45,
        totalWickets: 2,
        totalBallsLegal: 30,
        oversDisplay: '5.0',
        currentRunRate: 9.0,
        extras: 1,
        extrasBreakdown: { wides: 1, noBalls: 0, byes: 0, legByes: 0, penalty: 0 },
        batters: [{ playerId: 'p1', runs: 20, balls: 12, fours: 2, sixes: 1, isOut: false }],
        bowlers: [{ playerId: 'p2', balls: 12, runs: 18, wickets: 1, maidens: 0, dots: 4 }],
        fallOfWickets: [{ score: 10, wicketNumber: 1, playerId: 'p3', overs: 0.5 }],
      },
      events: [
        { sequence: 1, overNumber: 0, strikerId: 'p1', nonStrikerId: 'p3', bowlerId: 'p2', batsmanRuns: 1, extraRuns: 0, extraType: 'NONE' },
      ],
    },
  ];

  it('renders a Stumps-style match report', () => {
    const pdf = renderScorecardPdf({
      match: baseMatch,
      innings,
      names,
      mvp: [{ playerId: 'p1', playerName: 'Sudhir' }],
    });
    const text = pdf.toString();
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(text).toContain('Match Report');
    expect(text).toContain('Alpha XI');
    expect(text).toContain('Raghus Premier League');
    expect(text).toContain('Sudhir');
    expect(text).toContain('Match Summary');
    expect(text).toContain('1st Innings Scorecard');
    expect(text).toContain('Over Comparison');
    expect(text).toContain('Player Of The Match');
    expect(text).toContain('bhmu2277');
    expect(text).toContain('not out');
  });

  it('summary variant keeps the cover page only', () => {
    const pdf = renderScorecardPdf({
      match: baseMatch,
      innings,
      names,
      variant: 'summary',
    });
    const text = pdf.toString();
    expect(text).toContain('Match Report');
    expect(text).toContain('Match Summary');
    expect(text).not.toContain('Over Comparison');
    expect(text).not.toContain('1st Innings Scorecard');
  });

  it('always shows the base Match Rules block, and hattrick/penalties only when applicable', () => {
    const withoutExtras = renderScorecardPdf({ match: baseMatch, innings, names }).toString();
    expect(withoutExtras).toContain('Match Rules');
    expect(withoutExtras).toContain('Balls/Over');
    expect(withoutExtras).not.toContain('Hattrick');
    expect(withoutExtras).not.toContain('Penalties');

    const withExtras = renderScorecardPdf({
      match: baseMatch,
      innings,
      names,
      matchRules: { hattrickBonusRuns: 3, penaltiesEnabled: true },
    }).toString();
    expect(withExtras).toContain('Hattrick');
    expect(withExtras).toContain('+3 runs');
    expect(withExtras).toContain('Penalties');
  });

  it('renders Special Scoring only when a penalty delivery exists, hidden otherwise', () => {
    const withoutPenalty = renderScorecardPdf({ match: baseMatch, innings, names }).toString();
    expect(withoutPenalty).not.toContain('Special Scoring');

    const inningsWithPenalty = [
      {
        ...innings[0]!,
        events: [
          ...innings[0]!.events,
          {
            sequence: 2,
            overNumber: 0,
            strikerId: 'p1',
            nonStrikerId: 'p3',
            bowlerId: 'p2',
            batsmanRuns: 0,
            extraRuns: 5,
            extraType: 'PENALTY',
            penaltyReason: 'TOURNAMENT_PENALTY',
          },
        ],
      },
    ];
    const withPenalty = renderScorecardPdf({ match: baseMatch, innings: inningsWithPenalty, names }).toString();
    expect(withPenalty).toContain('Special Scoring');
    expect(withPenalty).toContain('Tournament Penalty');
    expect(withPenalty).toContain('+5');
  });
});
