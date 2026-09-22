export * from './design';
export * from './youtube';
export * from './slug';
export * from './public-live';
export * from './playing-xi';
export * from './match-result';
export * from './test-match-rules';
export * from './player-search';
export * from './career-stats';
export * from './tournament-rules';
export * from './mvp';
export {
  SHARE_VISIBILITIES,
  isLinkShareable,
  isPublicListed,
  canAnonymousViewShare,
  DEFAULT_SHARE_COPY,
  matchShareText,
  tournamentShareText,
  playerShareText,
  ogMatchTitle,
  ogMatchDescription,
  escapeHtml,
  socialPreviewHtml,
} from './share';
export type { ShareVisibility, ShareFeature, MatchShareInput, ShareCopy } from './share';
export * from './access';
export * from './fan-engagement';
export * from './delivery-limits';
export * from './knockout';
export * from './event-stat-policy';
export * from './over-rules';

export type ExtraType = 'NONE' | 'WIDE' | 'NO_BALL' | 'BYE' | 'LEG_BYE' | 'PENALTY';

export type DismissalType =
  | 'BOWLED'
  | 'CAUGHT'
  | 'LBW'
  | 'RUN_OUT'
  | 'STUMPED'
  | 'HIT_WICKET'
  | 'MANKAD'
  | 'OVER_THE_FENCE'
  | 'ONE_HAND_ONE_BOUNCE'
  | 'OBSTRUCTING'
  | 'HIT_BALL_TWICE'
  | 'TIMED_OUT'
  | 'RETIRED_HURT'
  | 'RETIRED_OUT';

export type ScoringEvent = {
  sequence: number;
  overNumber: number;
  ballInOver: number;
  strikerId: string;
  nonStrikerId: string;
  bowlerId: string;
  batsmanRuns: number;
  extraRuns: number;
  extraType: ExtraType;
  isWicket: boolean;
  dismissalType?: DismissalType | null;
  dismissedPlayerId?: string | null;
  isUndone?: boolean;
};

export type ReplayOptions = {
  ballsPerOver?: number;
  maxOvers?: number;
  maxWickets?: number;
  targetRuns?: number | null;
  addWideToBatsman?: boolean;
  addNoBallToBatsman?: boolean;
  mankadCountsAsBowlerWicket?: boolean;
  widesCountAsLegal?: boolean;
  noBallsCountAsLegal?: boolean;
};

export type LegalBallOptions = Pick<ReplayOptions, 'widesCountAsLegal' | 'noBallsCountAsLegal'>;

export type BatterCard = {
  playerId: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  isOut: boolean;
  dismissalType?: DismissalType | null;
  bowlerId?: string | null;
};

export type BowlerCard = {
  playerId: string;
  balls: number;
  runs: number;
  wickets: number;
  maidens: number;
  dots: number;
  wides: number;
  noBalls: number;
  fours: number;
  sixes: number;
};

export type Partnership = { batterIds: [string, string]; runs: number; balls: number };

export type FallOfWicket = {
  wicketNumber: number;
  score: number;
  overs: number;
  playerId: string;
  dismissalType?: DismissalType | null;
};

export type InningsSnapshot = {
  totalRuns: number;
  totalWickets: number;
  totalBallsLegal: number;
  extras: number;
  extrasBreakdown: { wides: number; noBalls: number; byes: number; legByes: number; penalty: number };
  oversDisplay: string;
  currentOver: number;
  ballsInCurrentOver: number;
  strikerId: string | null;
  nonStrikerId: string | null;
  bowlerId: string | null;
  currentRunRate: number;
  partnership: Partnership | null;
  partnerships: Partnership[];
  fallOfWickets: FallOfWicket[];
  batters: BatterCard[];
  bowlers: BowlerCard[];
  isComplete: boolean;
  freeHitNext: boolean;
};

/**
 * The single canonical way to turn a `Match` row + its free-form `settings` JSON
 * into `ReplayOptions` — was previously copy-pasted across scoring.service.ts,
 * public-live.service.ts, and stats-persistence.service.ts.
 */
export function matchReplayOptions(
  match: { ballsPerOver: number; overs: number; maxWickets: number; settings: unknown },
  targetRuns?: number | null,
  inningsOverrides?: { oversLimit?: number | null; maxWicketsLimit?: number | null } | null,
): ReplayOptions {
  const settings = (match.settings ?? {}) as Record<string, unknown>;
  return {
    ballsPerOver: match.ballsPerOver,
    maxOvers: inningsOverrides?.oversLimit ?? match.overs,
    maxWickets: inningsOverrides?.maxWicketsLimit ?? match.maxWickets,
    targetRuns: targetRuns ?? null,
    addWideToBatsman: Boolean(settings.addWideToBatsman),
    addNoBallToBatsman: Boolean(settings.addNoBallToBatsman),
    mankadCountsAsBowlerWicket: settings.mankad === false ? false : true,
    widesCountAsLegal: Boolean(settings.widesCountAsLegal),
    noBallsCountAsLegal: Boolean(settings.noBallsCountAsLegal),
  };
}

export function isLegalBall(extra: ExtraType, options: LegalBallOptions = {}): boolean {
  if (extra === 'PENALTY') return false;
  if (extra === 'WIDE') return Boolean(options.widesCountAsLegal);
  if (extra === 'NO_BALL') return Boolean(options.noBallsCountAsLegal);
  return true;
}

/** Runs that change ends (bye/leg-bye extras, additional runs off a wide, or off the bat). */
export function strikeChangingRuns(ev: Pick<ScoringEvent, 'batsmanRuns' | 'extraRuns' | 'extraType'>): number {
  const extra = ev.extraType ?? 'NONE';
  if (extra === 'BYE' || extra === 'LEG_BYE') return ev.extraRuns;
  if (extra === 'WIDE') return Math.max(0, ev.extraRuns - 1);
  if (extra === 'NONE' || extra === 'NO_BALL') return ev.batsmanRuns;
  return 0;
}

export function formatOvers(legalBalls: number, ballsPerOver = 6): string {
  const o = Math.floor(legalBalls / ballsPerOver);
  const b = legalBalls % ballsPerOver;
  return `${o}.${b}`;
}

/** Lowest overs limit allowed once scoring has started (cannot drop below overs already begun). */
export function minOversFromProgress(legalBalls: number, ballsPerOver = 6): number {
  const bpo = Math.max(1, ballsPerOver);
  const balls = Math.max(0, legalBalls);
  const currentOver = Math.floor(balls / bpo);
  const ballsInOver = balls % bpo;
  return ballsInOver > 0 ? currentOver + 1 : Math.max(1, currentOver);
}

/** Lowest wicket limit allowed (cannot drop below wickets already fallen). */
export function minWicketsFromProgress(wicketsFallen: number): number {
  return Math.max(1, Math.min(10, Math.max(0, wicketsFallen)));
}

export function oversAsDecimal(legalBalls: number, ballsPerOver = 6): number {
  const o = Math.floor(legalBalls / ballsPerOver);
  const b = legalBalls % ballsPerOver;
  return o + b / ballsPerOver;
}

function bowlerCredit(d?: DismissalType | null, mankadCounts = true): boolean {
  if (!d) return false;
  if (d === 'MANKAD') return mankadCounts;
  return ['BOWLED', 'CAUGHT', 'LBW', 'STUMPED', 'HIT_WICKET', 'OVER_THE_FENCE', 'ONE_HAND_ONE_BOUNCE'].includes(d);
}

export function replayInnings(events: ScoringEvent[], options: ReplayOptions = {}): InningsSnapshot {
  const bpo = options.ballsPerOver ?? 6;
  const maxOvers = options.maxOvers ?? 20;
  const maxWickets = options.maxWickets ?? 10;
  const live = events.filter((e) => !e.isUndone).sort((a, b) => a.sequence - b.sequence);

  const batters = new Map<string, BatterCard>();
  const bowlers = new Map<string, BowlerCard>();
  const ensureBatter = (id: string) => {
    if (!batters.has(id)) {
      batters.set(id, { playerId: id, runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false });
    }
    return batters.get(id)!;
  };
  const ensureBowler = (id: string) => {
    if (!bowlers.has(id)) {
      bowlers.set(id, { playerId: id, balls: 0, runs: 0, wickets: 0, maidens: 0, dots: 0, wides: 0, noBalls: 0, fours: 0, sixes: 0 });
    }
    return bowlers.get(id)!;
  };

  let totalRuns = 0;
  let totalWickets = 0;
  let totalBallsLegal = 0;
  const extrasBreakdown = { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalty: 0 };
  let extras = 0;
  let strikerId: string | null = live[0]?.strikerId ?? null;
  let nonStrikerId: string | null = live[0]?.nonStrikerId ?? null;
  let bowlerId: string | null = live[0]?.bowlerId ?? null;
  let freeHitNext = false;
  const fallOfWickets: FallOfWicket[] = [];
  const partnerships: Partnership[] = [];
  let pRuns = 0;
  let pBalls = 0;
  let overRuns = 0;
  let overLegal = 0;

  const rotate = () => {
    const tmp = strikerId;
    strikerId = nonStrikerId;
    nonStrikerId = tmp;
  };

  for (const ev of live) {
    strikerId = ev.strikerId;
    nonStrikerId = ev.nonStrikerId;
    bowlerId = ev.bowlerId;
    const batter = ensureBatter(ev.strikerId);
    const bowler = ensureBowler(ev.bowlerId);
    const extra = ev.extraType ?? 'NONE';
    const legal = isLegalBall(extra, options);
    const teamRuns = ev.batsmanRuns + ev.extraRuns;
    totalRuns += teamRuns;
    extras += ev.extraRuns;
    if (extra === 'WIDE') {
      extrasBreakdown.wides += ev.extraRuns;
      bowler.wides += 1;
    }
    if (extra === 'NO_BALL') {
      extrasBreakdown.noBalls += ev.extraRuns;
      bowler.noBalls += 1;
    }
    if (extra === 'BYE') extrasBreakdown.byes += ev.extraRuns;
    if (extra === 'LEG_BYE') extrasBreakdown.legByes += ev.extraRuns;
    if (extra === 'PENALTY') extrasBreakdown.penalty += ev.extraRuns;

    let creditedBat = ev.batsmanRuns;
    if (extra === 'WIDE' && options.addWideToBatsman) creditedBat += ev.extraRuns;
    if (extra === 'NO_BALL' && options.addNoBallToBatsman) creditedBat += ev.extraRuns;
    if (extra === 'NONE' || extra === 'NO_BALL') {
      batter.runs += creditedBat;
      if (creditedBat === 4) {
        batter.fours += 1;
        bowler.fours += 1;
      }
      if (creditedBat === 6) {
        batter.sixes += 1;
        bowler.sixes += 1;
      }
    }

    if (legal) {
      batter.balls += 1;
      bowler.balls += 1;
      totalBallsLegal += 1;
      overLegal += 1;
      pBalls += 1;
    }
    // Penalty runs are a team-level award, not conceded by the specific bowler on strike.
    if (extra !== 'PENALTY') bowler.runs += teamRuns;
    overRuns += teamRuns;
    pRuns += teamRuns;
    if (legal && teamRuns === 0) bowler.dots += 1;

    if (ev.isWicket) {
      const dismissed = ev.dismissedPlayerId ?? ev.strikerId;
      const out = ensureBatter(dismissed);
      if (ev.dismissalType !== 'RETIRED_HURT') {
        out.isOut = true;
        out.dismissalType = ev.dismissalType;
        out.bowlerId = bowlerCredit(ev.dismissalType, options.mankadCountsAsBowlerWicket !== false)
          ? ev.bowlerId
          : null;
        if (bowlerCredit(ev.dismissalType, options.mankadCountsAsBowlerWicket !== false)) bowler.wickets += 1;
        totalWickets += 1;
        fallOfWickets.push({
          wicketNumber: totalWickets,
          score: totalRuns,
          overs: oversAsDecimal(totalBallsLegal, bpo),
          playerId: dismissed,
          dismissalType: ev.dismissalType,
        });
        partnerships.push({
          batterIds: [ev.strikerId, ev.nonStrikerId],
          runs: pRuns,
          balls: pBalls,
        });
        pRuns = 0;
        pBalls = 0;
      }
    }

    const rotateOn = strikeChangingRuns(ev) % 2 === 1;
    if (rotateOn) rotate();

    if (legal && overLegal === bpo) {
      if (overRuns === 0) bowler.maidens += 1;
      overRuns = 0;
      overLegal = 0;
      rotate();
    }

    freeHitNext = extra === 'NO_BALL';
  }

  const currentOver = Math.floor(totalBallsLegal / bpo);
  const ballsInCurrentOver = totalBallsLegal % bpo;
  const oversFaced = oversAsDecimal(totalBallsLegal, bpo);
  const crr = oversFaced > 0 ? Number((totalRuns / oversFaced).toFixed(2)) : 0;
  const complete =
    totalWickets >= maxWickets ||
    currentOver >= maxOvers ||
    (options.targetRuns != null && totalRuns >= options.targetRuns);

  return {
    totalRuns,
    totalWickets,
    totalBallsLegal,
    extras,
    extrasBreakdown,
    oversDisplay: formatOvers(totalBallsLegal, bpo),
    currentOver,
    ballsInCurrentOver,
    strikerId,
    nonStrikerId,
    bowlerId,
    currentRunRate: crr,
    partnership:
      strikerId && nonStrikerId
        ? { batterIds: [strikerId, nonStrikerId], runs: pRuns, balls: pBalls }
        : null,
    partnerships:
      strikerId && nonStrikerId
        ? [...partnerships, { batterIds: [strikerId, nonStrikerId], runs: pRuns, balls: pBalls }]
        : partnerships,
    fallOfWickets,
    batters: [...batters.values()],
    bowlers: [...bowlers.values()],
    isComplete: complete,
    freeHitNext,
  };
}

/**
 * `overNumber`/`ballInOver` stamped on a `BallEvent` are display metadata only — the scoring
 * engine (`replayInnings`) never reads them, it re-derives over/ball progress from `sequence`
 * order alone. After an admin inserts/deletes/reorders a historical ball, those stamped labels
 * go stale for every event chronologically after the edit point; this recomputes them the same
 * way `replayInnings` tracks over progress, so the persisted labels stay truthful.
 */
export function recalcBallPositions<T extends Pick<ScoringEvent, 'sequence' | 'extraType' | 'isUndone'>>(
  events: T[],
  options: Pick<ReplayOptions, 'ballsPerOver' | 'widesCountAsLegal' | 'noBallsCountAsLegal'> = {},
): { event: T; overNumber: number; ballInOver: number }[] {
  const bpo = Math.max(1, options.ballsPerOver ?? 6);
  const ordered = [...events].sort((a, b) => a.sequence - b.sequence);
  let legal = 0;
  const out: { event: T; overNumber: number; ballInOver: number }[] = [];
  for (const ev of ordered) {
    const overNumber = Math.floor(legal / bpo);
    const ballInOver = legal % bpo;
    out.push({ event: ev, overNumber, ballInOver });
    if (!ev.isUndone && isLegalBall(ev.extraType, options)) legal += 1;
  }
  return out;
}

/**
 * Overs credited for NRR. An all-out innings counts as the full allotted overs.
 */
export function nrrOvers(input: {
  balls: number;
  allOut?: boolean;
  maxOvers: number;
  ballsPerOver?: number;
}): number {
  const bpo = input.ballsPerOver ?? 6;
  if (bpo <= 0 || input.maxOvers <= 0) return 0;
  const maxBalls = input.maxOvers * bpo;
  const used = input.allOut ? maxBalls : Math.min(Math.max(0, input.balls), maxBalls);
  return used / bpo;
}

/**
 * NRR = (runs scored / overs faced) - (runs conceded / overs bowled).
 * All-out innings count as the full allotted overs.
 * Pass `oversFaced` / `oversBowled` to combine several innings (apply `nrrOvers` per innings first).
 */
export function netRunRate(input: {
  runsFor: number;
  ballsFaced?: number;
  allOutFor?: boolean;
  runsAgainst: number;
  ballsBowled?: number;
  oppositionAllOut?: boolean;
  maxOvers?: number;
  ballsPerOver?: number;
  oversFaced?: number;
  oversBowled?: number;
}): number {
  const bpo = input.ballsPerOver ?? 6;
  const faced =
    input.oversFaced ??
    nrrOvers({
      balls: input.ballsFaced ?? 0,
      allOut: input.allOutFor,
      maxOvers: input.maxOvers ?? 0,
      ballsPerOver: bpo,
    });
  const bowled =
    input.oversBowled ??
    nrrOvers({
      balls: input.ballsBowled ?? 0,
      allOut: input.oppositionAllOut,
      maxOvers: input.maxOvers ?? 0,
      ballsPerOver: bpo,
    });
  if (faced <= 0 || bowled <= 0) return 0;
  return Number((input.runsFor / faced - input.runsAgainst / bowled).toFixed(3));
}

export type StandingTeam = {
  teamId: string;
  teamName: string;
  logoUrl?: string | null;
};

export type StandingMatch = {
  homeTeamId: string;
  awayTeamId: string;
  overs: number;
  ballsPerOver: number;
  maxWickets: number;
  resultType?: 'WIN' | 'TIE' | 'DRAW' | 'NO_RESULT' | 'ABANDONED' | 'CANCELLED' | null;
  winnerTeamId?: string | null;
  innings: Array<{
    battingTeamId: string;
    bowlingTeamId: string;
    totalRuns: number;
    totalBallsLegal: number;
    totalWickets: number;
    nrrRuns?: number;
  }>;
};

export type StandingRow = {
  teamId: string;
  teamName: string;
  logoUrl: string | null;
  played: number;
  won: number;
  lost: number;
  tied: number;
  noResult: number;
  bonusPoints: number;
  points: number;
  nrr: number;
};

export type StandingsOptions = {
  /** Extra points awarded per win, on top of the standard 2 — e.g. a tournament-configured winning bonus. */
  winningBonusPoints?: number;
  /** Points awarded to EACH team for a tied (or no-result) match — defaults to 1, matching the historical hardcoded value. */
  tiePoints?: number;
};

/**
 * A team's aggregated contribution from manually-entered matches (fixtures never scored
 * through this app's live engine — see `TournamentManualMatch`). Folded into the same
 * won/lost/tied/noResult/runsFor/runsAgainst/oversFaced/oversBowled totals as real matches
 * BEFORE points/NRR are derived, so a manual win still earns the standard win points (+ any
 * configured bonus) exactly like a real one — there is no separate manual points value.
 */
export type ManualStandingInput = {
  teamId: string;
  played: number;
  won: number;
  lost: number;
  tied: number;
  noResult: number;
  runsFor: number;
  runsAgainst: number;
  oversFaced: number;
  oversBowled: number;
};

/** Group table: win = 2 pts (+ optional configured winning bonus), tie = configured tie points, sorted by points then NRR. */
export function computeGroupStandings(
  teams: StandingTeam[],
  matches: StandingMatch[],
  options: StandingsOptions = {},
  manual: ManualStandingInput[] = [],
): StandingRow[] {
  const bonusPerWin = Math.max(0, Math.trunc(options.winningBonusPoints ?? 0));
  const tiePoints = Math.max(0, Math.trunc(options.tiePoints ?? 1));
  const ids = new Set(teams.map((t) => t.teamId));
  const groupMatches = matches.filter((m) => ids.has(m.homeTeamId) && ids.has(m.awayTeamId));
  const manualByTeam = new Map(manual.map((m) => [m.teamId, m]));

  const rows = teams.map((team) => {
    const played = groupMatches.filter((m) => m.homeTeamId === team.teamId || m.awayTeamId === team.teamId);
    let won = 0;
    let lost = 0;
    let tied = 0;
    let noResult = 0;
    let runsFor = 0;
    let runsAgainst = 0;
    let oversFaced = 0;
    let oversBowled = 0;

    for (const m of played) {
      const batting = m.innings.filter((i) => i.battingTeamId === team.teamId);
      const bowling = m.innings.filter((i) => i.bowlingTeamId === team.teamId);
      const teamRuns = batting.reduce((a, i) => a + i.totalRuns, 0);
      const oppRuns = bowling.reduce((a, i) => a + i.totalRuns, 0);
      const teamNrrRuns = batting.reduce((a, i) => a + (i.nrrRuns ?? i.totalRuns), 0);
      const oppNrrRuns = bowling.reduce((a, i) => a + (i.nrrRuns ?? i.totalRuns), 0);
      // A Test draw involved real play, but this app's NRR math assumes overs-limited cricket
      // (nrrOvers treats an unfinished innings as facing the full match overs) — since Test
      // innings have no over cap, folding a draw into NRR would produce a meaningless figure.
      // Award tie-points (via the noResult bucket) without touching NRR until Test NRR gets its
      // own rule, per "don't award T20-style tie points to a Test Match unless configured".
      const nr =
        m.resultType === 'NO_RESULT' ||
        m.resultType === 'ABANDONED' ||
        m.resultType === 'CANCELLED' ||
        m.resultType === 'DRAW';
      if (!nr) {
        runsFor += teamNrrRuns;
        runsAgainst += oppNrrRuns;
        oversFaced += nrrOvers({
          balls: batting.reduce((a, i) => a + i.totalBallsLegal, 0),
          allOut: batting.some((i) => i.totalWickets >= m.maxWickets),
          maxOvers: m.overs,
          ballsPerOver: m.ballsPerOver,
        });
        oversBowled += nrrOvers({
          balls: bowling.reduce((a, i) => a + i.totalBallsLegal, 0),
          allOut: bowling.some((i) => i.totalWickets >= m.maxWickets),
          maxOvers: m.overs,
          ballsPerOver: m.ballsPerOver,
        });
      }
      if (nr) noResult += 1;
      else if (m.resultType === 'WIN' && m.winnerTeamId) {
        if (m.winnerTeamId === team.teamId) won += 1;
        else lost += 1;
      } else if (m.resultType === 'TIE') tied += 1;
      else if (teamRuns > oppRuns) won += 1;
      else if (teamRuns < oppRuns) lost += 1;
      else tied += 1;
    }

    const m = manualByTeam.get(team.teamId);
    const totalPlayed = played.length + (m?.played ?? 0);
    const totalWon = won + (m?.won ?? 0);
    const totalLost = lost + (m?.lost ?? 0);
    const totalTied = tied + (m?.tied ?? 0);
    const totalNoResult = noResult + (m?.noResult ?? 0);
    const totalRunsFor = runsFor + (m?.runsFor ?? 0);
    const totalRunsAgainst = runsAgainst + (m?.runsAgainst ?? 0);
    const totalOversFaced = oversFaced + (m?.oversFaced ?? 0);
    const totalOversBowled = oversBowled + (m?.oversBowled ?? 0);
    const bonusPoints = totalWon * bonusPerWin;
    return {
      teamId: team.teamId,
      teamName: team.teamName,
      logoUrl: team.logoUrl ?? null,
      played: totalPlayed,
      won: totalWon,
      lost: totalLost,
      tied: totalTied,
      noResult: totalNoResult,
      bonusPoints,
      points: totalWon * 2 + (totalTied + totalNoResult) * tiePoints + bonusPoints,
      nrr: netRunRate({ runsFor: totalRunsFor, runsAgainst: totalRunsAgainst, oversFaced: totalOversFaced, oversBowled: totalOversBowled }),
    };
  });

  rows.sort((a, b) => b.points - a.points || b.nrr - a.nrr || a.teamName.localeCompare(b.teamName));
  return rows;
}
