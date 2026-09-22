import type { ComputedMatchResult } from './match-result';

/**
 * Test cricket's result/follow-on rules are structurally different from limited-overs (variable
 * innings count, follow-on reordering, declarations, draws) — kept as a separate rules module
 * rather than branching T20/ODI logic in `match-result.ts`, per the "clean rules layer" requirement.
 * Callers dispatch on `match.format === 'TEST'` to pick this module instead of `computeMatchResult`.
 */

/** Law 14 / ICC Test playing-condition follow-on lead thresholds, keyed by scheduled match duration in days. */
const FOLLOW_ON_THRESHOLDS: Record<number, number> = {
  1: 75,
  2: 100,
  3: 150,
  4: 150,
  5: 200,
};

/** Defaults to the 5-day/200-run threshold when no duration is configured. */
export function followOnThreshold(durationDays?: number | null): number {
  if (durationDays == null) return FOLLOW_ON_THRESHOLDS[5]!;
  return FOLLOW_ON_THRESHOLDS[durationDays] ?? FOLLOW_ON_THRESHOLDS[5]!;
}

export type TestInningsInput = {
  inningsNumber: number;
  battingTeamId: string;
  totalRuns: number;
  totalWickets: number;
  /** COMPLETED (all out), DECLARED, or FORFEITED all count as terminal for result purposes. */
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'DECLARED' | 'FORFEITED';
};

function isTerminal(status: TestInningsInput['status']) {
  return status === 'COMPLETED' || status === 'DECLARED' || status === 'FORFEITED';
}

/** Live lead/trail, and it doubles as the follow-on lead check after each team's first innings. */
export function computeLeadTrail(
  innings: TestInningsInput[],
  teamAId: string,
  teamBId: string,
): { leadingTeamId: string | null; leadRuns: number } {
  const terminalOrLive = innings.filter((i) => i.status !== 'PENDING');
  const aRuns = terminalOrLive.filter((i) => i.battingTeamId === teamAId).reduce((sum, i) => sum + i.totalRuns, 0);
  const bRuns = terminalOrLive.filter((i) => i.battingTeamId === teamBId).reduce((sum, i) => sum + i.totalRuns, 0);
  if (aRuns === bRuns) return { leadingTeamId: null, leadRuns: 0 };
  return aRuns > bRuns ? { leadingTeamId: teamAId, leadRuns: aRuns - bRuns } : { leadingTeamId: teamBId, leadRuns: bRuns - aRuns };
}

/**
 * Available once the side batting first has completed its first innings and the side batting
 * second has completed its first innings, with a lead at or above the configured threshold.
 */
export function computeFollowOnAvailability(
  firstInnings: TestInningsInput,
  secondInnings: TestInningsInput,
  durationDays?: number | null,
): { available: boolean; lead: number } {
  if (!isTerminal(firstInnings.status) || !isTerminal(secondInnings.status)) return { available: false, lead: 0 };
  const lead = firstInnings.totalRuns - secondInnings.totalRuns;
  return { available: lead >= followOnThreshold(durationDays), lead };
}

export type TestMatchResult = ComputedMatchResult;

/**
 * Decides the match from whichever innings have reached a terminal state, in chronological order.
 * Mirrors real Test result rules: an innings victory can end the match after only 3 innings
 * (the side that batted once is still ahead of the side that batted twice); otherwise the match
 * runs to all 4 innings, decided by aggregate runs (with a wickets margin for a side that chased
 * successfully in its final innings) or a TIE if the aggregates land exactly level.
 */
export function computeTestMatchResult(input: {
  homeTeamId: string;
  awayTeamId: string;
  maxWickets: number;
  intent?: 'COMPLETE' | 'ABANDON' | 'NO_RESULT' | 'CANCEL' | 'DRAW';
  innings: TestInningsInput[];
}): TestMatchResult {
  const intent = input.intent ?? 'COMPLETE';
  if (intent === 'ABANDON') return { resultType: 'ABANDONED', winnerTeamId: null, marginType: null, marginValue: null, status: 'ABANDONED' };
  if (intent === 'CANCEL') return { resultType: 'CANCELLED', winnerTeamId: null, marginType: null, marginValue: null, status: 'CANCELLED' };
  if (intent === 'DRAW') return { resultType: 'DRAW', winnerTeamId: null, marginType: null, marginValue: null, status: 'COMPLETED' };

  const terminal = input.innings.filter((i) => isTerminal(i.status)).sort((a, b) => a.inningsNumber - b.inningsNumber);
  if (terminal.length < 3) {
    return { resultType: 'NO_RESULT', winnerTeamId: null, marginType: null, marginValue: null, status: 'COMPLETED' };
  }

  const aggFor = (teamId: string) => terminal.filter((i) => i.battingTeamId === teamId).reduce((sum, i) => sum + i.totalRuns, 0);
  const inningsCountFor = (teamId: string) => terminal.filter((i) => i.battingTeamId === teamId).length;

  if (terminal.length === 3) {
    const battedTwice = inningsCountFor(input.homeTeamId) === 2 ? input.homeTeamId : input.awayTeamId;
    const battedOnce = battedTwice === input.homeTeamId ? input.awayTeamId : input.homeTeamId;
    const aggTwice = aggFor(battedTwice);
    const aggOnce = aggFor(battedOnce);
    if (aggOnce > aggTwice) {
      return {
        resultType: 'WIN',
        winnerTeamId: battedOnce,
        marginType: 'INNINGS',
        marginValue: aggOnce - aggTwice,
        status: 'COMPLETED',
      };
    }
    // Not decided yet — the trailing side's second (follow-on) innings still needs to be played.
    return { resultType: 'NO_RESULT', winnerTeamId: null, marginType: null, marginValue: null, status: 'COMPLETED' };
  }

  // All 4 innings complete: decide on final aggregate.
  const lastInnings = terminal[terminal.length - 1]!;
  const teamLast = lastInnings.battingTeamId;
  const teamOther = teamLast === input.homeTeamId ? input.awayTeamId : input.homeTeamId;
  const aggLast = aggFor(teamLast);
  const aggOther = aggFor(teamOther);
  if (aggLast === aggOther) {
    return { resultType: 'TIE', winnerTeamId: null, marginType: null, marginValue: null, status: 'COMPLETED' };
  }
  if (aggLast > aggOther) {
    return {
      resultType: 'WIN',
      winnerTeamId: teamLast,
      marginType: 'WICKETS',
      marginValue: Math.max(0, input.maxWickets - lastInnings.totalWickets),
      status: 'COMPLETED',
    };
  }
  return {
    resultType: 'WIN',
    winnerTeamId: teamOther,
    marginType: 'RUNS',
    marginValue: aggOther - aggLast,
    status: 'COMPLETED',
  };
}
