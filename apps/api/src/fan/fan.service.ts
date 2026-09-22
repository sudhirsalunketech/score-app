import { Inject, Injectable } from '@nestjs/common';
import {
  ChatMessageKind,
  ChatReportStatus,
  FanPointSource,
  FanQuestionKind,
  FanQuestionScope,
  FanQuestionStatus,
  FanQuestionType,
  FanQuizStatus,
  FanSettlementMode,
  Prisma,
} from '@prisma/client';
import { z } from 'zod';
import {
  FAN_CHAT_RATE,
  FAN_REACT_EMOJIS,
  FAN_REACT_RATE,
  LIVE_SOCKET,
  answerIsCorrect,
  badgesForStats,
  boundFanPoints,
  isDuplicateChat,
  isFanQuizComingSoon,
  isFanQuizPlayable,
  isLinkShareable,
  liveTemplateVisible,
  MATCH_PREDICTION_TEMPLATES,
  rankFanRows,
  resolveFanQuizState,
  sanitizeChatBody,
  shouldShowFanQuiz,
  TOURNAMENT_PREDICTION_TEMPLATES,
  TOURNAMENT_QUIZ_TEMPLATES,
} from '@crickscore/shared';
import { PrismaService } from '../prisma/prisma.service';
import { Errors } from '../common/app-error';
import type { AuthUser } from '../common/auth.guard';
import { AccessService } from '../access/access.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

const chatHits = new Map<string, number[]>();
const reactHits = new Map<string, number[]>();

function settingsDto(row: {
  chatEnabled: boolean;
  publicChat: boolean;
  loginRequiredToChat: boolean;
  predictionsEnabled: boolean;
  quizzesEnabled: boolean;
  moderationEnabled: boolean;
  revealPercentagesAfterLock: boolean;
  minAnswersForPercentages: number;
} | null) {
  return {
    chatEnabled: row?.chatEnabled ?? true,
    publicChat: row?.publicChat ?? true,
    loginRequiredToChat: row?.loginRequiredToChat ?? true,
    predictionsEnabled: row?.predictionsEnabled ?? true,
    quizzesEnabled: row?.quizzesEnabled ?? false,
    moderationEnabled: row?.moderationEnabled ?? true,
    revealPercentagesAfterLock: row?.revealPercentagesAfterLock ?? true,
    minAnswersForPercentages: row?.minAnswersForPercentages ?? 3,
  };
}

type QuizLike = {
  id: string;
  name: string;
  description: string | null;
  status: FanQuizStatus;
  startAt: Date | null;
  endAt: Date | null;
  updatedAt: Date;
};

/**
 * Many quizzes can exist per tournament; fan-facing surfaces (visibility banner,
 * play, preview) still show exactly one. Rank by *resolved* visibility outcome
 * (active > coming_soon > hidden) rather than raw status — an ACTIVE quiz with a
 * future start resolves to hidden while a SCHEDULED one past its start resolves
 * to active, so raw status alone would pick the wrong one.
 */
function pickPrimaryQuiz(quizzes: QuizLike[], quizzesEnabled: boolean, tournamentId: string, now = new Date()): QuizLike | null {
  const rank = { active: 0, coming_soon: 1, hidden: 2 } as const;
  const ranked = quizzes
    .map((quiz) => ({
      quiz,
      state: resolveFanQuizState({
        tournamentId,
        now,
        settings: { quizzesEnabled, quizStatus: quiz.status, quizStartAt: quiz.startAt, quizEndAt: quiz.endAt },
      }),
    }))
    .sort((a, b) => {
      if (rank[a.state] !== rank[b.state]) return rank[a.state] - rank[b.state];
      const aStart = a.quiz.startAt?.getTime() ?? Infinity;
      const bStart = b.quiz.startAt?.getTime() ?? Infinity;
      if (aStart !== bStart) return aStart - bStart;
      return b.quiz.updatedAt.getTime() - a.quiz.updatedAt.getTime();
    });
  return ranked[0]?.quiz ?? null;
}

export type FanQuizVisibilityDto = {
  show: boolean;
  comingSoon: boolean;
  playable: boolean;
  tournamentId: string | null;
  tournamentName: string | null;
  quizName: string | null;
  quizDescription: string | null;
  quizStatus: string;
};

function quizVisibilityDto(
  quizzesEnabled: boolean,
  primary: QuizLike | null,
  tournamentId: string | null,
  tournamentName: string | null,
  matchExists = true,
): FanQuizVisibilityDto {
  const input = {
    matchExists,
    tournamentId,
    settings: {
      quizzesEnabled,
      quizStatus: primary?.status ?? null,
      quizStartAt: primary?.startAt ?? null,
      quizEndAt: primary?.endAt ?? null,
    },
  };
  const show = shouldShowFanQuiz(input);
  return {
    show,
    comingSoon: isFanQuizComingSoon(input),
    playable: isFanQuizPlayable(input),
    tournamentId: show ? tournamentId : null,
    tournamentName: show ? tournamentName : null,
    quizName: show ? primary?.name ?? null : null,
    quizDescription: show ? primary?.description ?? null : null,
    quizStatus: show ? primary?.status ?? 'DRAFT' : 'DRAFT',
  };
}

@Injectable()
export class FanService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AccessService) private readonly access: AccessService,
    @Inject(RealtimeGateway) private readonly realtime: RealtimeGateway,
  ) {}

  async assertFanManageMatch(user: AuthUser, matchId: string) {
    await this.access.assertMatch(user, matchId, 'FAN_MANAGE');
  }

  async assertFanManageTournament(user: AuthUser, tournamentId: string) {
    await this.access.assertTournament(user, tournamentId, 'FAN_MANAGE');
  }

  async canViewMatch(user: AuthUser | null, matchId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: {
        id: true,
        title: true,
        status: true,
        visibility: true,
        publicLiveEnabled: true,
        publicSlug: true,
        homeTeamId: true,
        awayTeamId: true,
        resultWinnerTeamId: true,
        tournamentId: true,
        homeTeam: { select: { id: true, name: true } },
        awayTeam: { select: { id: true, name: true } },
      },
    });
    if (!match) throw Errors.notFound('MATCH_NOT_FOUND', 'This match is no longer available.');
    if (isLinkShareable(match.visibility) || match.publicLiveEnabled) return match;
    if (user && (await this.access.canMatch(user, matchId, 'MATCH_VIEW'))) return match;
    throw Errors.notFound('MATCH_NOT_FOUND', 'This match is no longer available.');
  }

  async canViewTournament(user: AuthUser | null, tournamentId: string) {
    const tn = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { id: true, name: true, visibility: true, publicSlug: true },
    });
    if (!tn) throw Errors.notFound('NOT_FOUND', 'Tournament not found');
    if (isLinkShareable(tn.visibility)) return tn;
    if (user && (await this.access.canTournament(user, tournamentId, 'TOURNAMENT_VIEW'))) return tn;
    throw Errors.notFound('NOT_FOUND', 'Tournament not found');
  }

  async matchSettings(matchId: string) {
    return settingsDto(await this.prisma.fanSettings.findUnique({ where: { matchId } }));
  }

  async tournamentSettings(tournamentId: string) {
    return settingsDto(await this.prisma.fanSettings.findUnique({ where: { tournamentId } }));
  }

  async patchMatchSettings(user: AuthUser, matchId: string, body: unknown) {
    await this.assertFanManageMatch(user, matchId);
    const input = this.settingsSchema().parse(body);
    const row = await this.prisma.fanSettings.upsert({
      where: { matchId },
      create: { matchId, ...input },
      update: input,
    });
    return settingsDto(row);
  }

  async patchTournamentSettings(user: AuthUser, tournamentId: string, body: unknown) {
    await this.assertFanManageTournament(user, tournamentId);
    const input = this.settingsSchema().parse(body);
    const row = await this.prisma.fanSettings.upsert({
      where: { tournamentId },
      create: { tournamentId, ...input },
      update: input,
    });
    return settingsDto(row);
  }

  private settingsSchema() {
    return z.object({
      chatEnabled: z.boolean().optional(),
      publicChat: z.boolean().optional(),
      loginRequiredToChat: z.boolean().optional(),
      predictionsEnabled: z.boolean().optional(),
      quizzesEnabled: z.boolean().optional(),
      moderationEnabled: z.boolean().optional(),
      revealPercentagesAfterLock: z.boolean().optional(),
      minAnswersForPercentages: z.number().int().min(1).max(100).optional(),
    });
  }

  async listTournamentQuizzes(user: AuthUser, tournamentId: string) {
    await this.assertFanManageTournament(user, tournamentId);
    const [settings, quizzes] = await Promise.all([
      this.tournamentSettings(tournamentId),
      this.prisma.quiz.findMany({ where: { tournamentId }, orderBy: { createdAt: 'asc' } }),
    ]);
    return {
      enabled: settings.quizzesEnabled,
      quizzes: quizzes.map((q) => ({
        id: q.id,
        name: q.name,
        description: q.description,
        status: q.status,
        startAt: q.startAt?.toISOString() ?? null,
        endAt: q.endAt?.toISOString() ?? null,
      })),
    };
  }

  /**
   * Operates strictly on the passed `db` client (never `this.prisma`) so the
   * caller can run this inside a `$transaction` alongside the tournament write.
   */
  async syncTournamentQuizzes(
    db: Prisma.TransactionClient,
    tournamentId: string,
    input: {
      enabled?: boolean;
      quizzes?: Array<{
        id?: string;
        name: string;
        description?: string;
        status?: string;
        startAt?: string;
        endAt?: string;
      }>;
    },
    opts: { seedQuestions?: boolean } = {},
  ) {
    await db.fanSettings.upsert({
      where: { tournamentId },
      create: { tournamentId, quizzesEnabled: input.enabled ?? false },
      update: { quizzesEnabled: input.enabled ?? false },
    });
    if (opts.seedQuestions && (input.enabled ?? false)) {
      await this.ensureTournamentQuizDefaults(db, tournamentId);
    }
    if (input.quizzes === undefined) return;

    const existing = await db.quiz.findMany({ where: { tournamentId }, select: { id: true } });
    const existingIds = new Set(existing.map((q) => q.id));
    for (const q of input.quizzes) {
      if (q.id && !existingIds.has(q.id)) {
        throw Errors.validation('One of the submitted quizzes does not belong to this tournament.');
      }
    }

    const incomingIds = new Set(input.quizzes.filter((q) => q.id).map((q) => q.id as string));
    const toDelete = [...existingIds].filter((id) => !incomingIds.has(id));
    if (toDelete.length) await db.quiz.deleteMany({ where: { id: { in: toDelete } } });

    for (const q of input.quizzes) {
      const data = {
        name: q.name.trim(),
        description: q.description?.trim() || null,
        status: (q.status as FanQuizStatus | undefined) ?? FanQuizStatus.DRAFT,
        startAt: q.startAt ? new Date(q.startAt) : null,
        endAt: q.endAt ? new Date(q.endAt) : null,
      };
      if (q.id) {
        await db.quiz.update({ where: { id: q.id }, data });
      } else {
        await db.quiz.create({ data: { tournamentId, ...data } });
      }
    }
  }

  async quizVisibilityForMatch(user: AuthUser | null, matchId: string): Promise<FanQuizVisibilityDto> {
    const match = await this.canViewMatch(user, matchId);
    if (!match.tournamentId) {
      return quizVisibilityDto(false, null, null, null, true);
    }
    const tn = await this.prisma.tournament.findUnique({
      where: { id: match.tournamentId },
      select: { id: true, name: true },
    });
    const settings = await this.tournamentSettings(match.tournamentId);
    const quizzes = await this.prisma.quiz.findMany({ where: { tournamentId: match.tournamentId } });
    const primary = pickPrimaryQuiz(quizzes, settings.quizzesEnabled, match.tournamentId);
    return quizVisibilityDto(settings.quizzesEnabled, primary, match.tournamentId, tn?.name ?? null, true);
  }

  async quizVisibilityForTournament(user: AuthUser | null, tournamentId: string): Promise<FanQuizVisibilityDto> {
    const tn = await this.canViewTournament(user, tournamentId);
    const settings = await this.tournamentSettings(tournamentId);
    const quizzes = await this.prisma.quiz.findMany({ where: { tournamentId } });
    const primary = pickPrimaryQuiz(quizzes, settings.quizzesEnabled, tournamentId);
    return quizVisibilityDto(settings.quizzesEnabled, primary, tournamentId, tn.name, true);
  }

  private async assertQuizQuestionVisible(
    user: AuthUser | null,
    row: { kind: FanQuestionKind; matchId: string | null; tournamentId: string | null },
    mode: 'view' | 'answer' = 'view',
  ) {
    if (row.kind !== FanQuestionKind.QUIZ) return;
    const tournamentId = row.tournamentId ?? (row.matchId
      ? (await this.prisma.match.findUnique({ where: { id: row.matchId }, select: { tournamentId: true } }))?.tournamentId
      : null);
    if (!tournamentId) throw Errors.notFound('NOT_FOUND', 'Question not found');
    const vis = row.matchId
      ? await this.quizVisibilityForMatch(user, row.matchId)
      : await this.quizVisibilityForTournament(user, tournamentId);
    if (!vis.show || !vis.playable) {
      if (mode === 'answer' && vis.show) throw Errors.forbidden('Question closed');
      throw Errors.notFound('NOT_FOUND', 'Question not found');
    }
  }

  async overview(user: AuthUser | null, matchId: string) {
    const match = await this.canViewMatch(user, matchId);
    const settings = await this.matchSettings(matchId);
    await this.ensureMatchDefaults(matchId);
    const unread = await this.prisma.chatMessage.count({ where: { matchId, deletedAt: null } });
    const fanQuiz = await this.quizVisibilityForMatch(user, matchId);
    return {
      match: { id: match.id, title: match.title, status: match.status, publicSlug: match.publicSlug },
      settings,
      chatCount: unread,
      canChat: Boolean(user) && settings.chatEnabled,
      canManage: user ? await this.access.canMatch(user, matchId, 'FAN_MANAGE') : false,
      fanQuiz,
    };
  }

  async listChat(user: AuthUser | null, matchId: string) {
    const match = await this.canViewMatch(user, matchId);
    const settings = await this.matchSettings(matchId);
    if (!settings.chatEnabled) return { messages: [], settings, online: this.realtime.publicViewerCount(matchId) };
    if (!user && !settings.publicChat) return { messages: [], settings, online: 0 };
    if (!isLinkShareable(match.visibility) && !match.publicLiveEnabled && !user) {
      return { messages: [], settings, online: 0 };
    }
    const rows = await this.prisma.chatMessage.findMany({
      where: { matchId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      take: 200,
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
        parent: { select: { id: true, body: true, user: { select: { name: true } } } },
        reactions: { select: { emoji: true, userId: true } },
      },
    });
    return {
      messages: rows.map((row) => this.chatDto(row, user?.id)),
      settings,
      online: this.realtime.publicViewerCount(matchId),
      canManage: user ? await this.access.canMatch(user, matchId, 'FAN_MANAGE') : false,
    };
  }

  async postChat(user: AuthUser, matchId: string, body: unknown) {
    await this.canViewMatch(user, matchId);
    const settings = await this.matchSettings(matchId);
    if (!settings.chatEnabled) throw Errors.forbidden('Chat is turned off.');
    if (settings.loginRequiredToChat && !user) throw Errors.unauthorized();
    await this.assertNotBlocked(matchId, user.id);
    const parsed = z.object({ body: z.string(), parentId: z.string().optional() }).parse(body);
    const text = sanitizeChatBody(parsed.body);
    if (!text) throw Errors.validation('Message cannot be empty');
    this.assertChatRate(user.id);
    let parentId: string | undefined;
    if (parsed.parentId) {
      const parent = await this.prisma.chatMessage.findFirst({
        where: { id: parsed.parentId, matchId, deletedAt: null },
      });
      if (!parent) throw Errors.validation('Reply target was not found');
      parentId = parent.id;
    }
    const last = await this.prisma.chatMessage.findFirst({
      where: { matchId, userId: user.id, kind: ChatMessageKind.USER, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (last && Date.now() - last.createdAt.getTime() < 20_000 && isDuplicateChat(last.body, text)) {
      throw Errors.validation('Please do not repeat the same message');
    }
    const row = await this.prisma.chatMessage.create({
      data: { matchId, userId: user.id, body: text, kind: ChatMessageKind.USER, parentId },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
        parent: { select: { id: true, body: true, user: { select: { name: true } } } },
        reactions: { select: { emoji: true, userId: true } },
      },
    });
    const dto = this.chatDto(row, user.id);
    this.realtime.emitFan(matchId, LIVE_SOCKET.fanChatMessage, dto);
    return dto;
  }

  async reactChat(user: AuthUser, messageId: string, body: unknown) {
    const emoji = z.enum(FAN_REACT_EMOJIS).parse(z.object({ emoji: z.string() }).parse(body).emoji);
    const row = await this.prisma.chatMessage.findUnique({ where: { id: messageId } });
    if (!row || row.deletedAt) throw Errors.notFound('NOT_FOUND', 'Message not found');
    await this.canViewMatch(user, row.matchId);
    await this.assertNotBlocked(row.matchId, user.id);
    this.assertReactRate(user.id);
    const existing = await this.prisma.chatReaction.findUnique({
      where: { messageId_userId_emoji: { messageId, userId: user.id, emoji } },
    });
    if (existing) {
      await this.prisma.chatReaction.delete({ where: { id: existing.id } });
    } else {
      await this.prisma.chatReaction.create({ data: { messageId, userId: user.id, emoji } });
    }
    const reactions = await this.prisma.chatReaction.findMany({
      where: { messageId },
      select: { emoji: true, userId: true },
    });
    const payload = { id: messageId, matchId: row.matchId, reactions: this.reactionDto(reactions, user.id) };
    this.realtime.emitFan(row.matchId, LIVE_SOCKET.fanChatReaction, payload);
    return payload;
  }

  async deleteChat(user: AuthUser, messageId: string) {
    const row = await this.prisma.chatMessage.findUnique({ where: { id: messageId } });
    if (!row || row.deletedAt) throw Errors.notFound('NOT_FOUND', 'Message not found');
    const own = row.userId === user.id;
    const manage = row.matchId ? await this.access.canMatch(user, row.matchId, 'FAN_MANAGE') : false;
    if (!own && !manage) throw Errors.forbidden("You don't have permission.");
    await this.prisma.chatMessage.update({
      where: { id: messageId },
      data: { deletedAt: new Date(), deletedById: user.id },
    });
    this.realtime.emitFan(row.matchId, LIVE_SOCKET.fanChatDeleted, { id: messageId, matchId: row.matchId });
    return { deleted: true };
  }

  async reportChat(user: AuthUser, messageId: string, body: unknown) {
    const reason = z.object({ reason: z.string().min(2).max(200) }).parse(body).reason;
    const row = await this.prisma.chatMessage.findUnique({ where: { id: messageId } });
    if (!row) throw Errors.notFound('NOT_FOUND', 'Message not found');
    await this.canViewMatch(user, row.matchId);
    return this.prisma.chatReport.create({ data: { messageId, reporterId: user.id, reason } });
  }

  async muteOrBlock(user: AuthUser, messageId: string, blocked: boolean) {
    const row = await this.prisma.chatMessage.findUnique({ where: { id: messageId } });
    if (!row?.userId) throw Errors.notFound('NOT_FOUND', 'Message not found');
    await this.assertFanManageMatch(user, row.matchId);
    await this.prisma.chatMute.upsert({
      where: { matchId_userId: { matchId: row.matchId, userId: row.userId } },
      create: {
        matchId: row.matchId,
        userId: row.userId,
        blocked,
        mutedUntil: blocked ? null : new Date(Date.now() + 3600_000),
        createdById: user.id,
      },
      update: { blocked, mutedUntil: blocked ? null : new Date(Date.now() + 3600_000) },
    });
    this.realtime.emitFan(row.matchId, LIVE_SOCKET.fanChatModerated, { userId: row.userId, blocked });
    return { ok: true };
  }

  async listReports(user: AuthUser, matchId?: string) {
    if (matchId) await this.assertFanManageMatch(user, matchId);
    else if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') throw Errors.forbidden();
    return this.prisma.chatReport.findMany({
      where: { status: ChatReportStatus.OPEN, ...(matchId ? { message: { matchId } } : {}) },
      include: {
        reporter: { select: { id: true, name: true } },
        message: {
          include: { user: { select: { id: true, name: true } }, match: { select: { id: true, title: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async dismissReport(user: AuthUser, id: string) {
    const row = await this.prisma.chatReport.findUnique({ where: { id }, include: { message: true } });
    if (!row) throw Errors.notFound('NOT_FOUND', 'Report not found');
    await this.assertFanManageMatch(user, row.message.matchId);
    return this.prisma.chatReport.update({ where: { id }, data: { status: ChatReportStatus.DISMISSED } });
  }

  async listQuestions(
    user: AuthUser | null,
    opts: { matchId?: string; tournamentId?: string; kind: FanQuestionKind },
  ) {
    if (opts.kind === FanQuestionKind.QUIZ) {
      return this.listQuizQuestions(user, opts);
    }
    if (opts.matchId) {
      await this.canViewMatch(user, opts.matchId);
      const settings = await this.matchSettings(opts.matchId);
      if (!settings.predictionsEnabled) return [];
      await this.ensureMatchDefaults(opts.matchId);
    } else if (opts.tournamentId) {
      await this.canViewTournament(user, opts.tournamentId);
      const settings = await this.tournamentSettings(opts.tournamentId);
      if (!settings.predictionsEnabled) return [];
      await this.ensureTournamentDefaults(opts.tournamentId);
    }
    await this.applyServerLocks(opts);
    if (opts.matchId) await this.refreshNextBatsmanOut(opts.matchId);
    const match = opts.matchId
      ? await this.prisma.match.findUnique({ where: { id: opts.matchId }, select: { status: true } })
      : null;
    const live = match?.status === 'LIVE' || match?.status === 'INNINGS_BREAK';
    const wickets = opts.matchId
      ? await this.prisma.ballEvent.count({ where: { matchId: opts.matchId, isWicket: true, isUndone: false } })
      : 0;
    const rows = await this.prisma.fanQuestion.findMany({
      where: {
        kind: FanQuestionKind.PREDICTION,
        matchId: opts.matchId,
        tournamentId: opts.tournamentId,
        status: { in: [FanQuestionStatus.OPEN, FanQuestionStatus.LOCKED, FanQuestionStatus.SETTLED] },
      },
      include: { options: { orderBy: { sortOrder: 'asc' } }, _count: { select: { answers: true } } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    const mine = user
      ? await this.prisma.fanAnswer.findMany({
          where: { userId: user.id, questionId: { in: rows.map((r) => r.id) } },
        })
      : [];
    const mineMap = new Map(mine.map((a) => [a.questionId, a]));
    const settings = opts.matchId ? await this.matchSettings(opts.matchId) : await this.tournamentSettings(opts.tournamentId!);
    const visible = rows.filter(
      (row) => !row.templateKey || liveTemplateVisible(row.templateKey, { status: match?.status ?? 'SCHEDULED', wickets, live }),
    );
    return Promise.all(visible.map((row) => this.questionDto(row, mineMap.get(row.id), user, settings)));
  }

  private async listQuizQuestions(
    user: AuthUser | null,
    opts: { matchId?: string; tournamentId?: string },
  ) {
    let tournamentId = opts.tournamentId ?? null;
    let matchId = opts.matchId ?? null;
    let vis: FanQuizVisibilityDto;
    if (matchId) {
      const match = await this.canViewMatch(user, matchId);
      tournamentId = match.tournamentId;
      vis = await this.quizVisibilityForMatch(user, matchId);
    } else if (tournamentId) {
      await this.canViewTournament(user, tournamentId);
      vis = await this.quizVisibilityForTournament(user, tournamentId);
    } else {
      return [];
    }
    if (!vis.show || !vis.playable || !tournamentId) return [];
    await this.applyServerLocks({ matchId: matchId ?? undefined, tournamentId, kind: FanQuestionKind.QUIZ });
    const match = matchId
      ? await this.prisma.match.findUnique({ where: { id: matchId }, select: { status: true } })
      : null;
    const live = match?.status === 'LIVE' || match?.status === 'INNINGS_BREAK';
    const wickets = matchId
      ? await this.prisma.ballEvent.count({ where: { matchId, isWicket: true, isUndone: false } })
      : 0;
    const rows = await this.prisma.fanQuestion.findMany({
      where: {
        kind: FanQuestionKind.QUIZ,
        tournamentId,
        status: { in: [FanQuestionStatus.OPEN, FanQuestionStatus.LOCKED, FanQuestionStatus.SETTLED] },
        OR: matchId ? [{ matchId }, { matchId: null }] : [{ matchId: null }],
      },
      include: { options: { orderBy: { sortOrder: 'asc' } }, _count: { select: { answers: true } } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    const mine = user
      ? await this.prisma.fanAnswer.findMany({
          where: { userId: user.id, questionId: { in: rows.map((r) => r.id) } },
        })
      : [];
    const mineMap = new Map(mine.map((a) => [a.questionId, a]));
    const settings = await this.tournamentSettings(tournamentId);
    const visible = rows.filter(
      (row) => !row.templateKey || liveTemplateVisible(row.templateKey, { status: match?.status ?? 'SCHEDULED', wickets, live }),
    );
    return Promise.all(visible.map((row) => this.questionDto(row, mineMap.get(row.id), user, settings)));
  }

  async getQuestion(user: AuthUser | null, id: string) {
    const row = await this.prisma.fanQuestion.findUnique({
      where: { id },
      include: { options: { orderBy: { sortOrder: 'asc' } }, _count: { select: { answers: true } } },
    });
    if (!row || row.status === FanQuestionStatus.DRAFT || row.status === FanQuestionStatus.CANCELLED) {
      throw Errors.notFound('NOT_FOUND', 'Question not found');
    }
    if (row.matchId) await this.canViewMatch(user, row.matchId);
    if (row.tournamentId) await this.canViewTournament(user, row.tournamentId);
    await this.assertQuizQuestionVisible(user, row);
    const mine = user ? await this.prisma.fanAnswer.findUnique({ where: { questionId_userId: { questionId: id, userId: user.id } } }) : null;
    const settings = row.tournamentId
      ? await this.tournamentSettings(row.tournamentId)
      : row.matchId
        ? await this.matchSettings(row.matchId)
        : settingsDto(null);
    return this.questionDto(row, mine, user, settings);
  }

  private async refreshNextBatsmanOut(matchId: string) {
    const row = await this.prisma.fanQuestion.findFirst({
      where: { matchId, templateKey: 'NEXT_BATSMAN_OUT', status: FanQuestionStatus.OPEN },
      include: { _count: { select: { answers: true } } },
    });
    if (!row || row._count.answers > 0) return;
    const last = await this.prisma.ballEvent.findFirst({
      where: { matchId, isUndone: false },
      orderBy: { sequence: 'desc' },
    });
    if (!last) return;
    const players = await this.prisma.player.findMany({
      where: { id: { in: [last.strikerId, last.nonStrikerId] } },
      select: { id: true, name: true },
    });
    if (!players.length) return;
    await this.prisma.fanOption.deleteMany({ where: { questionId: row.id } });
    await this.prisma.fanOption.createMany({
      data: players.map((p, i) => ({ questionId: row.id, label: p.name, playerId: p.id, sortOrder: i })),
    });
  }

  async answer(user: AuthUser, questionId: string, body: unknown) {
    const input = z
      .object({ optionIds: z.array(z.string()).optional(), numberValue: z.number().int().optional() })
      .parse(body);
    const row = await this.prisma.fanQuestion.findUnique({
      where: { id: questionId },
      include: { options: true },
    });
    if (!row) throw Errors.notFound('NOT_FOUND', 'Question not found');
    if (row.matchId) await this.canViewMatch(user, row.matchId);
    if (row.tournamentId) await this.canViewTournament(user, row.tournamentId);
    if (row.kind === FanQuestionKind.QUIZ) {
      await this.assertQuizQuestionVisible(user, row, 'answer');
    }
    await this.applyServerLocks({ matchId: row.matchId ?? undefined, tournamentId: row.tournamentId ?? undefined, kind: row.kind });
    const fresh = await this.prisma.fanQuestion.findUnique({ where: { id: questionId } });
    if (!fresh || fresh.status !== FanQuestionStatus.OPEN) {
      throw Errors.forbidden(row.kind === FanQuestionKind.QUIZ ? 'Question closed' : 'Prediction Locked');
    }
    if (fresh.lockAt && fresh.lockAt <= new Date()) {
      throw Errors.forbidden(row.kind === FanQuestionKind.QUIZ ? 'Question closed' : 'Prediction Locked');
    }
    const existing = await this.prisma.fanAnswer.findUnique({
      where: { questionId_userId: { questionId, userId: user.id } },
    });
    if (existing) throw Errors.conflict('ALREADY_ANSWERED', 'You already submitted an answer');
    const optionIds = input.optionIds ?? [];
    if (fresh.type !== FanQuestionType.NUMBER) {
      const valid = new Set(row.options.map((o) => o.id));
      if (!optionIds.length || optionIds.some((id) => !valid.has(id))) throw Errors.validation('Invalid option');
      if (fresh.type !== FanQuestionType.MULTIPLE_CHOICE && optionIds.length !== 1) {
        throw Errors.validation('Select one option');
      }
      if (fresh.templateKey === 'TOURNAMENT_FINALISTS' && optionIds.length !== 2) {
        throw Errors.validation('Select two finalists');
      }
    } else if (input.numberValue == null) {
      throw Errors.validation('Enter a number');
    }
    return this.prisma.fanAnswer.create({
      data: { questionId, userId: user.id, optionIds, numberValue: input.numberValue },
    });
  }

  async createQuestion(user: AuthUser, body: unknown) {
    const input = z
      .object({
        kind: z.nativeEnum(FanQuestionKind),
        type: z.nativeEnum(FanQuestionType).optional(),
        scope: z.nativeEnum(FanQuestionScope),
        matchId: z.string().optional(),
        tournamentId: z.string().optional(),
        title: z.string().min(2).max(120),
        question: z.string().min(2).max(240),
        description: z.string().max(400).optional(),
        points: z.number().int().optional(),
        options: z.array(z.object({ label: z.string().min(1).max(80), playerId: z.string().optional(), teamId: z.string().optional() })).max(20).optional(),
        openAt: z.string().datetime().optional(),
        lockAt: z.string().datetime().optional(),
        timeLimitSec: z.number().int().min(10).max(3600).optional(),
        settlementMode: z.nativeEnum(FanSettlementMode).optional(),
        correctOptionIndexes: z.array(z.number().int()).optional(),
        correctNumber: z.number().int().optional(),
        publish: z.boolean().optional(),
      })
      .parse(body);
    if (input.matchId) await this.assertFanManageMatch(user, input.matchId);
    else if (input.tournamentId) await this.assertFanManageTournament(user, input.tournamentId);
    else throw Errors.validation('Match or tournament required');
    let tournamentId = input.tournamentId ?? null;
    let matchId = input.matchId ?? null;
    if (matchId) {
      const match = await this.prisma.match.findUnique({ where: { id: matchId }, select: { tournamentId: true } });
      if (!match) throw Errors.notFound('MATCH_NOT_FOUND', 'This match is no longer available.');
      tournamentId = match.tournamentId ?? tournamentId;
    }
    if (input.kind === FanQuestionKind.QUIZ && !tournamentId) {
      throw Errors.validation('Fan Quiz questions must belong to a tournament.');
    }
    if (matchId && tournamentId) {
      const match = await this.prisma.match.findUnique({ where: { id: matchId }, select: { tournamentId: true } });
      if (match && match.tournamentId !== tournamentId) {
        throw Errors.validation('Question match must belong to the same tournament.');
      }
    }
    const options = input.options ?? [];
    const siblingWhere = {
      kind: input.kind,
      ...(matchId ? { matchId } : { tournamentId, matchId: null }),
    };
    const last = await this.prisma.fanQuestion.aggregate({ where: siblingWhere, _max: { sortOrder: true } });
    const correctIds: string[] = [];
    const created = await this.prisma.fanQuestion.create({
      data: {
        kind: input.kind,
        type: input.type ?? FanQuestionType.SINGLE_CHOICE,
        scope: input.scope,
        matchId,
        tournamentId,
        sortOrder: (last._max.sortOrder ?? -1) + 1,
        title: input.title,
        question: input.question,
        description: input.description,
        points: boundFanPoints(input.points, input.kind === FanQuestionKind.QUIZ ? 5 : 10),
        status: input.publish ? FanQuestionStatus.OPEN : FanQuestionStatus.DRAFT,
        publishedAt: input.publish ? new Date() : null,
        openAt: input.openAt ? new Date(input.openAt) : new Date(),
        lockAt: input.lockAt ? new Date(input.lockAt) : null,
        timeLimitSec: input.timeLimitSec,
        settlementMode: input.settlementMode ?? FanSettlementMode.MANUAL,
        correctNumber: input.correctNumber,
        createdById: user.id,
        options: {
          create: options.map((opt, i) => ({
            label: opt.label,
            playerId: opt.playerId,
            teamId: opt.teamId,
            sortOrder: i,
          })),
        },
      },
      include: { options: true },
    });
    if (input.correctOptionIndexes?.length) {
      for (const idx of input.correctOptionIndexes) {
        const opt = created.options[idx];
        if (opt) correctIds.push(opt.id);
      }
      await this.prisma.fanQuestion.update({ where: { id: created.id }, data: { correctOptionIds: correctIds } });
    }
    return this.prisma.fanQuestion.findUniqueOrThrow({ where: { id: created.id }, include: { options: true } });
  }

  async cancelQuestion(user: AuthUser, id: string) {
    const row = await this.prisma.fanQuestion.findUnique({ where: { id } });
    if (!row) throw Errors.notFound('NOT_FOUND', 'Question not found');
    if (row.matchId) await this.assertFanManageMatch(user, row.matchId);
    if (row.tournamentId) await this.assertFanManageTournament(user, row.tournamentId);
    return this.prisma.fanQuestion.update({
      where: { id },
      data: { status: FanQuestionStatus.CANCELLED, cancelledAt: new Date() },
    });
  }

  async settleManual(user: AuthUser, id: string, body: unknown) {
    const input = z.object({ correctOptionIds: z.array(z.string()).optional(), correctNumber: z.number().int().optional() }).parse(body);
    const row = await this.prisma.fanQuestion.findUnique({ where: { id } });
    if (!row) throw Errors.notFound('NOT_FOUND', 'Question not found');
    if (row.matchId) await this.assertFanManageMatch(user, row.matchId);
    if (row.tournamentId) await this.assertFanManageTournament(user, row.tournamentId);
    if (row.status === FanQuestionStatus.SETTLED) return { settled: true, already: true };
    await this.prisma.fanQuestion.update({
      where: { id },
      data: {
        correctOptionIds: input.correctOptionIds ?? row.correctOptionIds,
        correctNumber: input.correctNumber ?? row.correctNumber,
      },
    });
    await this.settleQuestion(id);
    return { settled: true };
  }

  async adjustPoints(user: AuthUser, body: unknown) {
    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') throw Errors.forbidden();
    const input = z
      .object({
        userId: z.string(),
        points: z.number().int().min(-50).max(50),
        reason: z.string().min(3).max(200),
        sourceId: z.string(),
        matchId: z.string().optional(),
        tournamentId: z.string().optional(),
      })
      .parse(body);
    await this.access.audit(user.id, 'FAN_POINTS_ADJUST', 'User', input.userId, { points: input.points, reason: input.reason });
    return this.prisma.fanPointTransaction.create({
      data: {
        userId: input.userId,
        sourceType: FanPointSource.ADMIN_ADJUSTMENT,
        sourceId: input.sourceId,
        points: input.points,
        reason: input.reason,
        matchId: input.matchId,
        tournamentId: input.tournamentId,
        createdById: user.id,
      },
    });
  }

  async leaderboard(scope: { matchId?: string; tournamentId?: string }, user: AuthUser | null) {
    if (scope.matchId) await this.canViewMatch(user, scope.matchId);
    if (scope.tournamentId) await this.canViewTournament(user, scope.tournamentId);
    const where: Prisma.FanPointTransactionWhereInput = scope.matchId
      ? { matchId: scope.matchId }
      : scope.tournamentId
        ? { tournamentId: scope.tournamentId }
        : {};
    const grouped = await this.prisma.fanPointTransaction.groupBy({
      by: ['userId'],
      where,
      _sum: { points: true },
      _min: { createdAt: true },
    });
    const pred = await this.prisma.fanPointTransaction.groupBy({
      by: ['userId'],
      where: { ...where, sourceType: { in: [FanPointSource.PREDICTION_CORRECT, FanPointSource.TOURNAMENT_PREDICTION] } },
      _count: true,
    });
    const quiz = await this.prisma.fanPointTransaction.groupBy({
      by: ['userId'],
      where: { ...where, sourceType: { in: [FanPointSource.QUIZ_CORRECT, FanPointSource.QUIZ_FAST] } },
      _count: true,
    });
    const predMap = new Map(pred.map((r) => [r.userId, r._count]));
    const quizMap = new Map(quiz.map((r) => [r.userId, r._count]));
    const ranked = rankFanRows(
      grouped.map((g) => ({
        userId: g.userId,
        points: g._sum.points ?? 0,
        correctPredictions: predMap.get(g.userId) ?? 0,
        correctQuizzes: quizMap.get(g.userId) ?? 0,
        firstPointAt: g._min.createdAt,
      })),
    );
    const users = await this.prisma.user.findMany({
      where: { id: { in: ranked.map((r) => r.userId) } },
      select: { id: true, name: true, avatarUrl: true },
    });
    const badges = await this.prisma.fanBadgeAward.findMany({
      where: { userId: { in: ranked.map((r) => r.userId) } },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));
    const badgeMap = new Map<string, string[]>();
    for (const b of badges) {
      const list = badgeMap.get(b.userId) ?? [];
      list.push(b.badgeKey);
      badgeMap.set(b.userId, list);
    }
    const rows = ranked.map((r) => ({
      ...r,
      name: userMap.get(r.userId)?.name ?? 'Fan',
      avatarUrl: userMap.get(r.userId)?.avatarUrl ?? null,
      badges: badgeMap.get(r.userId) ?? [],
    }));
    const me = user ? rows.find((r) => r.userId === user.id) : null;
    return { rows: rows.slice(0, 50), me: me ? { rank: me.rank, points: me.points } : null };
  }

  async myProfile(user: AuthUser) {
    const txs = await this.prisma.fanPointTransaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const points = txs.reduce((s, t) => s + t.points, 0);
    const answers = await this.prisma.fanAnswer.count({ where: { userId: user.id } });
    const predCorrect = txs.filter((t) => t.sourceType === FanPointSource.PREDICTION_CORRECT || t.sourceType === FanPointSource.TOURNAMENT_PREDICTION).length;
    const quizCorrect = txs.filter((t) => t.sourceType === FanPointSource.QUIZ_CORRECT || t.sourceType === FanPointSource.QUIZ_FAST).length;
    const quizAnswers = await this.prisma.fanAnswer.count({
      where: { userId: user.id, question: { kind: FanQuestionKind.QUIZ } },
    });
    const predAnswers = answers - quizAnswers;
    const global = await this.leaderboard({}, user);
    const badges = await this.prisma.fanBadgeAward.findMany({ where: { userId: user.id } });
    return {
      user: { id: user.id, name: user.name },
      points,
      rank: global.me?.rank ?? null,
      predictions: predAnswers,
      predictionsCorrect: predCorrect,
      accuracy: predAnswers ? Math.round((predCorrect / predAnswers) * 1000) / 10 : 0,
      quizzes: quizAnswers,
      quizzesCorrect: quizCorrect,
      badges: badges.map((b) => b.badgeKey),
      history: txs,
    };
  }

  async onScoringEvent(matchId: string, input: {
    batsmanRuns: number;
    extraRuns: number;
    isWicket: boolean;
    isUndone?: boolean;
    strikerId: string;
    bowlerId: string;
    dismissedPlayerId?: string | null;
    overNumber: number;
    ballInOver: number;
    duplicate?: boolean;
    matchCompleted?: boolean;
    totalRuns?: number;
    totalWickets?: number;
    oversComplete?: boolean;
  }) {
    if (input.duplicate || input.isUndone) return;
    const names = await this.playerNames([input.strikerId, input.bowlerId, input.dismissedPlayerId]);
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: { homeTeam: { select: { name: true } }, awayTeam: { select: { name: true, id: true } }, resultWinner: { select: { name: true } } },
    });
    if (!match) return;
    const batting = match.homeTeam.name;
    if (input.batsmanRuns === 6) await this.systemChat(matchId, `🏏 ${names.get(input.strikerId) ?? 'Batter'} scored 6 runs`);
    if (input.totalRuns != null && input.totalRuns - (input.batsmanRuns + input.extraRuns) < 50 && input.totalRuns >= 50) {
      await this.systemChat(matchId, `🔥 ${batting} reached 50 runs`);
    }
    if (input.isWicket) await this.systemChat(matchId, `🎯 ${input.totalWickets ?? 1} wicket down`);
    if (input.oversComplete) await this.systemChat(matchId, `🏁 Over ${input.overNumber + 1} completed`);
    if (input.matchCompleted) {
      const winner = match.resultWinner?.name ?? match.homeTeam.name;
      await this.systemChat(matchId, `🏆 ${winner} won the match`);
    }
    if (input.isWicket) {
      await this.settleByTemplate(matchId, 'NEXT_WICKET', { playerId: input.bowlerId });
      await this.settleByTemplate(matchId, 'NEXT_BATSMAN_OUT', { playerId: input.dismissedPlayerId ?? input.strikerId });
      const wickets = await this.prisma.ballEvent.count({ where: { matchId, isWicket: true, isUndone: false } });
      if (wickets === 1) await this.settleByTemplate(matchId, 'FIRST_WICKET', { playerId: input.bowlerId });
    }
    if (input.batsmanRuns === 4 || input.batsmanRuns === 6) {
      await this.settleByTemplate(matchId, 'NEXT_BOUNDARY', { playerId: input.strikerId });
    }
    if (input.oversComplete) {
      const overBalls = await this.prisma.ballEvent.findMany({
        where: { matchId, overNumber: input.overNumber, isUndone: false },
      });
      const runs = overBalls.reduce((s, e) => s + e.totalRuns, 0);
      const boundary = overBalls.some((e) => e.batsmanRuns >= 4);
      await this.settleByTemplate(matchId, 'NEXT_OVER_BOUNDARY', { yes: boundary });
      await this.settleByTemplate(matchId, 'NEXT_OVER_10', { yes: runs >= 10 });
    }
    if (input.matchCompleted) await this.settleCompletedMatch(matchId);
  }

  private async settleCompletedMatch(matchId: string) {
    const facts = await this.matchFacts(matchId);
    await this.settleByTemplate(matchId, 'MATCH_WINNER', { teamId: facts.winnerTeamId });
    await this.settleByTemplate(matchId, 'MOST_RUNS', { playerId: facts.mostRunsId });
    await this.settleByTemplate(matchId, 'MOST_SIXES', { playerId: facts.mostSixesId });
    await this.settleByTemplate(matchId, 'POTM', { playerId: facts.potmId ?? facts.mostRunsId });
    await this.settleByTemplate(matchId, 'TOTAL_RUNS', { number: facts.totalRuns });
    await this.settleByTemplate(matchId, 'TOTAL_WICKETS', { number: facts.totalWickets });
    await this.settleByTemplate(matchId, 'QUIZ_WINNER', { teamId: facts.winnerTeamId });
    await this.settleByTemplate(matchId, 'QUIZ_MOST_RUNS', { playerId: facts.mostRunsId });
    await this.settleByTemplate(matchId, 'QUIZ_MOST_SIXES', { playerId: facts.mostSixesId });
    await this.settleByTemplate(matchId, 'QUIZ_FIRST_BOUNDARY', { playerId: facts.firstBoundaryId });
    await this.settleByTemplate(matchId, 'QUIZ_FIRST_WICKET', { playerId: facts.firstWicketBowlerId });
    await this.settleByTemplate(matchId, 'QUIZ_HIGHEST_TEAM', { teamId: facts.highestTeamId });
    await this.settleByTemplate(matchId, 'QUIZ_WICKETS', { number: facts.totalWickets });
    await this.settleByTemplate(matchId, 'QUIZ_POTM', { playerId: facts.potmId ?? facts.mostRunsId });
    if (facts.tournamentId) await this.maybeSettleTournament(facts.tournamentId);
  }

  private async maybeSettleTournament(tournamentId: string) {
    const matches = await this.prisma.match.findMany({
      where: { tournamentId, status: { notIn: ['CANCELLED'] } },
      select: { status: true, title: true, resultWinnerTeamId: true, homeTeamId: true, awayTeamId: true },
    });
    const semis = matches.filter((m) => /semi/i.test(m.title));
    if (semis.length >= 2 && semis.every((m) => m.status === 'COMPLETED' && m.resultWinnerTeamId)) {
      await this.settleByTemplate(
        undefined,
        'TOURNAMENT_FINALISTS',
        { teamIds: semis.map((m) => m.resultWinnerTeamId!).filter(Boolean) },
        tournamentId,
      );
    }
    const final = matches.find((m) => /final/i.test(m.title) && !/semi/i.test(m.title));
    if (final?.homeTeamId && final.awayTeamId) {
      await this.settleByTemplate(undefined, 'TOURNAMENT_FINALISTS', { teamIds: [final.homeTeamId, final.awayTeamId] }, tournamentId);
    }
    if (final?.resultWinnerTeamId && final.status === 'COMPLETED') {
      await this.settleByTemplate(undefined, 'TOURNAMENT_WINNER', { teamId: final.resultWinnerTeamId }, tournamentId);
    }
    const allDone = matches.length > 0 && matches.every((m) => m.status === 'COMPLETED' || m.status === 'ABANDONED');
    if (!allDone) return;
    const top = await this.prisma.tournamentPoint.findFirst({
      where: { tournamentId },
      orderBy: [{ points: 'desc' }, { nrr: 'desc' }],
    });
    if (top) await this.settleByTemplate(undefined, 'TOP_GROUP', { teamId: top.teamId }, tournamentId);
    const matchIds = (
      await this.prisma.match.findMany({ where: { tournamentId }, select: { id: true } })
    ).map((m) => m.id);
    const events = await this.prisma.ballEvent.findMany({
      where: { matchId: { in: matchIds }, isUndone: false },
      select: { strikerId: true, bowlerId: true, batsmanRuns: true, isWicket: true },
    });
    const runs = new Map<string, number>();
    const wickets = new Map<string, number>();
    for (const ev of events) {
      runs.set(ev.strikerId, (runs.get(ev.strikerId) ?? 0) + ev.batsmanRuns);
      if (ev.isWicket) wickets.set(ev.bowlerId, (wickets.get(ev.bowlerId) ?? 0) + 1);
    }
    const topId = (map: Map<string, number>) => [...map.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const mostRuns = topId(runs);
    const mostWickets = topId(wickets);
    if (mostRuns) await this.settleByTemplate(undefined, 'TOURNAMENT_MOST_RUNS', { playerId: mostRuns }, tournamentId);
    if (mostWickets) await this.settleByTemplate(undefined, 'TOURNAMENT_MOST_WICKETS', { playerId: mostWickets }, tournamentId);
    if (mostRuns) await this.settleByTemplate(undefined, 'TOURNAMENT_MVP', { playerId: mostRuns }, tournamentId);
  }

  private async settleByTemplate(
    matchId: string | undefined,
    templateKey: string,
    answer: { playerId?: string | null; teamId?: string | null; teamIds?: string[]; number?: number; yes?: boolean },
    tournamentId?: string,
  ) {
    const rows = await this.prisma.fanQuestion.findMany({
      where: {
        templateKey,
        status: { in: [FanQuestionStatus.OPEN, FanQuestionStatus.LOCKED] },
        ...(matchId ? { matchId } : {}),
        ...(tournamentId ? { tournamentId } : {}),
      },
      include: { options: true },
    });
    for (const row of rows) {
      let correct: string[] = [];
      if (answer.playerId) correct = row.options.filter((o) => o.playerId === answer.playerId).map((o) => o.id);
      else if (answer.teamIds?.length) correct = row.options.filter((o) => o.teamId && answer.teamIds!.includes(o.teamId)).map((o) => o.id);
      else if (answer.teamId) correct = row.options.filter((o) => o.teamId === answer.teamId).map((o) => o.id);
      else if (answer.yes != null) {
        const label = answer.yes ? 'Yes' : 'No';
        correct = row.options.filter((o) => o.label.toLowerCase() === label.toLowerCase()).map((o) => o.id);
      }
      await this.prisma.fanQuestion.update({
        where: { id: row.id },
        data: {
          status: FanQuestionStatus.LOCKED,
          lockedAt: row.lockedAt ?? new Date(),
          correctOptionIds: correct,
          correctNumber: answer.number ?? row.correctNumber,
        },
      });
      await this.settleQuestion(row.id);
    }
  }

  private async settleQuestion(questionId: string) {
    const row = await this.prisma.fanQuestion.findUnique({
      where: { id: questionId },
      include: { answers: true },
    });
    if (!row || row.status === FanQuestionStatus.SETTLED || row.status === FanQuestionStatus.CANCELLED) return;
    const sourceType =
      row.kind === FanQuestionKind.QUIZ
        ? FanPointSource.QUIZ_CORRECT
        : row.scope === FanQuestionScope.TOURNAMENT
          ? FanPointSource.TOURNAMENT_PREDICTION
          : FanPointSource.PREDICTION_CORRECT;
    for (const ans of row.answers) {
      const ok = answerIsCorrect({
        type: row.type,
        optionIds: ans.optionIds,
        numberValue: ans.numberValue,
        correctOptionIds: row.correctOptionIds,
        correctNumber: row.correctNumber,
      });
      const fast =
        ok &&
        row.kind === FanQuestionKind.QUIZ &&
        row.publishedAt &&
        ans.createdAt.getTime() - row.publishedAt.getTime() <= 30_000;
      const points = ok ? (fast ? Math.max(row.points, 10) : row.points) : 0;
      if (points > 0) {
        try {
          await this.prisma.fanPointTransaction.create({
            data: {
              userId: ans.userId,
              sourceType: fast ? FanPointSource.QUIZ_FAST : sourceType,
              sourceId: row.id,
              points,
              reason: row.kind === FanQuestionKind.QUIZ ? (fast ? 'Fast correct quiz' : 'Correct Quiz') : 'Correct prediction',
              matchId: row.matchId,
              tournamentId: row.tournamentId,
            },
          });
        } catch (err) {
          if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err;
        }
      }
      await this.refreshBadges(ans.userId);
    }
    await this.prisma.fanQuestion.update({
      where: { id: questionId },
      data: { status: FanQuestionStatus.SETTLED, settledAt: new Date(), lockedAt: row.lockedAt ?? new Date() },
    });
    if (row.matchId) this.realtime.emitFan(row.matchId, LIVE_SOCKET.fanPredictionSettled, { id: row.id });
  }

  private async refreshBadges(userId: string) {
    const txs = await this.prisma.fanPointTransaction.findMany({ where: { userId } });
    const pred = txs.filter((t) => t.sourceType === FanPointSource.PREDICTION_CORRECT || t.sourceType === FanPointSource.TOURNAMENT_PREDICTION).length;
    const quiz = txs.filter((t) => t.sourceType === FanPointSource.QUIZ_CORRECT).length;
    const fast = txs.filter((t) => t.sourceType === FanPointSource.QUIZ_FAST).length;
    const tour = txs.filter((t) => t.sourceType === FanPointSource.TOURNAMENT_PREDICTION).length;
    const keys = badgesForStats({
      correctPredictions: pred,
      correctQuizzes: quiz,
      fastQuizzes: fast,
      tournamentCorrect: tour,
      matchPerfect: false,
      globalRank: null,
      points: txs.reduce((s, t) => s + t.points, 0),
    });
    for (const badgeKey of keys) {
      await this.prisma.fanBadgeAward.upsert({
        where: { userId_badgeKey: { userId, badgeKey } },
        create: { userId, badgeKey },
        update: {},
      });
    }
  }

  private async matchFacts(matchId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: { innings: true },
    });
    const events = await this.prisma.ballEvent.findMany({
      where: { matchId, isUndone: false },
      orderBy: { sequence: 'asc' },
    });
    if (!match) {
      return {
        winnerTeamId: null as string | null,
        mostRunsId: null as string | null,
        mostSixesId: null as string | null,
        potmId: null as string | null,
        firstBoundaryId: null as string | null,
        firstWicketBowlerId: null as string | null,
        highestTeamId: null as string | null,
        totalRuns: 0,
        totalWickets: 0,
        tournamentId: null as string | null,
      };
    }
    const runs = new Map<string, number>();
    const sixes = new Map<string, number>();
    let firstBoundary: string | null = null;
    let firstWicket: string | null = null;
    for (const ev of events) {
      runs.set(ev.strikerId, (runs.get(ev.strikerId) ?? 0) + ev.batsmanRuns);
      if (ev.batsmanRuns === 6) sixes.set(ev.strikerId, (sixes.get(ev.strikerId) ?? 0) + 1);
      if (!firstBoundary && ev.batsmanRuns >= 4) firstBoundary = ev.strikerId;
      if (!firstWicket && ev.isWicket) firstWicket = ev.bowlerId;
    }
    const top = (map: Map<string, number>) => [...map.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const innRuns = match.innings.map((i) => ({ teamId: i.battingTeamId, runs: i.totalRuns }));
    const highestTeam = innRuns.sort((a, b) => b.runs - a.runs)[0]?.teamId ?? match.homeTeamId;
    return {
      winnerTeamId: match.resultWinnerTeamId,
      mostRunsId: top(runs),
      mostSixesId: top(sixes),
      potmId: top(runs),
      firstBoundaryId: firstBoundary,
      firstWicketBowlerId: firstWicket,
      highestTeamId: highestTeam,
      totalRuns: match.innings.reduce((s, i) => s + i.totalRuns, 0),
      totalWickets: match.innings.reduce((s, i) => s + i.totalWickets, 0),
      tournamentId: match.tournamentId,
    };
  }

  async ensureMatchDefaults(matchId: string) {
    const existing = await this.prisma.fanQuestion.count({ where: { matchId } });
    if (existing) return;
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        homeTeam: true,
        awayTeam: true,
        players: { include: { player: { select: { id: true, name: true } } } },
      },
    });
    if (!match) return;
    const teams = [
      { label: match.homeTeam.name, teamId: match.homeTeamId },
      { label: match.awayTeam.name, teamId: match.awayTeamId },
    ];
    const players = match.players.map((p) => ({ label: p.player.name, playerId: p.player.id }));
    const yesNo = [{ label: 'Yes' }, { label: 'No' }];
    for (const tpl of MATCH_PREDICTION_TEMPLATES) {
      const options = tpl.type === 'TEAM' ? teams : tpl.type === 'YES_NO' ? yesNo : players.slice(0, 16);
      if (tpl.type !== 'NUMBER' && !options.length) continue;
      await this.prisma.fanQuestion.create({
        data: {
          kind: FanQuestionKind.PREDICTION,
          type: tpl.type as FanQuestionType,
          scope: FanQuestionScope.MATCH,
          matchId,
          title: tpl.title,
          question: tpl.title,
          points: tpl.points,
          status: FanQuestionStatus.OPEN,
          publishedAt: new Date(),
          templateKey: tpl.key,
          settlementMode: FanSettlementMode.AUTO,
          options: { create: options.map((o, i) => ({ ...o, sortOrder: i })) },
        },
      });
    }
  }

  async ensureTournamentDefaults(tournamentId: string) {
    const existing = await this.prisma.fanQuestion.count({ where: { tournamentId, kind: FanQuestionKind.PREDICTION } });
    if (existing) return;
    const groups = await this.prisma.tournamentGroup.findMany({
      where: { tournamentId },
      include: { teams: { include: { team: true } } },
    });
    const teams = groups.flatMap((g) => g.teams.map((x) => ({ label: x.team.name, teamId: x.teamId })));
    const unique = [...new Map(teams.map((t) => [t.teamId, t])).values()];
    if (unique.length < 2) return;
    const roster = await this.prisma.matchPlayer.findMany({
      where: { match: { tournamentId } },
      include: { player: { select: { id: true, name: true } } },
      take: 80,
    });
    const players = [...new Map(roster.map((p) => [p.player.id, { label: p.player.name, playerId: p.player.id }])).values()];
    for (const tpl of TOURNAMENT_PREDICTION_TEMPLATES) {
      const options = tpl.type === 'PLAYER' ? players.slice(0, 16) : unique;
      if (!options.length) continue;
      await this.prisma.fanQuestion.create({
        data: {
          kind: FanQuestionKind.PREDICTION,
          type: tpl.type as FanQuestionType,
          scope: FanQuestionScope.TOURNAMENT,
          tournamentId,
          title: tpl.title,
          question: tpl.title,
          points: tpl.points,
          status: FanQuestionStatus.OPEN,
          publishedAt: new Date(),
          templateKey: tpl.key,
          settlementMode: FanSettlementMode.AUTO,
          options: { create: options.map((o, i) => ({ ...o, sortOrder: i })) },
        },
      });
    }
  }

  /**
   * Operates strictly on the passed `db` client so it can run inside the same
   * transaction as the tournament fan-quiz settings write.
   */
  private async ensureTournamentQuizDefaults(db: Prisma.TransactionClient, tournamentId: string) {
    const existing = await db.fanQuestion.count({ where: { tournamentId, kind: FanQuestionKind.QUIZ } });
    if (existing) return;
    for (const tpl of TOURNAMENT_QUIZ_TEMPLATES) {
      await db.fanQuestion.create({
        data: {
          kind: FanQuestionKind.QUIZ,
          type: FanQuestionType.SINGLE_CHOICE,
          scope: FanQuestionScope.TOURNAMENT,
          tournamentId,
          title: tpl.title,
          question: tpl.title,
          points: tpl.points,
          status: FanQuestionStatus.DRAFT,
          templateKey: tpl.key,
          settlementMode: FanSettlementMode.MANUAL,
          options: { create: [{ label: '', sortOrder: 0 }, { label: '', sortOrder: 1 }] },
        },
      });
    }
  }

  private async applyServerLocks(opts: { matchId?: string; tournamentId?: string; kind: FanQuestionKind }) {
    const now = new Date();
    const open = await this.prisma.fanQuestion.findMany({
      where: {
        kind: opts.kind,
        matchId: opts.matchId,
        tournamentId: opts.tournamentId,
        status: FanQuestionStatus.OPEN,
      },
    });
    for (const row of open) {
      const timedOut = row.lockAt && row.lockAt <= now;
      const quizExpired = row.timeLimitSec && row.publishedAt && now.getTime() - row.publishedAt.getTime() >= row.timeLimitSec * 1000;
      let matchLock = false;
      if (row.templateKey === 'MATCH_WINNER' && row.matchId) {
        const match = await this.prisma.match.findUnique({ where: { id: row.matchId }, select: { status: true } });
        matchLock = Boolean(match && ['LIVE', 'INNINGS_BREAK', 'COMPLETED'].includes(match.status));
      }
      if (timedOut || quizExpired || matchLock) {
        await this.prisma.fanQuestion.update({
          where: { id: row.id },
          data: { status: FanQuestionStatus.LOCKED, lockedAt: now },
        });
        if (row.matchId) this.realtime.emitFan(row.matchId, LIVE_SOCKET.fanPredictionLocked, { id: row.id });
      }
    }
  }

  private async systemChat(matchId: string, body: string) {
    const settings = await this.matchSettings(matchId);
    if (!settings.chatEnabled) return;
    const row = await this.prisma.chatMessage.create({
      data: { matchId, body, kind: ChatMessageKind.SYSTEM },
    });
    this.realtime.emitFan(matchId, LIVE_SOCKET.fanChatMessage, this.chatDto({ ...row, user: null }));
  }

  private async playerNames(ids: Array<string | null | undefined>) {
    const clean = [...new Set(ids.filter((id): id is string => Boolean(id)))];
    if (!clean.length) return new Map<string, string>();
    const rows = await this.prisma.player.findMany({ where: { id: { in: clean } }, select: { id: true, name: true } });
    return new Map(rows.map((p) => [p.id, p.name]));
  }

  private async assertNotBlocked(matchId: string, userId: string) {
    const mute = await this.prisma.chatMute.findUnique({ where: { matchId_userId: { matchId, userId } } });
    if (!mute) return;
    if (mute.blocked) throw Errors.forbidden('You cannot post in this chat.');
    if (mute.mutedUntil && mute.mutedUntil > new Date()) throw Errors.forbidden('You are muted in this chat.');
  }

  private assertChatRate(userId: string) {
    const now = Date.now();
    const hits = (chatHits.get(userId) ?? []).filter((t) => now - t < FAN_CHAT_RATE.windowMs);
    if (hits.length >= FAN_CHAT_RATE.max) throw Errors.forbidden('You are sending messages too quickly.');
    hits.push(now);
    chatHits.set(userId, hits);
  }

  private assertReactRate(userId: string) {
    const now = Date.now();
    const hits = (reactHits.get(userId) ?? []).filter((t) => now - t < FAN_REACT_RATE.windowMs);
    if (hits.length >= FAN_REACT_RATE.max) throw Errors.forbidden('You are reacting too quickly.');
    hits.push(now);
    reactHits.set(userId, hits);
  }

  private reactionDto(rows: Array<{ emoji: string; userId: string }>, viewerId?: string) {
    const map = new Map<string, { emoji: string; count: number; mine: boolean }>();
    for (const row of rows) {
      const cur = map.get(row.emoji) ?? { emoji: row.emoji, count: 0, mine: false };
      cur.count += 1;
      if (viewerId && row.userId === viewerId) cur.mine = true;
      map.set(row.emoji, cur);
    }
    return [...map.values()];
  }

  private chatDto(
    row: {
      id: string;
      matchId: string;
      body: string;
      kind: ChatMessageKind;
      createdAt: Date;
      parentId?: string | null;
      user?: { id: string; name: string; avatarUrl?: string | null } | null;
      parent?: { id: string; body: string; user?: { name: string } | null } | null;
      reactions?: Array<{ emoji: string; userId: string }>;
    },
    viewerId?: string,
  ) {
    return {
      id: row.id,
      matchId: row.matchId,
      body: row.body,
      kind: row.kind,
      createdAt: row.createdAt,
      parentId: row.parentId ?? null,
      replyTo: row.parent
        ? { id: row.parent.id, body: row.parent.body, name: row.parent.user?.name ?? null }
        : null,
      reactions: this.reactionDto(row.reactions ?? [], viewerId),
      user: row.user ? { id: row.user.id, name: row.user.name, avatarUrl: row.user.avatarUrl ?? null } : null,
    };
  }

  async playQuiz(user: AuthUser | null, opts: { matchId?: string; tournamentId?: string; preview?: boolean }) {
    const vis = opts.matchId
      ? await this.quizVisibilityForMatch(user, opts.matchId)
      : opts.tournamentId
        ? await this.quizVisibilityForTournament(user, opts.tournamentId)
        : quizVisibilityDto(false, null, null, null, false);
    if (opts.preview) {
      if (!user) throw Errors.unauthorized();
      if (opts.matchId) await this.assertFanManageMatch(user, opts.matchId);
      else if (opts.tournamentId) await this.assertFanManageTournament(user, opts.tournamentId);
      else throw Errors.validation('Match or tournament required');
      let tournamentId = vis.tournamentId ?? opts.tournamentId ?? null;
      if (!tournamentId && opts.matchId) {
        const match = await this.prisma.match.findUnique({ where: { id: opts.matchId }, select: { tournamentId: true } });
        tournamentId = match?.tournamentId ?? null;
      }
      const settings = tournamentId ? await this.tournamentSettings(tournamentId) : settingsDto(null);
      const quizzes = tournamentId ? await this.prisma.quiz.findMany({ where: { tournamentId } }) : [];
      const primary = tournamentId ? pickPrimaryQuiz(quizzes, settings.quizzesEnabled, tournamentId) : null;
      const tn = tournamentId
        ? await this.prisma.tournament.findUnique({ where: { id: tournamentId }, select: { name: true } })
        : null;
      const questions = await this.listAdminQuestions(user, { matchId: opts.matchId, tournamentId: opts.tournamentId, preview: true });
      return {
        visibility: {
          show: true,
          comingSoon: false,
          playable: true,
          tournamentId,
          tournamentName: tn?.name ?? vis.tournamentName,
          quizName: primary?.name ?? vis.quizName,
          quizDescription: primary?.description ?? vis.quizDescription,
          quizStatus: primary?.status ?? vis.quizStatus,
        },
        questions,
        result: null,
      };
    }
    if (!vis.show) {
      return { visibility: vis, questions: [] as Awaited<ReturnType<FanService['listQuizQuestions']>>, result: null };
    }
    const questions = opts.preview
      ? await this.listAdminQuestions(user!, { matchId: opts.matchId, tournamentId: opts.tournamentId, preview: true })
      : vis.playable
        ? await this.listQuizQuestions(user, opts)
        : [];
    const answered = questions.filter((q) => q.myAnswer);
    const closable = questions.filter((q) => q.status === 'OPEN' || q.status === 'LOCKED' || q.status === 'SETTLED');
    const completed = !opts.preview && closable.length > 0 && answered.length >= closable.length;
    let result: { score: number; total: number; accuracy: number } | null = null;
    if (completed && user) {
      const raw = await this.prisma.fanQuestion.findMany({
        where: { id: { in: closable.map((q) => q.id) } },
        select: { id: true, type: true, correctOptionIds: true, correctNumber: true },
      });
      const mine = await this.prisma.fanAnswer.findMany({
        where: { userId: user.id, questionId: { in: raw.map((r) => r.id) } },
      });
      const mineMap = new Map(mine.map((a) => [a.questionId, a]));
      let score = 0;
      for (const row of raw) {
        const ans = mineMap.get(row.id);
        if (!ans) continue;
        if (
          answerIsCorrect({
            type: row.type,
            optionIds: ans.optionIds,
            numberValue: ans.numberValue,
            correctOptionIds: row.correctOptionIds,
            correctNumber: row.correctNumber,
          })
        ) {
          score += 1;
        }
      }
      const total = raw.length;
      result = { score, total, accuracy: total ? Math.round((score / total) * 100) : 0 };
    }
    return { visibility: vis, questions, result };
  }

  async listAdminQuestions(
    user: AuthUser,
    opts: { matchId?: string; tournamentId?: string; preview?: boolean },
  ) {
    let tournamentId = opts.tournamentId ?? null;
    if (opts.matchId) {
      await this.assertFanManageMatch(user, opts.matchId);
      const match = await this.prisma.match.findUnique({ where: { id: opts.matchId }, select: { tournamentId: true } });
      tournamentId = match?.tournamentId ?? null;
    } else if (opts.tournamentId) {
      await this.assertFanManageTournament(user, opts.tournamentId);
    } else {
      throw Errors.validation('Match or tournament required');
    }
    if (!tournamentId) return [];
    const rows = await this.prisma.fanQuestion.findMany({
      where: {
        kind: FanQuestionKind.QUIZ,
        tournamentId,
        status: { not: FanQuestionStatus.CANCELLED },
        ...(opts.preview
          ? { status: { in: [FanQuestionStatus.OPEN, FanQuestionStatus.LOCKED, FanQuestionStatus.SETTLED] } }
          : {}),
        ...(opts.matchId && opts.preview ? { OR: [{ matchId: opts.matchId }, { matchId: null }] } : {}),
      },
      include: { options: { orderBy: { sortOrder: 'asc' } }, _count: { select: { answers: true } } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    const settings = await this.tournamentSettings(tournamentId);
    return Promise.all(
      rows.map(async (row) => {
        const dto = await this.questionDto(row, null, user, settings);
        return opts.preview
          ? dto
          : {
              ...dto,
              status: row.status,
              correctOptionIds: row.correctOptionIds,
              matchId: row.matchId,
              enabled: row.status !== FanQuestionStatus.DRAFT && row.status !== FanQuestionStatus.CANCELLED,
            };
      }),
    );
  }

  async updateQuestion(user: AuthUser, id: string, body: unknown) {
    const row = await this.prisma.fanQuestion.findUnique({ where: { id }, include: { options: true, _count: { select: { answers: true } } } });
    if (!row) throw Errors.notFound('NOT_FOUND', 'Question not found');
    if (row.matchId) await this.assertFanManageMatch(user, row.matchId);
    if (row.tournamentId) await this.assertFanManageTournament(user, row.tournamentId);
    const input = z
      .object({
        title: z.string().min(2).max(120).optional(),
        question: z.string().min(2).max(240).optional(),
        description: z.string().max(400).nullable().optional(),
        points: z.number().int().optional(),
        matchId: z.string().nullable().optional(),
        lockAt: z.string().datetime().nullable().optional(),
        timeLimitSec: z.number().int().min(10).max(3600).nullable().optional(),
        options: z.array(z.object({ label: z.string().min(1).max(80) })).min(2).max(8).optional(),
        correctOptionIndexes: z.array(z.number().int()).optional(),
        publish: z.boolean().optional(),
      })
      .parse(body);
    if (input.matchId) {
      const match = await this.prisma.match.findUnique({ where: { id: input.matchId }, select: { tournamentId: true } });
      if (!match || (row.tournamentId && match.tournamentId !== row.tournamentId)) {
        throw Errors.validation('Question match must belong to the same tournament.');
      }
    }
    if (input.options && row._count.answers > 0) {
      throw Errors.conflict('HAS_ANSWERS', 'Cannot change options after fans have answered.');
    }
    let correctOptionIds = row.correctOptionIds;
    if (input.options) {
      await this.prisma.fanOption.deleteMany({ where: { questionId: id } });
      const created = await Promise.all(
        input.options.map((opt, i) =>
          this.prisma.fanOption.create({ data: { questionId: id, label: opt.label, sortOrder: i } }),
        ),
      );
      if (input.correctOptionIndexes?.length) {
        correctOptionIds = input.correctOptionIndexes.map((i) => created[i]?.id).filter((x): x is string => Boolean(x));
      }
    } else if (input.correctOptionIndexes?.length) {
      const opts = await this.prisma.fanOption.findMany({ where: { questionId: id }, orderBy: { sortOrder: 'asc' } });
      correctOptionIds = input.correctOptionIndexes.map((i) => opts[i]?.id).filter((x): x is string => Boolean(x));
    }
    return this.prisma.fanQuestion.update({
      where: { id },
      data: {
        title: input.title,
        question: input.question,
        description: input.description === undefined ? undefined : input.description,
        points: input.points != null ? boundFanPoints(input.points, 5) : undefined,
        matchId: input.matchId === undefined ? undefined : input.matchId,
        lockAt: input.lockAt === undefined ? undefined : input.lockAt ? new Date(input.lockAt) : null,
        timeLimitSec: input.timeLimitSec === undefined ? undefined : input.timeLimitSec,
        correctOptionIds,
        ...(input.publish === true
          ? { status: FanQuestionStatus.OPEN, publishedAt: new Date() }
          : input.publish === false
            ? { status: FanQuestionStatus.DRAFT, publishedAt: null }
            : {}),
      },
      include: { options: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  async deleteQuestion(user: AuthUser, id: string) {
    const row = await this.prisma.fanQuestion.findUnique({ where: { id } });
    if (!row) throw Errors.notFound('NOT_FOUND', 'Question not found');
    if (row.matchId) await this.assertFanManageMatch(user, row.matchId);
    if (row.tournamentId) await this.assertFanManageTournament(user, row.tournamentId);
    await this.prisma.fanAnswer.deleteMany({ where: { questionId: id } });
    await this.prisma.fanOption.deleteMany({ where: { questionId: id } });
    await this.prisma.fanQuestion.delete({ where: { id } });
    return { ok: true };
  }

  async reorderQuestions(user: AuthUser, tournamentId: string, body: unknown) {
    await this.assertFanManageTournament(user, tournamentId);
    const ids = z.object({ ids: z.array(z.string()).min(1) }).parse(body).ids;
    const rows = await this.prisma.fanQuestion.findMany({
      where: { id: { in: ids }, tournamentId, kind: FanQuestionKind.QUIZ },
    });
    if (rows.length !== ids.length) throw Errors.validation('Questions must belong to this tournament.');
    await this.prisma.$transaction(
      ids.map((id, i) => this.prisma.fanQuestion.update({ where: { id }, data: { sortOrder: i } })),
    );
    return { ok: true };
  }

  async quizResults(user: AuthUser, tournamentId: string) {
    await this.assertFanManageTournament(user, tournamentId);
    const questions = await this.prisma.fanQuestion.findMany({
      where: { tournamentId, kind: FanQuestionKind.QUIZ, status: { not: FanQuestionStatus.CANCELLED } },
      include: { options: { orderBy: { sortOrder: 'asc' } }, answers: true, _count: { select: { answers: true } } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    const participants = new Set(questions.flatMap((q) => q.answers.map((a) => a.userId)));
    const questionRows = questions.map((q) => {
      let correct = 0;
      let incorrect = 0;
      for (const ans of q.answers) {
        if (
          answerIsCorrect({
            type: q.type,
            optionIds: ans.optionIds,
            numberValue: ans.numberValue,
            correctOptionIds: q.correctOptionIds,
            correctNumber: q.correctNumber,
          })
        ) {
          correct += 1;
        } else {
          incorrect += 1;
        }
      }
      return {
        id: q.id,
        question: q.question,
        status: q.status,
        answers: q._count.answers,
        correct,
        incorrect,
        participationRate: participants.size ? Math.round((q._count.answers / participants.size) * 100) : 0,
      };
    });
    const totalAnswers = questionRows.reduce((s, r) => s + r.answers, 0);
    const correctAnswers = questionRows.reduce((s, r) => s + r.correct, 0);
    return {
      participants: participants.size,
      totalAnswers,
      correctAnswers,
      incorrectAnswers: totalAnswers - correctAnswers,
      questions: questionRows,
    };
  }

  private async questionDto(
    row: {
      id: string;
      kind: FanQuestionKind;
      type: FanQuestionType;
      title: string;
      question: string;
      description: string | null;
      points: number;
      status: FanQuestionStatus;
      templateKey: string | null;
      matchId: string | null;
      tournamentId: string | null;
      lockAt: Date | null;
      timeLimitSec: number | null;
      publishedAt: Date | null;
      options: Array<{ id: string; label: string; playerId: string | null; teamId: string | null }>;
      _count?: { answers: number };
      correctOptionIds: string[];
    },
    mine: { optionIds: string[]; numberValue: number | null } | null | undefined,
    _user: AuthUser | null,
    settings: ReturnType<typeof settingsDto>,
  ) {
    const locked = row.status !== FanQuestionStatus.OPEN;
    const showPct = locked && settings.revealPercentagesAfterLock && (row._count?.answers ?? 0) >= settings.minAnswersForPercentages;
    let percents = new Map<string, number>();
    if (showPct) {
      const answers = await this.prisma.fanAnswer.findMany({ where: { questionId: row.id }, select: { optionIds: true } });
      const counts = new Map(row.options.map((o) => [o.id, 0]));
      for (const ans of answers) {
        for (const id of ans.optionIds) {
          if (counts.has(id)) counts.set(id, (counts.get(id) ?? 0) + 1);
        }
      }
      const total = answers.length || 1;
      percents = new Map([...counts].map(([id, n]) => [id, Math.round((n / total) * 100)]));
    }
    return {
      id: row.id,
      matchId: row.matchId,
      tournamentId: row.tournamentId,
      kind: row.kind,
      type: row.type,
      title: row.title,
      question: row.question,
      description: row.description,
      points: row.points,
      status: row.status,
      templateKey: row.templateKey,
      lockAt: row.lockAt,
      closesInSec:
        row.timeLimitSec && row.publishedAt
          ? Math.max(0, row.timeLimitSec - Math.floor((Date.now() - row.publishedAt.getTime()) / 1000))
          : null,
      options: row.options.map((o) => ({
        id: o.id,
        label: o.label,
        playerId: o.playerId,
        teamId: o.teamId,
        percent: showPct ? (percents.get(o.id) ?? 0) : null,
      })),
      myAnswer: mine ?? null,
      answerCount: row._count?.answers ?? 0,
      correctOptionIds: row.status === FanQuestionStatus.SETTLED ? row.correctOptionIds : [],
      showPercentages: showPct,
    };
  }
}
