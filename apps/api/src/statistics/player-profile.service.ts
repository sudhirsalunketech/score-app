import { Inject, Injectable } from '@nestjs/common';
import { ExtraType } from '@prisma/client';
import {
  computeMatchMvp,
  computeStreetMvp,
  formatOvers,
  isLegalBall,
  mvpConfigFromSnapshot,
  mvpInputsFromInnings,
  parseRuleSnapshot,
  replayInnings,
  type MvpInningsSlice,
  type ScoringEvent,
} from '@crickscore/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ScoringService } from '../scoring/scoring.service';
import { Errors } from '../common/app-error';
import { eventInvolvesPlayer } from '../players/player-account.helpers';
import {
  addBatterInnings,
  addBowlerSpell,
  countRunBucket,
  emptyBuckets,
  emptySlice,
  formatLabel,
  markMatch,
  presentSlice,
  PROFILE_FORMATS,
  strikeRate,
  type SliceTotals,
} from './player-profile-stats';

type EventRow = {
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
  fielderId: string | null;
  isUndone: boolean;
};

export type PlayerMatchRow = {
  matchId: string;
  title: string;
  format: string;
  status: string;
  when: string | null;
  versus: string;
  homeName: string;
  awayName: string;
  venue: string | null;
  result: string | null;
  tournamentId: string | null;
  tournamentName: string | null;
  batting: {
    order: number | null;
    runs: number;
    balls: number;
    fours: number;
    sixes: number;
    sr: number;
    dismissal: string | null;
    dismissedBy: string | null;
  } | null;
  bowling: { overs: string; runs: number; maidens: number; wickets: number; eco: number } | null;
  fielding: { catches: number; stumpings: number; runOuts: number };
  mvp: { batting: number; bowling: number; fielding: number; total: number };
};

function toScoringEvents(rows: EventRow[]): ScoringEvent[] {
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

function playerName(names: Map<string, string>, id: string | null | undefined) {
  if (!id) return null;
  return names.get(id) ?? null;
}

@Injectable()
export class PlayerProfileService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ScoringService) private readonly scoring: ScoringService,
  ) {}

  async build(playerId: string, filter?: { tournamentId?: string; matchId?: string }) {
    const innings = await this.prisma.innings.findMany({
      where: {
        isSuperOver: false,
        ...(filter?.tournamentId ? { match: { tournamentId: filter.tournamentId } } : {}),
        ...(filter?.matchId ? { matchId: filter.matchId } : {}),
        OR: [
          { events: { some: { strikerId: playerId } } },
          { events: { some: { bowlerId: playerId } } },
          { events: { some: { dismissedPlayerId: playerId } } },
          { events: { some: { fielderId: playerId } } },
          { match: { players: { some: { playerId } } } },
        ],
      },
      include: {
        events: { orderBy: { sequence: 'asc' } },
        battingTeam: true,
        bowlingTeam: true,
        match: {
          include: {
            homeTeam: true,
            awayTeam: true,
            players: { include: { player: { select: { id: true, name: true } } } },
            tournament: { select: { id: true, name: true, season: true } },
            ruleSnapshot: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    const yearlySlices = new Map<number, SliceTotals>();
    const yearSeen = new Set<string>();
    const teamSlices = new Map<string, SliceTotals>();
    const teamSeen = new Set<string>();
    const matchInningsSlices = new Map<string, MvpInningsSlice[]>();
    const matchRuleJson = new Map<string, unknown>();
    const overall = emptySlice();
    const byFormat = Object.fromEntries(PROFILE_FORMATS.map((f) => [f, emptySlice()])) as Record<
      (typeof PROFILE_FORMATS)[number],
      SliceTotals
    >;
    const faced = emptyBuckets();
    const bowled = emptyBuckets();
    const recentBat: Array<{ runs: number; notOut: boolean }> = [];
    const recentBowl: string[] = [];
    const matches: PlayerMatchRow[] = [];
    const seenMatch = new Set<string>();
    const positions = new Map<string, SliceTotals>();
    const fieldByMatch = new Map<string, { catches: number; stumpings: number; runOuts: number }>();

    for (const inn of innings) {
      const snap = replayInnings(toScoringEvents(inn.events), this.scoring.replayOptions(inn.match, inn));
      const format = formatLabel(inn.match.format) ?? 'CLUB';
      const batter = snap.batters.find((b) => b.playerId === playerId);
      const bowler = snap.bowlers.find((b) => b.playerId === playerId);
      const names = new Map(inn.match.players.map((p) => [p.playerId, p.player.name]));
      const played = inn.match.players.some((p) => p.playerId === playerId);
      const versus = inn.battingTeamId === inn.match.homeTeamId ? inn.match.awayTeam.name : inn.match.homeTeam.name;
      // The opponent for team-vs-team stats depends on which side this player is on in THIS innings:
      // batting -> the bowling side is the opponent; bowling -> the batting side is the opponent.
      // (`versus` above always names the bowling side, which is wrong whenever this player is the one bowling.)
      const opponentTeam = batter ? inn.bowlingTeam.name : bowler ? inn.battingTeam.name : null;
      const year = (inn.match.scheduledAt ?? inn.match.createdAt).getFullYear();
      if (!yearlySlices.has(year)) yearlySlices.set(year, emptySlice());
      if (opponentTeam && !teamSlices.has(opponentTeam)) teamSlices.set(opponentTeam, emptySlice());
      const yearKey = `${year}:${inn.matchId}`;
      const teamKey = opponentTeam ? `${opponentTeam}:${inn.matchId}` : null;
      if ((batter || bowler) && !yearSeen.has(yearKey)) {
        yearSeen.add(yearKey);
        markMatch(yearlySlices.get(year)!);
      }
      if (teamKey && !teamSeen.has(teamKey)) {
        teamSeen.add(teamKey);
        markMatch(teamSlices.get(opponentTeam!)!);
      }
      if (!matchRuleJson.has(inn.matchId)) matchRuleJson.set(inn.matchId, inn.match.ruleSnapshot?.rulesJson ?? null);
      if (!matchInningsSlices.has(inn.matchId)) matchInningsSlices.set(inn.matchId, []);
      matchInningsSlices.get(inn.matchId)!.push({
        battingTeamName: inn.battingTeam.name,
        bowlingTeamName: inn.bowlingTeam.name,
        batters: snap.batters,
        bowlers: snap.bowlers,
        wickets: inn.events
          .filter((e) => e.isWicket && !e.isUndone)
          .map((e) => ({ dismissalType: e.dismissalType, fielderId: e.fielderId, bowlerId: e.bowlerId })),
      });
      if (!seenMatch.has(inn.matchId) && (batter || bowler)) {
        seenMatch.add(inn.matchId);
        markMatch(overall);
        markMatch(byFormat[format]);
      }
      if (batter) {
        addBatterInnings(overall, batter);
        addBatterInnings(byFormat[format], batter);
        addBatterInnings(yearlySlices.get(year)!, batter);
        addBatterInnings(teamSlices.get(opponentTeam!)!, batter);
        recentBat.push({ runs: batter.runs, notOut: !batter.isOut });
        const order = inn.match.players.find((p) => p.playerId === playerId)?.battingOrder ?? 0;
        if (order > 0) {
          const key = order <= 2 ? '1-2' : String(order);
          if (!positions.has(key)) positions.set(key, emptySlice());
          addBatterInnings(positions.get(key)!, batter);
        }
      }
      if (bowler) {
        addBowlerSpell(overall, bowler);
        addBowlerSpell(byFormat[format], bowler);
        addBowlerSpell(yearlySlices.get(year)!, bowler);
        addBowlerSpell(teamSlices.get(opponentTeam!)!, bowler);
        recentBowl.push(`${bowler.wickets}-${bowler.runs}`);
      }
      const field = fieldByMatch.get(inn.matchId) ?? { catches: 0, stumpings: 0, runOuts: 0 };
      for (const ev of inn.events.filter((e) => e.isWicket && !e.isUndone && e.fielderId === playerId)) {
        if (ev.dismissalType === 'CAUGHT') {
          overall.catches += 1;
          byFormat[format].catches += 1;
          field.catches += 1;
        }
        if (ev.dismissalType === 'STUMPED') {
          overall.stumpings += 1;
          byFormat[format].stumpings += 1;
          field.stumpings += 1;
        }
        if (ev.dismissalType === 'RUN_OUT' || ev.dismissalType === 'MANKAD') {
          overall.runOuts += 1;
          byFormat[format].runOuts += 1;
          field.runOuts += 1;
        }
      }
      fieldByMatch.set(inn.matchId, field);
      for (const ev of inn.events.filter((e) => !e.isUndone)) {
        const legal = isLegalBall(ev.extraType);
        if (legal && ev.strikerId === playerId) countRunBucket(faced, ev.batsmanRuns);
        if (legal && ev.bowlerId === playerId) countRunBucket(bowled, ev.batsmanRuns);
      }
      const wicket = inn.events.find((e) => e.isWicket && !e.isUndone && e.dismissedPlayerId === playerId);
      const batRow = batter
        ? {
            order: inn.match.players.find((p) => p.playerId === playerId)?.battingOrder || null,
            runs: batter.runs,
            balls: batter.balls,
            fours: batter.fours,
            sixes: batter.sixes,
            sr: strikeRate(batter.runs, batter.balls),
            dismissal: batter.isOut ? batter.dismissalType ?? wicket?.dismissalType ?? 'OUT' : batter.balls || batter.runs ? 'NOT_OUT' : null,
            dismissedBy: batter.isOut ? playerName(names, batter.bowlerId ?? wicket?.bowlerId) : null,
          }
        : null;
      const bowlRow = bowler
        ? {
            overs: formatOvers(bowler.balls, inn.match.ballsPerOver),
            runs: bowler.runs,
            maidens: bowler.maidens,
            wickets: bowler.wickets,
            eco: bowler.balls ? Number((bowler.runs / (bowler.balls / inn.match.ballsPerOver)).toFixed(1)) : 0,
          }
        : null;
      const existing = matches.find((m) => m.matchId === inn.matchId);
      if (existing) {
        if (batRow) existing.batting = batRow;
        if (bowlRow) existing.bowling = bowlRow;
        existing.fielding = field;
        existing.mvp = computeStreetMvp({
          runs: existing.batting?.runs ?? 0,
          ballsFaced: existing.batting?.balls ?? 0,
          wickets: existing.bowling?.wickets ?? 0,
          maidenOvers: bowlRow?.maidens ?? 0,
          catches: field.catches,
          stumpings: field.stumpings,
          runOuts: field.runOuts,
        });
      } else if (batter || bowler || played) {
        matches.push({
          matchId: inn.matchId,
          title: inn.match.title,
          format: inn.match.format,
          status: inn.match.status,
          when: inn.match.scheduledAt?.toISOString() ?? inn.match.createdAt.toISOString(),
          versus,
          homeName: inn.match.homeTeam.name,
          awayName: inn.match.awayTeam.name,
          venue: inn.match.venueText,
          result: inn.match.resultType,
          tournamentId: inn.match.tournamentId,
          tournamentName: inn.match.tournament?.name ?? null,
          batting: batRow,
          bowling: bowlRow,
          fielding: field,
          mvp: computeStreetMvp({
            runs: batRow?.runs ?? 0,
            ballsFaced: batRow?.balls ?? 0,
            wickets: bowlRow?.wickets ?? 0,
            maidenOvers: bowlRow?.maidens ?? 0,
            catches: field.catches,
            stumpings: field.stumpings,
            runOuts: field.runOuts,
          }),
        });
      }
    }

    const facedTotal = Object.values(faced).reduce((a, b) => a + b, 0);
    const bowledTotal = Object.values(bowled).reduce((a, b) => a + b, 0);
    const runTotal = faced[1] * 1 + faced[2] * 2 + faced[3] * 3 + faced[4] * 4 + faced[6] * 6;
    const mvp = computeStreetMvp({
      runs: overall.runs,
      ballsFaced: overall.balls,
      wickets: overall.wickets,
      maidenOvers: overall.maidens,
      catches: overall.catches,
      stumpings: overall.stumpings,
      runOuts: overall.runOuts,
    });

    const nowYear = new Date().getFullYear();
    const yearly = {
      thisYear: presentSlice(yearlySlices.get(nowYear) ?? emptySlice()),
      lastYear: presentSlice(yearlySlices.get(nowYear - 1) ?? emptySlice()),
    };
    const bestAgainstTeam = [...teamSlices.entries()]
      .map(([team, slice]) => ({ team, ...presentSlice(slice) }))
      .sort((a, b) => b.runs - a.runs);

    let playerOfMatchCount = 0;
    for (const m of matches) {
      if (m.status !== 'COMPLETED') continue;
      const slices = matchInningsSlices.get(m.matchId);
      if (!slices?.length) continue;
      const config = mvpConfigFromSnapshot(parseRuleSnapshot(matchRuleJson.get(m.matchId)));
      const rows = computeMatchMvp(mvpInputsFromInnings(slices), config);
      if (rows[0]?.playerId === playerId) playerOfMatchCount += 1;
    }

    return {
      overall,
      mvp,
      view: {
        tables: {
          overall: presentSlice(overall),
          byFormat: Object.fromEntries(PROFILE_FORMATS.map((f) => [f, presentSlice(byFormat[f])])),
        },
        matches: matches.reverse(),
        recent: {
          batting: recentBat.slice(-5).reverse(),
          bowling: recentBowl.slice(-5).reverse(),
        },
        yearly,
        bestAgainstTeam,
        playerOfMatchCount,
        insights: {
          batting: { buckets: faced, totalBalls: facedTotal, totalRuns: runTotal },
          bowling: { buckets: bowled, totalBalls: bowledTotal },
          positions: [...positions.entries()].map(([position, slice]) => ({
            position,
            ...presentSlice(slice),
          })),
        },
      },
    };
  }

  async matchPlayer(matchId: string, playerId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        homeTeam: true,
        awayTeam: true,
        tournament: { select: { id: true, name: true, season: true } },
        players: { include: { player: { select: { id: true, name: true } } } },
        innings: { include: { events: { orderBy: { sequence: 'asc' } }, battingTeam: true, bowlingTeam: true }, orderBy: { inningsNumber: 'asc' } },
        ruleSnapshot: true,
      },
    });
    if (!match) throw Errors.notFound('MATCH_NOT_FOUND', 'Match not found');
    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
      select: { id: true, name: true, photoUrl: true, profileCode: true, battingStyle: true, bowlingStyle: true },
    });
    if (!player) throw Errors.notFound('PLAYER_NOT_FOUND', 'Player not found');
    const profile = await this.build(playerId, { matchId });
    const names = new Map(match.players.map((p) => [p.playerId, p.player.name]));
    const slices = match.innings.map((inn) => {
      const snap = replayInnings(toScoringEvents(inn.events), this.scoring.replayOptions(match, inn));
      return {
        battingTeamName: inn.battingTeam.name,
        bowlingTeamName: inn.bowlingTeam.name,
        batters: snap.batters,
        bowlers: snap.bowlers,
        wickets: inn.events
          .filter((e) => e.isWicket && !e.isUndone)
          .map((e) => ({ dismissalType: e.dismissalType, fielderId: e.fielderId, bowlerId: e.bowlerId })),
      };
    });
    const config = mvpConfigFromSnapshot(parseRuleSnapshot(match.ruleSnapshot?.rulesJson));
    const mvpRows = computeMatchMvp(mvpInputsFromInnings(slices), config);
    const mvp = mvpRows.find((row) => row.playerId === playerId) ?? profile.mvp;
    const row = profile.view.matches[0] ?? null;
    const balls = match.innings.flatMap((inn) =>
      inn.events
        .filter((e) => eventInvolvesPlayer(e, playerId))
        .map((e) => ({
          inningsId: inn.id,
          inningsNumber: inn.inningsNumber,
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
          fielderId: e.fielderId,
          isUndone: e.isUndone,
          role:
            e.strikerId === playerId
              ? 'striker'
              : e.bowlerId === playerId
                ? 'bowler'
                : e.fielderId === playerId
                  ? 'fielder'
                  : e.dismissedPlayerId === playerId
                    ? 'dismissed'
                    : 'nonStriker',
        })),
    );
    const winner =
      match.resultWinnerTeamId === match.homeTeamId
        ? match.homeTeam.name
        : match.resultWinnerTeamId === match.awayTeamId
          ? match.awayTeam.name
          : null;
    return {
      match: {
        id: match.id,
        title: match.title,
        status: match.status,
        date: match.scheduledAt?.toISOString() ?? match.createdAt.toISOString(),
        venue: match.venueText,
        resultType: match.resultType,
        result: winner,
        homeTeam: { id: match.homeTeam.id, name: match.homeTeam.name, logoUrl: match.homeTeam.logoUrl },
        awayTeam: { id: match.awayTeam.id, name: match.awayTeam.name, logoUrl: match.awayTeam.logoUrl },
        tournament: match.tournament,
      },
      player,
      batting: row?.batting ?? null,
      bowling: row?.bowling ?? null,
      fielding: row?.fielding ?? { catches: 0, stumpings: 0, runOuts: 0 },
      mvp,
      balls,
      names: Object.fromEntries(names),
    };
  }
}
