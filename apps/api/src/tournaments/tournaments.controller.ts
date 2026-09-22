import { Body, Controller, Delete, Get, Inject, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MatchStatus, Role, ShareVisibility } from '@prisma/client';
import { z } from 'zod';
import { computeGroupStandings, isLinkShareable, parseRuleSnapshot, rulesAffect } from '@crickscore/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser, OptionalUser, Public, Roles, type AuthUser } from '../common/auth.guard';
import { tournamentDiscoveryWhere } from '../share/visibility';
import { PublicLiveService } from '../public-live/public-live.service';
import { Errors } from '../common/app-error';
import { tournamentInclude } from '../domain/includes';
import { ScoringService } from '../scoring/scoring.service';
import { AccessService } from '../access/access.service';
import { RequirePermission } from '../access/permission.guard';
import { FanService } from '../fan/fan.service';
import { createTournamentSchema, patchTournamentSchema, toDate } from './tournament.schema';
import { buildTournamentDashboard, playerStatsFromDashboard } from './tournament-dashboard';
import { KnockoutService } from './knockout.service';
import { ManualMatchService } from './manual-match.service';
import { StatsPersistenceService } from '../statistics/stats-persistence.service';

@ApiTags('tournaments')
@ApiBearerAuth()
@Controller('tournaments')
export class TournamentsController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ScoringService) private readonly scoring: ScoringService,
    @Inject(PublicLiveService) private readonly live: PublicLiveService,
    @Inject(AccessService) private readonly access: AccessService,
    @Inject(FanService) private readonly fan: FanService,
    @Inject(KnockoutService) private readonly knockout: KnockoutService,
    @Inject(ManualMatchService) private readonly manualMatches: ManualMatchService,
    @Inject(StatsPersistenceService) private readonly stats: StatsPersistenceService,
  ) {}

  @Public()
  @Get()
  list(@OptionalUser() user: AuthUser | null) {
    return this.prisma.tournament.findMany({
      where: tournamentDiscoveryWhere(user),
      include: { _count: { select: { matches: true } }, groups: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SCORER, Role.TEAM_MANAGER, Role.PLAYER)
  async create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const input = createTournamentSchema.parse(body);
    const publicSlug = await this.live.uniqueTournamentSlug(input.name);
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.tournament.create({
        data: {
          name: input.name,
          clubId: input.clubId,
          season: input.season,
          coverImageUrl: input.coverImageUrl,
          startDate: toDate(input.startDate),
          endDate: toDate(input.endDate),
          visibility: input.visibility,
          defaultOvers: input.defaultOvers,
          defaultMaxWickets: input.defaultMaxWickets,
          defaultBallsPerOver: input.defaultBallsPerOver,
          defaultWidesCountAsLegal: input.defaultWidesCountAsLegal,
          defaultNoBallsCountAsLegal: input.defaultNoBallsCountAsLegal,
          defaultOverWiseRulesEnabled: input.defaultOverWiseRulesEnabled,
          defaultOverRules: input.defaultOverRules,
          winningBonusPoints: input.winningBonusPoints,
          stageType: input.stageType,
          knockoutTeamCount: input.knockoutTeamCount,
          includeThirdPlace: input.includeThirdPlace,
          pairingMode: input.pairingMode,
          createdById: user.id,
          publicSlug,
        },
        include: tournamentInclude,
      });
      if (input.fanQuiz) {
        await this.fan.syncTournamentQuizzes(tx, created.id, input.fanQuiz);
      }
      return created;
    });
  }

  @Patch(':id')
  @RequirePermission('TOURNAMENT_EDIT', { tournamentParam: 'id' })
  async patch(@Param('id') id: string, @Body() body: unknown) {
    const tn = await this.prisma.tournament.findUnique({ where: { id } });
    if (!tn) throw Errors.notFound('NOT_FOUND', 'Tournament not found');
    const input = patchTournamentSchema.parse(body);
    let publicSlug = tn.publicSlug;
    if (!publicSlug) publicSlug = await this.live.uniqueTournamentSlug(input.name ?? tn.name);
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.tournament.update({
        where: { id },
        data: {
          name: input.name,
          season: input.season,
          coverImageUrl: input.coverImageUrl,
          startDate: input.startDate !== undefined ? toDate(input.startDate) ?? null : undefined,
          endDate: input.endDate !== undefined ? toDate(input.endDate) ?? null : undefined,
          visibility: input.visibility,
          defaultOvers: input.defaultOvers,
          defaultMaxWickets: input.defaultMaxWickets,
          defaultBallsPerOver: input.defaultBallsPerOver,
          defaultWidesCountAsLegal: input.defaultWidesCountAsLegal,
          defaultNoBallsCountAsLegal: input.defaultNoBallsCountAsLegal,
          defaultOverWiseRulesEnabled: input.defaultOverWiseRulesEnabled,
          defaultOverRules: input.defaultOverRules,
          winningBonusPoints: input.winningBonusPoints,
          stageType: input.stageType,
          knockoutTeamCount: input.knockoutTeamCount,
          includeThirdPlace: input.includeThirdPlace,
          pairingMode: input.pairingMode,
          publicSlug,
        },
        include: tournamentInclude,
      });
      if (input.fanQuiz) {
        await this.fan.syncTournamentQuizzes(tx, id, input.fanQuiz, { seedQuestions: true });
      }
      return updated;
    });
  }

  @Delete(':id')
  @RequirePermission('TOURNAMENT_EDIT', { tournamentParam: 'id' })
  async remove(@Param('id') id: string) {
    const tn = await this.prisma.tournament.findUnique({ where: { id } });
    if (!tn) throw Errors.notFound('NOT_FOUND', 'Tournament not found');
    const startedMatch = await this.prisma.match.findFirst({
      where: {
        tournamentId: id,
        status: { notIn: [MatchStatus.DRAFT, MatchStatus.SCHEDULED, MatchStatus.TOSS_PENDING, MatchStatus.TOSS_COMPLETED] },
      },
      select: { id: true },
    });
    if (startedMatch) {
      throw Errors.conflict(
        'TOURNAMENT_HAS_PLAYED_MATCHES',
        'This tournament has a match that has already started or finished. Delete or reset that match first.',
      );
    }
    await this.prisma.$transaction([
      this.prisma.match.deleteMany({ where: { tournamentId: id } }),
      this.prisma.tournament.delete({ where: { id } }),
    ]);
    return { deleted: true };
  }

  @Public()
  @Get(':id/knockout')
  async knockoutBracket(@OptionalUser() user: AuthUser | null, @Param('id') id: string) {
    const tn = await this.prisma.tournament.findUnique({
      where: { id },
      select: { id: true, visibility: true, createdById: true },
    });
    if (!tn) throw Errors.notFound('NOT_FOUND', 'Tournament not found');
    if (!(await this.canViewTournament(user, tn))) throw Errors.notFound('NOT_FOUND', 'Tournament not found');
    return this.knockout.getBracket(id);
  }

  @Post(':id/knockout/generate')
  @RequirePermission('TOURNAMENT_MANAGE_MATCHES', { tournamentParam: 'id' })
  generateKnockout(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    return this.knockout.generate(user, id, body);
  }

  @Patch(':id/knockout')
  @RequirePermission('TOURNAMENT_EDIT', { tournamentParam: 'id' })
  patchKnockout(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    return this.knockout.patchConfig(user, id, body);
  }

  @Public()
  @Get(':id')
  async get(@OptionalUser() user: AuthUser | null, @Param('id') id: string) {
    const row = await this.prisma.tournament.findUnique({ where: { id }, include: tournamentInclude });
    if (!row) throw Errors.notFound('NOT_FOUND', 'Tournament not found');
    if (!(await this.canViewTournament(user, row))) throw Errors.notFound('NOT_FOUND', 'Tournament not found');
    const matches = user ? await this.access.attachMatchPermissions(user, row.matches ?? []) : row.matches;
    const myPermissions = user ? this.access.dtoPerms(await this.access.tournamentPermissions(user, id)) : [];
    return { ...row, matches, myPermissions };
  }

  @Post(':id/groups')
  @RequirePermission('TOURNAMENT_MANAGE_TEAMS', { tournamentParam: 'id' })
  async addGroup(@Param('id') id: string, @Body() body: unknown) {
    const name = z.object({ name: z.string().min(1) }).parse(body).name;
    const count = await this.prisma.tournamentGroup.count({ where: { tournamentId: id } });
    return this.prisma.tournamentGroup.create({
      data: { tournamentId: id, name, sortOrder: count },
      include: { teams: { include: { team: true } } },
    });
  }

  @Post(':id/groups/:gid/teams')
  @RequirePermission('TOURNAMENT_MANAGE_TEAMS', { tournamentParam: 'id' })
  async addTeam(@Param('id') id: string, @Param('gid') gid: string, @Body() body: unknown) {
    const teamId = z.object({ teamId: z.string() }).parse(body).teamId;
    const already = await this.prisma.tournamentGroupTeam.findFirst({
      where: { teamId, group: { tournamentId: id } },
    });
    if (already) throw Errors.conflict('TEAM_ALREADY_IN_TOURNAMENT', 'This team is already in the tournament.');
    return this.prisma.tournamentGroupTeam.create({
      data: { groupId: gid, teamId },
      include: { team: true },
    });
  }

  @Delete(':id/groups/:gid/teams/:teamId')
  @RequirePermission('TOURNAMENT_MANAGE_TEAMS', { tournamentParam: 'id' })
  async removeTeam(@Param('gid') gid: string, @Param('teamId') teamId: string) {
    const row = await this.prisma.tournamentGroupTeam.findUnique({
      where: { groupId_teamId: { groupId: gid, teamId } },
    });
    if (!row) throw Errors.notFound('NOT_FOUND', 'Team is not in this group');
    await this.prisma.tournamentGroupTeam.delete({ where: { id: row.id } });
    return { deleted: true };
  }

  @Delete(':id/groups/:gid')
  @RequirePermission('TOURNAMENT_MANAGE_TEAMS', { tournamentParam: 'id' })
  async removeGroup(@Param('id') id: string, @Param('gid') gid: string) {
    const group = await this.prisma.tournamentGroup.findFirst({ where: { id: gid, tournamentId: id } });
    if (!group) throw Errors.notFound('NOT_FOUND', 'Group not found');
    await this.prisma.tournamentGroup.delete({ where: { id: gid } });
    return { deleted: true };
  }

  @Get(':id/teams/:teamId/manual-matches')
  @RequirePermission('TOURNAMENT_MANAGE_TEAMS', { tournamentParam: 'id' })
  listManualMatches(@Param('id') id: string, @Param('teamId') teamId: string) {
    return this.manualMatches.list(id, teamId);
  }

  @Post(':id/teams/:teamId/manual-matches')
  @RequirePermission('TOURNAMENT_MANAGE_TEAMS', { tournamentParam: 'id' })
  async createManualMatch(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('teamId') teamId: string, @Body() body: unknown) {
    const row = await this.manualMatches.create(user, id, teamId, body);
    await this.prisma.$transaction((tx) => this.stats.refreshTournamentPoints(tx, id));
    return row;
  }

  @Patch(':id/teams/:teamId/manual-matches/:matchId')
  @RequirePermission('TOURNAMENT_MANAGE_TEAMS', { tournamentParam: 'id' })
  async updateManualMatch(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('teamId') teamId: string,
    @Param('matchId') matchId: string,
    @Body() body: unknown,
  ) {
    const row = await this.manualMatches.update(user, id, teamId, matchId, body);
    await this.prisma.$transaction((tx) => this.stats.refreshTournamentPoints(tx, id));
    return row;
  }

  @Delete(':id/teams/:teamId/manual-matches/:matchId')
  @RequirePermission('TOURNAMENT_MANAGE_TEAMS', { tournamentParam: 'id' })
  async deleteManualMatch(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('teamId') teamId: string, @Param('matchId') matchId: string) {
    const row = await this.manualMatches.remove(user, id, teamId, matchId);
    await this.prisma.$transaction((tx) => this.stats.refreshTournamentPoints(tx, id));
    return row;
  }

  @Post(':id/teams/:teamId/qualify-status')
  @RequirePermission('TOURNAMENT_MANAGE_TEAMS', { tournamentParam: 'id' })
  setQualifyStatus(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('teamId') teamId: string, @Body() body: unknown) {
    return this.manualMatches.setQualifyStatus(user, id, teamId, body);
  }

  @Public()
  @Get(':id/points-table')
  async points(@OptionalUser() user: AuthUser | null, @Param('id') id: string) {
    const tn = await this.prisma.tournament.findUnique({
      where: { id },
      include: {
        groups: { orderBy: { sortOrder: 'asc' }, include: { teams: { include: { team: true } } } },
        matches: { include: { innings: true, homeTeam: true, awayTeam: true, ruleSnapshot: true } },
      },
    });
    if (!tn) throw Errors.notFound('NOT_FOUND', 'Tournament not found');
    if (!(await this.canViewTournament(user, tn))) throw Errors.notFound('NOT_FOUND', 'Tournament not found');

    const completed = tn.matches.filter((m) => m.status === MatchStatus.COMPLETED);
    const manual = await this.manualMatches.standingInputs(id);
    const groups = tn.groups.map((g) => {
      const qualifyStatusByTeam = new Map(g.teams.map((gt) => [gt.teamId, gt.qualifyStatus]));
      const rows = computeGroupStandings(
        g.teams.map((gt) => ({
          teamId: gt.teamId,
          teamName: gt.team.name,
          logoUrl: gt.team.logoUrl,
        })),
        completed.map((m) => ({
          homeTeamId: m.homeTeamId,
          awayTeamId: m.awayTeamId,
          overs: m.overs,
          ballsPerOver: m.ballsPerOver,
          maxWickets: m.maxWickets,
          resultType: m.resultType,
          winnerTeamId: m.resultWinnerTeamId,
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
        })),
        { winningBonusPoints: tn.winningBonusPoints, tiePoints: tn.tiePoints },
        manual,
      );
      return {
        id: g.id,
        name: g.name,
        rows: rows.map((row) => ({ ...row, qualifyStatus: qualifyStatusByTeam.get(row.teamId) ?? null })),
      };
    });
    return groups;
  }

  @Public()
  @Get(':id/dashboard')
  async dashboard(@OptionalUser() user: AuthUser | null, @Param('id') id: string) {
    const tn = await this.prisma.tournament.findUnique({
      where: { id },
      select: { id: true, visibility: true, createdById: true },
    });
    if (!tn) throw Errors.notFound('NOT_FOUND', 'Tournament not found');
    if (!(await this.canViewTournament(user, tn))) throw Errors.notFound('NOT_FOUND', 'Tournament not found');
    const dash = await buildTournamentDashboard(this.prisma, this.scoring, id);
    if (!dash) throw Errors.notFound('NOT_FOUND', 'Tournament not found');
    return dash;
  }

  @Public()
  @Get(':id/players/:playerId/stats')
  async playerTournamentStats(
    @OptionalUser() user: AuthUser | null,
    @Param('id') id: string,
    @Param('playerId') playerId: string,
  ) {
    const tn = await this.prisma.tournament.findUnique({
      where: { id },
      select: { id: true, name: true, visibility: true, createdById: true },
    });
    if (!tn) throw Errors.notFound('NOT_FOUND', 'Tournament not found');
    if (!(await this.canViewTournament(user, tn))) throw Errors.notFound('NOT_FOUND', 'Tournament not found');
    const dash = await buildTournamentDashboard(this.prisma, this.scoring, id);
    if (!dash) throw Errors.notFound('NOT_FOUND', 'Tournament not found');
    const stats = playerStatsFromDashboard(dash, playerId);
    if (!stats) {
      return {
        tournamentId: id,
        tournamentName: tn.name,
        scope: 'tournament' as const,
        player: { playerId, playerName: 'Player', photoUrl: null, teamName: '' },
        matches: 0,
        innings: 0,
        runs: 0,
        balls: 0,
        average: null,
        strikeRate: 0,
        highest: 0,
        wickets: 0,
        economy: 0,
        bestBowling: null,
        overs: '0.0',
        catches: 0,
        runOuts: 0,
        stumpings: 0,
      };
    }
    return { ...stats, tournamentName: tn.name };
  }

  @Public()
  @Get(':id/home-stats')
  async homeStats(@OptionalUser() user: AuthUser | null, @Param('id') id: string) {
    const dash = await this.dashboard(user, id);
    const bat = dash.performers.bestBatsman;
    const bowl = dash.performers.bestBowler;
    return {
      mostRuns: bat ? { playerId: bat.playerId, playerName: bat.playerName, teamName: bat.teamName, value: bat.runs } : null,
      mostWickets: bowl
        ? { playerId: bowl.playerId, playerName: bowl.playerName, teamName: bowl.teamName, value: bowl.wickets }
        : null,
      sixes: dash.summary.sixes,
      fours: dash.summary.fours,
    };
  }

  private async canViewTournament(
    user: AuthUser | null,
    tournament: { id: string; visibility: ShareVisibility; createdById?: string | null },
  ) {
    if (isLinkShareable(tournament.visibility)) return true;
    return user ? this.access.canTournament(user, tournament.id, 'TOURNAMENT_VIEW') : false;
  }
}
