/**
 * Additive beta fixture. Does not wipe the database.
 *
 *   SEED_BETA=1 SEED_PASSWORD='…' pnpm db:seed-beta
 *
 * Refuses to run when NODE_ENV=production unless ALLOW_BETA_SEED=1.
 */
import {
  PrismaClient,
  Role,
  AccessLevel,
  AccessStatus,
  BallType,
  MatchFormat,
  MatchStatus,
  ShareVisibility,
  TossDecision,
  InningsStatus,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  if (process.env.SEED_BETA !== '1') {
    throw new Error('Refusing to run. Set SEED_BETA=1 to create additive CrickScore Beta Cup fixtures.');
  }
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_BETA_SEED !== '1') {
    throw new Error('Refusing beta seed in production. Set ALLOW_BETA_SEED=1 only on a dedicated beta database.');
  }
  const password = process.env.SEED_PASSWORD;
  if (!password) {
    throw new Error('SEED_PASSWORD is required. Do not commit passwords.');
  }
  const passwordHash = await bcrypt.hash(password, 12);

  const admin =
    (await prisma.user.findFirst({ where: { role: { in: [Role.SUPER_ADMIN, Role.ADMIN] } } })) ??
    (await prisma.user.create({
      data: {
        email: 'beta-admin@example.com',
        name: 'Beta Admin',
        role: Role.ADMIN,
        isBeta: true,
        passwordHash,
        preferences: { create: { locale: 'en' } },
      },
    }));

  await prisma.user.update({ where: { id: admin.id }, data: { isBeta: true } });

  const upsertUser = async (email: string, name: string, role: Role) =>
    prisma.user.upsert({
      where: { email },
      update: { isBeta: true, name, role },
      create: {
        email,
        name,
        role,
        isBeta: true,
        passwordHash,
        preferences: { create: { locale: 'en' } },
        player: { create: { name, profileCode: `CS${Math.floor(100000 + Math.random() * 900000)}` } },
      },
    });

  const scorer = await upsertUser('beta-scorer@example.com', 'Beta Scorer', Role.PLAYER);
  const player = await upsertUser('beta-player@example.com', 'Beta Player', Role.PLAYER);
  const viewer = await upsertUser('beta-viewer@example.com', 'Beta Viewer', Role.VIEWER);

  const tournament = await prisma.tournament.upsert({
    where: { publicSlug: 'crickscore-beta-cup' },
    update: {},
    create: {
      name: 'CrickScore Beta Cup',
      season: 'Beta',
      createdById: admin.id,
      publicSlug: 'crickscore-beta-cup',
      visibility: ShareVisibility.PUBLIC,
    },
  });

  const team = async (name: string, shortName: string) => {
    const existing = await prisma.team.findFirst({ where: { name, createdById: admin.id } });
    if (existing) return existing;
    return prisma.team.create({ data: { name, shortName, createdById: admin.id } });
  };
  const alpha = await team('Alpha XI', 'AXI');
  const raghus = await team('Raghus Challengers', 'RCH');
  const nikhils = await team('Nikhils Challengers', 'NCH');
  const warriors = await team('Beta Warriors', 'BWR');

  const group =
    (await prisma.tournamentGroup.findFirst({ where: { tournamentId: tournament.id, name: 'Beta' } })) ??
    (await prisma.tournamentGroup.create({ data: { tournamentId: tournament.id, name: 'Beta' } }));
  for (const tm of [alpha, raghus, nikhils, warriors]) {
    await prisma.tournamentGroupTeam.upsert({
      where: { groupId_teamId: { groupId: group.id, teamId: tm.id } },
      create: { groupId: group.id, teamId: tm.id },
      update: {},
    });
  }

  const existingSet = await prisma.tournamentRuleSet.findFirst({
    where: { tournamentId: tournament.id },
    orderBy: { version: 'desc' },
  });
  const ruleSet =
    existingSet ??
    (await prisma.tournamentRuleSet.create({
      data: {
        tournamentId: tournament.id,
        version: 1,
        enabled: true,
        createdById: admin.id,
        mvpJson: {
          batting: { run: 0.1, thirty: 1, fifty: 1, hundred: 1, duck: -1 },
          bowling: { wicket: 2, threeWicket: 1, maiden: 1 },
          fielding: { catch: 1, stumping: 1, runOut: 1 },
        },
        rules: {
          create: [
            {
              name: 'Over 3 double runs',
              category: 'OVER_RULE',
              scope: 'OVER',
              condition: 'OVER_EQUALS',
              conditionConfig: { over: 3 },
              action: 'MULTIPLY_RUNS',
              actionConfig: { multiplier: 2 },
              priority: 10,
            },
            {
              name: 'Ball 4 penalty +2',
              category: 'BALL_RULE',
              scope: 'BALL',
              condition: 'BALL_EQUALS',
              conditionConfig: { over: 1, ball: 4 },
              action: 'ADD_PENALTY',
              actionConfig: { runs: 2 },
              priority: 20,
            },
            {
              name: 'Wicket penalty -1',
              category: 'WICKET_RULE',
              scope: 'TOURNAMENT',
              condition: 'WICKET',
              action: 'WICKET_PENALTY',
              actionConfig: { runs: 1 },
              priority: 30,
            },
          ],
        },
      },
    }));

  const ensureMatch = async (slug: string, data: Parameters<typeof prisma.match.create>[0]['data']) => {
    const existing = await prisma.match.findUnique({ where: { publicSlug: slug } });
    if (existing) return existing;
    return prisma.match.create({ data: { ...data, publicSlug: slug } });
  };

  const upcoming = await ensureMatch('beta-alpha-vs-raghus', {
    title: 'Alpha XI vs Raghus Challengers',
    status: MatchStatus.SCHEDULED,
    format: MatchFormat.T10,
    overs: 5,
    ballsPerOver: 6,
    maxWickets: 7,
    playingPerSide: 8,
    ballType: BallType.TENNIS,
    venueText: 'Beta Ground',
    scheduledAt: new Date(Date.now() + 86400000),
    tournamentId: tournament.id,
    homeTeamId: alpha.id,
    awayTeamId: raghus.id,
    createdById: admin.id,
    publicLiveEnabled: true,
    visibility: ShareVisibility.PUBLIC,
    settings: { scorerId: scorer.id },
    teams: { create: [{ teamId: alpha.id, side: 'HOME' }, { teamId: raghus.id, side: 'AWAY' }] },
  });

  const live = await ensureMatch('beta-alpha-vs-nikhils', {
    title: 'Alpha XI vs Nikhils Challengers',
    status: MatchStatus.LIVE,
    format: MatchFormat.T10,
    overs: 5,
    ballsPerOver: 6,
    maxWickets: 7,
    playingPerSide: 8,
    ballType: BallType.TENNIS,
    venueText: 'Beta Ground',
    tournamentId: tournament.id,
    homeTeamId: alpha.id,
    awayTeamId: nikhils.id,
    tossWinnerTeamId: alpha.id,
    tossDecision: TossDecision.BAT,
    createdById: admin.id,
    publicLiveEnabled: true,
    visibility: ShareVisibility.PUBLIC,
    settings: { scorerId: scorer.id },
    toss: { create: { winnerTeamId: alpha.id, decision: TossDecision.BAT } },
    teams: { create: [{ teamId: alpha.id, side: 'HOME' }, { teamId: nikhils.id, side: 'AWAY' }] },
  });

  const completed = await ensureMatch('beta-alpha-vs-warriors', {
    title: 'Alpha XI vs Beta Warriors',
    status: MatchStatus.COMPLETED,
    format: MatchFormat.T10,
    overs: 5,
    ballsPerOver: 6,
    maxWickets: 7,
    playingPerSide: 8,
    ballType: BallType.TENNIS,
    venueText: 'Beta Ground',
    tournamentId: tournament.id,
    homeTeamId: alpha.id,
    awayTeamId: warriors.id,
    tossWinnerTeamId: alpha.id,
    tossDecision: TossDecision.BAT,
    createdById: admin.id,
    publicLiveEnabled: true,
    visibility: ShareVisibility.PUBLIC,
    resultType: 'WIN',
    resultWinnerTeamId: alpha.id,
    marginType: 'RUNS',
    marginValue: 12,
    completedAt: new Date(),
    teams: { create: [{ teamId: alpha.id, side: 'HOME' }, { teamId: warriors.id, side: 'AWAY' }] },
  });

  const matchB = await ensureMatch('beta-nikhils-vs-warriors', {
    title: 'Nikhils Challengers vs Beta Warriors',
    status: MatchStatus.SCHEDULED,
    format: MatchFormat.T10,
    overs: 5,
    ballsPerOver: 6,
    maxWickets: 7,
    homeTeamId: nikhils.id,
    awayTeamId: warriors.id,
    createdById: admin.id,
    publicLiveEnabled: false,
    visibility: ShareVisibility.PRIVATE,
    tournamentId: tournament.id,
    teams: { create: [{ teamId: nikhils.id, side: 'HOME' }, { teamId: warriors.id, side: 'AWAY' }] },
  });

  if (!(await prisma.innings.findFirst({ where: { matchId: live.id } }))) {
    await prisma.innings.create({
      data: {
        matchId: live.id,
        inningsNumber: 1,
        battingTeamId: alpha.id,
        bowlingTeamId: nikhils.id,
        status: InningsStatus.IN_PROGRESS,
      },
    });
  }

  if (!(await prisma.innings.findFirst({ where: { matchId: completed.id } }))) {
    await prisma.innings.create({
      data: {
        matchId: completed.id,
        inningsNumber: 1,
        battingTeamId: alpha.id,
        bowlingTeamId: warriors.id,
        status: InningsStatus.COMPLETED,
        totalRuns: 42,
        totalWickets: 2,
      },
    });
  }

  const grant = async (matchId: string, userId: string, level: AccessLevel) => {
    await prisma.matchAccess.upsert({
      where: { matchId_userId: { matchId, userId } },
      create: { matchId, userId, level, status: AccessStatus.ACTIVE, grantedById: admin.id, permissions: [] },
      update: { level, status: AccessStatus.ACTIVE },
    });
  };
  await grant(upcoming.id, scorer.id, AccessLevel.SCORER);
  await grant(live.id, scorer.id, AccessLevel.SCORER);
  await grant(upcoming.id, player.id, AccessLevel.PLAYER);
  await grant(upcoming.id, viewer.id, AccessLevel.VIEWER);
  void matchB;
  void ruleSet;

  console.info('Beta fixtures ready: CrickScore Beta Cup (Alpha XI vs Raghus Challengers). Credentials come from SEED_PASSWORD.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
