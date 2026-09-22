import { describe, expect, it, vi } from 'vitest';
import { Role } from '@prisma/client';
import { FanService } from './fan.service';
import type { AuthUser } from '../common/auth.guard';

const viewer: AuthUser = { id: 'u1', email: 'v@x.dev', name: 'Rahul', role: Role.VIEWER };
const admin: AuthUser = { id: 'a1', email: 'a@x.dev', name: 'Admin', role: Role.ADMIN };

function publicMatch() {
  return {
    id: 'm1',
    title: 'Alpha vs Raghus',
    status: 'LIVE',
    visibility: 'PUBLIC',
    publicLiveEnabled: true,
    publicSlug: 'alpha-raghus',
    homeTeamId: 't1',
    awayTeamId: 't2',
    resultWinnerTeamId: null,
    tournamentId: 'tn1',
    homeTeam: { id: 't1', name: 'Alpha XI' },
    awayTeam: { id: 't2', name: 'Raghus' },
  };
}

function prismaFor(store: {
  mute?: { blocked: boolean; mutedUntil?: Date | null } | null;
  lastChat?: { body: string; createdAt: Date } | null;
  message?: { id: string; matchId: string; deletedAt?: Date | null } | null;
  existingReaction?: { id: string } | null;
  reactions?: Array<{ emoji: string; userId: string }>;
  question?: {
    id: string;
    matchId: string | null;
    tournamentId: string | null;
    kind: string;
    type: string;
    status: string;
    lockAt: Date | null;
    templateKey?: string | null;
    options: Array<{ id: string }>;
  } | null;
  existingAnswer?: { id: string } | null;
  grouped?: Array<{ userId: string; _sum: { points: number | null }; _min: { createdAt: Date | null } }>;
  questionCount?: number;
  quizzes?: Array<{
    id: string;
    name: string;
    description: string | null;
    status: string;
    startAt: Date | null;
    endAt: Date | null;
    updatedAt: Date;
  }>;
}) {
  return {
    match: { findUnique: vi.fn(async () => publicMatch()) },
    tournament: { findUnique: vi.fn(async () => ({ id: 'tn1', name: 'Cup', visibility: 'PUBLIC', publicSlug: 'cup' })) },
    fanSettings: { findUnique: vi.fn(async () => null), upsert: vi.fn() },
    quiz: {
      findMany: vi.fn(async () => store.quizzes ?? []),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    chatMessage: {
      count: vi.fn(async () => 0),
      findMany: vi.fn(async () => []),
      findUnique: vi.fn(async () =>
        store.message
          ? { id: store.message.id, matchId: store.message.matchId, deletedAt: store.message.deletedAt ?? null }
          : { id: 'c1', matchId: 'm1', deletedAt: null },
      ),
      findFirst: vi.fn(async () => store.lastChat ?? null),
      create: vi.fn(async (args: { data: { body: string } }) => ({
        id: 'c1',
        matchId: 'm1',
        body: args.data.body,
        kind: 'USER',
        createdAt: new Date(),
        user: { id: viewer.id, name: viewer.name, avatarUrl: null },
      })),
    },
    chatReaction: {
      findUnique: vi.fn(async () => store.existingReaction ?? null),
      create: vi.fn(async (args: { data: unknown }) => args.data),
      delete: vi.fn(async () => ({})),
      findMany: vi.fn(async () => store.reactions ?? []),
    },
    chatMute: { findUnique: vi.fn(async () => store.mute ?? null) },
    fanQuestion: {
      count: vi.fn(async () => store.questionCount ?? 1),
      findMany: vi.fn(async () => []),
      findUnique: vi.fn(async () => store.question ?? null),
      create: vi.fn(async (args: { data: unknown }) => args.data),
      aggregate: vi.fn(async () => ({ _max: { sortOrder: 0 } })),
    },
    fanAnswer: {
      findUnique: vi.fn(async () => store.existingAnswer ?? null),
      findMany: vi.fn(async () => []),
      create: vi.fn(async (args: { data: unknown }) => args.data),
    },
    fanPointTransaction: {
      groupBy: vi.fn(async ({ where }: { where: { matchId?: string; tournamentId?: string } }) => {
        if (where.matchId === 'm1') return store.grouped ?? [];
        if (where.tournamentId === 'tn1') return [];
        return store.grouped ?? [];
      }),
      findMany: vi.fn(async () => []),
    },
    fanBadgeAward: { findMany: vi.fn(async () => []) },
    user: { findMany: vi.fn(async () => [{ id: 'u1', name: 'Rahul', avatarUrl: null }]) },
    ballEvent: { count: vi.fn(async () => 0), findFirst: vi.fn(async () => null), findMany: vi.fn(async () => []) },
  };
}

function svc(prisma: ReturnType<typeof prismaFor>) {
  const access = {
    canMatch: vi.fn(async () => false),
    canTournament: vi.fn(async () => false),
    assertMatch: vi.fn(async () => undefined),
    assertTournament: vi.fn(async () => undefined),
    audit: vi.fn(async () => undefined),
  };
  const realtime = { emitFan: vi.fn(), publicViewerCount: vi.fn(() => 2) };
  return new FanService(prisma as never, access as never, realtime as never);
}

describe('FanService chat', () => {
  it('rejects empty messages', async () => {
    const fan = svc(prismaFor({}));
    await expect(fan.postChat(viewer, 'm1', { body: '   ' })).rejects.toMatchObject({ status: 400 });
  });

  it('blocks a muted/blocked user from posting', async () => {
    const fan = svc(prismaFor({ mute: { blocked: true } }));
    await expect(fan.postChat(viewer, 'm1', { body: 'What a six!' })).rejects.toMatchObject({ status: 403 });
  });

  it('rejects a duplicate message within 20 seconds', async () => {
    const fan = svc(prismaFor({ lastChat: { body: 'What a six!', createdAt: new Date() } }));
    await expect(fan.postChat(viewer, 'm1', { body: 'what a six!' })).rejects.toMatchObject({ status: 400 });
  });

  it('rate-limits more than 5 messages in 10 seconds', async () => {
    const fan = svc(prismaFor({}));
    for (let i = 0; i < 5; i += 1) {
      await fan.postChat({ ...viewer, id: 'rate-user' }, 'm1', { body: `msg ${i}` });
    }
    await expect(fan.postChat({ ...viewer, id: 'rate-user' }, 'm1', { body: 'msg 6' })).rejects.toMatchObject({
      status: 403,
    });
  });

  it('toggles a supported emoji reaction and broadcasts the counter', async () => {
    const prisma = prismaFor({
      reactions: [{ emoji: '🔥', userId: viewer.id }],
    });
    const fan = svc(prisma);
    const out = await fan.reactChat(viewer, 'c1', { emoji: '🔥' });
    expect(out).toMatchObject({
      id: 'c1',
      matchId: 'm1',
      reactions: [{ emoji: '🔥', count: 1, mine: true }],
    });
    expect(prisma.chatReaction.create).toHaveBeenCalled();
  });

  it('rejects an unsupported reaction emoji', async () => {
    const fan = svc(prismaFor({}));
    await expect(fan.reactChat(viewer, 'c1', { emoji: '💣' })).rejects.toThrow();
  });

  it('rate-limits chat reactions', async () => {
    const fan = svc(prismaFor({}));
    const user = { ...viewer, id: 'react-rate-user' };
    for (let i = 0; i < 20; i += 1) {
      await fan.reactChat(user, 'c1', { emoji: '👏' });
    }
    await expect(fan.reactChat(user, 'c1', { emoji: '👏' })).rejects.toMatchObject({ status: 403 });
  });
});

describe('FanService answers', () => {
  const open = {
    id: 'q1',
    matchId: 'm1',
    tournamentId: null,
    kind: 'PREDICTION',
    type: 'TEAM',
    status: 'OPEN',
    lockAt: null,
    templateKey: 'MATCH_WINNER',
    options: [{ id: 'o1' }, { id: 'o2' }],
  };

  it('rejects a second answer from the same user', async () => {
    const fan = svc(prismaFor({ question: open, existingAnswer: { id: 'a1' } }));
    await expect(fan.answer(viewer, 'q1', { optionIds: ['o1'] })).rejects.toMatchObject({ status: 409 });
  });

  it('rejects answers after lock using server status', async () => {
    const fan = svc(prismaFor({ question: { ...open, status: 'LOCKED' } }));
    await expect(fan.answer(viewer, 'q1', { optionIds: ['o1'] })).rejects.toMatchObject({ status: 403 });
  });

  it('rejects answers after server lockAt', async () => {
    const fan = svc(prismaFor({ question: { ...open, lockAt: new Date(Date.now() - 1000) } }));
    await expect(fan.answer(viewer, 'q1', { optionIds: ['o1'] })).rejects.toMatchObject({ status: 403 });
  });
});

describe('FanService quiz visibility', () => {
  it('hides match quizzes when the tournament has no quiz configured', async () => {
    const prisma = prismaFor({});
    const fan = svc(prisma);
    await expect(fan.listQuestions(viewer, { matchId: 'm1', kind: 'QUIZ' as never })).resolves.toEqual([]);
    const vis = await fan.quizVisibilityForMatch(viewer, 'm1');
    expect(vis.show).toBe(false);
  });

  it('does not leak a quiz question when the tournament quiz is off', async () => {
    const fan = svc(
      prismaFor({
        question: {
          id: 'q1',
          matchId: 'm1',
          tournamentId: 'tn1',
          kind: 'QUIZ',
          type: 'SINGLE_CHOICE',
          status: 'OPEN',
          lockAt: null,
          options: [{ id: 'o1' }],
        },
      }),
    );
    await expect(fan.getQuestion(viewer, 'q1')).rejects.toMatchObject({ status: 404 });
    await expect(fan.answer(viewer, 'q1', { optionIds: ['o1'] })).rejects.toMatchObject({ status: 404 });
  });

  it('picks the resolved-active quiz over a raw-ACTIVE quiz whose window has not started', async () => {
    const past = new Date(Date.now() - 60_000);
    const future = new Date(Date.now() + 60 * 60_000);
    const prisma = prismaFor({
      quizzes: [
        {
          id: 'future-active',
          name: 'Future Active',
          description: null,
          status: 'ACTIVE',
          startAt: future,
          endAt: null,
          updatedAt: past,
        },
        {
          id: 'past-scheduled',
          name: 'Past Scheduled',
          description: null,
          status: 'SCHEDULED',
          startAt: past,
          endAt: null,
          updatedAt: new Date(),
        },
      ],
    });
    prisma.fanSettings.findUnique.mockResolvedValue({
      chatEnabled: true,
      publicChat: true,
      loginRequiredToChat: true,
      predictionsEnabled: true,
      quizzesEnabled: true,
      moderationEnabled: true,
      revealPercentagesAfterLock: true,
      minAnswersForPercentages: 3,
    } as never);
    const fan = svc(prisma);
    const vis = await fan.quizVisibilityForTournament(viewer, 'tn1');
    expect(vis.show).toBe(true);
    expect(vis.quizName).toBe('Past Scheduled');
  });
});

describe('FanService syncTournamentQuizzes', () => {
  it('creates, updates, and deletes quizzes based on the incoming array', async () => {
    const prisma = prismaFor({
      quizzes: [
        { id: 'keep', name: 'Old name', description: null, status: 'DRAFT', startAt: null, endAt: null, updatedAt: new Date() },
        { id: 'drop', name: 'Old name 2', description: null, status: 'DRAFT', startAt: null, endAt: null, updatedAt: new Date() },
      ],
    });
    const fan = svc(prisma);
    await fan.syncTournamentQuizzes(prisma as never, 'tn1', {
      enabled: true,
      quizzes: [{ id: 'keep', name: 'Updated name' }, { name: 'Brand new quiz' }],
    });
    expect(prisma.fanSettings.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { tournamentId: 'tn1' } }));
    expect(prisma.quiz.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['drop'] } } });
    expect(prisma.quiz.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'keep' } }));
    expect(prisma.quiz.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tournamentId: 'tn1', name: 'Brand new quiz' }) }),
    );
  });

  it('rejects a quiz id that does not belong to the tournament', async () => {
    const prisma = prismaFor({});
    const fan = svc(prisma);
    await expect(
      fan.syncTournamentQuizzes(prisma as never, 'tn1', { quizzes: [{ id: 'not-mine', name: 'x' }] }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('leaves existing quizzes untouched when the quizzes key is omitted', async () => {
    const prisma = prismaFor({});
    const fan = svc(prisma);
    await fan.syncTournamentQuizzes(prisma as never, 'tn1', { enabled: true });
    expect(prisma.quiz.findMany).not.toHaveBeenCalled();
    expect(prisma.quiz.deleteMany).not.toHaveBeenCalled();
  });

  it('does not seed default quiz questions unless seedQuestions is requested', async () => {
    const prisma = prismaFor({ questionCount: 0 });
    const fan = svc(prisma);
    await fan.syncTournamentQuizzes(prisma as never, 'tn1', { enabled: true });
    expect(prisma.fanQuestion.create).not.toHaveBeenCalled();
  });

  it('seeds default draft quiz questions with two blank options when enabling with seedQuestions', async () => {
    const prisma = prismaFor({ questionCount: 0 });
    const fan = svc(prisma);
    await fan.syncTournamentQuizzes(prisma as never, 'tn1', { enabled: true }, { seedQuestions: true });
    expect(prisma.fanQuestion.create).toHaveBeenCalledTimes(3);
    expect(prisma.fanQuestion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          kind: 'QUIZ',
          tournamentId: 'tn1',
          status: 'DRAFT',
          options: { create: [{ label: '', sortOrder: 0 }, { label: '', sortOrder: 1 }] },
        }),
      }),
    );
  });

  it('does not seed default quiz questions again once some already exist', async () => {
    const prisma = prismaFor({ questionCount: 1 });
    const fan = svc(prisma);
    await fan.syncTournamentQuizzes(prisma as never, 'tn1', { enabled: true }, { seedQuestions: true });
    expect(prisma.fanQuestion.create).not.toHaveBeenCalled();
  });

  it('does not seed default quiz questions when not enabling', async () => {
    const prisma = prismaFor({ questionCount: 0 });
    const fan = svc(prisma);
    await fan.syncTournamentQuizzes(prisma as never, 'tn1', { enabled: false }, { seedQuestions: true });
    expect(prisma.fanQuestion.create).not.toHaveBeenCalled();
  });
});

describe('FanService points', () => {
  it('forbids non-admins from adjusting the ledger', async () => {
    const fan = svc(prismaFor({}));
    await expect(
      fan.adjustPoints(viewer, { userId: 'u2', points: 10, reason: 'fix', sourceId: 'x' }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('lets an admin write an adjustment transaction only', async () => {
    const prisma = {
      ...prismaFor({}),
      fanPointTransaction: {
        ...prismaFor({}).fanPointTransaction,
        create: vi.fn(async (args: { data: { points: number; sourceType: string } }) => args.data),
      },
    };
    const fan = svc(prisma);
    const row = await fan.adjustPoints(admin, { userId: 'u2', points: 10, reason: 'correction', sourceId: 'adj-1' });
    expect(row).toMatchObject({ sourceType: 'ADMIN_ADJUSTMENT', points: 10 });
  });

  it('keeps match and tournament leaderboards separate', async () => {
    const fan = svc(
      prismaFor({
        grouped: [{ userId: 'u1', _sum: { points: 20 }, _min: { createdAt: new Date() } }],
      }),
    );
    const matchBoard = await fan.leaderboard({ matchId: 'm1' }, viewer);
    const tourBoard = await fan.leaderboard({ tournamentId: 'tn1' }, viewer);
    expect(matchBoard.rows[0]?.points).toBe(20);
    expect(tourBoard.rows).toEqual([]);
  });
});
