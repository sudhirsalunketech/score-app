import { Inject, Injectable } from '@nestjs/common';
import { ExtraType, InningsStatus } from '@prisma/client';
import {
  buildPublicLiveScore,
  canAnonymousViewShare,
  isLinkShareable,
  matchReplayOptions,
  ogMatchDescription,
  ogMatchTitle,
  publicBroadcastFromSettings,
  replayInnings,
  slugifyMatchTitle,
  slugifyName,
  socialPreviewHtml,
  withSlugSuffix,
  type PublicLiveScoreDto,
  type PublicMatchSummaryDto,
  type PublicTeamDto,
  type ScoringEvent,
  type ShareFeature,
} from '@crickscore/shared';
import { PrismaService } from '../prisma/prisma.service';
import { Errors } from '../common/app-error';
import { TournamentRulesService } from '../tournaments/rules.service';
import { matchInclude } from '../domain/includes';
import { RealtimeGateway } from '../realtime/realtime.gateway';

function teamDto(team: { id: string; name: string; shortName: string | null; logoUrl: string | null }): PublicTeamDto {
  return { id: team.id, name: team.name, shortName: team.shortName, logoUrl: team.logoUrl };
}

function toEvents(rows: {
  sequence: number;
  overNumber: number;
  ballInOver: number;
  strikerId: string;
  nonStrikerId: string;
  bowlerId: string;
  batsmanRuns: number;
  extraRuns: number;
  extraType: ExtraType;
  isWicket: boolean;
  dismissalType: ScoringEvent['dismissalType'];
  dismissedPlayerId: string | null;
  isUndone: boolean;
}[]): ScoringEvent[] {
  return rows.map((e) => ({
    sequence: e.sequence,
    overNumber: e.overNumber,
    ballInOver: e.ballInOver,
    strikerId: e.strikerId,
    nonStrikerId: e.nonStrikerId,
    bowlerId: e.bowlerId,
    batsmanRuns: e.batsmanRuns,
    extraRuns: e.extraRuns,
    extraType: e.extraType,
    isWicket: e.isWicket,
    dismissalType: e.dismissalType,
    dismissedPlayerId: e.dismissedPlayerId,
    isUndone: e.isUndone,
  }));
}

@Injectable()
export class PublicLiveService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TournamentRulesService) private readonly rules: TournamentRulesService,
    @Inject(RealtimeGateway) private readonly realtime: RealtimeGateway,
  ) {}

  async uniqueSlug(homeName: string, awayName: string): Promise<string> {
    const base = slugifyMatchTitle(homeName, awayName);
    const taken = await this.prisma.match.findUnique({ where: { publicSlug: base } });
    if (!taken) return base;
    for (let i = 0; i < 8; i += 1) {
      const candidate = withSlugSuffix(base, Math.random().toString(36).slice(2, 8));
      const hit = await this.prisma.match.findUnique({ where: { publicSlug: candidate } });
      if (!hit) return candidate;
    }
    return withSlugSuffix(base, Date.now().toString(36));
  }

  async uniqueTournamentSlug(name: string): Promise<string> {
    const base = slugifyName(name);
    const taken = await this.prisma.tournament.findUnique({ where: { publicSlug: base } });
    if (!taken) return base;
    for (let i = 0; i < 8; i += 1) {
      const candidate = withSlugSuffix(base, Math.random().toString(36).slice(2, 8));
      const hit = await this.prisma.tournament.findUnique({ where: { publicSlug: candidate } });
      if (!hit) return candidate;
    }
    return withSlugSuffix(base, Date.now().toString(36));
  }

  async requirePublic(slug: string, feature: ShareFeature = 'live') {
    const match = await this.prisma.match.findUnique({
      where: { publicSlug: slug },
      include: matchInclude,
    });
    if (!match || !isLinkShareable(match.visibility)) {
      throw Errors.notFound('MATCH_NOT_FOUND', 'Match not found');
    }
    if (feature !== 'live') {
      const allowed = canAnonymousViewShare({
        visibility: match.visibility,
        feature,
        publicLiveEnabled: true,
        publicScorecardEnabled: match.publicScorecardEnabled,
        publicStatsEnabled: match.publicStatsEnabled,
        publicMvpEnabled: match.publicMvpEnabled,
      });
      if (!allowed) throw Errors.forbidden('This view is not public');
    }
    return match;
  }

  async summary(slug: string): Promise<PublicMatchSummaryDto> {
    const match = await this.requirePublic(slug);
    return {
      publicSlug: match.publicSlug!,
      title: match.title,
      status: match.status,
      venueText: match.venueText,
      tournamentName: match.tournament?.name ?? null,
      scheduledAt: match.scheduledAt?.toISOString() ?? null,
      homeTeam: teamDto(match.homeTeam),
      awayTeam: teamDto(match.awayTeam),
      youtube: {
        enabled: match.youtubeEnabled && Boolean(match.youtubeVideoId),
        videoId: match.youtubeEnabled ? match.youtubeVideoId : null,
      },
      publicLiveEnabled: match.publicLiveEnabled,
    };
  }

  async live(slug: string): Promise<PublicLiveScoreDto> {
    const match = await this.requirePublic(slug);
    return this.compose(match.id);
  }

  async compose(matchId: string): Promise<PublicLiveScoreDto> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: matchInclude,
    });
    if (!match) throw Errors.notFound('MATCH_NOT_FOUND', 'Match not found');
    const innings =
      [...match.innings].reverse().find((i) => i.status === InningsStatus.IN_PROGRESS) ??
      match.innings[match.innings.length - 1] ??
      null;
    const allEvents = innings
      ? await this.prisma.ballEvent.findMany({
          where: { inningsId: innings.id, isUndone: false },
          orderBy: { sequence: 'asc' },
        })
      : [];
    const snapshot = innings
      ? replayInnings(toEvents(allEvents), matchReplayOptions(match, innings.targetRuns, innings))
      : null;
    const recent = allEvents.slice(-18);
    const xi = match.players.filter((p) => p.isPlaying);
    const players = (xi.length
      ? xi.map((p) => ({ id: p.player.id, name: p.player.name }))
      : [
          ...match.homeTeam.players.map((p) => ({ id: p.player.id, name: p.player.name })),
          ...match.awayTeam.players.map((p) => ({ id: p.player.id, name: p.player.name })),
        ]
    );
    const xiRow = (teamId: string) =>
      xi
        .filter((p) => p.teamId === teamId)
        .map((p) => ({
          id: p.player.id,
          name: p.player.name,
          isCaptain: p.isCaptain,
          isWicketKeeper: p.isWicketKeeper,
          photoUrl: p.player.photoUrl,
        }));
    const overlay = await this.rules.liveOverlay(matchId);
    const inningsScores = match.innings.map((inn) => {
      const counted = overlay?.innings.find((row) => row.inningsNumber === inn.inningsNumber)?.countedRuns;
      return {
        battingTeamId: inn.battingTeamId,
        bowlingTeamId: inn.bowlingTeamId,
        inningsNumber: inn.inningsNumber,
        runs: overlay?.affectsMatchResult && counted != null ? counted : inn.totalRuns,
        wickets: inn.totalWickets,
        overs: `${Math.floor(inn.totalBallsLegal / match.ballsPerOver)}.${inn.totalBallsLegal % match.ballsPerOver}`,
      };
    });
    const customRules = overlay
      ? {
          active: overlay.active,
          summary: overlay.summary,
          lastBall: overlay.lastBall,
          score: overlay.score,
          affectsMatchResult: Boolean(overlay.affectsMatchResult),
          balls: overlay.evaluations
            .filter((e) => e.originalRuns !== e.countedRuns)
            .map((e) => ({ sequence: e.sequence, actual: e.originalRuns, counted: e.countedRuns })),
        }
      : null;
    const displaySnap =
      snapshot && customRules?.affectsMatchResult && customRules.score
        ? { ...snapshot, totalRuns: customRules.score.counted }
        : snapshot;
    return buildPublicLiveScore({
      matchId: match.id,
      publicSlug: match.publicSlug,
      title: match.title,
      status: match.status,
      venueText: match.venueText,
      tournamentName: match.tournament?.name ?? null,
      tournamentLogoUrl: match.tournament?.coverImageUrl ?? null,
      broadcast: publicBroadcastFromSettings(match.settings),
      oversLimit: match.overs,
      maxWickets: match.maxWickets,
      ballsPerOver: match.ballsPerOver,
      homeTeam: teamDto(match.homeTeam),
      awayTeam: teamDto(match.awayTeam),
      battingTeamId: innings?.battingTeamId ?? null,
      bowlingTeamId: innings?.bowlingTeamId ?? null,
      inningsId: innings?.id ?? null,
      inningsNumber: innings?.inningsNumber ?? null,
      snapshot: displaySnap,
      players,
      recentEvents: recent.map((e) => ({
        sequence: e.sequence,
        overNumber: e.overNumber,
        ballInOver: e.ballInOver,
        batsmanRuns: e.batsmanRuns,
        extraRuns: e.extraRuns,
        extraType: e.extraType,
        isWicket: e.isWicket,
        commentary: e.commentary,
        bowlerId: e.bowlerId,
        strikerId: e.strikerId,
        dismissalType: e.dismissalType,
      })),
      youtubeVideoId: match.youtubeVideoId,
      youtubeEnabled: match.youtubeEnabled,
      result:
        match.resultType || inningsScores.length
          ? {
              resultType: match.resultType,
              winnerTeamId: match.resultWinnerTeamId,
              marginType: match.marginType,
              marginValue: match.marginValue,
              innings: inningsScores,
            }
          : null,
      customRules,
      scheduledAt: match.scheduledAt?.toISOString() ?? null,
      tournamentSlug: match.tournament?.publicSlug ?? null,
      visibility: match.visibility,
      share: {
        live: match.publicLiveEnabled,
        scorecard: match.publicScorecardEnabled,
        stats: match.publicStatsEnabled,
        mvp: match.publicMvpEnabled,
      },
      viewerCount: this.realtime.publicViewerCount(match.id),
      playingXi: {
        home: xiRow(match.homeTeamId),
        away: xiRow(match.awayTeamId),
      },
      format: match.format,
      toss: match.tossWinnerTeamId ? { winnerTeamId: match.tossWinnerTeamId, decision: match.tossDecision } : null,
    });
  }

  webOrigin() {
    return (process.env.WEB_ORIGIN || 'http://localhost:5173').split(',')[0]!.replace(/\/$/, '');
  }

  async previewHtml(slug: string) {
    const match = await this.requirePublic(slug);
    const dto = await this.compose(match.id);
    const url = `${this.webOrigin()}/live/${slug}`;
    return socialPreviewHtml({
      title: ogMatchTitle(dto.homeTeam.name, dto.awayTeam.name, dto.status),
      description: ogMatchDescription({
        tournamentName: dto.tournamentName,
        runs: dto.score.runs,
        wickets: dto.score.wickets,
        overs: dto.score.overs,
        status: dto.status,
      }),
      url,
      image: `${this.webOrigin()}/favicon.svg`,
      heading: dto.status === 'LIVE' || dto.status === 'INNINGS_BREAK' ? 'Watch Live Score' : dto.title,
    });
  }

  async publicEvents(slug: string, inningsNumber?: number) {
    const match = await this.requirePublic(slug, 'scorecard');
    const innings =
      inningsNumber != null
        ? match.innings.find((i) => i.inningsNumber === inningsNumber)
        : [...match.innings].reverse().find((i) => i.status === InningsStatus.IN_PROGRESS) ??
          match.innings[match.innings.length - 1];
    if (!innings) return [];
    return this.prisma.ballEvent.findMany({
      where: { inningsId: innings.id, isUndone: false },
      orderBy: { sequence: 'asc' },
    });
  }
}
