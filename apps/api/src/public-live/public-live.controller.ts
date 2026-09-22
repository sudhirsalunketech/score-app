import { Header, Inject, Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../common/auth.guard';
import { PublicLiveService } from './public-live.service';
import { ScoringService } from '../scoring/scoring.service';

@ApiTags('public')
@Public()
@Controller('public/matches')
export class PublicLiveController {
  constructor(
    @Inject(PublicLiveService) private readonly live: PublicLiveService,
    @Inject(ScoringService) private readonly scoring: ScoringService,
  ) {}

  @Get(':slug/live')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate')
  @Header('Pragma', 'no-cache')
  liveScore(@Param('slug') slug: string, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    return this.live.live(slug);
  }

  @Get(':slug/scorecard')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate')
  async scorecard(@Param('slug') slug: string) {
    const match = await this.live.requirePublic(slug, 'scorecard');
    return this.scoring.scorecard(match.id);
  }

  @Get(':slug/mvp')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate')
  async mvp(@Param('slug') slug: string) {
    const match = await this.live.requirePublic(slug, 'mvp');
    return this.scoring.matchMvp(match.id);
  }

  @Get(':slug/stats')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate')
  async stats(@Param('slug') slug: string) {
    await this.live.requirePublic(slug, 'stats');
    return this.live.live(slug);
  }

  @Get(':slug/events')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate')
  events(@Param('slug') slug: string, @Query('innings') innings?: string) {
    const n = innings ? Number(innings) : undefined;
    return this.live.publicEvents(slug, Number.isFinite(n) ? n : undefined);
  }

  @Get(':slug/preview')
  async preview(@Param('slug') slug: string, @Res() res: Response) {
    const html = await this.live.previewHtml(slug);
    res.status(200).type('html').send(html);
  }

  @Get(':slug')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate')
  @Header('Pragma', 'no-cache')
  summary(@Param('slug') slug: string, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    return this.live.summary(slug);
  }
}
