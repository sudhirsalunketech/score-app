import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, OptionalUser, Public, type AuthUser } from '../common/auth.guard';
import { PlayerAccountService } from './player-account.service';
import { PlayerProfileService } from '../statistics/player-profile.service';
import { MatchesService } from '../matches/matches.service';
import { AccessService } from '../access/access.service';
import { PrismaService } from '../prisma/prisma.service';
import { Errors } from '../common/app-error';
import { isLinkShareable } from '@crickscore/shared';

@ApiTags('player-account')
@ApiBearerAuth()
@Controller()
export class PlayerAccountController {
  constructor(
    @Inject(PlayerAccountService) private readonly players: PlayerAccountService,
    @Inject(PlayerProfileService) private readonly profiles: PlayerProfileService,
    @Inject(MatchesService) private readonly matches: MatchesService,
    @Inject(AccessService) private readonly access: AccessService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  @Get('users/me/player')
  mePlayer(@CurrentUser() user: AuthUser) {
    return this.players.mePlayer(user);
  }

  @Get('users/me/teams')
  meTeams(@CurrentUser() user: AuthUser) {
    return this.players.meTeams(user);
  }

  @Get('users/me/tournaments')
  meTournaments(
    @CurrentUser() user: AuthUser,
    @Query('season') season?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.players.meTournaments(user, { season, page, limit });
  }

  @Get('users/me/played-matches')
  mePlayedMatches(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: string,
    @Query('tournamentId') tournamentId?: string,
    @Query('teamId') teamId?: string,
    @Query('season') season?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.players.mePlayedMatches(user, { status, tournamentId, teamId, season, from, to, page, limit });
  }

  @Public()
  @Get('players/:id/teams')
  playerTeams(@Param('id') id: string) {
    return this.players.playerTeams(id);
  }

  @Public()
  @Get('players/:id/matches')
  playerMatches(
    @Param('id') id: string,
    @Query('status') status?: string,
    @Query('tournamentId') tournamentId?: string,
    @Query('teamId') teamId?: string,
    @Query('season') season?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.players.playerMatches(id, { status, tournamentId, teamId, season, from, to, page, limit });
  }

  @Public()
  @Get('players/:id/tournaments')
  playerTournaments(
    @Param('id') id: string,
    @Query('season') season?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.players.playerTournaments(id, { season, page, limit });
  }

  @Public()
  @Get('teams/:id/matches')
  teamMatches(
    @OptionalUser() user: AuthUser | null,
    @Param('id') id: string,
    @Query('status') status?: string,
    @Query('tournamentId') tournamentId?: string,
    @Query('season') season?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.players.teamMatches(id, user, { status, tournamentId, season, from, to, page, limit });
  }

  @Public()
  @Get('teams/:id/tournaments')
  teamTournaments(
    @OptionalUser() user: AuthUser | null,
    @Param('id') id: string,
    @Query('season') season?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.players.teamTournaments(id, user, { season, page, limit });
  }

  @Public()
  @Get('players/:id/tournaments/:tournamentId/statistics')
  async playerTournamentStatistics(
    @OptionalUser() user: AuthUser | null,
    @Param('id') id: string,
    @Param('tournamentId') tournamentId: string,
  ) {
    const tn = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { id: true, visibility: true, createdById: true },
    });
    if (!tn) throw Errors.notFound('NOT_FOUND', 'Tournament not found');
    const allowed =
      isLinkShareable(tn.visibility) || (user ? await this.access.canTournament(user, tn.id, 'TOURNAMENT_VIEW') : false);
    if (!allowed) throw Errors.notFound('NOT_FOUND', 'Tournament not found');
    return this.players.tournamentStatistics(id, tournamentId);
  }

  @Public()
  @Get('matches/:matchId/players/:playerId/statistics')
  async matchPlayerStatistics(
    @OptionalUser() user: AuthUser | null,
    @Param('matchId') matchId: string,
    @Param('playerId') playerId: string,
  ) {
    await this.matches.getForViewer(matchId, user);
    return this.profiles.matchPlayer(matchId, playerId);
  }
}
