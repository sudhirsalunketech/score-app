import { Body, Controller, Get, Inject, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TournamentRulesService } from './rules.service';
import { CurrentUser, type AuthUser } from '../common/auth.guard';
import { RequirePermission } from '../access/permission.guard';

@ApiTags('tournament-rules')
@ApiBearerAuth()
@Controller('tournaments')
export class TournamentRulesController {
  constructor(@Inject(TournamentRulesService) private readonly rules: TournamentRulesService) {}

  @Get(':id/rules')
  @RequirePermission('TOURNAMENT_VIEW', { tournamentParam: 'id' })
  get(@Param('id') id: string) {
    return this.rules.getBundle(id);
  }

  @Post(':id/rulesets')
  @RequirePermission('TOURNAMENT_MANAGE_RULES', { tournamentParam: 'id' })
  create(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.rules.createVersion(user, id);
  }

  @Put(':id/rulesets/:version')
  @RequirePermission('TOURNAMENT_MANAGE_RULES', { tournamentParam: 'id' })
  save(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('version', ParseIntPipe) version: number,
    @Body() body: unknown,
  ) {
    return this.rules.saveRules(user, id, version, body);
  }

  @Post(':id/rulesets/:version/activate')
  @RequirePermission('TOURNAMENT_MANAGE_RULES', { tournamentParam: 'id' })
  activate(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('version', ParseIntPipe) version: number,
    @Body() body: unknown,
  ) {
    const enabled = body && typeof body === 'object' && 'enabled' in body ? Boolean((body as { enabled?: boolean }).enabled) : true;
    return this.rules.activate(user, id, version, enabled);
  }

  @Post(':id/rules/preview')
  @RequirePermission('TOURNAMENT_MANAGE_RULES', { tournamentParam: 'id' })
  preview(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    return this.rules.preview(user, id, body);
  }
}
