/**
 * Wipe all application data on the local development database, then restore
 * only authentication users/roles. Does not touch schema or _prisma_migrations.
 */
import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing wipe: NODE_ENV=production');
  }
  const url = process.env.DATABASE_URL || '';
  if (!url.includes('localhost:5435') || !url.includes('/crickscore')) {
    throw new Error(`Refusing wipe: DATABASE_URL is not the local docker database (${url})`);
  }
  if ((process.env.APP_ENV || 'development').toLowerCase() === 'production') {
    throw new Error('Refusing wipe: APP_ENV=production');
  }

  const tables = await prisma.$queryRawUnsafe(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
  );
  const names = tables.map((t) => `"${t.tablename}"`).join(', ');
  if (!names) throw new Error('No tables found');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE`);

  const passwordHash = await bcrypt.hash('ChangeMe123!', 12);
  const permissions = await Promise.all(
    ['matches.read', 'matches.score', 'teams.write', 'tournaments.write', 'users.admin'].map((key) =>
      prisma.permission.create({ data: { key } }),
    ),
  );
  for (const role of Object.values(Role)) {
    const def = await prisma.roleDefinition.create({ data: { name: role, description: role } });
    await prisma.rolePermission.createMany({
      data: permissions.map((p) => ({ roleId: def.id, permissionId: p.id })),
    });
  }
  await prisma.user.create({
    data: {
      id: 'user_admin',
      email: 'admin@crickscore.dev',
      name: 'Admin',
      role: Role.SUPER_ADMIN,
      passwordHash,
      preferences: { create: { locale: 'en' } },
      player: { create: { name: 'Admin', profileCode: 'CS100001' } },
    },
  });
  await prisma.user.create({
    data: {
      id: 'user_scorer',
      email: 'scorer@crickscore.dev',
      name: 'Sudhir',
      role: Role.SCORER,
      passwordHash,
      preferences: { create: { locale: 'en' } },
      player: { create: { name: 'Sudhir', profileCode: 'CS100002' } },
    },
  });

  const counts = {
    users: await prisma.user.count(),
    clubs: await prisma.club.count(),
    teams: await prisma.team.count(),
    players: await prisma.player.count(),
    tournaments: await prisma.tournament.count(),
    matches: await prisma.match.count(),
    innings: await prisma.innings.count(),
    balls: await prisma.ballEvent.count(),
    fanQuestions: await prisma.fanQuestion.count(),
    fanAnswers: await prisma.fanAnswer.count(),
  };
  console.log(JSON.stringify({ wiped: true, env: 'development', counts }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
