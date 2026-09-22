import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Put, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { canAnonymousViewShare } from '@crickscore/shared';
import { MatchesService } from './matches.service';
import { ScoringService } from '../scoring/scoring.service';
import { OverRulesService } from './over-rules.service';
import { CurrentUser, OptionalUser, Public, type AuthUser } from '../common/auth.guard';
import { RequirePermission } from '../access/permission.guard';
import { renderScorecardPdf } from './scorecard-pdf';
import { Errors } from '../common/app-error';

@ApiTags('matches')
@ApiBearerAuth()
@Controller()
export class MatchesController {
  constructor(
    @Inject(MatchesService) private readonly matches: MatchesService,
    @Inject(ScoringService) private readonly scoring: ScoringService,
    @Inject(OverRulesService) private readonly overRuleSvc: OverRulesService,
  ) {}

  @Public()
  @Get('matches')
  list(@OptionalUser() user: AuthUser | null) {
    return this.matches.list(user);
  }

  @Post('matches')
  create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.matches.create(user, body);
  }

  @Public()
  @Get('matches/:id')
  get(@OptionalUser() user: AuthUser | null, @Param('id') id: string) {
    return this.matches.getForViewer(id, user);
  }

  @Patch('matches/:id')
  patch(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    return this.matches.update(user, id, body);
  }

  @Delete('matches/:id')
  @RequirePermission('MATCH_DELETE')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.matches.remove(user, id);
  }

  @Post('matches/:id/start')
  @RequirePermission('MATCH_MANAGE_TOSS')
  start(@Param('id') id: string) {
    return this.matches.start(id);
  }

  @Post('matches/:id/toss')
  @RequirePermission('MATCH_MANAGE_TOSS')
  toss(@Param('id') id: string, @Body() body: unknown) {
    return this.matches.toss(id, body);
  }

  @Post('matches/:id/innings')
  @RequirePermission('MATCH_SCORE')
  innings(@Param('id') id: string, @Body() body: unknown) {
    return this.matches.startInnings(id, body);
  }

  @Public()
  @Get('matches/:id/rules')
  matchRules(@OptionalUser() user: AuthUser | null, @Param('id') id: string) {
    return this.matches.rulesFor(id, { includeRules: Boolean(user) });
  }

  @Public()
  @Get('matches/:id/rule-evaluations')
  matchRuleEvals(@Param('id') id: string) {
    return this.matches.rulesFor(id, { includeRules: false });
  }

  @Public()
  @Get('matches/:id/playing-xi')
  async playingXi(@OptionalUser() user: AuthUser | null, @Param('id') id: string) {
    await this.matches.getForViewer(id, user);
    return this.matches.getPlayingXi(id);
  }

  @Put('matches/:id/playing-xi')
  @RequirePermission('MATCH_MANAGE_PLAYING_XI')
  savePlayingXi(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    return this.matches.putPlayingXi(user, id, body);
  }

  @Public()
  @Get('matches/:id/result')
  async result(@OptionalUser() user: AuthUser | null, @Param('id') id: string) {
    await this.matches.getForViewer(id, user);
    return this.matches.getResult(id);
  }

  @Post('matches/:id/pause')
  @RequirePermission('MATCH_SCORE')
  pause(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    return this.matches.pause(user, id, body);
  }

  @Post('matches/:id/resume')
  @RequirePermission('MATCH_SCORE')
  resume(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.matches.resume(user, id);
  }

  @Post('matches/:id/complete')
  @RequirePermission('MATCH_MANAGE_RESULT')
  complete(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    return this.matches.complete(user, id, body);
  }

  @Post('matches/:id/abandon')
  @RequirePermission('MATCH_MANAGE_RESULT')
  abandon(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.matches.abandon(user, id);
  }

  @Post('matches/:id/cancel')
  @RequirePermission('MATCH_MANAGE_RESULT')
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.matches.cancel(user, id);
  }

  @Post('matches/:id/tie/shared-points')
  @RequirePermission('MATCH_MANAGE_RESULT')
  resolveTieSharedPoints(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.matches.resolveTieSharedPoints(user, id);
  }

  @Post('matches/:id/super-over/start')
  @RequirePermission('MATCH_MANAGE_RESULT')
  startSuperOver(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.matches.startSuperOver(user, id);
  }

  @Post('matches/:id/draw')
  @RequirePermission('MATCH_MANAGE_RESULT')
  drawMatch(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.matches.drawMatch(user, id);
  }

  @Post('matches/:id/follow-on')
  @RequirePermission('MATCH_MANAGE_RESULT')
  decideFollowOn(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    return this.matches.decideFollowOn(user, id, body);
  }

  @Post('matches/:id/correction/unlock')
  @RequirePermission('MATCH_CORRECT_BALL')
  unlockCorrection(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.matches.unlockCorrection(user, id);
  }

  @Post('matches/:id/correction/lock')
  @RequirePermission('MATCH_CORRECT_BALL')
  lockCorrection(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.matches.lockCorrection(user, id);
  }

  @Get('matches/:id/corrections')
  @RequirePermission('MATCH_CORRECT_BALL')
  correctionHistory(@Param('id') id: string) {
    return this.scoring.listCorrections(id);
  }

  @Public()
  @Get('matches/:id/over-rules')
  overRules(@Param('id') id: string) {
    return this.overRuleSvc.list(id);
  }

  @Put('matches/:id/over-rules/:overNumber')
  @RequirePermission('MATCH_EDIT')
  upsertOverRule(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('overNumber') overNumber: string, @Body() body: unknown) {
    return this.overRuleSvc.upsertRule(user, id, Number(overNumber), body);
  }

  @Delete('matches/:id/over-rules/:overNumber')
  @RequirePermission('MATCH_EDIT')
  clearOverRule(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('overNumber') overNumber: string,
    @Query('ruleType') ruleType?: string,
  ) {
    return this.overRuleSvc.clearRule(user, id, Number(overNumber), ruleType);
  }

  @Post('matches/:id/over-rules/:overNumber/copy')
  @RequirePermission('MATCH_EDIT')
  copyOverRule(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('overNumber') overNumber: string, @Body() body: { toOver: number }) {
    return this.overRuleSvc.copyRule(user, id, Number(overNumber), Number(body?.toOver));
  }

  @Patch('innings/:inningsId/events/:eventId')
  @RequirePermission('MATCH_CORRECT_BALL', { inningsParam: 'inningsId' })
  correctBall(@CurrentUser() user: AuthUser, @Param('eventId') eventId: string, @Body() body: unknown) {
    return this.scoring.correctEvent(user, eventId, body);
  }

  @Delete('innings/:inningsId/events/:eventId')
  @RequirePermission('MATCH_CORRECT_BALL', { inningsParam: 'inningsId' })
  deleteBall(@CurrentUser() user: AuthUser, @Param('eventId') eventId: string, @Body() body: unknown) {
    return this.scoring.deleteEvent(user, eventId, body);
  }

  @Post('innings/:id/events/insert')
  @RequirePermission('MATCH_CORRECT_BALL', { inningsParam: 'id' })
  insertBall(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    return this.scoring.insertEvent(user, id, body);
  }

  @Public()
  @Get('matches/:id/innings')
  async listInnings(@OptionalUser() user: AuthUser | null, @Param('id') id: string) {
    const match = await this.matches.getForViewer(id, user);
    return match.innings;
  }

  @Public()
  @Get('matches/:id/live')
  async live(@OptionalUser() user: AuthUser | null, @Param('id') id: string) {
    const viewed = await this.matches.getForViewer(id, user);
    const live = await this.scoring.live(id);
    return {
      ...live,
      match: { ...live.match, myPermissions: 'myPermissions' in viewed ? viewed.myPermissions : [] },
    };
  }

  @Public()
  @Get('matches/:id/scorecard.pdf')
  async scorecardPdf(
    @OptionalUser() user: AuthUser | null,
    @Param('id') id: string,
    @Query('variant') variant: string | undefined,
    @Res() res: Response,
  ) {
    const viewed = await this.matches.getForViewer(id, user);
    if (!user) {
      const allowed = canAnonymousViewShare({
        visibility: viewed.visibility,
        feature: 'scorecard',
        publicScorecardEnabled: viewed.publicScorecardEnabled,
      });
      if (!allowed) throw Errors.notFound('MATCH_NOT_FOUND', 'This match is no longer available.');
    }
    const card = await this.scoring.scorecard(id);
    const meta = await this.scoring.reportMeta(id);
    const names = await this.scoring.namesForMatch(id);
    const innings = await Promise.all(
      card.innings.map(async (inn) => ({
        ...inn,
        events: await this.scoring.listEvents(inn.id),
      })),
    );
    const hattrickBonusRuns = await this.scoring.hattrickBonusRuns(id);
    const hattrickPenaltyRuns = await this.scoring.hattrickPenaltyRuns(id);
    const penaltiesEnabled = innings.some((inn) =>
      inn.events.some((e) => !e.isUndone && e.extraType === 'PENALTY' && e.extraRuns !== 0),
    );
    const mode = variant === 'summary' ? 'summary' : 'report';
    const pdf = renderScorecardPdf({
      match: {
        ...card.match,
        tournament: card.match.tournament
          ? { ...card.match.tournament, club: meta.tournamentClubName ? { name: meta.tournamentClubName } : null }
          : null,
      },
      innings,
      names,
      mvp: card.mvp,
      scorerName: meta.scorerName,
      matchRules: { hattrickBonusRuns, hattrickPenaltyRuns, penaltiesEnabled },
      variant: mode,
    });
    const filename = mode === 'summary' ? `Match_Summary-${id}.pdf` : `Match_Report-${id}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(pdf);
  }

  @Public()
  @Get('matches/:id/scorecard')
  async scorecard(@OptionalUser() user: AuthUser | null, @Param('id') id: string) {
    const viewed = await this.matches.getForViewer(id, user);
    const card = await this.scoring.scorecard(id);
    return {
      ...card,
      match: { ...card.match, myPermissions: 'myPermissions' in viewed ? viewed.myPermissions : [] },
    };
  }

  @Public()
  @Get('matches/:id/mvp')
  async mvp(@OptionalUser() user: AuthUser | null, @Param('id') id: string) {
    await this.matches.getForViewer(id, user);
    return this.scoring.matchMvp(id);
  }

  @Post('innings/:id/events')
  @RequirePermission('MATCH_SCORE', { inningsParam: 'id' })
  async events(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    await this.matches.assertCanScoreInnings(user, id);
    return this.scoring.applyEvent(id, body);
  }

  @Public()
  @Get('innings/:id/events')
  async listEvents(@OptionalUser() user: AuthUser | null, @Param('id') id: string) {
    await this.matches.assertCanViewInnings(user, id);
    return this.scoring.listEvents(id);
  }

  @Post('innings/:id/complete')
  @RequirePermission('MATCH_SCORE', { inningsParam: 'id' })
  async completeInnings(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    await this.matches.assertCanScoreInnings(user, id);
    const asDeclaration = Boolean((body as { asDeclaration?: boolean } | undefined)?.asDeclaration);
    return this.scoring.declareComplete(id, { asDeclaration });
  }

  @Patch('innings/:id')
  @RequirePermission('MATCH_SCORE', { inningsParam: 'id' })
  async patchInnings(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    await this.matches.assertCanScoreInnings(user, id);
    return this.matches.patchInnings(id, body);
  }

  @Post('innings/:id/undo')
  @RequirePermission('MATCH_UNDO', { inningsParam: 'id' })
  async undo(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.matches.assertCanUndoInnings(user, id);
    return this.scoring.undo(id);
  }
}
