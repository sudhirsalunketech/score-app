export type MvpConfig = {
  batting: {
    pointsPerTenRuns: number;
    minRuns: number;
    fiftyBonus: number;
    hundredBonus: number;
    strikeRateBonus: number;
    strikeRateThreshold: number;
    strikeRateMinRuns: number;
  };
  bowling: {
    pointsPerWicket: number;
    threeWicketBonus: number;
    fiveWicketBonus: number;
    maidenOverBonus: number;
  };
  fielding: {
    catch: number;
    stumping: number;
    runOut: number;
  };
};

/** Screenshot Points System (`44_*.png`). Bat runs/10 is not floored so 198 runs → 19.8. */
export const DEFAULT_MVP_CONFIG: MvpConfig = {
  batting: {
    pointsPerTenRuns: 1,
    minRuns: 10,
    fiftyBonus: 1,
    hundredBonus: 1,
    strikeRateBonus: 1,
    strikeRateThreshold: 130,
    strikeRateMinRuns: 10,
  },
  bowling: {
    pointsPerWicket: 2,
    threeWicketBonus: 1,
    fiveWicketBonus: 1,
    maidenOverBonus: 1,
  },
  fielding: {
    catch: 1,
    stumping: 1,
    runOut: 1,
  },
};

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function sanitizeMvpConfig(value: unknown): MvpConfig {
  const row = value && typeof value === 'object' && !Array.isArray(value) ? (value as Partial<MvpConfig>) : {};
  const b = row.batting ?? DEFAULT_MVP_CONFIG.batting;
  const o = row.bowling ?? DEFAULT_MVP_CONFIG.bowling;
  const f = row.fielding ?? DEFAULT_MVP_CONFIG.fielding;
  return {
    batting: {
      pointsPerTenRuns: clamp(b.pointsPerTenRuns, 0, 10, DEFAULT_MVP_CONFIG.batting.pointsPerTenRuns),
      minRuns: clamp(b.minRuns, 0, 50, DEFAULT_MVP_CONFIG.batting.minRuns),
      fiftyBonus: clamp(b.fiftyBonus, 0, 20, DEFAULT_MVP_CONFIG.batting.fiftyBonus),
      hundredBonus: clamp(b.hundredBonus, 0, 20, DEFAULT_MVP_CONFIG.batting.hundredBonus),
      strikeRateBonus: clamp(b.strikeRateBonus, 0, 20, DEFAULT_MVP_CONFIG.batting.strikeRateBonus),
      strikeRateThreshold: clamp(b.strikeRateThreshold, 0, 400, DEFAULT_MVP_CONFIG.batting.strikeRateThreshold),
      strikeRateMinRuns: clamp(b.strikeRateMinRuns, 0, 50, DEFAULT_MVP_CONFIG.batting.strikeRateMinRuns),
    },
    bowling: {
      pointsPerWicket: clamp(o.pointsPerWicket, 0, 20, DEFAULT_MVP_CONFIG.bowling.pointsPerWicket),
      threeWicketBonus: clamp(o.threeWicketBonus, 0, 20, DEFAULT_MVP_CONFIG.bowling.threeWicketBonus),
      fiveWicketBonus: clamp(o.fiveWicketBonus, 0, 20, DEFAULT_MVP_CONFIG.bowling.fiveWicketBonus),
      maidenOverBonus: clamp(o.maidenOverBonus, 0, 20, DEFAULT_MVP_CONFIG.bowling.maidenOverBonus),
    },
    fielding: {
      catch: clamp(f.catch, 0, 20, DEFAULT_MVP_CONFIG.fielding.catch),
      stumping: clamp(f.stumping, 0, 20, DEFAULT_MVP_CONFIG.fielding.stumping),
      runOut: clamp(f.runOut, 0, 20, DEFAULT_MVP_CONFIG.fielding.runOut),
    },
  };
}

export type MvpStatInput = {
  runs: number;
  ballsFaced: number;
  wickets: number;
  maidenOvers: number;
  catches: number;
  stumpings: number;
  runOuts: number;
};

export type MvpBreakdown = { batting: number; bowling: number; fielding: number; total: number };

/** Street MVP (screenshot Points System). Uses actual cricket stats, not tournament-adjusted team totals. */
export function computeStreetMvp(stat: MvpStatInput, config: MvpConfig = DEFAULT_MVP_CONFIG): MvpBreakdown {
  const cfg = sanitizeMvpConfig(config);
  let batting = 0;
  if (stat.runs >= cfg.batting.minRuns) batting += (stat.runs / 10) * cfg.batting.pointsPerTenRuns;
  if (stat.runs >= 50) batting += cfg.batting.fiftyBonus;
  if (stat.runs >= 100) batting += cfg.batting.hundredBonus;
  if (
    stat.runs >= cfg.batting.strikeRateMinRuns &&
    stat.ballsFaced > 0 &&
    (stat.runs * 100) / stat.ballsFaced >= cfg.batting.strikeRateThreshold
  ) {
    batting += cfg.batting.strikeRateBonus;
  }
  let bowling = stat.wickets * cfg.bowling.pointsPerWicket;
  if (stat.wickets >= 3) bowling += cfg.bowling.threeWicketBonus;
  if (stat.wickets >= 5) bowling += cfg.bowling.fiveWicketBonus;
  bowling += stat.maidenOvers * cfg.bowling.maidenOverBonus;
  const fielding =
    stat.catches * cfg.fielding.catch + stat.stumpings * cfg.fielding.stumping + stat.runOuts * cfg.fielding.runOut;
  const round1 = (n: number) => Math.round(n * 10) / 10;
  return {
    batting: round1(batting),
    bowling: round1(bowling),
    fielding: round1(fielding),
    total: round1(batting + bowling + fielding),
  };
}

export type MvpPlayerInput = MvpStatInput & {
  playerId: string;
  playerName?: string;
  teamName?: string;
};

export type MvpPlayerRow = MvpBreakdown & {
  playerId: string;
  playerName: string;
  teamName: string;
};

export function computeMatchMvp(players: MvpPlayerInput[], config: MvpConfig = DEFAULT_MVP_CONFIG): MvpPlayerRow[] {
  return players
    .map((p) => ({
      playerId: p.playerId,
      playerName: p.playerName ?? 'Player',
      teamName: p.teamName ?? '',
      ...computeStreetMvp(p, config),
    }))
    .filter((p) => p.total > 0)
    .sort((a, b) => b.total - a.total || a.playerName.localeCompare(b.playerName));
}

export type MvpInningsSlice = {
  battingTeamName: string;
  bowlingTeamName: string;
  batters: Array<{ playerId: string; runs: number; balls: number }>;
  bowlers: Array<{ playerId: string; wickets: number; maidens?: number }>;
  wickets: Array<{ dismissalType?: string | null; fielderId?: string | null; bowlerId?: string | null }>;
  names?: Map<string, string>;
};

export function mvpInputsFromInnings(slices: MvpInningsSlice[]): MvpPlayerInput[] {
  const map = new Map<string, MvpPlayerInput>();
  const ensure = (id: string, teamName: string, names?: Map<string, string>) => {
    if (!map.has(id)) {
      map.set(id, {
        playerId: id,
        playerName: names?.get(id) ?? 'Player',
        teamName,
        runs: 0,
        ballsFaced: 0,
        wickets: 0,
        maidenOvers: 0,
        catches: 0,
        stumpings: 0,
        runOuts: 0,
      });
    }
    return map.get(id)!;
  };
  for (const inn of slices) {
    for (const b of inn.batters) {
      const row = ensure(b.playerId, inn.battingTeamName, inn.names);
      row.runs += b.runs;
      row.ballsFaced += b.balls;
    }
    for (const bowl of inn.bowlers) {
      const row = ensure(bowl.playerId, inn.bowlingTeamName, inn.names);
      row.wickets += bowl.wickets;
      row.maidenOvers += bowl.maidens ?? 0;
    }
    for (const w of inn.wickets) {
      const id = w.fielderId || w.bowlerId;
      if (!id) continue;
      const row = ensure(id, inn.bowlingTeamName, inn.names);
      if (w.dismissalType === 'CAUGHT') row.catches += 1;
      else if (w.dismissalType === 'STUMPED') row.stumpings += 1;
      else if (w.dismissalType === 'RUN_OUT' || w.dismissalType === 'MANKAD') row.runOuts += 1;
    }
  }
  return [...map.values()];
}

export function mvpConfigFromSnapshot(snapshot: { mvp?: MvpConfig } | null | undefined): MvpConfig {
  return sanitizeMvpConfig(snapshot?.mvp ?? DEFAULT_MVP_CONFIG);
}

export function addMvpBreakdown(a: MvpBreakdown, b: MvpBreakdown): MvpBreakdown {
  const batting = Math.round((a.batting + b.batting) * 10) / 10;
  const bowling = Math.round((a.bowling + b.bowling) * 10) / 10;
  const fielding = Math.round((a.fielding + b.fielding) * 10) / 10;
  return { batting, bowling, fielding, total: Math.round((batting + bowling + fielding) * 10) / 10 };
}
