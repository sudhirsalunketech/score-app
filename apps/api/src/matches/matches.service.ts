import { Inject, Injectable } from '@nestjs/common';
import { BallType, InningsStatus, MatchFormat, MatchMarginType, MatchResultType, MatchStatus, Prisma, ShareVisibility, TossDecision } from '@prisma/client';
import { z } from 'zod';
import { computeFollowOnAvailability, computeLeadTrail, computeMatchResult, computeTestMatchResult, extractYoutubeVideoId, followOnThreshold, isLinkShareable, LIVE_SOCKET, minOversFromProgress, minWicketsFromProgress, playingXiLocked, resultIsIdempotent, validatePlayingXi } from '@crickscore/shared';
import { PrismaService } from '../prisma/prisma.service';
import { Errors } from '../common/app-error';
import { matchInclude } from '../domain/includes';
import { assertTransition, matchIsPaused } from '../domain/lifecycle';
import { isMatchStructureLocked, STRUCTURE_LOCKED_MESSAGE } from '../domain/structure-lock';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { PublicLiveService } from '../public-live/public-live.service';
import { StatsPersistenceService } from '../statistics/stats-persistence.service';
import { TournamentRulesService } from '../tournaments/rules.service';
import type { AuthUser } from '../common/auth.guard';
import { AccessService } from '../access/access.service';
import { canForcePlayingXi } from './scoring-access';
import { matchDiscoveryWhere } from '../share/visibility';
import { KnockoutService } from '../tournaments/knockout.service';
import { NotificationsService } from '../notifications/notifications.service';

function parseDate(value?: string) {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

const createSchema = z.object({
  homeTeamId: z.string(),
  awayTeamId: z.string(),
  format: z.nativeEnum(MatchFormat).optional(),
  overs: z.number().int().min(1).max(90).optional(),
  ballsPerOver: z.number().int().min(4).max(8).optional(),
  maxWickets: z.number().int().min(1).max(10).optional(),
  playingPerSide: z.number().int().min(2).max(11).optional(),
  ballType: z.nativeEnum(BallType).optional(),
  venueText: z.string().optional(),
  tournamentId: z.string().optional(),
  scheduledAt: z.string().optional(),
  settings: z.record(z.unknown()).optional(),
  publicLiveEnabled: z.boolean().optional(),
  visibility: z.nativeEnum(ShareVisibility).optional(),
  publicScorecardEnabled: z.boolean().optional(),
  publicStatsEnabled: z.boolean().optional(),
  publicMvpEnabled: z.boolean().optional(),
  youtubeUrl: z.string().max(500).optional().nullable(),
  youtubeEnabled: z.boolean().optional(),
  overWiseRulesEnabled: z.boolean().optional(),
});

@Injectable()
export class MatchesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RealtimeGateway) private readonly realtime: RealtimeGateway,
    @Inject(PublicLiveService) private readonly publicLive: PublicLiveService,
    @Inject(StatsPersistenceService) private readonly stats: StatsPersistenceService,
    @Inject(TournamentRulesService) private readonly rules: TournamentRulesService,
    @Inject(AccessService) private readonly access: AccessService,
    @Inject(KnockoutService) private readonly knockout: KnockoutService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {}

  private async scoringEventCount(matchId: string) {
    return this.prisma.ballEvent.count({
      where: { isUndone: false, innings: { matchId } },
    });
  }

  async list(user: AuthUser | null) {
    const rows = await this.prisma.match.findMany({
      where: matchDiscoveryWhere(user),
      include: matchInclude,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return this.access.attachMatchPermissions(user, rows);
  }

  async get(id: string) {
    const match = await this.prisma.match.findUnique({ where: { id }, include: matchInclude });
    if (!match) throw Errors.notFound('MATCH_NOT_FOUND', 'Match not found');
    return match;
  }

  async getForViewer(id: string, user: AuthUser | null) {
    const match = await this.get(id);
    const allowed = isLinkShareable(match.visibility) || (user ? await this.access.canMatch(user, id, 'MATCH_VIEW') : false);
    if (!allowed) throw Errors.notFound('MATCH_NOT_FOUND', 'This match is no longer available.');
    const perms = user ? this.access.dtoPerms(await this.access.matchPermissions(user, id)) : [];
    if (!user) {
      const { settings: _settings, ...rest } = match;
      return rest;
    }
    return { ...match, myPermissions: perms };
  }

  async create(user: AuthUser, body: unknown) {
    const input = createSchema.parse(body);
    let tournamentDefaults: {
      defaultOvers: number | null;
      defaultMaxWickets: number | null;
      defaultBallsPerOver: number | null;
      defaultWidesCountAsLegal: boolean;
      defaultNoBallsCountAsLegal: boolean;
      defaultOverWiseRulesEnabled: boolean;
      defaultOverRules: Prisma.JsonValue;
    } | null = null;
    if (input.tournamentId) {
      await this.access.assertTournament(user, input.tournamentId, 'TOURNAMENT_MANAGE_MATCHES');
      tournamentDefaults = await this.prisma.tournament.findUnique({
        where: { id: input.tournamentId },
        select: {
          defaultOvers: true,
          defaultMaxWickets: true,
          defaultBallsPerOver: true,
          defaultWidesCountAsLegal: true,
          defaultNoBallsCountAsLegal: true,
          defaultOverWiseRulesEnabled: true,
          defaultOverRules: true,
        },
      });
    } else if (user.role === 'VIEWER') {
      throw Errors.forbidden("You don't have permission");
    }
    if (input.homeTeamId === input.awayTeamId) throw Errors.validation('Please select two different teams.');
    const [home, away] = await Promise.all([
      this.prisma.team.findUnique({ where: { id: input.homeTeamId } }),
      this.prisma.team.findUnique({ where: { id: input.awayTeamId } }),
    ]);
    if (!home || !away) throw Errors.notFound('TEAM_NOT_FOUND', 'Team not found');
    const format = input.format ?? MatchFormat.T10;
    const overs =
      input.overs ?? tournamentDefaults?.defaultOvers ?? (format === MatchFormat.T20 ? 20 : format === MatchFormat.HUNDRED ? 100 : 5);
    let youtubeVideoId: string | null = null;
    if (input.youtubeUrl) {
      youtubeVideoId = extractYoutubeVideoId(input.youtubeUrl);
      if (!youtubeVideoId) throw Errors.validation('Invalid YouTube Live URL');
    }
    const publicSlug = await this.publicLive.uniqueSlug(home.name, away.name);
    const match = await this.prisma.match.create({
      data: {
        title: `${home.name} vs ${away.name}`,
        status: MatchStatus.SCHEDULED,
        format,
        overs: format === MatchFormat.HUNDRED ? 100 : overs,
        ballsPerOver: format === MatchFormat.HUNDRED ? 5 : input.ballsPerOver ?? tournamentDefaults?.defaultBallsPerOver ?? 6,
        maxWickets: input.maxWickets ?? tournamentDefaults?.defaultMaxWickets ?? 7,
        playingPerSide: input.playingPerSide ?? 8,
        ballType: input.ballType ?? BallType.TENNIS,
        venueText: input.venueText,
        tournamentId: input.tournamentId,
        scheduledAt: parseDate(input.scheduledAt) ?? new Date(),
        homeTeamId: input.homeTeamId,
        awayTeamId: input.awayTeamId,
        createdById: user.id,
        publicSlug,
        publicLiveEnabled: input.publicLiveEnabled ?? false,
        visibility: input.visibility ?? (input.publicLiveEnabled ? ShareVisibility.UNLISTED : ShareVisibility.PRIVATE),
        publicScorecardEnabled: input.publicScorecardEnabled ?? true,
        publicStatsEnabled: input.publicStatsEnabled ?? true,
        publicMvpEnabled: input.publicMvpEnabled ?? true,
        youtubeVideoId,
        youtubeEnabled: Boolean(youtubeVideoId) && (input.youtubeEnabled ?? true),
        overWiseRulesEnabled: input.overWiseRulesEnabled ?? tournamentDefaults?.defaultOverWiseRulesEnabled ?? false,
        settings: {
          overTheFence: true,
          mankad: true,
          lastMan: true,
          widesCountAsLegal: tournamentDefaults?.defaultWidesCountAsLegal ?? false,
          noBallsCountAsLegal: tournamentDefaults?.defaultNoBallsCountAsLegal ?? false,
          ...(input.settings ?? {}),
        },
        teams: {
          create: [
            { teamId: input.homeTeamId, side: 'HOME' },
            { teamId: input.awayTeamId, side: 'AWAY' },
          ],
        },
      },
      include: matchInclude,
    });
    await this.prisma.auditLog.create({
      data: { userId: user.id, action: 'MATCH_CREATE', entity: 'Match', entityId: match.id },
    });
    if (match.overWiseRulesEnabled && Array.isArray(tournamentDefaults?.defaultOverRules) && tournamentDefaults.defaultOverRules.length) {
      const template = tournamentDefaults.defaultOverRules as Array<{
        overNumber: number;
        name?: string | null;
        ruleType: string;
        enabled?: boolean;
        config: Prisma.InputJsonValue;
      }>;
      await this.prisma.overRule.createMany({
        data: template.map((rule) => ({
          matchId: match.id,
          overNumber: rule.overNumber,
          name: rule.name ?? null,
          ruleType: rule.ruleType,
          config: rule.config,
          enabled: rule.enabled ?? true,
        })),
        skipDuplicates: true,
      });
    }
    return match;
  }

  async update(user: AuthUser, id: string, body: unknown) {
    const currentMatch = await this.get(id);
    const input = createSchema.partial().omit({ homeTeamId: true, awayTeamId: true }).extend({
      homeTeamId: z.string().optional(),
      awayTeamId: z.string().optional(),
      venueText: z.string().optional(),
    }).parse(body ?? {});
    const shareKeys = new Set([
      'publicLiveEnabled',
      'visibility',
      'publicScorecardEnabled',
      'publicStatsEnabled',
      'publicMvpEnabled',
      'youtubeUrl',
      'youtubeEnabled',
    ]);
    const keys = Object.keys(input);
    const onlyShare = keys.length > 0 && keys.every((k) => shareKeys.has(k));
    const settingsOnly = keys.length > 0 && keys.every((k) => k === 'settings');
    if (onlyShare) {
      await this.access.assertMatch(user, id, 'MATCH_SHARE');
    } else if (settingsOnly) {
      const canScore = await this.access.canMatch(user, id, 'MATCH_SCORE');
      const canEdit = await this.access.canMatch(user, id, 'MATCH_EDIT');
      if (!canScore && !canEdit) await this.access.assertMatch(user, id, 'MATCH_EDIT');
    } else {
      await this.access.assertMatch(user, id, 'MATCH_EDIT');
    }
    const nextHome = input.homeTeamId ?? currentMatch.homeTeamId;
    const nextAway = input.awayTeamId ?? currentMatch.awayTeamId;
    if (nextHome === nextAway) {
      throw Errors.validation('Please select two different teams.');
    }
    const structureKeys = [
      'ballsPerOver',
      'playingPerSide',
      'homeTeamId',
      'awayTeamId',
      'tournamentId',
      'overWiseRulesEnabled',
    ] as const;
    const eventCount = await this.scoringEventCount(id);
    if (isMatchStructureLocked(currentMatch.status, eventCount) && structureKeys.some((key) => input[key] !== undefined)) {
      throw Errors.structureLocked(STRUCTURE_LOCKED_MESSAGE);
    }
    if (input.overs != null || input.maxWickets != null) {
      const innings = currentMatch.innings ?? [];
      const liveInnings = innings.find((row) => row.status === InningsStatus.IN_PROGRESS) ?? innings.at(-1);
      const legalBalls = liveInnings?.totalBallsLegal ?? 0;
      const wicketsFallen = liveInnings?.totalWickets ?? 0;
      const ballsPerOver = input.ballsPerOver ?? currentMatch.ballsPerOver;
      const minOvers = minOversFromProgress(legalBalls, ballsPerOver);
      const minWickets = minWicketsFromProgress(wicketsFallen);
      if (input.overs != null && input.overs < minOvers) {
        throw Errors.validation(`Overs cannot be less than ${minOvers} because that many overs have already been bowled.`);
      }
      if (input.maxWickets != null && input.maxWickets < minWickets) {
        throw Errors.validation(`Wickets cannot be less than ${minWickets} because that many wickets have already fallen.`);
      }
    }
    const data: Prisma.MatchUncheckedUpdateInput = {};
    if (input.format) data.format = input.format;
    if (input.overs != null) data.overs = input.overs;
    if (input.ballsPerOver != null) data.ballsPerOver = input.ballsPerOver;
    if (input.maxWickets != null) data.maxWickets = input.maxWickets;
    if (input.playingPerSide != null) data.playingPerSide = input.playingPerSide;
    if (input.ballType) data.ballType = input.ballType;
    if (input.venueText !== undefined) data.venueText = input.venueText;
    if (input.overWiseRulesEnabled !== undefined) data.overWiseRulesEnabled = input.overWiseRulesEnabled;
    if (input.tournamentId !== undefined) data.tournamentId = input.tournamentId;
    if (input.scheduledAt !== undefined) data.scheduledAt = parseDate(input.scheduledAt);
    if (input.settings) {
      const prev = (currentMatch.settings ?? {}) as Record<string, unknown>;
      const scoringSettingKeys = ['mankad', 'lastMan', 'overTheFence'];
      const incoming = input.settings;
      if (isMatchStructureLocked(currentMatch.status, eventCount) && scoringSettingKeys.some((key) => incoming[key] !== undefined && incoming[key] !== prev[key])) {
        throw Errors.structureLocked(STRUCTURE_LOCKED_MESSAGE);
      }
      data.settings = { ...prev, ...incoming } as Prisma.InputJsonValue;
    }
    if (input.homeTeamId) data.homeTeamId = input.homeTeamId;
    if (input.awayTeamId) data.awayTeamId = input.awayTeamId;
    if (input.homeTeamId || input.awayTeamId) {
      const home = input.homeTeamId ?? currentMatch.homeTeamId;
      const away = input.awayTeamId ?? currentMatch.awayTeamId;
      const [h, a] = await Promise.all([
        this.prisma.team.findUnique({ where: { id: home } }),
        this.prisma.team.findUnique({ where: { id: away } }),
      ]);
      if (h && a) data.title = `${h.name} vs ${a.name}`;
    }
    if (input.publicLiveEnabled !== undefined) data.publicLiveEnabled = input.publicLiveEnabled;
    if (input.visibility !== undefined) data.visibility = input.visibility;
    if (input.publicScorecardEnabled !== undefined) data.publicScorecardEnabled = input.publicScorecardEnabled;
    if (input.publicStatsEnabled !== undefined) data.publicStatsEnabled = input.publicStatsEnabled;
    if (input.publicMvpEnabled !== undefined) data.publicMvpEnabled = input.publicMvpEnabled;
    if (input.publicLiveEnabled === true && currentMatch.visibility === ShareVisibility.PRIVATE && input.visibility === undefined) {
      data.visibility = ShareVisibility.UNLISTED;
    }
    if (input.youtubeEnabled !== undefined) data.youtubeEnabled = input.youtubeEnabled;
    if (input.youtubeUrl !== undefined) {
      if (!input.youtubeUrl) {
        data.youtubeVideoId = null;
        data.youtubeEnabled = false;
      } else {
        const videoId = extractYoutubeVideoId(input.youtubeUrl);
        if (!videoId) throw Errors.validation('Invalid YouTube Live URL');
        data.youtubeVideoId = videoId;
        if (input.youtubeEnabled === undefined) data.youtubeEnabled = true;
      }
    }
    if (!currentMatch.publicSlug) {
      const home = await this.prisma.team.findUnique({ where: { id: currentMatch.homeTeamId } });
      const away = await this.prisma.team.findUnique({ where: { id: currentMatch.awayTeamId } });
      if (home && away) data.publicSlug = await this.publicLive.uniqueSlug(home.name, away.name);
    }
    return this.prisma.match.update({ where: { id }, data, include: matchInclude });
  }

  async start(id: string) {
    const match = await this.get(id);
    const next = MatchStatus.TOSS_PENDING;
    assertTransition(match.status, next);
    const updated = await this.prisma.match.update({ where: { id }, data: { status: next }, include: matchInclude });
    this.realtime.emitMatch(id, 'match.started', { matchId: id });
    return updated;
  }

  async toss(id: string, body: unknown) {
    const input = z.object({ tossWinnerTeamId: z.string(), tossDecision: z.nativeEnum(TossDecision) }).parse(body);
    return this.prisma.$transaction(async (tx) => {
      const match = await tx.match.findUnique({ where: { id } });
      if (!match) throw Errors.notFound('MATCH_NOT_FOUND', 'Match not found');
      const tossable: MatchStatus[] = [MatchStatus.TOSS_PENDING, MatchStatus.SCHEDULED, MatchStatus.DRAFT];
      if (!tossable.includes(match.status)) {
        if (match.tossWinnerTeamId) return tx.match.findUniqueOrThrow({ where: { id }, include: matchInclude });
        throw Errors.invalidState('Toss already completed or not allowed');
      }
      if (![match.homeTeamId, match.awayTeamId].includes(input.tossWinnerTeamId)) {
        throw Errors.validation('Toss winner must be one of the match teams');
      }
      if (match.status === MatchStatus.DRAFT || match.status === MatchStatus.SCHEDULED) {
        assertTransition(match.status, MatchStatus.TOSS_PENDING);
      }
      assertTransition(MatchStatus.TOSS_PENDING, MatchStatus.TOSS_COMPLETED);
      await tx.toss.upsert({
        where: { matchId: id },
        create: { matchId: id, winnerTeamId: input.tossWinnerTeamId, decision: input.tossDecision },
        update: { winnerTeamId: input.tossWinnerTeamId, decision: input.tossDecision },
      });
      return tx.match.update({
        where: { id },
        data: {
          status: MatchStatus.TOSS_COMPLETED,
          tossWinnerTeamId: input.tossWinnerTeamId,
          tossDecision: input.tossDecision,
        },
        include: matchInclude,
      });
    });
  }

  async startInnings(id: string, body: unknown) {
    const input = z.object({ battingTeamId: z.string(), bowlingTeamId: z.string() }).parse(body);
    const updated = await this.prisma.$transaction(async (tx) => {
      const match = await tx.match.findUnique({ where: { id }, include: { innings: true } });
      if (!match) throw Errors.notFound('MATCH_NOT_FOUND', 'Match not found');
      if (![match.homeTeamId, match.awayTeamId].includes(input.battingTeamId) || ![match.homeTeamId, match.awayTeamId].includes(input.bowlingTeamId)) {
        throw Errors.validation('Innings teams must belong to the match');
      }
      if (input.battingTeamId === input.bowlingTeamId) throw Errors.validation('Batting and bowling teams must differ');
      const existing = match.innings.find(
        (i) => i.battingTeamId === input.battingTeamId && i.status !== InningsStatus.COMPLETED && i.status !== InningsStatus.DECLARED,
      );
      if (existing) {
        await this.rules.snapshotForMatch(tx, id);
        if (match.status !== MatchStatus.LIVE) {
          assertTransition(match.status, MatchStatus.LIVE);
          await tx.match.update({ where: { id }, data: { status: MatchStatus.LIVE } });
        }
        return tx.match.findUniqueOrThrow({ where: { id }, include: matchInclude });
      }

      if (match.format === MatchFormat.TEST) {
        if (match.innings.length >= 4) throw Errors.invalidState('All 4 Test innings already exist');
        const inningsNumber = match.innings.length + 1;
        if (inningsNumber === 3) {
          const first = match.innings.find((i) => i.inningsNumber === 1)!;
          const second = match.innings.find((i) => i.inningsNumber === 2)!;
          const followOn = computeFollowOnAvailability(
            { inningsNumber: 1, battingTeamId: first.battingTeamId, totalRuns: first.totalRuns, totalWickets: first.totalWickets, status: first.status },
            { inningsNumber: 2, battingTeamId: second.battingTeamId, totalRuns: second.totalRuns, totalWickets: second.totalWickets, status: second.status },
            match.testDurationDays,
          );
          if (followOn.available && match.followOnEnforced == null) {
            throw Errors.invalidState('Decide the follow-on before starting the next innings.');
          }
          const expectedBattingTeamId =
            followOn.available && match.followOnEnforced ? second.battingTeamId : first.battingTeamId;
          if (input.battingTeamId !== expectedBattingTeamId) {
            throw Errors.validation('This innings must follow the decided batting order.');
          }
        } else if (inningsNumber === 4) {
          const third = match.innings.find((i) => i.inningsNumber === 3)!;
          const expectedBattingTeamId = third.battingTeamId === match.homeTeamId ? match.awayTeamId : match.homeTeamId;
          if (input.battingTeamId !== expectedBattingTeamId) {
            throw Errors.validation('The other team must bat in the 4th innings.');
          }
        }
        await this.rules.snapshotForMatch(tx, id);
        await tx.innings.create({
          data: { matchId: id, inningsNumber, battingTeamId: input.battingTeamId, bowlingTeamId: input.bowlingTeamId },
        });
        const nextStatus = MatchStatus.LIVE;
        if (match.status === MatchStatus.TOSS_COMPLETED || match.status === MatchStatus.INNINGS_BREAK) {
          assertTransition(match.status, nextStatus);
        } else if (match.status !== MatchStatus.LIVE) {
          throw Errors.invalidState('Complete toss before starting innings');
        }
        return tx.match.update({ where: { id }, data: { status: nextStatus }, include: matchInclude });
      }

      if (match.innings.length >= 2) throw Errors.invalidState('Both innings already exist');
      const nextStatus = MatchStatus.LIVE;
      if (match.status === MatchStatus.TOSS_COMPLETED || match.status === MatchStatus.INNINGS_BREAK) {
        assertTransition(match.status, nextStatus);
      } else if (match.status !== MatchStatus.LIVE) {
        throw Errors.invalidState('Complete toss before starting innings');
      }
      const inningsNumber = match.innings.length + 1;
      const first = match.innings.find((i) => i.inningsNumber === 1);
      if (inningsNumber === 2 && first && input.battingTeamId === first.battingTeamId) {
        throw Errors.validation('The other team must bat in the second innings.');
      }
      await this.rules.snapshotForMatch(tx, id);
      const countedFirst = first ? await this.rules.countedTotal(tx, id, first.id, first.totalRuns) : 0;
      await tx.innings.create({
        data: {
          matchId: id,
          inningsNumber,
          battingTeamId: input.battingTeamId,
          bowlingTeamId: input.bowlingTeamId,
          targetRuns: inningsNumber === 2 && first ? countedFirst + 1 : null,
        },
      });
      return tx.match.update({ where: { id }, data: { status: nextStatus }, include: matchInclude });
    });
    if (updated.status === MatchStatus.LIVE && updated.innings.length === 1) {
      const recipients = await this.notifications.recipientsForMatch(id);
      void this.notifications.notify({
        userIds: recipients,
        type: 'MATCH_STARTED',
        title: 'Match started',
        body: `${updated.homeTeam.name} vs ${updated.awayTeam.name} is live.`,
        link: `/matches/${id}/centre`,
        meta: { matchId: id },
      });
    }
    return updated;
  }

  /** Once the lead reaches the configured threshold after both first innings, and locked once decided — Law 14. */
  async decideFollowOn(user: AuthUser, id: string, body: unknown) {
    const input = z.object({ enforce: z.boolean() }).parse(body ?? {});
    await this.access.assertMatch(user, id, 'MATCH_MANAGE_RESULT');
    return this.prisma.$transaction(async (tx) => {
      const match = await tx.match.findUnique({ where: { id }, include: { innings: true } });
      if (!match) throw Errors.notFound('MATCH_NOT_FOUND', 'Match not found');
      if (match.format !== MatchFormat.TEST) throw Errors.invalidState('Follow-on only applies to Test matches.');
      if (match.followOnEnforced != null) throw Errors.invalidState('The follow-on decision has already been made.');
      const first = match.innings.find((i) => i.inningsNumber === 1);
      const second = match.innings.find((i) => i.inningsNumber === 2);
      if (!first || !second) throw Errors.invalidState('Both first innings must be complete before deciding the follow-on.');
      const followOn = computeFollowOnAvailability(
        { inningsNumber: 1, battingTeamId: first.battingTeamId, totalRuns: first.totalRuns, totalWickets: first.totalWickets, status: first.status },
        { inningsNumber: 2, battingTeamId: second.battingTeamId, totalRuns: second.totalRuns, totalWickets: second.totalWickets, status: second.status },
        match.testDurationDays,
      );
      if (!followOn.available) throw Errors.invalidState('Follow-on is not available.');
      await tx.auditLog.create({
        data: { userId: user.id, action: 'FOLLOW_ON_DECIDED', entity: 'Match', entityId: id, meta: { enforce: input.enforce, lead: followOn.lead } },
      });
      return tx.match.update({ where: { id }, data: { followOnEnforced: input.enforce }, include: matchInclude });
    });
  }

  /**
   * "Unlock" is a permission-gated flag on the match (`correctionUnlocked`), never a MatchStatus
   * transition — COMPLETED is a dead-end in `assertTransition`'s state table by design, and ball
   * corrections should never need to walk a completed match back through the live scoring
   * lifecycle just to fix historical data.
   */
  async unlockCorrection(user: AuthUser, id: string) {
    await this.access.assertMatch(user, id, 'MATCH_CORRECT_BALL');
    const match = await this.prisma.match.findUnique({ where: { id } });
    if (!match) throw Errors.notFound('MATCH_NOT_FOUND', 'Match not found');
    if (match.correctionUnlocked) return match;
    await this.prisma.auditLog.create({
      data: { userId: user.id, action: 'SCORECARD_UNLOCKED', entity: 'Match', entityId: id, meta: {} },
    });
    return this.prisma.match.update({ where: { id }, data: { correctionUnlocked: true } });
  }

  async lockCorrection(user: AuthUser, id: string) {
    await this.access.assertMatch(user, id, 'MATCH_CORRECT_BALL');
    const match = await this.prisma.match.findUnique({ where: { id } });
    if (!match) throw Errors.notFound('MATCH_NOT_FOUND', 'Match not found');
    if (!match.correctionUnlocked) return match;
    await this.prisma.auditLog.create({
      data: { userId: user.id, action: 'SCORECARD_LOCKED', entity: 'Match', entityId: id, meta: {} },
    });
    return this.prisma.match.update({ where: { id }, data: { correctionUnlocked: false } });
  }

  async patchInnings(id: string, body: unknown) {
    const input = z.object({ targetRuns: z.number().int().min(1).max(999) }).parse(body ?? {});
    const innings = await this.prisma.innings.findUnique({ where: { id }, include: { match: true } });
    if (!innings) throw Errors.notFound('NOT_FOUND', 'Innings not found');
    if (innings.status === InningsStatus.COMPLETED) {
      throw Errors.invalidState('This innings is already complete. No additional balls can be added.');
    }
    return this.prisma.innings.update({
      where: { id },
      data: { targetRuns: input.targetRuns },
    });
  }

  async assertCanScoreInnings(user: AuthUser, inningsId: string) {
    await this.access.assertInnings(user, inningsId, 'MATCH_SCORE');
  }

  async assertCanUndoInnings(user: AuthUser, inningsId: string) {
    await this.access.assertInnings(user, inningsId, 'MATCH_UNDO');
  }

  async assertCanViewInnings(user: AuthUser | null, inningsId: string) {
    const innings = await this.prisma.innings.findUnique({
      where: { id: inningsId },
      select: { matchId: true, match: { select: { visibility: true } } },
    });
    if (!innings) throw Errors.notFound('NOT_FOUND', 'Innings not found');
    if (isLinkShareable(innings.match.visibility)) return;
    if (!user || !(await this.access.canMatch(user, innings.matchId, 'MATCH_VIEW'))) {
      throw Errors.notFound('NOT_FOUND', 'Innings not found');
    }
  }

  async getPlayingXi(id: string) {
    const match = await this.get(id);
    const eventCount = await this.prisma.ballEvent.count({ where: { matchId: id, isUndone: false } });
    const jerseyByPlayer = new Map<string, number | null>();
    for (const tp of [...match.homeTeam.players, ...match.awayTeam.players]) {
      jerseyByPlayer.set(tp.playerId, tp.jerseyNo ?? tp.player.profile?.jerseyNo ?? null);
    }
    const mapTeam = (team: typeof match.homeTeam) => {
      const selected = match.players.filter((p) => p.teamId === team.id && p.isPlaying);
      return {
        teamId: team.id,
        name: team.name,
        shortName: team.shortName,
        logoUrl: team.logoUrl,
        players: selected.map((row) => ({
          playerId: row.playerId,
          name: row.player.name,
          photoUrl: row.player.photoUrl,
          role: row.player.role,
          jerseyNo: jerseyByPlayer.get(row.playerId) ?? null,
          isCaptain: row.isCaptain,
          isViceCaptain: row.isViceCaptain,
          isWicketKeeper: row.isWicketKeeper,
        })),
        roster: team.players.map((tp) => ({
          playerId: tp.playerId,
          name: tp.player.name,
          photoUrl: tp.player.photoUrl,
          role: tp.player.role,
          jerseyNo: tp.jerseyNo ?? tp.player.profile?.jerseyNo ?? null,
        })),
      };
    };
    return {
      matchId: match.id,
      playingPerSide: match.playingPerSide,
      locked: playingXiLocked(eventCount),
      home: mapTeam(match.homeTeam),
      away: mapTeam(match.awayTeam),
    };
  }

  async putPlayingXi(user: AuthUser, id: string, body: unknown) {
    const input = z
      .object({
        teamId: z.string(),
        force: z.boolean().optional(),
        players: z
          .array(
            z.object({
              playerId: z.string(),
              isCaptain: z.boolean().optional(),
              isViceCaptain: z.boolean().optional(),
              isWicketKeeper: z.boolean().optional(),
            }),
          )
          .min(2)
          .max(11),
      })
      .parse(body);

    const match = await this.get(id);
    if (!(await this.access.canMatch(user, id, 'MATCH_MANAGE_PLAYING_XI'))) throw Errors.forbidden("You don't have permission");
    const eventCount = await this.prisma.ballEvent.count({ where: { matchId: id, isUndone: false } });
    if (playingXiLocked(eventCount) && !(input.force && canForcePlayingXi(user))) {
      throw Errors.invalidState('Playing XI is locked after scoring has started');
    }

    const team = match.homeTeamId === input.teamId ? match.homeTeam : match.awayTeamId === input.teamId ? match.awayTeam : null;
    if (!team) throw Errors.validation('Team is not part of this match');
    const errors = validatePlayingXi({
      teamId: input.teamId,
      matchTeamIds: [match.homeTeamId, match.awayTeamId],
      playingPerSide: match.playingPerSide,
      rosterPlayerIds: team.players.map((p) => p.playerId),
      players: input.players,
    });
    if (errors[0]) throw Errors.validation(errors[0].message);

    await this.prisma.$transaction(async (tx) => {
      await tx.matchPlayer.deleteMany({ where: { matchId: id, teamId: input.teamId } });
      await tx.matchPlayer.createMany({
        data: input.players.map((p, index) => ({
          matchId: id,
          teamId: input.teamId,
          playerId: p.playerId,
          isPlaying: true,
          isCaptain: Boolean(p.isCaptain),
          isViceCaptain: Boolean(p.isViceCaptain),
          isWicketKeeper: Boolean(p.isWicketKeeper),
          battingOrder: index,
        })),
      });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: input.force ? 'PLAYING_XI_CORRECTED' : 'PLAYING_XI_SET',
          entity: 'Match',
          entityId: id,
          meta: { teamId: input.teamId, count: input.players.length },
        },
      });
    });
    return this.getPlayingXi(id);
  }

  rulesFor(id: string, opts?: { includeRules?: boolean }) {
    return this.rules.matchRules(id, opts);
  }

  matchResultDto(match: {
    id: string;
    status: MatchStatus;
    resultType: MatchResultType | null;
    resultWinnerTeamId: string | null;
    marginType: MatchMarginType | null;
    marginValue: number | null;
    homeTeam: { id: string; name: string; shortName: string | null };
    awayTeam: { id: string; name: string; shortName: string | null };
    innings: Array<{
      inningsNumber: number;
      battingTeamId: string;
      bowlingTeamId: string;
      totalRuns: number;
      totalWickets: number;
      totalBallsLegal: number;
    }>;
    ballsPerOver: number;
  }) {
    return {
      matchId: match.id,
      status: match.status,
      resultType: match.resultType,
      winnerTeamId: match.resultWinnerTeamId,
      marginType: match.marginType,
      marginValue: match.marginValue,
      home: {
        teamId: match.homeTeam.id,
        name: match.homeTeam.name,
        shortName: match.homeTeam.shortName,
      },
      away: {
        teamId: match.awayTeam.id,
        name: match.awayTeam.name,
        shortName: match.awayTeam.shortName,
      },
      innings: match.innings.map((inn) => ({
        battingTeamId: inn.battingTeamId,
        bowlingTeamId: inn.bowlingTeamId,
        inningsNumber: inn.inningsNumber,
        runs: inn.totalRuns,
        wickets: inn.totalWickets,
        overs: `${Math.floor(inn.totalBallsLegal / match.ballsPerOver)}.${inn.totalBallsLegal % match.ballsPerOver}`,
      })),
    };
  }

  async getResult(id: string) {
    const match = await this.get(id);
    return this.matchResultDto(match);
  }

  async pause(user: AuthUser, id: string, body: unknown) {
    await this.access.assertMatch(user, id, 'MATCH_SCORE');
    const reason = z.object({ reason: z.enum(['DRINKS', 'RAIN', 'DELAY']) }).parse(body ?? {}).reason;
    const next =
      reason === 'DRINKS'
        ? MatchStatus.DRINKS_BREAK
        : reason === 'RAIN'
          ? MatchStatus.RAIN_DELAY
          : MatchStatus.MATCH_DELAY;
    const match = await this.get(id);
    assertTransition(match.status, next);
    const updated = await this.prisma.match.update({ where: { id }, data: { status: next }, include: matchInclude });
    const live = await this.publicLive.compose(id);
    this.realtime.emitMatch(id, LIVE_SOCKET.scoreUpdated, live);
    return updated;
  }

  async resume(user: AuthUser, id: string) {
    await this.access.assertMatch(user, id, 'MATCH_SCORE');
    const match = await this.get(id);
    if (!matchIsPaused(match.status)) throw Errors.invalidState('Match is not paused');
    assertTransition(match.status, MatchStatus.LIVE);
    const updated = await this.prisma.match.update({
      where: { id },
      data: { status: MatchStatus.LIVE },
      include: matchInclude,
    });
    const live = await this.publicLive.compose(id);
    this.realtime.emitMatch(id, LIVE_SOCKET.scoreUpdated, live);
    return updated;
  }

  async complete(user: AuthUser, id: string, body: unknown) {
    const input = z
      .object({ intent: z.enum(['COMPLETE', 'NO_RESULT']).optional() })
      .parse(body ?? {});
    await this.access.assertMatch(user, id, 'MATCH_MANAGE_RESULT');
    return this.finalize(user, id, input.intent ?? 'COMPLETE');
  }

  async abandon(user: AuthUser, id: string) {
    await this.access.assertMatch(user, id, 'MATCH_MANAGE_RESULT');
    return this.finalize(user, id, 'ABANDON');
  }

  async cancel(user: AuthUser, id: string) {
    await this.access.assertMatch(user, id, 'MATCH_MANAGE_RESULT');
    return this.finalize(user, id, 'CANCEL');
  }

  /** Test-only: the match ran out of playing time without a result. */
  async drawMatch(user: AuthUser, id: string) {
    await this.access.assertMatch(user, id, 'MATCH_MANAGE_RESULT');
    return this.finalize(user, id, 'DRAW');
  }

  async finalize(user: AuthUser | null, id: string, intent: 'COMPLETE' | 'NO_RESULT' | 'ABANDON' | 'CANCEL' | 'DRAW' = 'COMPLETE') {
    const updated = await this.prisma.$transaction(async (tx) => {
      const match = await tx.match.findUnique({
        where: { id },
        include: { innings: true, homeTeam: true, awayTeam: true },
      });
      if (!match) throw Errors.notFound('MATCH_NOT_FOUND', 'Match not found');
      if (intent === 'DRAW' && match.format !== MatchFormat.TEST) {
        throw Errors.invalidState('Only Test matches can be drawn.');
      }
      const resultInns = await this.rules.resultInnings(
        tx,
        id,
        match.innings.map((i) => ({
          id: i.id,
          inningsNumber: i.inningsNumber,
          battingTeamId: i.battingTeamId,
          totalRuns: i.totalRuns,
          totalWickets: i.totalWickets,
          status: i.status,
        })),
      );
      const computed =
        match.format === MatchFormat.TEST
          ? computeTestMatchResult({
              homeTeamId: match.homeTeamId,
              awayTeamId: match.awayTeamId,
              maxWickets: match.maxWickets,
              intent,
              // Test declarations need the real DECLARED status (not just isComplete), and
              // don't go through the fan-engagement counted-runs overlay resultInns applies.
              innings: match.innings.map((i) => ({
                inningsNumber: i.inningsNumber,
                battingTeamId: i.battingTeamId,
                totalRuns: i.totalRuns,
                totalWickets: i.totalWickets,
                status: i.status,
              })),
            })
          : computeMatchResult({
              homeTeamId: match.homeTeamId,
              awayTeamId: match.awayTeamId,
              maxWickets: match.maxWickets,
              // DRAW is rejected above for any non-TEST match, so this is never actually 'DRAW' here.
              intent: intent as 'COMPLETE' | 'NO_RESULT' | 'ABANDON' | 'CANCEL',
              innings: resultInns,
            });
      if (resultIsIdempotent({ status: match.status, resultType: match.resultType }, computed.status) && match.resultType) {
        await this.stats.persist(tx, id);
        await this.stats.persistStandings(tx, id);
        return tx.match.findUniqueOrThrow({ where: { id }, include: matchInclude });
      }
      assertTransition(match.status, computed.status);
      const next = await tx.match.update({
        where: { id },
        data: {
          status: computed.status,
          resultType: computed.resultType,
          resultWinnerTeamId: computed.winnerTeamId,
          marginType: computed.marginType,
          marginValue: computed.marginValue,
          completedAt: new Date(),
        },
        include: matchInclude,
      });
      await tx.auditLog.create({
        data: {
          userId: user?.id,
          action: computed.status === 'ABANDONED' ? 'MATCH_ABANDONED' : 'MATCH_COMPLETED',
          entity: 'Match',
          entityId: id,
          meta: {
            resultType: computed.resultType,
            winnerTeamId: computed.winnerTeamId,
            marginType: computed.marginType,
            marginValue: computed.marginValue,
          },
        },
      });
      await this.stats.persist(tx, id);
      await this.stats.persistStandings(tx, id);
      return next;
    });
    const dto = await this.publicLive.compose(id);
    this.realtime.emitMatch(id, LIVE_SOCKET.matchCompleted, { ...this.matchResultDto(updated), live: dto });
    if (updated.status === MatchStatus.COMPLETED) {
      await this.knockout.advanceAfterResult(id);
      const recipients = await this.notifications.recipientsForMatch(id);
      const winner = updated.resultWinner?.name ?? updated.resultWinnerTeamId;
      void this.notifications.notify({
        userIds: recipients,
        type: 'MATCH_RESULT',
        title: 'Match completed',
        body: winner ? `${winner} won ${updated.homeTeam.name} vs ${updated.awayTeam.name}` : `${updated.homeTeam.name} vs ${updated.awayTeam.name} completed.`,
        link: `/matches/${id}/centre`,
        meta: { matchId: id },
      });
    }
    return this.matchResultDto(updated);
  }

  /** "End Match — Shared Points" from the tie-decision modal. Not available for knockout matches — those must be decided by a Super Over. */
  async resolveTieSharedPoints(user: AuthUser, id: string) {
    await this.access.assertMatch(user, id, 'MATCH_MANAGE_RESULT');
    const updated = await this.prisma.$transaction(async (tx) => {
      const match = await tx.match.findUnique({ where: { id } });
      if (!match) throw Errors.notFound('MATCH_NOT_FOUND', 'Match not found');
      if (match.status !== MatchStatus.SUPER_OVER_PENDING) {
        throw Errors.invalidState('This match is not awaiting a tie decision.');
      }
      if (match.knockoutRound) {
        throw Errors.invalidState('Knockout matches must be decided by a Super Over.');
      }
      assertTransition(match.status, MatchStatus.COMPLETED);
      const next = await tx.match.update({
        where: { id },
        data: {
          status: MatchStatus.COMPLETED,
          resultType: MatchResultType.TIE,
          resultWinnerTeamId: null,
          marginType: null,
          marginValue: null,
          completedAt: new Date(),
        },
        include: matchInclude,
      });
      await tx.auditLog.create({
        data: { userId: user.id, action: 'MATCH_TIE_SHARED_POINTS', entity: 'Match', entityId: id, meta: {} },
      });
      await this.stats.persist(tx, id);
      await this.stats.persistStandings(tx, id);
      return next;
    });
    const dto = await this.publicLive.compose(id);
    this.realtime.emitMatch(id, LIVE_SOCKET.matchCompleted, { ...this.matchResultDto(updated), live: dto });
    return this.matchResultDto(updated);
  }

  /** "Start Super Over" from the tie-decision modal. Creates the first Super Over innings; the second is auto-created by ScoringService once the first completes. */
  async startSuperOver(user: AuthUser, id: string) {
    await this.access.assertMatch(user, id, 'MATCH_MANAGE_RESULT');
    const updated = await this.prisma.$transaction(async (tx) => {
      const match = await tx.match.findUnique({ where: { id }, include: { innings: true } });
      if (!match) throw Errors.notFound('MATCH_NOT_FOUND', 'Match not found');
      if (match.status !== MatchStatus.SUPER_OVER_PENDING) {
        throw Errors.invalidState('This match is not awaiting a tie decision.');
      }
      const superOvers = match.innings.filter((i) => i.isSuperOver);
      const nextSuperOverNumber = superOvers.length === 0 ? 1 : Math.max(...superOvers.map((i) => i.superOverNumber ?? 0)) + 1;
      const lastPairNumber = superOvers.length === 0 ? null : Math.max(...superOvers.map((i) => i.superOverNumber ?? 0));
      const lastPair = lastPairNumber == null
        ? match.innings.filter((i) => !i.isSuperOver)
        : superOvers.filter((i) => i.superOverNumber === lastPairNumber);
      const sortedLastPair = [...lastPair].sort((a, b) => a.inningsNumber - b.inningsNumber);
      const battedSecondLastTime = sortedLastPair[sortedLastPair.length - 1];
      const battedFirstLastTime = sortedLastPair[0];
      if (!battedSecondLastTime || !battedFirstLastTime) {
        throw Errors.invalidState('Cannot determine the Super Over batting order.');
      }
      const nextInningsNumber = Math.max(...match.innings.map((i) => i.inningsNumber)) + 1;
      const settings = (match.settings ?? {}) as Record<string, unknown>;
      const soOvers = Number(settings.superOverOvers) > 0 ? Math.trunc(Number(settings.superOverOvers)) : 1;
      const soWickets = Number(settings.superOverMaxWickets) > 0 ? Math.trunc(Number(settings.superOverMaxWickets)) : 2;
      await tx.innings.create({
        data: {
          matchId: id,
          inningsNumber: nextInningsNumber,
          // the team that batted second last time bats first in the new Super Over
          battingTeamId: battedSecondLastTime.battingTeamId,
          bowlingTeamId: battedFirstLastTime.battingTeamId,
          isSuperOver: true,
          superOverNumber: nextSuperOverNumber,
          oversLimit: soOvers,
          maxWicketsLimit: soWickets,
        },
      });
      assertTransition(match.status, MatchStatus.SUPER_OVER);
      const next = await tx.match.update({ where: { id }, data: { status: MatchStatus.SUPER_OVER }, include: matchInclude });
      await tx.auditLog.create({
        data: { userId: user.id, action: 'SUPER_OVER_STARTED', entity: 'Match', entityId: id, meta: { superOverNumber: nextSuperOverNumber } },
      });
      return next;
    });
    const dto = await this.publicLive.compose(id);
    this.realtime.emitMatch(id, LIVE_SOCKET.scoreUpdated, dto);
    return updated;
  }

  async remove(user: AuthUser, id: string) {
    await this.access.assertMatch(user, id, 'MATCH_DELETE');
    await this.prisma.match.delete({ where: { id } });
    await this.access.audit(user.id, 'MATCH_DELETED', 'Match', id, { allowed: true });
    return { deleted: true };
  }
}
