export type CareerStats = {
  matches?: number;
  innings?: number;
  runs?: number;
  balls?: number;
  highestScore?: number;
  notOuts?: number;
  wickets?: number;
  oversBowled?: number;
  runsConceded?: number;
  maidens?: number;
  catches?: number;
  stumpings?: number;
  runOuts?: number;
  bestBowlWkts?: number;
  bestBowlRuns?: number;
};

export function battingAverage(stats?: CareerStats | null) {
  const outs = Math.max(0, (stats?.innings ?? 0) - (stats?.notOuts ?? 0));
  if (!outs) return null;
  return (stats?.runs ?? 0) / outs;
}

export function bowlingAverage(stats?: CareerStats | null) {
  const wickets = stats?.wickets ?? 0;
  if (!wickets) return null;
  return (stats?.runsConceded ?? 0) / wickets;
}

export function formatAvg(value: number | null) {
  if (value == null) return '—';
  return value.toFixed(1);
}

export function bestBowling(stats?: CareerStats | null) {
  if (!(stats?.bestBowlWkts ?? 0)) return '—';
  return `${stats?.bestBowlWkts}-${stats?.bestBowlRuns ?? 0}`;
}
