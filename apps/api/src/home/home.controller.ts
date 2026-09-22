import { Controller, Get, Inject } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { OptionalUser, Public, type AuthUser } from '../common/auth.guard';
import { matchInclude } from '../domain/includes';
import { AuthService } from '../auth/auth.service';
import { AccessService } from '../access/access.service';
import { matchDiscoveryWhere, tournamentDiscoveryWhere } from '../share/visibility';
import { PlayerAccountService } from '../players/player-account.service';
import { computeStreetMvp } from '@crickscore/shared';
import { matchStatusGroup } from '../players/player-account.helpers';
import { Role } from '@prisma/client';

@ApiTags('home')
@ApiBearerAuth()
@Controller('home')
export class HomeController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(AccessService) private readonly access: AccessService,
    @Inject(PlayerAccountService) private readonly players: PlayerAccountService,
  ) {}

  @Public()
  @Get()
  async home(@OptionalUser() user: AuthUser | null) {
    const matches = await this.prisma.match.findMany({
      where: matchDiscoveryWhere(user),
      include: matchInclude,
      orderBy: { createdAt: 'desc' },
      take: 40,
    });
    const tournaments = await this.prisma.tournament.findMany({
      where: tournamentDiscoveryWhere(user),
      include: { _count: { select: { matches: true } } },
      orderBy: { createdAt: 'desc' },
      take: 6,
    });
    const live = matches.filter((m) => m.status === 'LIVE' || m.status === 'INNINGS_BREAK');
    const upcoming = matches.filter(
      (m) =>
        m.status === 'DRAFT' ||
        m.status === 'SCHEDULED' ||
        m.status === 'TOSS_PENDING' ||
        m.status === 'TOSS_COMPLETED',
    );
    const recent = matches.filter((m) => m.status === 'COMPLETED' || m.status === 'ABANDONED');
    const myMatches = user
      ? matches.filter((m) => {
          const settings = (m.settings ?? {}) as Record<string, unknown>;
          const scorerIds = Array.isArray(settings.scorerIds) ? (settings.scorerIds as unknown[]) : [];
          return m.createdById === user.id || scorerIds.includes(user.id);
        })
      : [];
    const assigned = user
      ? await this.prisma.matchAccess.findMany({
          where: {
            userId: user.id,
            status: 'ACTIVE',
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
          include: { match: { include: matchInclude } },
        })
      : [];
    const assignedMatches = assigned.map((row) => row.match);
    const mine = [...myMatches, ...assignedMatches.filter((m) => !myMatches.some((x) => x.id === m.id))];
    const withPerms = await this.access.attachMatchPermissions(user, matches);
    const permById = new Map(withPerms.map((m) => [m.id, m.myPermissions]));
    const tagged = <T extends { id: string }>(list: T[]) =>
      list.map((m) => ({ ...m, myPermissions: permById.get(m.id) ?? [] }));
    if (!user) {
      return {
        user: null,
        matches: tagged(matches),
        liveMatches: tagged(live),
        upcomingMatches: tagged(upcoming),
        recentMatches: tagged(recent),
        myMatches: [],
        tournaments,
        profileSnapshot: { matches: 0, runs: 0, wickets: 0, mvpPoints: 0, teams: [] },
      };
    }
    const row = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { player: { include: { careerStats: true, teams: { include: { team: true } } } } },
    });
    const mineTagged = await this.access.attachMatchPermissions(user, mine);
    const career = row.player?.careerStats;
    const mvp = career
      ? computeStreetMvp({
          runs: career.runs,
          ballsFaced: career.balls,
          wickets: career.wickets,
          maidenOvers: career.maidens,
          catches: career.catches,
          stumpings: career.stumpings,
          runOuts: career.runOuts,
        })
      : { batting: 0, bowling: 0, fielding: 0, total: 0 };
    const snapshot = {
      matches: career?.matches ?? 0,
      runs: career?.runs ?? 0,
      wickets: career?.wickets ?? 0,
      balls: career?.balls ?? 0,
      bestScore: career?.highestScore ?? 0,
      strikeRate: career?.balls ? Number(((career.runs / career.balls) * 100).toFixed(1)) : 0,
      economy: career?.oversBowled ? Number((career.runsConceded / career.oversBowled).toFixed(1)) : 0,
      mvpPoints: mvp.total,
      teams: (row.player?.teams ?? []).filter((tp) => !tp.leftAt).map((tp) => tp.team),
      player: row.player
        ? {
            id: row.player.id,
            name: row.player.name,
            photoUrl: row.player.photoUrl,
            role: row.player.role,
            battingStyle: row.player.battingStyle,
            bowlingStyle: row.player.bowlingStyle,
            profileCode: row.player.profileCode,
          }
        : null,
    };
    if (user.role === Role.PLAYER && row.player) {
      const scope = await this.players.scopeForPlayer(row.player.id);
      const involved = this.players.involvedMatches(matches, scope.currentTeamIds, scope.playedMatchIds);
      const missingIds = scope.playedMatchIds.filter((id) => !involved.some((m) => m.id === id));
      const extra = missingIds.length
        ? await this.prisma.match.findMany({
            where: { id: { in: missingIds } },
            include: matchInclude,
            take: 20,
          })
        : [];
      const allMine = [...involved, ...extra];
      const liveMine = allMine.filter((m) => matchStatusGroup(m.status) === 'live');
      const upcomingMine = allMine.filter((m) => matchStatusGroup(m.status) === 'upcoming');
      const recentMine = allMine.filter((m) => matchStatusGroup(m.status) === 'completed');
      const tournamentIds = [...new Set(allMine.map((m) => m.tournamentId).filter((id): id is string => Boolean(id)))];
      const myTournaments = tournamentIds.length
        ? await this.prisma.tournament.findMany({
            where: { id: { in: tournamentIds } },
            include: { _count: { select: { matches: true } } },
            orderBy: { createdAt: 'desc' },
          })
        : [];
      return {
        user: this.auth.publicUser(row),
        matches: tagged(allMine),
        liveMatches: tagged(liveMine),
        upcomingMatches: tagged(upcomingMine),
        recentMatches: tagged(recentMine),
        myMatches: tagged(allMine),
        tournaments: myTournaments,
        profileSnapshot: snapshot,
      };
    }
    return {
      user: this.auth.publicUser(row),
      matches: tagged(matches),
      liveMatches: tagged(live),
      upcomingMatches: tagged(upcoming),
      recentMatches: tagged(recent),
      myMatches: mineTagged,
      tournaments,
      profileSnapshot: snapshot,
    };
  }
}
