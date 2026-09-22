import { Controller, Get, Header, Inject, Param, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InningsStatus, MatchStatus } from '@prisma/client';
import type { Response } from 'express';
import { computeGroupStandings, isLinkShareable, parseRuleSnapshot, rulesAffect, socialPreviewHtml } from '@crickscore/shared';
import { Public } from '../common/auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { Errors } from '../common/app-error';
import { PublicLiveService } from './public-live.service';
import { StatisticsController } from '../statistics/statistics.controller';

@ApiTags('public')
@Public()
@Controller('public/tournaments')
export class PublicTournamentController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PublicLiveService) private readonly live: PublicLiveService,
    @Inject(StatisticsController) private readonly stats: StatisticsController,
  ) {}

  private async requirePublic(slug: string) {
    const tn = await this.prisma.tournament.findUnique({
      where: { publicSlug: slug },
      include: {
        club: true,
        groups: { orderBy: { sortOrder: 'asc' }, include: { teams: { include: { team: true } } } },
        matches: {
          include: {
            homeTeam: true,
            awayTeam: true,
            innings: { orderBy: { inningsNumber: 'asc' } },
            ruleSnapshot: true,
          },
          orderBy: { scheduledAt: 'desc' },
        },
      },
    });
    if (!tn || !isLinkShareable(tn.visibility)) throw Errors.notFound('NOT_FOUND', 'Tournament not found');
    return tn;
  }

  @Get(':slug')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate')
  async get(@Param('slug') slug: string) {
    const tn = await this.requirePublic(slug);
    return {
      publicSlug: tn.publicSlug,
      name: tn.name,
      season: tn.season,
      coverImageUrl: tn.coverImageUrl,
      startDate: tn.startDate,
      endDate: tn.endDate,
      clubName: tn.club?.name ?? null,
      visibility: tn.visibility,
      groups: tn.groups.map((g) => ({
        id: g.id,
        name: g.name,
        teams: g.teams.map((row) => ({
          teamId: row.teamId,
          name: row.team.name,
          shortName: row.team.shortName,
          logoUrl: row.team.logoUrl,
        })),
      })),
      matches: tn.matches.map((m) => {
        const shareable = isLinkShareable(m.visibility);
        const inn = m.innings.find((i) => i.status === InningsStatus.IN_PROGRESS) ?? m.innings[m.innings.length - 1];
        return {
          publicSlug: shareable ? m.publicSlug : null,
          title: m.title,
          status: m.status,
          scheduledAt: m.scheduledAt,
          venueText: m.venueText,
          overs: m.overs,
          format: m.format,
          homeTeam: { id: m.homeTeam.id, name: m.homeTeam.name, shortName: m.homeTeam.shortName, logoUrl: m.homeTeam.logoUrl },
          awayTeam: { id: m.awayTeam.id, name: m.awayTeam.name, shortName: m.awayTeam.shortName, logoUrl: m.awayTeam.logoUrl },
          watchLive: shareable && m.publicLiveEnabled,
          score:
            shareable && inn
              ? {
                  battingTeamId: inn.battingTeamId,
                  runs: inn.totalRuns,
                  wickets: inn.totalWickets,
                  overs: `${Math.floor(inn.totalBallsLegal / m.ballsPerOver)}.${inn.totalBallsLegal % m.ballsPerOver}`,
                }
              : null,
        };
      }),
    };
  }

  @Get(':slug/points')
  async points(@Param('slug') slug: string) {
    const tn = await this.requirePublic(slug);
    const completed = tn.matches.filter((m) => m.status === MatchStatus.COMPLETED);
    return tn.groups.map((g) => ({
      id: g.id,
      name: g.name,
      rows: computeGroupStandings(
        g.teams.map((gt) => ({ teamId: gt.teamId, teamName: gt.team.name, logoUrl: gt.team.logoUrl })),
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
              | { innings?: Array<{ inningsNumber: number; countedRuns: number }> }
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
      ),
    }));
  }

  @Get(':slug/mvp')
  async mvp(@Param('slug') slug: string) {
    const tn = await this.requirePublic(slug);
    return this.stats.publicCategory('mvp', tn.id);
  }

  @Get(':slug/stats')
  async statsHub(@Param('slug') slug: string, @Query('category') category = 'mostRuns') {
    const tn = await this.requirePublic(slug);
    return this.stats.publicCategory(category, tn.id);
  }

  @Get(':slug/preview')
  async preview(@Param('slug') slug: string, @Res() res: Response) {
    const tn = await this.requirePublic(slug);
    const origin = this.live.webOrigin();
    const url = `${origin}/tournament/${slug}`;
    const html = socialPreviewHtml({
      title: tn.name,
      description: `${tn.name}${tn.season ? ` · ${tn.season}` : ''}. Live scores, fixtures, points table, stats and MVP.`,
      url,
      image: tn.coverImageUrl || `${origin}/favicon.svg`,
      heading: tn.name,
    });
    res.status(200).type('html').send(html);
  }
}
