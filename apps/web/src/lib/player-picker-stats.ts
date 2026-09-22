export function formatBattingStat(card?: { runs?: number; balls?: number } | null): string {
  return `${card?.runs ?? 0}(${card?.balls ?? 0})`;
}

export function formatBowlingStat(card?: { wickets?: number; runs?: number } | null): string {
  return `${card?.wickets ?? 0}/${card?.runs ?? 0}`;
}

export function battingStatsMap(batters: Array<{ playerId: string; runs: number; balls: number }> | undefined): Record<string, string> {
  return Object.fromEntries((batters ?? []).map((b) => [b.playerId, formatBattingStat(b)]));
}

export function bowlingStatsMap(
  bowlers: Array<{ playerId: string; wickets: number; runs: number }> | undefined,
): Record<string, string> {
  return Object.fromEntries((bowlers ?? []).map((b) => [b.playerId, formatBowlingStat(b)]));
}

/** Bowler who completed the previous over — cannot bowl the next over. */
export function lastCompletedOverBowlerId(
  events: Array<{ isUndone?: boolean; overNumber: number; bowlerId: string }>,
  opts: { ballsInCurrentOver: number; currentOver: number },
): string | null {
  if (opts.currentOver <= 0 || opts.ballsInCurrentOver !== 0) return null;
  const live = events.filter((e) => !e.isUndone);
  if (!live.length) return null;
  const prevOver = opts.currentOver - 1;
  const inPrev = live.filter((e) => e.overNumber === prevOver);
  return inPrev[inPrev.length - 1]?.bowlerId ?? null;
}
