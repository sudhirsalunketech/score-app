import { Controller, Get, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { RealtimeModule } from './realtime/realtime.module';
import { JwtAuthGuard, Public, RolesGuard } from './common/auth.guard';
import { EnvelopeInterceptor } from './common/envelope.interceptor';
import { HttpErrorFilter } from './common/http-exception.filter';
import { UsersController } from './users/users.controller';
import { CatalogController } from './catalog/catalog.controller';
import { MatchesController } from './matches/matches.controller';
import { MatchesService } from './matches/matches.service';
import { ScoringService } from './scoring/scoring.service';
import { OverRulesService } from './matches/over-rules.service';
import { TournamentsController } from './tournaments/tournaments.controller';
import { TournamentRulesController } from './tournaments/rules.controller';
import { TournamentRulesService } from './tournaments/rules.service';
import { ManualMatchService } from './tournaments/manual-match.service';
import { StatisticsController } from './statistics/statistics.controller';
import { StatsPersistenceService } from './statistics/stats-persistence.service';
import { PlayerProfileService } from './statistics/player-profile.service';
import { PlayerAccountController } from './players/player-account.controller';
import { PlayerAccountService } from './players/player-account.service';
import { HomeController } from './home/home.controller';
import { PublicLiveController } from './public-live/public-live.controller';
import { PublicTournamentController } from './public-live/public-tournament.controller';
import { PublicLiveService } from './public-live/public-live.service';
import { AccessService } from './access/access.service';
import { AccessController } from './access/access.controller';
import { PermissionGuard } from './access/permission.guard';
import { BetaService } from './beta/beta.service';
import { BetaController } from './beta/beta.controller';
import { FanService } from './fan/fan.service';
import { FanController } from './fan/fan.controller';
import { UploadsController } from './uploads/uploads.controller';
import { FollowsController } from './follows/follows.controller';
import { KnockoutService } from './tournaments/knockout.service';
import { NotificationsService } from './notifications/notifications.service';
import { NotificationsController } from './notifications/notifications.controller';
import { publicConfig, appEnv } from './common/app-config';
import { isHighFrequencyScoringPath } from './common/scoring-throttle';

@Controller()
class HealthController {
  @Public()
  @Get('health')
  health() {
    return { status: 'ok', ok: true, name: 'CrickScore API' };
  }

  @Public()
  @Get('config')
  config() {
    return publicConfig();
  }
}

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 600,
        skipIf: (ctx) => {
          const req = ctx.switchToHttp().getRequest<{ originalUrl?: string; url?: string; headers?: Record<string, unknown> }>();
          if (isHighFrequencyScoringPath(req.originalUrl ?? req.url ?? '')) return true;
          const e2e = req.headers?.['x-e2e'] === '1' || req.headers?.['x-e2e'] === 'true';
          return e2e && appEnv() !== 'production';
        },
      },
    ]),
    PrismaModule,
    AuthModule,
    RealtimeModule,
  ],
  controllers: [
    HealthController,
    UsersController,
    CatalogController,
    MatchesController,
    TournamentsController,
    TournamentRulesController,
    StatisticsController,
    PlayerAccountController,
    HomeController,
    PublicLiveController,
    PublicTournamentController,
    AccessController,
    BetaController,
    FanController,
    UploadsController,
    FollowsController,
    NotificationsController,
  ],
  providers: [
    MatchesService,
    ScoringService,
    OverRulesService,
    PublicLiveService,
    StatsPersistenceService,
    PlayerProfileService,
    PlayerAccountService,
    TournamentRulesService,
    ManualMatchService,
    KnockoutService,
    NotificationsService,
    AccessService,
    BetaService,
    FanService,
    StatisticsController,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: EnvelopeInterceptor },
    { provide: APP_FILTER, useClass: HttpErrorFilter },
  ],
})
export class AppModule {}
