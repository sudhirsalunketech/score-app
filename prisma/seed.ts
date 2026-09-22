import { PrismaClient, BallType, MatchFormat, MatchStatus, Role, ExtraType, DismissalType, InningsStatus, TossDecision, ShareVisibility } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { replayInnings } from '@crickscore/shared';

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DESTRUCTIVE_SEED !== '1') {
    throw new Error('Refusing destructive seed in production. Set ALLOW_DESTRUCTIVE_SEED=1 only for disposable demo databases.');
  }
  const PASSWORD = process.env.SEED_PASSWORD ?? (process.env.NODE_ENV === 'production' ? '' : 'ChangeMe123!');
  if (!PASSWORD) {
    throw new Error('SEED_PASSWORD is required. Never hardcode production passwords.');
  }
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  await prisma.ballEvent.deleteMany();
  await prisma.ballRuleEvaluation.deleteMany();
  await prisma.matchRuleSnapshot.deleteMany();
  await prisma.tournamentRule.deleteMany();
  await prisma.tournamentRuleSet.deleteMany();
  await prisma.matchAccess.deleteMany();
  await prisma.tournamentAccess.deleteMany();
  await prisma.invitation.deleteMany();
  await prisma.betaFeedback.deleteMany();
  await prisma.partnership.deleteMany();
  await prisma.fallOfWicket.deleteMany();
  await prisma.innings.deleteMany();
  await prisma.toss.deleteMany();
  await prisma.matchPlayer.deleteMany();
  await prisma.matchOfficial.deleteMany();
  await prisma.matchTeam.deleteMany();
  await prisma.match.deleteMany();
  await prisma.tournamentPoint.deleteMany();
  await prisma.tournamentGroupTeam.deleteMany();
  await prisma.tournamentGroup.deleteMany();
  await prisma.tournament.deleteMany();
  await prisma.teamPlayer.deleteMany();
  await prisma.playerStatistic.deleteMany();
  await prisma.playerProfile.deleteMany();
  await prisma.player.deleteMany();
  await prisma.teamStatistic.deleteMany();
  await prisma.team.deleteMany();
  await prisma.club.deleteMany();
  await prisma.venue.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.passwordReset.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.userPreference.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.roleDefinition.deleteMany();

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

  const admin = await prisma.user.create({
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
  const scorer = await prisma.user.create({
    data: {
      id: 'user_scorer',
      email: 'scorer@crickscore.dev',
      name: 'Sudhir',
      role: Role.SCORER,
      passwordHash,
      preferences: { create: { locale: 'en' } },
    },
  });

  const club = await prisma.club.create({
    data: { name: 'Deccan Cricket Club', city: 'Pune', establishedYear: 2014, createdById: admin.id },
  });
  const venue = await prisma.venue.create({ data: { name: 'Deccan Gymkhana', city: 'Pune' } });

  const rehman = await prisma.team.create({
    data: { name: 'Shivaji 11s', shortName: 'SHV', location: 'Pune', clubId: club.id, createdById: scorer.id },
  });
  const aqib = await prisma.team.create({
    data: { name: 'Deccan 11s', shortName: 'DCN', location: 'Pune', clubId: club.id, createdById: scorer.id },
  });
  const ye = await prisma.team.create({
    data: { name: 'YE', shortName: 'YE', location: 'Mumbai', createdById: scorer.id },
  });
  const mestry = await prisma.team.create({
    data: { name: 'Mestry XI', shortName: 'MXY', location: 'Mumbai', createdById: scorer.id },
  });

  const mkPlayer = async (name: string, teamId: string, extra?: { userId?: string; role?: string }) => {
    const player = await prisma.player.create({
      data: {
        name,
        profileCode: `CS${Math.floor(100000 + Math.random() * 900000)}`,
        role: extra?.role ?? 'BATSMAN',
        battingStyle: 'Right-hand',
        bowlingStyle: extra?.role === 'BOWLER' ? 'Right-arm medium' : null,
        userId: extra?.userId,
        profile: { create: {} },
        teams: { create: { teamId } },
        careerStats: { create: {} },
      },
    });
    return player;
  };

  const sudhir = await mkPlayer('Sudhir', ye.id, { userId: scorer.id });
  const jj = await mkPlayer('Jj', ye.id);
  const sk = await mkPlayer('Sk', ye.id);
  const akshay = await mkPlayer('Akshay Mestry', mestry.id, { role: 'BOWLER' });
  const r1 = await mkPlayer('Shivaji Rao', rehman.id);
  const r2 = await mkPlayer('Rohit Deshpande', rehman.id);
  const a1 = await mkPlayer('Arjun Patil', aqib.id, { role: 'BOWLER' });
  const a2 = await mkPlayer('Karan Joshi', aqib.id);
  await mkPlayer('Harshad Rane', rehman.id);
  await mkPlayer('Umesh Thakur', aqib.id);

  // Round every squad up to at least 8 players so each seeded team already meets the
  // playing-XI minimum and is selectable in the "New Match" team picker out of the box.
  const rehmanExtra = ['Vivek Kulkarni', 'Nikhil Sawant', 'Ganesh More', 'Abhishek Rane', 'Sameer Naik', 'Pradeep Shetty'];
  const aqibExtra = ['Rahul Gaikwad', 'Suresh Yadav', 'Manoj Tiwari', 'Deepak Chavan', 'Ravi Pandit', 'Sanjay Mhatre'];
  const yeExtra = ['Rohan Patil', 'Vikram Deshmukh', 'Sameer Kulkarni', 'Ajay Shinde', 'Nitin Rane'];
  const mestryExtra = ['Sanjay More', 'Prashant Naik', 'Rahul Jadhav', 'Kiran Salvi', 'Tushar Gupte', 'Amol Bhosale', 'Ganesh Pawar'];
  for (const name of rehmanExtra) await mkPlayer(name, rehman.id);
  for (const name of aqibExtra) await mkPlayer(name, aqib.id);
  for (const name of yeExtra) await mkPlayer(name, ye.id);
  for (const name of mestryExtra) await mkPlayer(name, mestry.id, { role: 'BOWLER' });

  const tournament = await prisma.tournament.create({
    data: {
      name: "Practice Men's Hundred",
      clubId: club.id,
      season: '2026',
      createdById: admin.id,
      publicSlug: 'practice-mens-hundred',
      visibility: ShareVisibility.UNLISTED,
      groups: {
        create: [
          { name: 'GROUP A', sortOrder: 0, teams: { create: [{ teamId: rehman.id }, { teamId: aqib.id }] } },
          { name: 'GROUP B', sortOrder: 1 },
          { name: 'GROUP C', sortOrder: 2 },
        ],
      },
      // Demonstrates the merged Run/Wicket "MAPPING" over-rule type as a per-tournament
      // default template — new matches created under this tournament start with it applied.
      defaultOverRules: [
        {
          overNumber: 0,
          name: 'Power Over',
          ruleType: 'MAPPING',
          enabled: true,
          config: {
            mapping: [
              { kind: 'RUN', count: 6, value: 3 },
              { kind: 'WICKET', count: 1, value: 2 },
              { kind: 'OTHER', count: 0, value: 1 },
            ],
          },
        },
      ],
    },
  });

  const liveMatch = await prisma.match.create({
    data: {
      title: 'Shivaji 11s vs Deccan 11s',
      status: MatchStatus.LIVE,
      format: MatchFormat.HUNDRED,
      overs: 100,
      ballsPerOver: 5,
      maxWickets: 7,
      playingPerSide: 8,
      ballType: BallType.TENNIS,
      venueText: 'Deccan Gymkhana Pune',
      venueId: venue.id,
      tournamentId: tournament.id,
      homeTeamId: rehman.id,
      awayTeamId: aqib.id,
      tossWinnerTeamId: rehman.id,
      tossDecision: TossDecision.BAT,
      createdById: scorer.id,
      publicLiveEnabled: true,
      publicSlug: 'shivaji-11s-vs-deccan-11s-2026',
      visibility: ShareVisibility.UNLISTED,
      settings: { overTheFence: true, mankad: true, lastMan: true },
      toss: { create: { winnerTeamId: rehman.id, decision: TossDecision.BAT } },
      teams: { create: [{ teamId: rehman.id, side: 'HOME' }, { teamId: aqib.id, side: 'AWAY' }] },
    },
  });

  const liveInn = await prisma.innings.create({
    data: {
      matchId: liveMatch.id,
      inningsNumber: 1,
      battingTeamId: rehman.id,
      bowlingTeamId: aqib.id,
      status: InningsStatus.IN_PROGRESS,
    },
  });

  await prisma.ballEvent.createMany({
    data: [
      {
        inningsId: liveInn.id,
        matchId: liveMatch.id,
        sequence: 1,
        idempotencyKey: 'seed-live-1',
        overNumber: 0,
        ballInOver: 0,
        strikerId: r1.id,
        nonStrikerId: r2.id,
        bowlerId: a1.id,
        batsmanRuns: 4,
        extraRuns: 0,
        totalRuns: 4,
        extraType: ExtraType.NONE,
      },
      {
        inningsId: liveInn.id,
        matchId: liveMatch.id,
        sequence: 2,
        idempotencyKey: 'seed-live-2',
        overNumber: 0,
        ballInOver: 1,
        strikerId: r1.id,
        nonStrikerId: r2.id,
        bowlerId: a1.id,
        batsmanRuns: 1,
        extraRuns: 0,
        totalRuns: 1,
        extraType: ExtraType.NONE,
      },
      {
        inningsId: liveInn.id,
        matchId: liveMatch.id,
        sequence: 3,
        idempotencyKey: 'seed-live-3',
        overNumber: 0,
        ballInOver: 2,
        strikerId: r2.id,
        nonStrikerId: r1.id,
        bowlerId: a1.id,
        batsmanRuns: 6,
        extraRuns: 0,
        totalRuns: 6,
        extraType: ExtraType.NONE,
      },
    ],
  });

  const scoringMatch = await prisma.match.create({
    data: {
      title: 'YE vs Mestry XI',
      status: MatchStatus.LIVE,
      format: MatchFormat.T10,
      overs: 5,
      ballsPerOver: 6,
      maxWickets: 7,
      playingPerSide: 8,
      ballType: BallType.TENNIS,
      venueText: 'Street ground',
      homeTeamId: ye.id,
      awayTeamId: mestry.id,
      tossWinnerTeamId: ye.id,
      tossDecision: TossDecision.BAT,
      createdById: scorer.id,
      publicLiveEnabled: true,
      publicSlug: 'ye-vs-mestry-xi-2026',
      visibility: ShareVisibility.UNLISTED,
      overWiseRulesEnabled: true,
      settings: { overTheFence: true, mankad: true, lastMan: true },
      toss: { create: { winnerTeamId: ye.id, decision: TossDecision.BAT } },
      teams: { create: [{ teamId: ye.id, side: 'HOME' }, { teamId: mestry.id, side: 'AWAY' }] },
      // Demonstrates the merged Run/Wicket "MAPPING" over-rule type on a real match: +3 if the
      // over goes for exactly 6 runs, -2 if exactly 1 wicket falls, +1 always (Other).
      overRules: {
        create: [
          {
            overNumber: 0,
            name: 'Power Over',
            ruleType: 'MAPPING',
            enabled: true,
            config: {
              mapping: [
                { kind: 'RUN', count: 6, value: 3 },
                { kind: 'WICKET', count: 1, value: 2 },
                { kind: 'OTHER', count: 0, value: 1 },
              ],
            },
          },
        ],
      },
    },
  });
  await prisma.innings.create({
    data: {
      matchId: scoringMatch.id,
      inningsNumber: 1,
      battingTeamId: ye.id,
      bowlingTeamId: mestry.id,
    },
  });

  const done = await prisma.match.create({
    data: {
      title: 'Shivaji 11s vs Deccan 11s (completed)',
      status: MatchStatus.COMPLETED,
      format: MatchFormat.T10,
      overs: 5,
      ballsPerOver: 6,
      maxWickets: 7,
      ballType: BallType.TENNIS,
      venueText: 'Deccan Gymkhana Pune',
      tournamentId: tournament.id,
      homeTeamId: rehman.id,
      awayTeamId: aqib.id,
      tossWinnerTeamId: rehman.id,
      tossDecision: TossDecision.BAT,
      createdById: scorer.id,
      publicLiveEnabled: true,
      publicSlug: 'shivaji-11s-vs-deccan-11s-completed',
      visibility: ShareVisibility.UNLISTED,
      settings: { overTheFence: true, mankad: true },
      toss: { create: { winnerTeamId: rehman.id, decision: TossDecision.BAT } },
      teams: { create: [{ teamId: rehman.id, side: 'HOME' }, { teamId: aqib.id, side: 'AWAY' }] },
    },
  });

  const inn1 = await prisma.innings.create({
    data: { matchId: done.id, inningsNumber: 1, battingTeamId: rehman.id, bowlingTeamId: aqib.id, status: InningsStatus.COMPLETED },
  });
  const inn2 = await prisma.innings.create({
    data: { matchId: done.id, inningsNumber: 2, battingTeamId: aqib.id, bowlingTeamId: rehman.id, status: InningsStatus.COMPLETED, targetRuns: 73 },
  });

  const balls1 = [
    { s: r1.id, ns: r2.id, b: a1.id, r: 4 },
    { s: r1.id, ns: r2.id, b: a1.id, r: 1 },
    { s: r2.id, ns: r1.id, b: a1.id, r: 6 },
    { s: r2.id, ns: r1.id, b: a1.id, r: 2 },
    { s: r2.id, ns: r1.id, b: a1.id, r: 1 },
    { s: r1.id, ns: r2.id, b: a1.id, r: 0, w: true as const, d: DismissalType.BOWLED, out: r1.id },
  ];
  for (let i = 0; i < balls1.length; i++) {
    const x = balls1[i]!;
    await prisma.ballEvent.create({
      data: {
        inningsId: inn1.id,
        matchId: done.id,
        sequence: i + 1,
        idempotencyKey: `seed-c1-${i}`,
        overNumber: 0,
        ballInOver: i,
        strikerId: x.s,
        nonStrikerId: x.ns,
        bowlerId: x.b,
        batsmanRuns: x.r,
        extraRuns: 0,
        totalRuns: x.r,
        extraType: ExtraType.NONE,
        isWicket: Boolean(x.w),
        dismissalType: x.d ?? null,
        dismissedPlayerId: x.out ?? null,
      },
    });
  }
  for (let i = 0; i < 24; i++) {
    await prisma.ballEvent.create({
      data: {
        inningsId: inn1.id,
        matchId: done.id,
        sequence: 7 + i,
        idempotencyKey: `seed-c1b-${i}`,
        overNumber: Math.floor((6 + i) / 6),
        ballInOver: (6 + i) % 6,
        strikerId: r2.id,
        nonStrikerId: sudhir.id,
        bowlerId: i < 12 ? a1.id : a2.id,
        batsmanRuns: i % 3 === 0 ? 4 : 1,
        extraRuns: 0,
        totalRuns: i % 3 === 0 ? 4 : 1,
        extraType: ExtraType.NONE,
      },
    });
  }
  for (let i = 0; i < 30; i++) {
    await prisma.ballEvent.create({
      data: {
        inningsId: inn2.id,
        matchId: done.id,
        sequence: i + 1,
        idempotencyKey: `seed-c2-${i}`,
        overNumber: Math.floor(i / 6),
        ballInOver: i % 6,
        strikerId: a2.id,
        nonStrikerId: a1.id,
        bowlerId: r1.id,
        batsmanRuns: i % 5 === 0 ? 6 : i % 2,
        extraRuns: 0,
        totalRuns: i % 5 === 0 ? 6 : i % 2,
        extraType: ExtraType.NONE,
      },
    });
  }

  for (const inn of [liveInn, inn1, inn2]) {
    const full = await prisma.innings.findUniqueOrThrow({
      where: { id: inn.id },
      include: { events: true, match: true },
    });
    const snap = replayInnings(
      full.events.map((e) => ({
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
      })),
      { ballsPerOver: full.match.ballsPerOver, maxOvers: full.match.overs, maxWickets: full.match.maxWickets },
    );
    await prisma.innings.update({
      where: { id: inn.id },
      data: {
        totalRuns: snap.totalRuns,
        totalWickets: snap.totalWickets,
        totalBallsLegal: snap.totalBallsLegal,
        extras: snap.extras,
      },
    });
  }

  await prisma.playerStatistic.update({
    where: { playerId: sudhir.id },
    data: { matches: 12, innings: 11, runs: 381, balls: 290, fours: 28, sixes: 11, highestScore: 64 },
  });

  console.log('Seeded CrickScore demo data. Local accounts use SEED_PASSWORD (or the local default when unset).');
  console.log('  scorer@crickscore.dev');
  console.log('  admin@crickscore.dev');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
