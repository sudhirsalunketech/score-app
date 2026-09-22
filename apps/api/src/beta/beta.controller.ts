import { Body, Controller, Get, Inject, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { BetaService } from './beta.service';
import { CurrentUser, Roles, type AuthUser } from '../common/auth.guard';

@ApiTags('beta')
@ApiBearerAuth()
@Controller('beta')
export class BetaController {
  constructor(@Inject(BetaService) private readonly beta: BetaService) {}

  @Get('welcome')
  welcome(@CurrentUser() user: AuthUser) {
    return this.beta.welcome(user);
  }

  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Get('testers')
  testers(@CurrentUser() user: AuthUser) {
    return this.beta.listTesters(user);
  }

  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Post('testers/invite')
  invite(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.beta.inviteTester(user, body);
  }

  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Post('testers/:userId/disable')
  disable(@CurrentUser() user: AuthUser, @Param('userId') userId: string) {
    return this.beta.setDisabled(user, userId, true);
  }

  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Post('testers/:userId/enable')
  enable(@CurrentUser() user: AuthUser, @Param('userId') userId: string) {
    return this.beta.setDisabled(user, userId, false);
  }

  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Post('invitations/:id/revoke')
  revokeInvite(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.beta.revokeInvitation(user, id);
  }

  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Get('feedback')
  listFeedback(@CurrentUser() user: AuthUser) {
    return this.beta.listFeedback(user);
  }

  @Post('feedback')
  createFeedback(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.beta.createFeedback(user, body);
  }

  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Patch('feedback/:id')
  patchFeedback(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    return this.beta.patchFeedback(user, id, body);
  }
}
