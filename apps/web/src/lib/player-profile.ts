export type SliceView = {
  matches: number;
  innings: number;
  runs: number;
  balls: number;
  highest: number;
  average: number | null;
  sr: number;
  notOuts: number;
  ducks: number;
  thirties: number;
  fifties: number;
  hundreds: number;
  sixes: number;
  fours: number;
  bowlInnings: number;
  bowlBalls: number;
  bowlRuns: number;
  dots: number;
  maidens: number;
  wickets: number;
  bowlAverage: number | null;
  economy: number;
  best: string;
  bowlSr: number | null;
  threeW: number;
  fiveW: number;
  catches: number;
  stumpings: number;
  runOuts: number;
};

export type PlayerProfileStats = {
  tables?: {
    overall: SliceView;
    byFormat: Record<string, SliceView>;
  };
  mvp?: { batting: number; bowling: number; fielding: number; total: number };
  matches?: Array<{
    matchId: string;
    title: string;
    format: string;
    status: string;
    when: string | null;
    versus: string;
    homeName?: string;
    awayName?: string;
    tournamentId?: string | null;
    tournamentName?: string | null;
    batting: { order: number | null; runs: number; balls: number; fours: number; sixes: number; sr: number; dismissal?: string | null } | null;
    bowling: { overs: string; runs: number; maidens: number; wickets: number; eco: number } | null;
  }>;
  recent?: {
    batting: Array<{ runs: number; notOut: boolean }>;
    bowling: string[];
  };
  yearly?: {
    thisYear: SliceView;
    lastYear: SliceView;
  };
  bestAgainstTeam?: Array<SliceView & { team: string }>;
  playerOfMatchCount?: number;
  insights?: {
    batting: { buckets: Record<string, number>; totalBalls: number; totalRuns: number };
    bowling: { buckets: Record<string, number>; totalBalls: number };
    positions: Array<SliceView & { position: string }>;
  };
};

export const FORMAT_COLS = ['T10', 'T20', 'CLUB', 'TEST'] as const;

/** Full (not just last-5) newest-first batting/bowling history, derived from the already-fetched match list. */
export function recentFormHistory(matches: PlayerProfileStats['matches']) {
  const rows = matches ?? [];
  return {
    battingHistory: rows
      .filter((m) => m.batting)
      .map((m) => ({ runs: m.batting!.runs, notOut: !m.batting!.dismissal || m.batting!.dismissal === 'NOT_OUT' })),
    bowlingHistory: rows.filter((m) => m.bowling).map((m) => `${m.bowling!.wickets}-${m.bowling!.runs}`),
  };
}

export function dash(value: number | string | null | undefined) {
  if (value == null || value === '') return '—';
  return value;
}
