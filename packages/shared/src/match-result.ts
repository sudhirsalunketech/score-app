export type MatchResultType = 'WIN' | 'TIE' | 'DRAW' | 'NO_RESULT' | 'ABANDONED' | 'CANCELLED';
export type MatchMarginType = 'RUNS' | 'WICKETS' | 'INNINGS';

export type MatchResultInnings = {
  inningsNumber: number;
  battingTeamId: string;
  totalRuns: number;
  totalWickets: number;
  isComplete?: boolean;
};

export type ComputedMatchResult = {
  resultType: MatchResultType;
  winnerTeamId: string | null;
  marginType: MatchMarginType | null;
  marginValue: number | null;
  status: 'COMPLETED' | 'ABANDONED' | 'CANCELLED';
};

export function computeMatchResult(input: {
  homeTeamId: string;
  awayTeamId: string;
  maxWickets: number;
  intent?: 'COMPLETE' | 'ABANDON' | 'NO_RESULT' | 'CANCEL';
  innings: MatchResultInnings[];
}): ComputedMatchResult {
  const intent = input.intent ?? 'COMPLETE';
  if (intent === 'ABANDON') {
    return { resultType: 'ABANDONED', winnerTeamId: null, marginType: null, marginValue: null, status: 'ABANDONED' };
  }
  if (intent === 'CANCEL') {
    return { resultType: 'CANCELLED', winnerTeamId: null, marginType: null, marginValue: null, status: 'CANCELLED' };
  }
  if (intent === 'NO_RESULT') {
    return { resultType: 'NO_RESULT', winnerTeamId: null, marginType: null, marginValue: null, status: 'COMPLETED' };
  }

  const first = input.innings.find((i) => i.inningsNumber === 1);
  const second = input.innings.find((i) => i.inningsNumber === 2);
  if (!first || !second) {
    return { resultType: 'NO_RESULT', winnerTeamId: null, marginType: null, marginValue: null, status: 'COMPLETED' };
  }

  if (second.totalRuns > first.totalRuns) {
    return {
      resultType: 'WIN',
      winnerTeamId: second.battingTeamId,
      marginType: 'WICKETS',
      marginValue: Math.max(0, input.maxWickets - second.totalWickets),
      status: 'COMPLETED',
    };
  }
  if (second.totalRuns === first.totalRuns) {
    return { resultType: 'TIE', winnerTeamId: null, marginType: null, marginValue: null, status: 'COMPLETED' };
  }
  return {
    resultType: 'WIN',
    winnerTeamId: first.battingTeamId,
    marginType: 'RUNS',
    marginValue: first.totalRuns - second.totalRuns,
    status: 'COMPLETED',
  };
}

export type ComputedSuperOverResult = {
  resultType: 'WIN' | 'TIE';
  winnerTeamId: string | null;
  marginType: 'RUNS' | null;
  marginValue: number | null;
};

/** A Super Over decides the match on runs alone — whoever scored more in their one over wins; equal scores mean another Super Over is needed. */
export function computeSuperOverResult(input: {
  innings: [{ battingTeamId: string; totalRuns: number }, { battingTeamId: string; totalRuns: number }];
}): ComputedSuperOverResult {
  const [first, second] = input.innings;
  if (second.totalRuns === first.totalRuns) {
    return { resultType: 'TIE', winnerTeamId: null, marginType: null, marginValue: null };
  }
  const winner = second.totalRuns > first.totalRuns ? second : first;
  const loser = winner === second ? first : second;
  return {
    resultType: 'WIN',
    winnerTeamId: winner.battingTeamId,
    marginType: 'RUNS',
    marginValue: winner.totalRuns - loser.totalRuns,
  };
}

export function resultIsIdempotent(
  current: { status: string; resultType?: string | null },
  nextStatus: string,
): boolean {
  if (current.status !== nextStatus) return false;
  if (current.status === 'COMPLETED' || current.status === 'ABANDONED' || current.status === 'CANCELLED') {
    return Boolean(current.resultType);
  }
  return false;
}
