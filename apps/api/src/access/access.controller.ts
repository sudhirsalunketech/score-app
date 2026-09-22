import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccessService } from './access.service';
import { CurrentUser, Public, type AuthUser } from '../common/auth.guard';
import { AuthService } from '../auth/auth.service';

@ApiTags('access')
@ApiBearerAuth()
@Controller()
export class AccessController {
  constructor(
    @Inject(AccessService) private readonly access: AccessService,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  @Get('matches/:id/access')
  listMatch(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.access.listMatchAccess(user, id);
  }

  @Post('matches/:id/access')
  grantMatch(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    return this.access.grantMatch(user, id, body);
  }

  @Patch('matches/:id/access/:accessId')
  patchMatch(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('accessId') accessId: string,
    @Body() body: unknown,
  ) {
    return this.access.patchMatchAccess(user, id, accessId, body);
  }

  @Delete('matches/:id/access/:accessId')
  revokeMatch(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('accessId') accessId: string) {
    return this.access.revokeMatchAccess(user, id, accessId);
  }

  @Post('matches/:id/invitations')
  inviteMatch(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    return this.access.invite(user, { ...(body as object), matchId: id });
  }

  @Get('tournaments/:id/access')
  listTournament(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.access.listTournamentAccess(user, id);
  }

  @Post('tournaments/:id/access')
  grantTournament(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    return this.access.grantTournament(user, id, body);
  }

  @Patch('tournaments/:id/access/:accessId')
  patchTournament(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('accessId') accessId: string,
    @Body() body: unknown,
  ) {
    return this.access.patchTournamentAccess(user, id, accessId, body);
  }

  @Delete('tournaments/:id/access/:accessId')
  revokeTournament(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('accessId') accessId: string) {
    return this.access.revokeTournamentAccess(user, id, accessId);
  }

  @Post('invitations')
  invite(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.access.invite(user, body);
  }

  @Public()
  @Get('invitations/:token')
  peek(@Param('token') token: string) {
    return this.access.peekInvite(token);
  }

  @Public()
  @Post('invitations/:token/accept')
  async accept(@Param('token') token: string, @Body() body: unknown) {
    const accepted = await this.access.acceptInvite(token, body);
    const user = await this.auth.login({ email: accepted.email, password: (body as { password: string }).password });
    return { ...user, matchId: accepted.matchId, tournamentId: accepted.tournamentId };
  }

  @Get('users/search')
  search(@CurrentUser() user: AuthUser, @Query('q') q?: string) {
    return this.access.searchPeople(user, q ?? '');
  }

  @Get('users/me/matches')
  myMatches(@CurrentUser() user: AuthUser) {
    return this.access.myMatches(user);
  }

  @Get('users/me/permissions')
  myPermissions(@CurrentUser() user: AuthUser) {
    return this.access.myPermissions(user);
  }

  @Get('users/me/access')
  myAccess(@CurrentUser() user: AuthUser) {
    return this.access.myAccess(user);
  }

  @Get('access/overview')
  overview(@CurrentUser() user: AuthUser) {
    return this.access.adminOverview(user);
  }

  @Get('access/logs')
  logs(@CurrentUser() user: AuthUser, @Query('entity') entity = 'Match', @Query('entityId') entityId = '') {
    return this.access.logs(user, entity, entityId);
  }
}
