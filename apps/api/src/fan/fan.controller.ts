import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { FanQuestionKind } from '@prisma/client';
import { FanService } from './fan.service';
import { CurrentUser, OptionalUser, Public, type AuthUser } from '../common/auth.guard';

@ApiTags('fan')
@ApiBearerAuth()
@Controller()
export class FanController {
  constructor(@Inject(FanService) private readonly fan: FanService) {}

  @Public()
  @Get('matches/:id/fan')
  overview(@OptionalUser() user: AuthUser | null, @Param('id') id: string) {
    return this.fan.overview(user, id);
  }

  @Public()
  @Get('matches/:id/chat')
  chat(@OptionalUser() user: AuthUser | null, @Param('id') id: string) {
    return this.fan.listChat(user, id);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('matches/:id/chat')
  postChat(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    return this.fan.postChat(user, id, body);
  }

  @Delete('chat/:messageId')
  deleteChat(@CurrentUser() user: AuthUser, @Param('messageId') messageId: string) {
    return this.fan.deleteChat(user, messageId);
  }

  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post('chat/:messageId/react')
  react(@CurrentUser() user: AuthUser, @Param('messageId') messageId: string, @Body() body: unknown) {
    return this.fan.reactChat(user, messageId, body);
  }

  @Post('chat/:messageId/report')
  report(@CurrentUser() user: AuthUser, @Param('messageId') messageId: string, @Body() body: unknown) {
    return this.fan.reportChat(user, messageId, body);
  }

  @Post('chat/:messageId/mute')
  mute(@CurrentUser() user: AuthUser, @Param('messageId') messageId: string) {
    return this.fan.muteOrBlock(user, messageId, false);
  }

  @Post('chat/:messageId/block')
  block(@CurrentUser() user: AuthUser, @Param('messageId') messageId: string) {
    return this.fan.muteOrBlock(user, messageId, true);
  }

  @Get('fan/moderation/reports')
  reports(@CurrentUser() user: AuthUser, @Query('matchId') matchId?: string) {
    return this.fan.listReports(user, matchId);
  }

  @Post('fan/moderation/reports/:id/dismiss')
  dismiss(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.fan.dismissReport(user, id);
  }

  @Public()
  @Get('matches/:id/predictions')
  matchPredictions(@OptionalUser() user: AuthUser | null, @Param('id') id: string) {
    return this.fan.listQuestions(user, { matchId: id, kind: FanQuestionKind.PREDICTION });
  }

  @Public()
  @Get('tournaments/:id/predictions')
  tournamentPredictions(@OptionalUser() user: AuthUser | null, @Param('id') id: string) {
    return this.fan.listQuestions(user, { tournamentId: id, kind: FanQuestionKind.PREDICTION });
  }

  @Public()
  @Get('matches/:id/quizzes')
  matchQuizzes(@OptionalUser() user: AuthUser | null, @Param('id') id: string) {
    return this.fan.listQuestions(user, { matchId: id, kind: FanQuestionKind.QUIZ });
  }

  @Public()
  @Get('tournaments/:id/quizzes')
  tournamentQuizzes(@OptionalUser() user: AuthUser | null, @Param('id') id: string) {
    return this.fan.listQuestions(user, { tournamentId: id, kind: FanQuestionKind.QUIZ });
  }

  @Public()
  @Get('matches/:id/fan/quiz')
  matchFanQuiz(@OptionalUser() user: AuthUser | null, @Param('id') id: string) {
    return this.fan.playQuiz(user, { matchId: id });
  }

  @Public()
  @Get('tournaments/:id/fan/quiz')
  tournamentFanQuiz(@OptionalUser() user: AuthUser | null, @Param('id') id: string) {
    return this.fan.playQuiz(user, { tournamentId: id });
  }

  @Get('tournaments/:id/fan/quiz/preview')
  previewTournamentQuiz(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.fan.playQuiz(user, { tournamentId: id, preview: true });
  }

  @Get('matches/:id/fan/quiz/preview')
  previewMatchQuiz(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.fan.playQuiz(user, { matchId: id, preview: true });
  }

  @Get('tournaments/:id/fan/quiz/questions')
  adminQuizQuestions(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.fan.listAdminQuestions(user, { tournamentId: id });
  }

  @Get('tournaments/:id/fan/quiz/results')
  quizResults(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.fan.quizResults(user, id);
  }

  @Post('tournaments/:id/fan/quiz/reorder')
  reorderQuiz(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    return this.fan.reorderQuestions(user, id, body);
  }

  @Public()
  @Get('fan/questions/:id')
  question(@OptionalUser() user: AuthUser | null, @Param('id') id: string) {
    return this.fan.getQuestion(user, id);
  }

  @Post('predictions/:id/answer')
  predict(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    return this.fan.answer(user, id, body);
  }

  @Post('quizzes/:id/answer')
  quizAnswer(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    return this.fan.answer(user, id, body);
  }

  @Post('fan/questions')
  create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.fan.createQuestion(user, body);
  }

  @Patch('fan/questions/:id')
  updateQuestion(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    return this.fan.updateQuestion(user, id, body);
  }

  @Delete('fan/questions/:id')
  deleteQuestion(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.fan.deleteQuestion(user, id);
  }

  @Post('fan/questions/:id/cancel')
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.fan.cancelQuestion(user, id);
  }

  @Post('fan/questions/:id/settle')
  settle(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    return this.fan.settleManual(user, id, body);
  }

  @Public()
  @Get('matches/:id/leaderboard')
  matchBoard(@OptionalUser() user: AuthUser | null, @Param('id') id: string) {
    return this.fan.leaderboard({ matchId: id }, user);
  }

  @Public()
  @Get('tournaments/:id/leaderboard')
  tournamentBoard(@OptionalUser() user: AuthUser | null, @Param('id') id: string) {
    return this.fan.leaderboard({ tournamentId: id }, user);
  }

  @Public()
  @Get('leaderboard/global')
  globalBoard(@OptionalUser() user: AuthUser | null) {
    return this.fan.leaderboard({}, user);
  }

  @Get('users/me/fan-profile')
  profile(@CurrentUser() user: AuthUser) {
    return this.fan.myProfile(user);
  }

  @Get('users/me/fan-points')
  points(@CurrentUser() user: AuthUser) {
    return this.fan.myProfile(user);
  }

  @Get('matches/:id/fan/settings')
  async matchSettings(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.fan.assertFanManageMatch(user, id);
    return this.fan.matchSettings(id);
  }

  @Patch('matches/:id/fan/settings')
  patchMatchSettings(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    return this.fan.patchMatchSettings(user, id, body);
  }

  @Get('tournaments/:id/fan/settings')
  async tournamentSettings(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.fan.assertFanManageTournament(user, id);
    return this.fan.tournamentSettings(id);
  }

  @Get('tournaments/:id/fan/quiz-configs')
  listTournamentQuizzes(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.fan.listTournamentQuizzes(user, id);
  }

  @Patch('tournaments/:id/fan/settings')
  patchTournamentSettings(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    return this.fan.patchTournamentSettings(user, id, body);
  }

  @Post('fan/points/adjust')
  adjust(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.fan.adjustPoints(user, body);
  }
}
