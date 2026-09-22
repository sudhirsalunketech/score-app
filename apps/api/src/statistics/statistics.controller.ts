import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { addMvpBreakdown, computeMatchMvp, computeStreetMvp, DEFAULT_MVP_CONFIG, formatOvers, isLinkShareable, mvpConfigFromSnapshot, mvpInputsFromInnings, parseRuleSnapshot, replayInnings, sanitizeMvpConfig } from '@crickscore/shared';
import { PrismaService } from '../prisma/prisma.service';
import { Errors } from '../common/app-error';
import { OptionalUser, Public, type AuthUser } from '../common/auth.guard';
import { AccessService } from '../access/access.service';
import { ScoringService } from '../scoring/scoring.service';
import { PlayerProfileService } from './player-profile.service';
import { bowlingAverage, economy, presentSlice } from './player-profile-stats';

type Acc = {
  playerId: string;
  playerName: string;
  teamName: string;
  runs: number;
  balls: number;
  wickets: number;
  maidens: number;
  dots: number;
  conceded: number;
  bowlBalls: number;
  highest: number;
  highestOut: boolean;
  fastest50?: number;
  fastest100?: number;
  catches: number;
  stumpings: number;
  runOuts: number;
  partnerships: { partnerId: string; partnerName: string; runs: number }[];
  bestWkts: number;
  bestRuns: number;
};

@ApiTags('statistics')
@ApiBearerAuth()
@Controller()
export class StatisticsController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ScoringService) private readonly scoring: ScoringService,
    @Inject(AccessService) private readonly access: AccessService,
    @Inject(PlayerProfileService) private readonly profiles: PlayerProfileService,
  ) {}

  @Public()
  @Get('statistics')
  async hub(@OptionalUser() user: AuthUser | null, @Query('category') category = 'mostRuns', @Query('tournamentId') tournamentId?: string) {
    if (tournamentId) {
      const tn = await this.prisma.tournament.findUnique({
        where: { id: tournamentId },
        select: { id: true, visibility: true, createdById: true },
      });
      if (!tn) throw Errors.notFound('NOT_FOUND', 'Tournament not found');
      const allowed =
        isLinkShareable(tn.visibility) || (user ? await this.access.canTournament(user, tn.id, 'TOURNAMENT_VIEW') : false);
      if (!allowed) throw Errors.notFound('NOT_FOUND', 'Tournament not found');
    }
    if (category === 'mvp') {
      return {
        rows: await this.mvpRows(tournamentId),
        mvp: await this.mvpConfigFor(tournamentId),
      };
    }
    const acc = await this.accumulate(tournamentId);
    const rows = this.rowsFor(category, acc);
    return rows;
  }

  async publicCategory(category: string, tournamentId: string) {
    if (category === 'mvp') {
      return {
        rows: await this.mvpRows(tournamentId),
        mvp: await this.mvpConfigFor(tournamentId),
      };
    }
    const acc = await this.accumulate(tournamentId);
    return this.rowsFor(category, acc);
  }

  @Public()
  @Get('players/:id/statistics')
  async playerStats(@Param('id') id: string) {
    const player = await this.prisma.player.findUnique({ where: { id }, include: { careerStats: true } });
    if (!player) throw Errors.notFound('PLAYER_NOT_FOUND', 'Player not found');
    const profile = await this.profiles.build(id);
    const career = player.careerStats;
    const totals = profile.overall;
    const slice = presentSlice(totals);
    const mvp = profile.mvp;
    return {
      playerId: id,
      career,
      batting: {
        matches: totals.matches,
        innings: totals.innings,
        runs: totals.runs,
        balls: totals.balls,
        average: slice.average,
        strikeRate: slice.sr,
        highest: totals.highest,
        fours: totals.fours,
        sixes: totals.sixes,
        fifties: totals.fifties,
        hundreds: totals.hundreds,
      },
      bowling: {
        matches: totals.matches,
        overs: formatOvers(totals.bowlBalls),
        balls: totals.bowlBalls,
        wickets: totals.wickets,
        runsConceded: totals.bowlRuns,
        economy: economy(totals.bowlRuns, totals.bowlBalls),
        average: bowlingAverage(totals.bowlRuns, totals.wickets),
        maidens: totals.maidens,
        dots: totals.dots,
        best: totals.bestWkts ? `${totals.bestWkts}-${totals.bestRuns}` : career && career.bestBowlWkts ? `${career.bestBowlWkts}-${career.bestBowlRuns}` : null,
        hatTricks: career?.hatTricks ?? 0,
      },
      fielding: {
        catches: totals.catches,
        stumpings: totals.stumpings,
        runOuts: totals.runOuts,
      },
      mvp: {
        batting: mvp.batting,
        bowling: mvp.bowling,
        fielding: mvp.fielding,
        total: mvp.total,
      },
      rows: [
        { playerName: 'Matches', value: totals.matches },
        { playerName: 'Runs', value: totals.runs },
        { playerName: 'Balls', value: totals.balls },
        { playerName: 'Wickets', value: totals.wickets },
        { playerName: 'Highest', value: totals.highest },
        { playerName: 'MVP', value: mvp.total },
      ],
      ...profile.view,
    };
  }

  @Public()
  @Get('teams/:id/statistics')
  async teamStats(@Param('id') id: string) {
    const team = await this.prisma.team.findUnique({ where: { id }, include: { stats: true } });
    if (!team) throw Errors.notFound('TEAM_NOT_FOUND', 'Team not found');
    const s = team.stats;
    return {
      matches: s?.matches ?? 0,
      wins: s?.wins ?? 0,
      losses: s?.losses ?? 0,
      ties: s?.ties ?? 0,
      noResults: s?.noResults ?? 0,
      winPct: s && s.matches ? Number(((s.wins / s.matches) * 100).toFixed(1)) : 0,
      runs: s?.runs ?? 0,
      wickets: s?.wickets ?? 0,
    };
  }

  private async accumulate(tournamentId?: string) {
    const innings = await this.prisma.innings.findMany({
      where: { isSuperOver: false, ...(tournamentId ? { match: { tournamentId } } : {}) },
      include: {
        events: { orderBy: { sequence: 'asc' } },
        match: true,
        battingTeam: true,
        bowlingTeam: true,
      },
    });
    const players = await this.prisma.player.findMany();
    const names = new Map(players.map((p) => [p.id, p.name]));
    const map = new Map<string, Acc>();
    const ensure = (id: string, teamName: string): Acc => {
      if (!map.has(id)) {
        map.set(id, {
          playerId: id,
          playerName: names.get(id) ?? 'Player',
          teamName,
          runs: 0,
          balls: 0,
          wickets: 0,
          maidens: 0,
          dots: 0,
          conceded: 0,
          bowlBalls: 0,
          highest: 0,
          highestOut: true,
          catches: 0,
          stumpings: 0,
          runOuts: 0,
          partnerships: [],
          bestWkts: 0,
          bestRuns: 99,
        });
      }
      return map.get(id)!;
    };

    for (const inn of innings) {
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
        this.scoring.replayOptions(inn.match, inn),
      );
      for (const b of snap.batters) {
        const a = ensure(b.playerId, inn.battingTeam.name);
        a.runs += b.runs;
        a.balls += b.balls;
        if (b.runs > a.highest) {
          a.highest = b.runs;
          a.highestOut = b.isOut;
        }
        if (b.runs >= 50 && (!a.fastest50 || b.balls < a.fastest50)) a.fastest50 = b.balls;
        if (b.runs >= 100 && (!a.fastest100 || b.balls < a.fastest100)) a.fastest100 = b.balls;
      }
      for (const bow of snap.bowlers) {
        const a = ensure(bow.playerId, inn.bowlingTeam.name);
        a.wickets += bow.wickets;
        a.maidens += bow.maidens;
        a.dots += bow.dots;
        a.conceded += bow.runs;
        a.bowlBalls += bow.balls;
        if (bow.wickets > a.bestWkts || (bow.wickets === a.bestWkts && bow.runs < a.bestRuns)) {
          a.bestWkts = bow.wickets;
          a.bestRuns = bow.runs;
        }
      }
      for (const ev of inn.events.filter((e) => e.isWicket && !e.isUndone)) {
        if (ev.dismissalType === 'CAUGHT') ensure(ev.bowlerId, inn.bowlingTeam.name).catches += 1;
        if (ev.dismissalType === 'STUMPED') ensure(ev.bowlerId, inn.bowlingTeam.name).stumpings += 1;
        if (ev.dismissalType === 'RUN_OUT' || ev.dismissalType === 'MANKAD') ensure(ev.bowlerId, inn.bowlingTeam.name).runOuts += 1;
      }
      if (snap.partnership) {
        const [a, b] = snap.partnership.batterIds;
        ensure(a, inn.battingTeam.name).partnerships.push({
          partnerId: b,
          partnerName: names.get(b) ?? 'Player',
          runs: snap.partnership.runs,
        });
      }
    }
    return map;
  }

  private async mvpConfigFor(tournamentId?: string) {
    if (!tournamentId) return DEFAULT_MVP_CONFIG;
    const enabledSet = await this.prisma.tournamentRuleSet.findFirst({
      where: { tournamentId, enabled: true },
      orderBy: { version: 'desc' },
    });
    const set =
      enabledSet ??
      (await this.prisma.tournamentRuleSet.findFirst({
        where: { tournamentId },
        orderBy: { version: 'desc' },
      }));
    return sanitizeMvpConfig(set?.mvpJson ?? DEFAULT_MVP_CONFIG);
  }

  private async mvpRows(tournamentId?: string) {
    const innings = await this.prisma.innings.findMany({
      where: { isSuperOver: false, ...(tournamentId ? { match: { tournamentId } } : {}) },
      include: {
        events: { orderBy: { sequence: 'asc' as const } },
        battingTeam: true,
        bowlingTeam: true,
        match: { include: { ruleSnapshot: true, players: { include: { player: true } } } },
      },
    });
    const byMatch = new Map<string, typeof innings>();
    for (const inn of innings) {
      const list = byMatch.get(inn.matchId) ?? [];
      list.push(inn);
      byMatch.set(inn.matchId, list);
    }
    const totals = new Map<string, { playerId: string; playerName: string; teamName: string; batting: number; bowling: number; fielding: number; total: number }>();
    for (const [, inns] of byMatch) {
      const match = inns[0]!.match;
      const names = new Map(match.players.map((p) => [p.playerId, p.player.name]));
      const config = mvpConfigFromSnapshot(parseRuleSnapshot(match.ruleSnapshot?.rulesJson));
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
          this.scoring.replayOptions(inn.match, inn),
        );
        return {
          battingTeamName: inn.battingTeam.name,
          bowlingTeamName: inn.bowlingTeam.name,
          batters: snap.batters,
          bowlers: snap.bowlers,
          wickets: inn.events.filter((e) => e.isWicket && !e.isUndone).map((e) => ({
            dismissalType: e.dismissalType,
            fielderId: e.fielderId,
            bowlerId: e.bowlerId,
          })),
          names,
        };
      });
      for (const row of computeMatchMvp(mvpInputsFromInnings(slices), config)) {
        const cur = totals.get(row.playerId);
        if (!cur) totals.set(row.playerId, { ...row });
        else {
          const next = addMvpBreakdown(cur, row);
          totals.set(row.playerId, { ...cur, ...next });
        }
      }
    }
    return [...totals.values()]
      .sort((a, b) => b.total - a.total)
      .map((x, i) => ({
        rank: i + 1,
        playerId: x.playerId,
        playerName: x.playerName,
        teamName: x.teamName,
        value: x.total,
        breakdown: { bat: x.batting, bowl: x.bowling, field: x.fielding },
      }));
  }

  private rowsFor(category: string, map: Map<string, Acc>) {
    const all = [...map.values()];
    const ranked = (rows: Acc[], value: (a: Acc) => number | string, extra?: (a: Acc) => Partial<{ starred: boolean; partnerName: string; breakdown: { bat: number; bowl: number; field: number } }>) =>
      rows
        .map((a, i) => ({
          rank: i + 1,
          playerId: a.playerId,
          playerName: a.playerName,
          teamName: a.teamName,
          value: value(a),
          ...(extra ? extra(a) : {}),
        }))
        .filter((r) => r.value !== 0 && r.value !== '0' && r.value !== '0-0');

    switch (category) {
      case 'mostWickets':
        return ranked(all.sort((a, b) => b.wickets - a.wickets), (a) => a.wickets);
      case 'highestScore':
        return ranked(
          all.sort((a, b) => b.highest - a.highest),
          (a) => a.highest,
          (a) => ({ starred: !a.highestOut }),
        );
      case 'bestBowl':
        return ranked(
          all.filter((a) => a.bestWkts > 0).sort((a, b) => b.bestWkts - a.bestWkts || a.bestRuns - b.bestRuns),
          (a) => `${a.bestWkts}-${a.bestRuns}`,
        );
      case 'bestEconomy':
        return ranked(
          all.filter((a) => a.bowlBalls >= 6).sort((a, b) => economy(a.conceded, a.bowlBalls) - economy(b.conceded, b.bowlBalls)),
          (a) => economy(a.conceded, a.bowlBalls).toFixed(1),
        );
      case 'mostMaidens':
        return ranked(all.sort((a, b) => b.maidens - a.maidens), (a) => a.maidens);
      case 'bowlDots':
        return ranked(all.sort((a, b) => b.dots - a.dots), (a) => a.dots);
      case 'fastest50':
        return ranked(
          all.filter((a) => a.fastest50).sort((a, b) => (a.fastest50 ?? 99) - (b.fastest50 ?? 99)),
          (a) => a.fastest50 ?? 0,
        );
      case 'fastest100':
        return ranked(
          all.filter((a) => a.fastest100).sort((a, b) => (a.fastest100 ?? 99) - (b.fastest100 ?? 99)),
          (a) => a.fastest100 ?? 0,
        );
      case 'bestPartnership':
        return all
          .flatMap((a) => a.partnerships.map((p) => ({ a, p })))
          .sort((x, y) => y.p.runs - x.p.runs)
          .slice(0, 20)
          .map((x, i) => ({
            rank: i + 1,
            playerName: x.a.playerName,
            partnerName: x.p.partnerName,
            teamName: x.a.teamName,
            value: x.p.runs,
          }));
      case 'mostBalls':
        return ranked(all.sort((a, b) => b.balls - a.balls), (a) => a.balls);
      case 'mvp':
        return all
          .map((a) => {
            const m = computeStreetMvp({
              runs: a.runs,
              ballsFaced: a.balls,
              wickets: a.wickets,
              maidenOvers: a.maidens,
              catches: a.catches,
              stumpings: a.stumpings,
              runOuts: a.runOuts,
            });
            return { a, m };
          })
          .sort((x, y) => y.m.total - x.m.total)
          .map((x, i) => ({
            rank: i + 1,
            playerId: x.a.playerId,
            playerName: x.a.playerName,
            teamName: x.a.teamName,
            value: x.m.total,
            breakdown: { bat: x.m.batting, bowl: x.m.bowling, field: x.m.fielding },
          }));
      case 'mostRuns':
      default:
        return ranked(all.sort((a, b) => b.runs - a.runs), (a) => a.runs);
    }
  }
}
