import type { BatterCard, BowlerCard } from '@/types/api';

export type HighlightLine = {
  id: string;
  name: string;
  line: string;
};

export function topBatterHighlights(
  batters: BatterCard[],
  nameOf: (id: string) => string,
  limit = 3,
): HighlightLine[] {
  return [...batters]
    .sort((a, b) => b.runs - a.runs || a.balls - b.balls)
    .slice(0, limit)
    .map((b) => ({
      id: b.playerId,
      name: nameOf(b.playerId),
      line: `${b.runs}(${b.balls})${b.isOut ? '' : '*'}`,
    }));
}

export function topBowlerHighlights(
  bowlers: BowlerCard[],
  nameOf: (id: string) => string,
  limit = 3,
): HighlightLine[] {
  return [...bowlers]
    .sort((a, b) => b.wickets - a.wickets || a.runs - b.runs)
    .slice(0, limit)
    .map((b) => ({
      id: b.playerId,
      name: nameOf(b.playerId),
      line: `${b.wickets}-${b.runs}`,
    }));
}

export function inningsScoreLine(runs: number, wickets: number, overs: string) {
  return `${runs}-${wickets} (${overs})`;
}

export function playerMatchTotals(
  innings: Array<{
    snapshot?: {
      batters?: Array<{ playerId: string; runs: number }>;
      bowlers?: Array<{ playerId: string; wickets: number }>;
    } | null;
  }>,
  playerId: string,
) {
  let runs = 0;
  let wickets = 0;
  for (const inn of innings) {
    runs += inn.snapshot?.batters?.find((row) => row.playerId === playerId)?.runs ?? 0;
    wickets += inn.snapshot?.bowlers?.find((row) => row.playerId === playerId)?.wickets ?? 0;
  }
  return { runs, wickets };
}

export function playerOfTheMatchId(settings: Record<string, unknown> | null | undefined) {
  const id = settings?.playerOfTheMatchId;
  return typeof id === 'string' && id ? id : null;
}

export function potmAchievementLine(
  innings: Array<{
    snapshot?: {
      batters?: Array<{ playerId: string; runs: number; balls: number; isOut: boolean }> | null;
      bowlers?: Array<{ playerId: string; runs: number; wickets: number }> | null;
    } | null;
  }>,
  playerId: string,
) {
  let battingRuns = 0;
  let battingBalls = 0;
  let batted = false;
  let battedOut = false;
  let bowlingRuns = 0;
  let bowlingWickets = 0;
  let bowled = false;
  for (const inn of innings) {
    const bat = inn.snapshot?.batters?.find((row) => row.playerId === playerId);
    if (bat) {
      batted = true;
      battingRuns += bat.runs;
      battingBalls += bat.balls;
      if (bat.isOut) battedOut = true;
    }
    const bowl = inn.snapshot?.bowlers?.find((row) => row.playerId === playerId);
    if (bowl) {
      bowled = true;
      bowlingRuns += bowl.runs;
      bowlingWickets += bowl.wickets;
    }
  }
  const parts: string[] = [];
  if (batted) parts.push(`${battingRuns}(${battingBalls})${battedOut ? '' : '*'}`);
  if (bowled) parts.push(`${bowlingWickets}-${bowlingRuns}`);
  return parts.length ? parts.join(' & ') : null;
}
