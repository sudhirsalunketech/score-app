/**
 * Tournament-scoped statistics.
 *
 * Every aggregate is built only from matches where match.tournamentId === the
 * requested tournament. Live innings are kept separate from completed records.
 *
 * Tournament MVP uses the existing per-match computeStreetMvp / computeMatchMvp
 * table (see docs/MVP-FORMULA.md), summed across COMPLETED matches only:
 *   batting: runs/10 (min 10 runs), 50+, 100+, SR≥130 (min 10 runs)
 *   bowling: 2 per wicket, +1 at 3 wickets, +1 at 5 wickets
 *   fielding: 1 per catch / stumping / run out (fielderId when present)
 *
 * Fielding leaderboards count only events with a fielderId. Generic wickets
 * are never inferred as catches.
 *
 * Best strike rate requires MIN_BALLS_STRIKE_RATE legal balls.
 * Best economy requires MIN_BALLS_ECONOMY legal balls.
 */
import { MatchStatus } from '@prisma/client';
import {
  addMvpBreakdown,
  computeGroupStandings,
  computeMatchMvp,
  formatOvers,
  mvpConfigFromSnapshot,
  mvpInputsFromInnings,
  parseRuleSnapshot,
  replayInnings,
} from '@crickscore/shared';
import { battingAverage, bowlingAverage, economy, strikeRate } from '../statistics/player-profile-stats';
import { manualStandingInputs } from './manual-match.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { ScoringService } from '../scoring/scoring.service';

export const MIN_BALLS_STRIKE_RATE = 10;
export const MIN_BALLS_ECONOMY = 6;

export const MVP_FORMULA =
  'Sum of per-match Street MVP from completed tournament matches only. Batting: runs/10 (min 10 runs), +1 at 50, +1 at 100, +1 if SR ≥ 130 (min 10 runs). Bowling: 2 per wicket, +1 at 3 wickets, +1 at 5 wickets. Fielding: 1 per catch, stumping or run out.';

const RECORD_STATUSES = new Set<string>([MatchStatus.COMPLETED]);
const LIVE_STATUSES = new Set<string>([MatchStatus.LIVE, MatchStatus.INNINGS_BREAK]);
const UPCOMING_STATUSES = new Set<string>([
  MatchStatus.DRAFT,
  MatchStatus.SCHEDULED,
  MatchStatus.TOSS_PENDING,
  MatchStatus.TOSS_COMPLETED,
]);

export type NamedStat = {
  playerId: string;
  playerName: string;
  photoUrl: string | null;
  teamId: string | null;
  teamName: string;
  matchId?: string | null;
  matchTitle?: string | null;
};

export type BestBatsman = NamedStat & {
  runs: number;
  average: number | null;
  strikeRate: number;
  highest: number;
  fours: number;
  sixes: number;
  innings: number;
};

export type BestBowler = NamedStat & {
  wickets: number;
  economy: number;
  average: number | null;
  best: string;
  overs: string;
  balls: number;
};

export type BestFielder = NamedStat & {
  catches: number;
  runOuts: number;
  stumpings: number;
  dismissals: number;
};

export type TournamentMvp = NamedStat & {
  score: number;
  batting: number;
  bowling: number;
  fielding: number;
  runs: number;
  wickets: number;
  catches: number;
  matches: number;
};

export type PlayerBatRow = NamedStat & {
  matches: number;
  innings: number;
  runs: number;
  balls: number;
  average: number | null;
  strikeRate: number;
  highest: number;
  fours: number;
  sixes: number;
  notOuts: number;
};

export type PlayerBowlRow = NamedStat & {
  matches: number;
  overs: string;
  balls: number;
  runs: number;
  wickets: number;
  economy: number;
  average: number | null;
  best: string;
  maidens: number;
};

export type PlayerFieldRow = NamedStat & {
  matches: number;
  catches: number;
  runOuts: number;
  stumpings: number;
  dismissals: number;
};

export type RecordLink = NamedStat & {
  value: number | string;
  extra?: string | null;
};

export type TeamScoreRecord = {
  teamId: string;
  teamName: string;
  runs: number;
  wickets: number;
  overs: string;
  matchId: string;
  matchTitle: string;
};

export type MarginRecord = {
  matchId: string;
  matchTitle: string;
  winnerTeamId: string | null;
  winnerName: string | null;
  marginType: string | null;
  marginValue: number | null;
};

export type TournamentRecords = {
  mostRuns: RecordLink | null;
  highestScore: RecordLink | null;
  mostFours: RecordLink | null;
  mostSixes: RecordLink | null;
  bestStrikeRate: RecordLink | null;
  mostWickets: RecordLink | null;
  bestBowling: RecordLink | null;
  bestEconomy: RecordLink | null;
  mostCatches: RecordLink | null;
  mostRunOuts: RecordLink | null;
  mostStumpings: RecordLink | null;
  highestTeamScore: TeamScoreRecord | null;
  lowestTeamScore: TeamScoreRecord | null;
  largestWinningMargin: MarginRecord | null;
  closestMatch: MarginRecord | null;
  mostTeamWins: { teamId: string; teamName: string; wins: number } | null;
};

export type TournamentPlayerRow = {
  playerId: string;
  playerName: string;
  photoUrl: string | null;
  teamId: string | null;
  teamName: string;
  matches: number;
  runs: number;
  wickets: number;
  catches: number;
  runOuts: number;
  stumpings: number;
};

export type TournamentTeamRow = {
  teamId: string;
  teamName: string;
  logoUrl: string | null;
  matches: number;
  won: number;
  lost: number;
  tied: number;
  noResult: number;
  points: number;
  runsScored: number;
  runsConceded: number;
  wickets: number;
  bestBatsman: { playerId: string; playerName: string; runs: number } | null;
  bestBowler: { playerId: string; playerName: string; wickets: number } | null;
};

export type MatchAward = {
  matchId: string;
  matchTitle: string;
  homeName: string;
  awayName: string;
  playerId: string;
  playerName: string;
  photoUrl: string | null;
  teamName: string;
  score: number;
};

export type ScorecardLink = {
  matchId: string;
  matchTitle: string;
  homeName: string;
  awayName: string;
  result: string | null;
  status: string;
  scheduledAt: string | null;
};

export type TournamentDashboard = {
  tournamentId: string;
  header: {
    name: string;
    status: 'DRAFT' | 'UPCOMING' | 'LIVE' | 'COMPLETED';
    season: string | null;
    club: string | null;
    format: string | null;
    overs: number | null;
    maxWickets: number | null;
    teams: number;
    matches: number;
    completed: number;
    live: number;
    upcoming: number;
    abandoned: number;
    cancelled: number;
  };
  summary: {
    teams: number;
    matches: number;
    completed: number;
    upcoming: number;
    live: number;
    totalRuns: number;
    totalWickets: number;
    totalOvers: string;
    totalBalls: number;
    fours: number;
    sixes: number;
    extras: number;
    liveTotals: { totalRuns: number; totalWickets: number; fours: number; sixes: number } | null;
  };
  hasCompletedStats: boolean;
  performers: {
    bestBatsman: BestBatsman | null;
    bestBowler: BestBowler | null;
    bestFielder: BestFielder | null;
    mvp: TournamentMvp | null;
  };
  batting: PlayerBatRow[];
  bowling: PlayerBowlRow[];
  fielding: PlayerFieldRow[];
  records: TournamentRecords;
  players: TournamentPlayerRow[];
  teams: TournamentTeamRow[];
  matchAwards: MatchAward[];
  scorecards: ScorecardLink[];
  quizEnabled: boolean;
  mvpFormula: string;
};

export type TournamentPlayerStats = {
  tournamentId: string;
  tournamentName: string;
  scope: 'tournament';
  player: {
    playerId: string;
    playerName: string;
    photoUrl: string | null;
    teamName: string;
  };
  matches: number;
  innings: number;
  runs: number;
  balls: number;
  average: number | null;
  strikeRate: number;
  highest: number;
  wickets: number;
  economy: number;
  bestBowling: string | null;
  overs: string;
  catches: number;
  runOuts: number;
  stumpings: number;
};

export type PlayerAcc = {
  playerId: string;
  playerName: string;
  photoUrl: string | null;
  teamId: string | null;
  teamName: string;
  matchIds: Set<string>;
  innings: number;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  highest: number;
  highestBalls: number;
  highestFours: number;
  highestSixes: number;
  highestOut: boolean;
  highestMatchId: string | null;
  highestMatchTitle: string | null;
  notOuts: number;
  bowlMatchIds: Set<string>;
  bowlBalls: number;
  bowlRuns: number;
  wickets: number;
  maidens: number;
  bestWkts: number;
  bestRuns: number;
  bestBalls: number;
  bestMatchId: string | null;
  bestMatchTitle: string | null;
  catches: number;
  runOuts: number;
  stumpings: number;
  mvpBat: number;
  mvpBowl: number;
  mvpField: number;
  mvpTotal: number;
};

export function createTournamentPlayerAcc(
  id: string,
  name = 'Player',
  extra: Partial<Omit<PlayerAcc, 'playerId' | 'playerName' | 'matchIds' | 'bowlMatchIds'>> = {},
): PlayerAcc {
  return { ...emptyPlayer(id, name, extra.photoUrl ?? null), ...extra, playerId: id, playerName: name };
}

function emptyPlayer(id: string, name: string, photoUrl: string | null): PlayerAcc {
  return {
    playerId: id,
    playerName: name,
    photoUrl,
    teamId: null,
    teamName: '',
    matchIds: new Set(),
    innings: 0,
    runs: 0,
    balls: 0,
    fours: 0,
    sixes: 0,
    highest: 0,
    highestBalls: 0,
    highestFours: 0,
    highestSixes: 0,
    highestOut: true,
    highestMatchId: null,
    highestMatchTitle: null,
    notOuts: 0,
    bowlMatchIds: new Set(),
    bowlBalls: 0,
    bowlRuns: 0,
    wickets: 0,
    maidens: 0,
    bestWkts: 0,
    bestRuns: 0,
    bestBalls: 0,
    bestMatchId: null,
    bestMatchTitle: null,
    catches: 0,
    runOuts: 0,
    stumpings: 0,
    mvpBat: 0,
    mvpBowl: 0,
    mvpField: 0,
    mvpTotal: 0,
  };
}

function named(p: PlayerAcc): NamedStat {
  return {
    playerId: p.playerId,
    playerName: p.playerName,
    photoUrl: p.photoUrl,
    teamId: p.teamId,
    teamName: p.teamName,
  };
}

export function compareBestBowling(
  a: { wickets: number; runs: number; balls: number },
  b: { wickets: number; runs: number; balls: number },
) {
  return b.wickets - a.wickets || a.runs - b.runs || a.balls - b.balls;
}

export function pickBestBatsman(players: PlayerAcc[]): PlayerAcc | null {
  return (
    [...players]
      .filter((p) => p.runs > 0)
      .sort(
        (a, b) =>
          b.runs - a.runs ||
          (battingAverage(b.runs, b.innings, b.notOuts) ?? -1) - (battingAverage(a.runs, a.innings, a.notOuts) ?? -1) ||
          strikeRate(b.runs, b.balls) - strikeRate(a.runs, a.balls),
      )[0] ?? null
  );
}

export function pickBestBowler(players: PlayerAcc[]): PlayerAcc | null {
  return (
    [...players]
      .filter((p) => p.wickets > 0)
      .sort(
        (a, b) =>
          b.wickets - a.wickets ||
          economy(a.bowlRuns, a.bowlBalls) - economy(b.bowlRuns, b.bowlBalls) ||
          (bowlingAverage(a.bowlRuns, a.wickets) ?? 999) - (bowlingAverage(b.bowlRuns, b.wickets) ?? 999),
      )[0] ?? null
  );
}

export function pickBestFielder(players: PlayerAcc[]): PlayerAcc | null {
  return (
    [...players]
      .filter((p) => p.catches + p.runOuts + p.stumpings > 0)
      .sort(
        (a, b) =>
          b.catches + b.runOuts + b.stumpings - (a.catches + a.runOuts + a.stumpings) ||
          b.catches - a.catches ||
          b.stumpings - a.stumpings,
      )[0] ?? null
  );
}

function bestBowlingLabel(p: PlayerAcc) {
  return p.bestWkts > 0 ? `${p.bestWkts}-${p.bestRuns}` : null;
}

function toBestBatsman(p: PlayerAcc): BestBatsman {
  return {
    ...named(p),
    runs: p.runs,
    average: battingAverage(p.runs, p.innings, p.notOuts),
    strikeRate: strikeRate(p.runs, p.balls),
    highest: p.highest,
    fours: p.fours,
    sixes: p.sixes,
    innings: p.innings,
  };
}

function toBestBowler(p: PlayerAcc): BestBowler {
  return {
    ...named(p),
    wickets: p.wickets,
    economy: economy(p.bowlRuns, p.bowlBalls),
    average: bowlingAverage(p.bowlRuns, p.wickets),
    best: bestBowlingLabel(p) ?? '—',
    overs: formatOvers(p.bowlBalls),
    balls: p.bowlBalls,
  };
}

function toBestFielder(p: PlayerAcc): BestFielder {
  return {
    ...named(p),
    catches: p.catches,
    runOuts: p.runOuts,
    stumpings: p.stumpings,
    dismissals: p.catches + p.runOuts + p.stumpings,
  };
}

function emptyRecords(): TournamentRecords {
  return {
    mostRuns: null,
    highestScore: null,
    mostFours: null,
    mostSixes: null,
    bestStrikeRate: null,
    mostWickets: null,
    bestBowling: null,
    bestEconomy: null,
    mostCatches: null,
    mostRunOuts: null,
    mostStumpings: null,
    highestTeamScore: null,
    lowestTeamScore: null,
    largestWinningMargin: null,
    closestMatch: null,
    mostTeamWins: null,
  };
}

function resultLine(m: {
  resultType?: string | null;
  resultWinnerTeamId?: string | null;
  marginType?: string | null;
  marginValue?: number | null;
  homeTeam: { id: string; name: string };
  awayTeam: { id: string; name: string };
}) {
  if (m.resultType === 'TIE') return 'Match tied';
  if (m.resultType === 'NO_RESULT') return 'No result';
  if (m.resultType === 'ABANDONED') return 'Match abandoned';
  if (m.resultType === 'CANCELLED') return 'Match cancelled';
  if (m.resultType === 'WIN' && m.resultWinnerTeamId) {
    const winner = m.resultWinnerTeamId === m.homeTeam.id ? m.homeTeam.name : m.awayTeam.name;
    const unit = m.marginType === 'WICKETS' ? 'wickets' : 'runs';
    return `${winner} won${m.marginValue != null ? ` by ${m.marginValue} ${unit}` : ''}`;
  }
  return null;
}

function tournamentStatus(counts: { live: number; completed: number; upcoming: number; matches: number }) {
  if (counts.live > 0) return 'LIVE' as const;
  if (counts.matches === 0) return 'DRAFT' as const;
  if (counts.upcoming > 0) return 'UPCOMING' as const;
  return 'COMPLETED' as const;
}

export function playerStatsFromDashboard(
  dash: TournamentDashboard,
  playerId: string,
): Omit<TournamentPlayerStats, 'tournamentName'> | null {
  const bat = dash.batting.find((p) => p.playerId === playerId);
  const bowl = dash.bowling.find((p) => p.playerId === playerId);
  const field = dash.fielding.find((p) => p.playerId === playerId);
  const row = dash.players.find((p) => p.playerId === playerId);
  if (!row && !bat && !bowl && !field) return null;
  return {
    tournamentId: dash.tournamentId,
    scope: 'tournament',
    player: {
      playerId,
      playerName: row?.playerName ?? bat?.playerName ?? bowl?.playerName ?? field?.playerName ?? 'Player',
      photoUrl: row?.photoUrl ?? bat?.photoUrl ?? bowl?.photoUrl ?? field?.photoUrl ?? null,
      teamName: row?.teamName ?? bat?.teamName ?? bowl?.teamName ?? field?.teamName ?? '',
    },
    matches: row?.matches ?? bat?.matches ?? bowl?.matches ?? 0,
    innings: bat?.innings ?? 0,
    runs: bat?.runs ?? 0,
    balls: bat?.balls ?? 0,
    average: bat?.average ?? null,
    strikeRate: bat?.strikeRate ?? 0,
    highest: bat?.highest ?? 0,
    wickets: bowl?.wickets ?? 0,
    economy: bowl?.economy ?? 0,
    bestBowling: bowl && bowl.best !== '—' ? bowl.best : null,
    overs: bowl?.overs ?? '0.0',
    catches: field?.catches ?? 0,
    runOuts: field?.runOuts ?? 0,
    stumpings: field?.stumpings ?? 0,
  };
}

export async function buildTournamentDashboard(
  prisma: PrismaService,
  scoring: ScoringService,
  tournamentId: string,
): Promise<TournamentDashboard | null> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      club: true,
      groups: { include: { teams: { include: { team: true } } } },
      matches: {
        include: {
          homeTeam: true,
          awayTeam: true,
          innings: {
            select: {
              battingTeamId: true,
              bowlingTeamId: true,
              totalRuns: true,
              totalWickets: true,
              totalBallsLegal: true,
              extras: true,
              isSuperOver: true,
            },
          },
        },
        orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'asc' }],
      },
      fanSettings: true,
    },
  });
  if (!tournament) return null;

  const innings = await prisma.innings.findMany({
    where: { match: { tournamentId }, isSuperOver: false },
    include: {
      events: { orderBy: { sequence: 'asc' as const } },
      battingTeam: true,
      bowlingTeam: true,
      match: {
        include: {
          ruleSnapshot: true,
          homeTeam: true,
          awayTeam: true,
          players: { include: { player: true } },
        },
      },
    },
  });

  const playerIds = new Set<string>();
  for (const inn of innings) {
    for (const e of inn.events) {
      if (e.strikerId) playerIds.add(e.strikerId);
      if (e.nonStrikerId) playerIds.add(e.nonStrikerId);
      if (e.bowlerId) playerIds.add(e.bowlerId);
      if (e.fielderId) playerIds.add(e.fielderId);
      if (e.dismissedPlayerId) playerIds.add(e.dismissedPlayerId);
    }
    for (const p of inn.match.players) playerIds.add(p.playerId);
  }
  const playerRows = playerIds.size
    ? await prisma.player.findMany({
        where: { id: { in: [...playerIds] } },
        select: { id: true, name: true, photoUrl: true },
      })
    : [];
  const names = new Map(playerRows.map((p) => [p.id, p]));

  const matches = tournament.matches;
  const completedMatches = matches.filter((m) => m.status === MatchStatus.COMPLETED);
  const liveMatches = matches.filter((m) => LIVE_STATUSES.has(m.status));
  const upcomingMatches = matches.filter((m) => UPCOMING_STATUSES.has(m.status));
  const abandonedMatches = matches.filter((m) => m.status === MatchStatus.ABANDONED);
  const cancelledMatches = matches.filter((m) => m.status === MatchStatus.CANCELLED);

  const groupTeams = tournament.groups.flatMap((g) => g.teams.map((x) => x.team));
  const matchTeams = matches.flatMap((m) => [m.homeTeam, m.awayTeam]);
  const uniqueTeams = [...groupTeams, ...matchTeams].filter(
    (team, i, arr) => team && arr.findIndex((x) => x.id === team.id) === i,
  );

  const format = matches[0]?.format ?? null;
  const overs = matches[0]?.overs ?? null;
  const maxWickets = matches[0]?.maxWickets ?? null;

  const players = new Map<string, PlayerAcc>();
  const ensure = (id: string) => {
    const cur = players.get(id);
    if (cur) return cur;
    const meta = names.get(id);
    const next = emptyPlayer(id, meta?.name ?? 'Player', meta?.photoUrl ?? null);
    players.set(id, next);
    return next;
  };

  let completedRuns = 0;
  let completedWickets = 0;
  let completedBalls = 0;
  let completedFours = 0;
  let completedSixes = 0;
  let completedExtras = 0;
  let liveRuns = 0;
  let liveWickets = 0;
  let liveFours = 0;
  let liveSixes = 0;

  const teamInnings: TeamScoreRecord[] = [];
  const matchAwards: MatchAward[] = [];
  const byMatch = new Map<string, typeof innings>();
  for (const inn of innings) {
    const list = byMatch.get(inn.matchId) ?? [];
    list.push(inn);
    byMatch.set(inn.matchId, list);
  }

  for (const [matchId, inns] of byMatch) {
    const match = inns[0]!.match;
    const isCompleted = RECORD_STATUSES.has(match.status);
    const isLive = LIVE_STATUSES.has(match.status);
    if (!isCompleted && !isLive) continue;

    const matchNames = new Map(match.players.map((p) => [p.playerId, p.player.name]));
    for (const p of match.players) {
      const row = ensure(p.playerId);
      row.teamId = p.teamId;
      row.teamName =
        p.teamId === match.homeTeamId ? match.homeTeam.name : p.teamId === match.awayTeamId ? match.awayTeam.name : row.teamName;
      if (p.player.photoUrl) row.photoUrl = p.player.photoUrl;
      if (p.player.name) row.playerName = p.player.name;
    }

    const slices = inns.map((inn) => {
      const snap = replayInnings(
        inn.events.map((e) => ({
          sequence: e.sequence,
          overNumber: e.overNumber,
          ballInOver: e.ballInOver,
          strikerId: e.strikerId,
          nonStrikerId: e.nonStrikerId,
          bowlerId: e.bowlerId,
          batsmanRuns: e.batsmanRuns,
          extraRuns: e.extraRuns,
          extraType: e.extraType,
          isWicket: e.isWicket,
          dismissalType: e.dismissalType,
          dismissedPlayerId: e.dismissedPlayerId,
          isUndone: e.isUndone,
        })),
        scoring.replayOptions(inn.match, inn),
      );

      if (isCompleted) {
        completedRuns += snap.totalRuns;
        completedWickets += snap.totalWickets;
        completedBalls += snap.totalBallsLegal;
        completedExtras += snap.extras;
        teamInnings.push({
          teamId: inn.battingTeamId,
          teamName: inn.battingTeam.name,
          runs: snap.totalRuns,
          wickets: snap.totalWickets,
          overs: formatOvers(snap.totalBallsLegal, match.ballsPerOver),
          matchId,
          matchTitle: match.title,
        });
        for (const b of snap.batters) {
          completedFours += b.fours;
          completedSixes += b.sixes;
          const row = ensure(b.playerId);
          row.matchIds.add(matchId);
          row.teamId = inn.battingTeamId;
          row.teamName = inn.battingTeam.name;
          row.innings += 1;
          row.runs += b.runs;
          row.balls += b.balls;
          row.fours += b.fours;
          row.sixes += b.sixes;
          if (!b.isOut) row.notOuts += 1;
          if (b.runs > row.highest || (b.runs === row.highest && !b.isOut && row.highestOut)) {
            row.highest = b.runs;
            row.highestBalls = b.balls;
            row.highestFours = b.fours;
            row.highestSixes = b.sixes;
            row.highestOut = b.isOut;
            row.highestMatchId = matchId;
            row.highestMatchTitle = match.title;
          }
        }
        for (const w of snap.bowlers) {
          const row = ensure(w.playerId);
          row.matchIds.add(matchId);
          row.bowlMatchIds.add(matchId);
          if (!row.teamId) {
            row.teamId = inn.bowlingTeamId;
            row.teamName = inn.bowlingTeam.name;
          }
          row.bowlBalls += w.balls;
          row.bowlRuns += w.runs;
          row.wickets += w.wickets;
          row.maidens += w.maidens;
          if (compareBestBowling({ wickets: w.wickets, runs: w.runs, balls: w.balls }, { wickets: row.bestWkts, runs: row.bestRuns, balls: row.bestBalls }) < 0) {
            row.bestWkts = w.wickets;
            row.bestRuns = w.runs;
            row.bestBalls = w.balls;
            row.bestMatchId = matchId;
            row.bestMatchTitle = match.title;
          }
        }
        for (const ev of inn.events) {
          if (!ev.isWicket || ev.isUndone || !ev.fielderId) continue;
          const row = ensure(ev.fielderId);
          row.matchIds.add(matchId);
          if (!row.teamId) {
            row.teamId = inn.bowlingTeamId;
            row.teamName = inn.bowlingTeam.name;
          }
          if (ev.dismissalType === 'CAUGHT') row.catches += 1;
          else if (ev.dismissalType === 'STUMPED') row.stumpings += 1;
          else if (ev.dismissalType === 'RUN_OUT' || ev.dismissalType === 'MANKAD') row.runOuts += 1;
        }
      } else if (isLive) {
        liveRuns += snap.totalRuns;
        liveWickets += snap.totalWickets;
        for (const b of snap.batters) {
          liveFours += b.fours;
          liveSixes += b.sixes;
        }
      }

      return {
        battingTeamName: inn.battingTeam.name,
        bowlingTeamName: inn.bowlingTeam.name,
        batters: snap.batters,
        bowlers: snap.bowlers,
        wickets: inn.events
          .filter((e) => e.isWicket && !e.isUndone)
          .map((e) => ({
            dismissalType: e.dismissalType,
            fielderId: e.fielderId,
            bowlerId: e.bowlerId,
          })),
        names: matchNames,
      };
    });

    if (!isCompleted) continue;
    const config = mvpConfigFromSnapshot(parseRuleSnapshot(match.ruleSnapshot?.rulesJson));
    const potmRows = computeMatchMvp(mvpInputsFromInnings(slices), config);
    for (const row of potmRows) {
      const acc = ensure(row.playerId);
      const next = addMvpBreakdown(
        { batting: acc.mvpBat, bowling: acc.mvpBowl, fielding: acc.mvpField, total: acc.mvpTotal },
        row,
      );
      acc.mvpBat = next.batting;
      acc.mvpBowl = next.bowling;
      acc.mvpField = next.fielding;
      acc.mvpTotal = next.total;
      if (!acc.teamName) acc.teamName = row.teamName;
    }
    const potm = potmRows[0];
    if (potm) {
      const acc = ensure(potm.playerId);
      matchAwards.push({
        matchId,
        matchTitle: match.title,
        homeName: match.homeTeam.name,
        awayName: match.awayTeam.name,
        playerId: potm.playerId,
        playerName: potm.playerName,
        photoUrl: acc.photoUrl,
        teamName: potm.teamName,
        score: potm.total,
      });
    }
  }

  const list = [...players.values()];
  const bestBat = pickBestBatsman(list);
  const bestBowl = pickBestBowler(list);
  const bestField = pickBestFielder(list);
  const mvpAcc =
    [...list]
      .filter((p) => p.mvpTotal > 0)
      .sort((a, b) => b.mvpTotal - a.mvpTotal || a.playerName.localeCompare(b.playerName))[0] ?? null;

  const batting = list
    .filter((p) => p.innings > 0)
    .sort((a, b) => b.runs - a.runs || strikeRate(b.runs, b.balls) - strikeRate(a.runs, a.balls))
    .map(
      (p): PlayerBatRow => ({
        ...named(p),
        matches: p.matchIds.size,
        innings: p.innings,
        runs: p.runs,
        balls: p.balls,
        average: battingAverage(p.runs, p.innings, p.notOuts),
        strikeRate: strikeRate(p.runs, p.balls),
        highest: p.highest,
        fours: p.fours,
        sixes: p.sixes,
        notOuts: p.notOuts,
      }),
    );

  const bowling = list
    .filter((p) => p.bowlBalls > 0 || p.wickets > 0)
    .sort((a, b) => b.wickets - a.wickets || economy(a.bowlRuns, a.bowlBalls) - economy(b.bowlRuns, b.bowlBalls))
    .map(
      (p): PlayerBowlRow => ({
        ...named(p),
        matches: p.bowlMatchIds.size,
        overs: formatOvers(p.bowlBalls),
        balls: p.bowlBalls,
        runs: p.bowlRuns,
        wickets: p.wickets,
        economy: economy(p.bowlRuns, p.bowlBalls),
        average: bowlingAverage(p.bowlRuns, p.wickets),
        best: bestBowlingLabel(p) ?? '—',
        maidens: p.maidens,
      }),
    );

  const fielding = list
    .filter((p) => p.catches + p.runOuts + p.stumpings > 0)
    .sort((a, b) => b.catches + b.runOuts + b.stumpings - (a.catches + a.runOuts + a.stumpings))
    .map(
      (p): PlayerFieldRow => ({
        ...named(p),
        matches: p.matchIds.size,
        catches: p.catches,
        runOuts: p.runOuts,
        stumpings: p.stumpings,
        dismissals: p.catches + p.runOuts + p.stumpings,
      }),
    );

  const records = emptyRecords();
  if (bestBat) {
    records.mostRuns = { ...named(bestBat), value: bestBat.runs };
  }
  const highest = [...list].filter((p) => p.highest > 0).sort((a, b) => b.highest - a.highest || Number(a.highestOut) - Number(b.highestOut))[0];
  if (highest) {
    records.highestScore = {
      ...named(highest),
      value: highest.highest,
      extra: `${highest.highestBalls} balls`,
      matchId: highest.highestMatchId,
      matchTitle: highest.highestMatchTitle,
    };
  }
  const mostFours = [...list].filter((p) => p.fours > 0).sort((a, b) => b.fours - a.fours || b.runs - a.runs)[0];
  if (mostFours) records.mostFours = { ...named(mostFours), value: mostFours.fours };
  const mostSixes = [...list].filter((p) => p.sixes > 0).sort((a, b) => b.sixes - a.sixes || b.runs - a.runs)[0];
  if (mostSixes) records.mostSixes = { ...named(mostSixes), value: mostSixes.sixes };
  const bestSr = [...list]
    .filter((p) => p.balls >= MIN_BALLS_STRIKE_RATE)
    .sort((a, b) => strikeRate(b.runs, b.balls) - strikeRate(a.runs, a.balls) || b.runs - a.runs)[0];
  if (bestSr) records.bestStrikeRate = { ...named(bestSr), value: strikeRate(bestSr.runs, bestSr.balls), extra: `${bestSr.balls} balls` };
  if (bestBowl) records.mostWickets = { ...named(bestBowl), value: bestBowl.wickets };
  const bestSpell = [...list]
    .filter((p) => p.bestWkts > 0)
    .sort((a, b) => compareBestBowling({ wickets: a.bestWkts, runs: a.bestRuns, balls: a.bestBalls }, { wickets: b.bestWkts, runs: b.bestRuns, balls: b.bestBalls }))[0];
  if (bestSpell) {
    records.bestBowling = {
      ...named(bestSpell),
      value: `${bestSpell.bestWkts}-${bestSpell.bestRuns}`,
      extra: formatOvers(bestSpell.bestBalls),
      matchId: bestSpell.bestMatchId,
      matchTitle: bestSpell.bestMatchTitle,
    };
  }
  const bestEco = [...list]
    .filter((p) => p.bowlBalls >= MIN_BALLS_ECONOMY)
    .sort((a, b) => economy(a.bowlRuns, a.bowlBalls) - economy(b.bowlRuns, b.bowlBalls) || b.bowlBalls - a.bowlBalls)[0];
  if (bestEco) records.bestEconomy = { ...named(bestEco), value: economy(bestEco.bowlRuns, bestEco.bowlBalls), extra: formatOvers(bestEco.bowlBalls) };
  const mostCatches = [...list].filter((p) => p.catches > 0).sort((a, b) => b.catches - a.catches)[0];
  if (mostCatches) records.mostCatches = { ...named(mostCatches), value: mostCatches.catches };
  const mostRo = [...list].filter((p) => p.runOuts > 0).sort((a, b) => b.runOuts - a.runOuts)[0];
  if (mostRo) records.mostRunOuts = { ...named(mostRo), value: mostRo.runOuts };
  const mostSt = [...list].filter((p) => p.stumpings > 0).sort((a, b) => b.stumpings - a.stumpings)[0];
  if (mostSt) records.mostStumpings = { ...named(mostSt), value: mostSt.stumpings };

  if (teamInnings.length) {
    records.highestTeamScore = [...teamInnings].sort((a, b) => b.runs - a.runs)[0] ?? null;
    records.lowestTeamScore = [...teamInnings].sort((a, b) => a.runs - b.runs)[0] ?? null;
  }

  const wins = completedMatches.filter((m) => m.resultType === 'WIN' && m.marginValue != null);
  const largest = [...wins].sort((a, b) => {
    if (a.marginType === b.marginType) return (b.marginValue ?? 0) - (a.marginValue ?? 0);
    if (a.marginType === 'RUNS') return -1;
    if (b.marginType === 'RUNS') return 1;
    return (b.marginValue ?? 0) - (a.marginValue ?? 0);
  })[0];
  if (largest) {
    records.largestWinningMargin = {
      matchId: largest.id,
      matchTitle: largest.title,
      winnerTeamId: largest.resultWinnerTeamId,
      winnerName:
        largest.resultWinnerTeamId === largest.homeTeam.id
          ? largest.homeTeam.name
          : largest.resultWinnerTeamId === largest.awayTeam.id
            ? largest.awayTeam.name
            : null,
      marginType: largest.marginType,
      marginValue: largest.marginValue,
    };
  }
  const closest = [...wins].sort((a, b) => {
    const av = a.marginType === 'RUNS' ? (a.marginValue ?? 999) : (a.marginValue ?? 999) * 10;
    const bv = b.marginType === 'RUNS' ? (b.marginValue ?? 999) : (b.marginValue ?? 999) * 10;
    return av - bv;
  })[0];
  if (closest) {
    records.closestMatch = {
      matchId: closest.id,
      matchTitle: closest.title,
      winnerTeamId: closest.resultWinnerTeamId,
      winnerName:
        closest.resultWinnerTeamId === closest.homeTeam.id
          ? closest.homeTeam.name
          : closest.resultWinnerTeamId === closest.awayTeam.id
            ? closest.awayTeam.name
            : null,
      marginType: closest.marginType,
      marginValue: closest.marginValue,
    };
  }

  const standingTeams = uniqueTeams.map((t) => ({ teamId: t.id, teamName: t.name, logoUrl: t.logoUrl }));
  const standingMatches = completedMatches.map((m) => ({
    homeTeamId: m.homeTeamId,
    awayTeamId: m.awayTeamId,
    overs: m.overs,
    ballsPerOver: m.ballsPerOver,
    maxWickets: m.maxWickets,
    resultType: m.resultType,
    winnerTeamId: m.resultWinnerTeamId,
    innings: m.innings.filter((i) => !i.isSuperOver).map((i) => ({
      battingTeamId: i.battingTeamId,
      bowlingTeamId: i.bowlingTeamId,
      totalRuns: i.totalRuns,
      totalBallsLegal: i.totalBallsLegal,
      totalWickets: i.totalWickets,
    })),
  }));
  const manualStandings = standingTeams.length > 0 ? await manualStandingInputs(prisma, tournamentId) : [];
  const standings =
    standingTeams.length > 0
      ? computeGroupStandings(
          standingTeams,
          standingMatches,
          { winningBonusPoints: tournament.winningBonusPoints, tiePoints: tournament.tiePoints },
          manualStandings,
        )
      : [];
  const mostWins = [...standings].sort((a, b) => b.won - a.won)[0];
  if (mostWins && mostWins.won > 0) {
    records.mostTeamWins = { teamId: mostWins.teamId, teamName: mostWins.teamName, wins: mostWins.won };
  }

  const teamRows: TournamentTeamRow[] = uniqueTeams.map((team) => {
    const row = standings.find((s) => s.teamId === team.id);
    const scored = completedMatches.reduce((sum, m) => {
      return sum + m.innings.filter((i) => i.battingTeamId === team.id).reduce((a, i) => a + i.totalRuns, 0);
    }, 0);
    const conceded = completedMatches.reduce((sum, m) => {
      return sum + m.innings.filter((i) => i.bowlingTeamId === team.id).reduce((a, i) => a + i.totalRuns, 0);
    }, 0);
    const wkts = list.filter((p) => p.teamId === team.id).reduce((a, p) => a + p.wickets, 0);
    const teamBat = pickBestBatsman(list.filter((p) => p.teamId === team.id));
    const teamBowl = pickBestBowler(list.filter((p) => p.teamId === team.id));
    return {
      teamId: team.id,
      teamName: team.name,
      logoUrl: team.logoUrl,
      matches: row?.played ?? 0,
      won: row?.won ?? 0,
      lost: row?.lost ?? 0,
      tied: row?.tied ?? 0,
      noResult: row?.noResult ?? 0,
      points: row?.points ?? 0,
      runsScored: scored,
      runsConceded: conceded,
      wickets: wkts,
      bestBatsman: teamBat ? { playerId: teamBat.playerId, playerName: teamBat.playerName, runs: teamBat.runs } : null,
      bestBowler: teamBowl ? { playerId: teamBowl.playerId, playerName: teamBowl.playerName, wickets: teamBowl.wickets } : null,
    };
  });

  const headerCounts = {
    live: liveMatches.length,
    completed: completedMatches.length,
    upcoming: upcomingMatches.length,
    matches: matches.length,
  };

  return {
    tournamentId,
    header: {
      name: tournament.name,
      status: tournamentStatus(headerCounts),
      season: tournament.season,
      club: tournament.club?.name ?? null,
      format,
      overs,
      maxWickets,
      teams: uniqueTeams.length,
      matches: matches.length,
      completed: completedMatches.length,
      live: liveMatches.length,
      upcoming: upcomingMatches.length,
      abandoned: abandonedMatches.length,
      cancelled: cancelledMatches.length,
    },
    summary: {
      teams: uniqueTeams.length,
      matches: matches.length,
      completed: completedMatches.length,
      upcoming: upcomingMatches.length,
      live: liveMatches.length,
      totalRuns: completedRuns,
      totalWickets: completedWickets,
      totalOvers: formatOvers(completedBalls),
      totalBalls: completedBalls,
      fours: completedFours,
      sixes: completedSixes,
      extras: completedExtras,
      liveTotals:
        liveMatches.length > 0
          ? { totalRuns: liveRuns, totalWickets: liveWickets, fours: liveFours, sixes: liveSixes }
          : null,
    },
    hasCompletedStats: completedMatches.length > 0 && list.some((p) => p.runs > 0 || p.wickets > 0 || p.catches + p.runOuts + p.stumpings > 0),
    performers: {
      bestBatsman: bestBat ? toBestBatsman(bestBat) : null,
      bestBowler: bestBowl ? toBestBowler(bestBowl) : null,
      bestFielder: bestField ? toBestFielder(bestField) : null,
      mvp: mvpAcc
        ? {
            ...named(mvpAcc),
            score: mvpAcc.mvpTotal,
            batting: mvpAcc.mvpBat,
            bowling: mvpAcc.mvpBowl,
            fielding: mvpAcc.mvpField,
            runs: mvpAcc.runs,
            wickets: mvpAcc.wickets,
            catches: mvpAcc.catches,
            matches: mvpAcc.matchIds.size,
          }
        : null,
    },
    batting,
    bowling,
    fielding,
    records,
    players: list
      .filter((p) => p.matchIds.size > 0)
      .sort((a, b) => a.playerName.localeCompare(b.playerName))
      .map((p) => ({
        playerId: p.playerId,
        playerName: p.playerName,
        photoUrl: p.photoUrl,
        teamId: p.teamId,
        teamName: p.teamName,
        matches: p.matchIds.size,
        runs: p.runs,
        wickets: p.wickets,
        catches: p.catches,
        runOuts: p.runOuts,
        stumpings: p.stumpings,
      })),
    teams: teamRows,
    matchAwards,
    scorecards: completedMatches.map((m) => ({
      matchId: m.id,
      matchTitle: m.title,
      homeName: m.homeTeam.name,
      awayName: m.awayTeam.name,
      result: resultLine(m),
      status: m.status,
      scheduledAt: m.scheduledAt?.toISOString() ?? null,
    })),
    quizEnabled: Boolean(tournament.fanSettings?.quizzesEnabled),
    mvpFormula: MVP_FORMULA,
  };
}
