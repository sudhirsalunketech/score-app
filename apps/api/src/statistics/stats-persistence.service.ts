import { Inject, Injectable } from '@nestjs/common';
import { ExtraType, MatchStatus, Prisma } from '@prisma/client';
import {
  applyCountedRunsToBatter,
  buildMatchStatDeltas,
  computeGroupStandings,
  eventStatPolicy,
  hatTrickBowlerIds,
  matchReplayOptions as replayOptionsFromMatch,
  parseRuleSnapshot,
  replayInnings,
  rulesAffect,
  type MatchStatsPayload,
  type ScoringEvent,
  type StandingMatch,
  type StandingTeam,
} from '@crickscore/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ManualMatchService } from '../tournaments/manual-match.service';

function toEvents(
  rows: Array<{
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
    dismissalType: ScoringEvent['dismissalType'];
    dismissedPlayerId: string | null;
    isUndone: boolean;
  }>,
): ScoringEvent[] {
  return rows.map((e) => ({
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
  }));
}

function payloadOf(value: Prisma.JsonValue): MatchStatsPayload | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as MatchStatsPayload;
  if (row.version !== 1 || !Array.isArray(row.players) || !Array.isArray(row.teams)) return null;
  return row;
}

@Injectable()
export class StatsPersistenceService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ManualMatchService) private readonly manualMatches: ManualMatchService,
  ) {}

  async persist(tx: Prisma.TransactionClient, matchId: string): Promise<{ applied: boolean }> {
    const existing = await tx.matchStatistic.findUnique({ where: { matchId } });
    if (existing) return { applied: false };

    const match = await tx.match.findUnique({
      where: { id: matchId },
      include: {
        innings: {
          include: { events: { orderBy: { sequence: 'asc' as const }, include: { ruleEvaluation: true } } },
          orderBy: { inningsNumber: 'asc' },
        },
        players: true,
        ruleSnapshot: true,
      },
    });
    if (!match) return { applied: false };
    const snapshotRules = parseRuleSnapshot(match.ruleSnapshot?.rulesJson);
    const playerStatsOn = rulesAffect(snapshotRules, 'playerStats');

    const payload = buildMatchStatDeltas({
      matchId: match.id,
      homeTeamId: match.homeTeamId,
      awayTeamId: match.awayTeamId,
      resultType: match.resultType,
      winnerTeamId: match.resultWinnerTeamId,
      playingPlayerIds: match.players.filter((p) => p.isPlaying).map((p) => p.playerId),
      // Super Over deliveries are a separate tie-breaker, not part of a player's normal match figures.
      innings: match.innings.filter((inn) => !inn.isSuperOver).map((inn) => {
        const snapshot = replayInnings(toEvents(inn.events), replayOptionsFromMatch(match, inn.targetRuns, inn));
        const batters = snapshot.batters.map((b) => ({ ...b }));
        if (playerStatsOn) {
          for (const event of inn.events) {
            if (event.isUndone || !event.ruleEvaluation) continue;
            const policy = eventStatPolicy({
              extraType: event.extraType,
              isWicket: event.isWicket,
              ruleAffects: { playerStats: true },
            });
            if (!policy.affectsBatterStats) continue;
            const batter = batters.find((b) => b.playerId === event.strikerId);
            if (!batter) continue;
            batter.runs = applyCountedRunsToBatter({
              batsmanRuns: batter.runs,
              originalRuns: event.ruleEvaluation.originalRuns,
              countedRuns: event.ruleEvaluation.countedRuns,
              affectsPlayerStats: true,
            });
          }
        }
        return {
          battingTeamId: inn.battingTeamId,
          bowlingTeamId: inn.bowlingTeamId,
          totalRuns: snapshot.totalRuns,
          totalWickets: snapshot.totalWickets,
          batters,
          bowlers: snapshot.bowlers,
          fielding: inn.events
            .filter((e) => e.isWicket && !e.isUndone)
            .map((e) => ({ dismissalType: e.dismissalType, fielderId: e.fielderId })),
          hatTrickBowlerIds: hatTrickBowlerIds(
            inn.events
              .filter((e) => !e.isUndone)
              .map((e) => ({
                sequence: e.sequence,
                overNumber: e.overNumber,
                ballInOver: e.ballInOver,
                actualRuns: e.totalRuns,
                extraType: e.extraType,
                isWicket: e.isWicket,
                bowlerId: e.bowlerId,
                isAutoGenerated: e.isAutoGenerated,
              })),
          ),
        };
      }),
    });

    await tx.matchStatistic.create({
      data: { matchId, payload: payload as unknown as Prisma.InputJsonValue },
    });
    await this.applyPayload(tx, payload, 1, match.ballsPerOver);
    return { applied: true };
  }

  async persistStandings(tx: Prisma.TransactionClient, matchId: string): Promise<{ applied: boolean }> {
    const match = await tx.match.findUnique({ where: { id: matchId }, select: { tournamentId: true } });
    if (!match?.tournamentId) return { applied: false };
    await this.refreshTournamentPoints(tx, match.tournamentId);
    return { applied: true };
  }

  async refreshTournamentPoints(tx: Prisma.TransactionClient, tournamentId: string) {
    const tn = await tx.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        groups: { include: { teams: { include: { team: true } } } },
        matches: { include: { innings: true, homeTeam: true, awayTeam: true, ruleSnapshot: true } },
      },
    });
    if (!tn) return;

    const teams = new Map<string, StandingTeam>();
    for (const group of tn.groups) {
      for (const row of group.teams) {
        teams.set(row.teamId, { teamId: row.teamId, teamName: row.team.name, logoUrl: row.team.logoUrl });
      }
    }
    for (const m of tn.matches) {
      if (!teams.has(m.homeTeamId)) teams.set(m.homeTeamId, { teamId: m.homeTeamId, teamName: m.homeTeam.name, logoUrl: m.homeTeam.logoUrl });
      if (!teams.has(m.awayTeamId)) teams.set(m.awayTeamId, { teamId: m.awayTeamId, teamName: m.awayTeam.name, logoUrl: m.awayTeam.logoUrl });
    }

    const completed = tn.matches.filter((m) => m.status === MatchStatus.COMPLETED);
    const standingMatches: StandingMatch[] = completed.map((m) => ({
      homeTeamId: m.homeTeamId,
      awayTeamId: m.awayTeamId,
      overs: m.overs,
      ballsPerOver: m.ballsPerOver,
      maxWickets: m.maxWickets,
      resultType: m.resultType,
      winnerTeamId: m.resultWinnerTeamId,
      // NRR is computed from the main innings only — a Super Over is a tie-breaker, not part of the match total.
      innings: m.innings.filter((i) => !i.isSuperOver).map((i) => {
        const derived = m.ruleSnapshot?.derivedJson as
          | { innings?: Array<{ inningsNumber: number; actualRuns: number; countedRuns: number }> }
          | null
          | undefined;
        const row = derived?.innings?.find((d) => d.inningsNumber === i.inningsNumber);
        const nrrOn = rulesAffect(parseRuleSnapshot(m.ruleSnapshot?.rulesJson), 'nrr');
        return {
          battingTeamId: i.battingTeamId,
          bowlingTeamId: i.bowlingTeamId,
          totalRuns: i.totalRuns,
          totalBallsLegal: i.totalBallsLegal,
          totalWickets: i.totalWickets,
          nrrRuns: nrrOn ? row?.countedRuns ?? i.totalRuns : undefined,
        };
      }),
    }));

    const manual = await this.manualMatches.standingInputs(tournamentId);
    const rows = computeGroupStandings(
      [...teams.values()],
      standingMatches,
      { winningBonusPoints: tn.winningBonusPoints, tiePoints: tn.tiePoints },
      manual,
    );
    const keepIds = rows.map((row) => row.teamId);
    if (keepIds.length) {
      await tx.tournamentPoint.deleteMany({ where: { tournamentId, teamId: { notIn: keepIds } } });
    } else {
      await tx.tournamentPoint.deleteMany({ where: { tournamentId } });
    }
    for (const row of rows) {
      await tx.tournamentPoint.upsert({
        where: { tournamentId_teamId: { tournamentId, teamId: row.teamId } },
        create: {
          tournamentId,
          teamId: row.teamId,
          played: row.played,
          won: row.won,
          lost: row.lost,
          tied: row.tied,
          noResult: row.noResult,
          bonusPoints: row.bonusPoints,
          points: row.points,
          nrr: row.nrr,
        },
        update: {
          played: row.played,
          won: row.won,
          lost: row.lost,
          tied: row.tied,
          noResult: row.noResult,
          bonusPoints: row.bonusPoints,
          points: row.points,
          nrr: row.nrr,
        },
      });
    }
  }

  async revert(tx: Prisma.TransactionClient, matchId: string): Promise<{ applied: boolean }> {
    const row = await tx.matchStatistic.findUnique({ where: { matchId } });
    if (!row) return { applied: false };
    const payload = payloadOf(row.payload);
    if (payload) {
      const match = await tx.match.findUnique({ where: { id: matchId }, select: { ballsPerOver: true } });
      await this.applyPayload(tx, payload, -1, match?.ballsPerOver ?? 6);
    }
    await tx.matchStatistic.delete({ where: { matchId } });
    return { applied: true };
  }

  private async applyPayload(tx: Prisma.TransactionClient, payload: MatchStatsPayload, sign: 1 | -1, ballsPerOver: number) {
    for (const player of payload.players) {
      const existing = await tx.playerStatistic.findUnique({ where: { playerId: player.playerId } });
      const nextHighest =
        sign === 1 ? Math.max(existing?.highestScore ?? 0, player.highestScore) : (existing?.highestScore ?? 0);
      const useBest =
        sign === 1 &&
        (player.bestBowlWkts > (existing?.bestBowlWkts ?? 0) ||
          (player.bestBowlWkts === (existing?.bestBowlWkts ?? 0) &&
            player.bestBowlWkts > 0 &&
            player.bestBowlRuns < (existing?.bestBowlRuns ?? 99)));
      const data = {
        matches: Math.max(0, (existing?.matches ?? 0) + sign * player.matches),
        innings: Math.max(0, (existing?.innings ?? 0) + sign * player.innings),
        runs: Math.max(0, (existing?.runs ?? 0) + sign * player.runs),
        balls: Math.max(0, (existing?.balls ?? 0) + sign * player.balls),
        fours: Math.max(0, (existing?.fours ?? 0) + sign * player.fours),
        sixes: Math.max(0, (existing?.sixes ?? 0) + sign * player.sixes),
        fifties: Math.max(0, (existing?.fifties ?? 0) + sign * player.fifties),
        hundreds: Math.max(0, (existing?.hundreds ?? 0) + sign * player.hundreds),
        highestScore: nextHighest,
        notOuts: Math.max(0, (existing?.notOuts ?? 0) + sign * player.notOuts),
        wickets: Math.max(0, (existing?.wickets ?? 0) + sign * player.wickets),
        oversBowled: Math.max(0, (existing?.oversBowled ?? 0) + (sign * player.oversBowledBalls) / ballsPerOver),
        runsConceded: Math.max(0, (existing?.runsConceded ?? 0) + sign * player.runsConceded),
        maidens: Math.max(0, (existing?.maidens ?? 0) + sign * player.maidens),
        catches: Math.max(0, (existing?.catches ?? 0) + sign * player.catches),
        stumpings: Math.max(0, (existing?.stumpings ?? 0) + sign * player.stumpings),
        runOuts: Math.max(0, (existing?.runOuts ?? 0) + sign * player.runOuts),
        bestBowlWkts: useBest ? player.bestBowlWkts : (existing?.bestBowlWkts ?? 0),
        bestBowlRuns: useBest ? player.bestBowlRuns : (existing?.bestBowlRuns ?? 0),
        hatTricks: Math.max(0, (existing?.hatTricks ?? 0) + sign * player.hatTricks),
      };
      if (existing) {
        await tx.playerStatistic.update({ where: { playerId: player.playerId }, data });
      } else if (sign === 1) {
        await tx.playerStatistic.create({ data: { playerId: player.playerId, ...data } });
      }
    }

    for (const team of payload.teams) {
      const existing = await tx.teamStatistic.findUnique({ where: { teamId: team.teamId } });
      const data = {
        matches: Math.max(0, (existing?.matches ?? 0) + sign * team.matches),
        wins: Math.max(0, (existing?.wins ?? 0) + sign * team.wins),
        losses: Math.max(0, (existing?.losses ?? 0) + sign * team.losses),
        ties: Math.max(0, (existing?.ties ?? 0) + sign * team.ties),
        noResults: Math.max(0, (existing?.noResults ?? 0) + sign * team.noResults),
        runs: Math.max(0, (existing?.runs ?? 0) + sign * team.runs),
        wickets: Math.max(0, (existing?.wickets ?? 0) + sign * team.wickets),
      };
      if (existing) {
        await tx.teamStatistic.update({ where: { teamId: team.teamId }, data });
      } else if (sign === 1) {
        await tx.teamStatistic.create({ data: { teamId: team.teamId, ...data } });
      }
    }
  }
}
