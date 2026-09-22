import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser, Public, Roles, type AuthUser } from '../common/auth.guard';
import { Errors } from '../common/app-error';
import { teamInclude } from '../domain/includes';
import { canManageClub, canManagePlayer, canManageTeam } from '../matches/scoring-access';
import { clubBallTypes, createClubSchema } from './club.schema';
import { storedImageUrlSchema } from '../uploads/image-upload';
import { toPublicPlayer } from './public-player';
import { canSensitivePlayerLookup, exactPhoneCandidates, parseSensitiveLookup, toLookupPlayer } from './player-lookup';
import { NotificationsService } from '../notifications/notifications.service';

function profileCode() {
  return `CS${Math.floor(100000 + Math.random() * 900000)}`;
}

const playerInclude = {
  teams: { include: { team: { include: { club: true } } } },
  profile: true,
  careerStats: true,
} as const;

@ApiTags('catalog')
@ApiBearerAuth()
@Controller()
export class CatalogController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
  ) {}

  @Public()
  @Get('search')
  async search(@Query('q') q?: string) {
    const query = (q ?? '').trim();
    if (query.length < 2) {
      return { query, matches: [], teams: [], players: [], tournaments: [], clubs: [] };
    }
    const [matches, teams, players, tournaments, clubs] = await Promise.all([
      this.prisma.match.findMany({
        where: {
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { homeTeam: { name: { contains: query, mode: 'insensitive' } } },
            { awayTeam: { name: { contains: query, mode: 'insensitive' } } },
          ],
        },
        include: { homeTeam: true, awayTeam: true },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
      this.prisma.team.findMany({
        where: { name: { contains: query, mode: 'insensitive' } },
        orderBy: { name: 'asc' },
        take: 8,
      }),
      this.prisma.player.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { profileCode: { contains: query, mode: 'insensitive' } },
          ],
        },
        include: { profile: true },
        orderBy: { name: 'asc' },
        take: 8,
      }),
      this.prisma.tournament.findMany({
        where: { name: { contains: query, mode: 'insensitive' } },
        orderBy: { name: 'asc' },
        take: 8,
      }),
      this.prisma.club.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { city: { contains: query, mode: 'insensitive' } },
          ],
        },
        orderBy: { name: 'asc' },
        take: 8,
      }),
    ]);
    return {
      query,
      matches: matches.map((m) => ({
        id: m.id,
        title: m.title,
        status: m.status,
        homeName: m.homeTeam.name,
        awayName: m.awayTeam.name,
      })),
      teams: teams.map((t) => ({ id: t.id, name: t.name, shortName: t.shortName })),
      players: players.map((p) => ({
        id: p.id,
        name: p.name,
        role: p.role,
        profileCode: p.profileCode,
        jerseyNo: p.profile?.jerseyNo ?? null,
      })),
      tournaments: tournaments.map((t) => ({ id: t.id, name: t.name })),
      clubs: clubs.map((c) => ({ id: c.id, name: c.name, city: c.city })),
    };
  }

  @Public()
  @Get('teams')
  listTeams() {
    return this.prisma.team.findMany({ include: teamInclude, orderBy: { name: 'asc' } });
  }

  @Post('teams')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SCORER, Role.TEAM_MANAGER, Role.PLAYER)
  createTeam(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const input = z
      .object({
        name: z.string().min(2),
        location: z.string().optional(),
        homeGround: z.string().optional(),
        shortName: z.string().optional(),
        clubId: z.string().optional(),
        logoUrl: storedImageUrlSchema,
      })
      .parse(body);
    return this.prisma.team.create({
      data: {
        name: input.name,
        location: input.location,
        homeGround: input.homeGround,
        shortName: input.shortName,
        clubId: input.clubId,
        logoUrl: input.logoUrl ?? undefined,
        createdById: user.id,
      },
      include: teamInclude,
    });
  }

  @Public()
  @Get('teams/:id')
  async getTeam(@Param('id') id: string) {
    const team = await this.prisma.team.findUnique({ where: { id }, include: teamInclude });
    if (!team) throw Errors.notFound('TEAM_NOT_FOUND', 'Team not found');
    return team;
  }

  @Patch('teams/:id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SCORER, Role.TEAM_MANAGER, Role.PLAYER)
  async patchTeam(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    const input = z
      .object({
        name: z.string().min(2).optional(),
        location: z.string().optional(),
        homeGround: z.string().optional(),
        shortName: z.string().optional(),
        logoUrl: storedImageUrlSchema,
      })
      .parse(body ?? {});
    const team = await this.prisma.team.findUnique({ where: { id } });
    if (!team) throw Errors.notFound('TEAM_NOT_FOUND', 'Team not found');
    if (!canManageTeam(user, team)) throw Errors.forbidden();
    return this.prisma.team.update({ where: { id }, data: input, include: teamInclude });
  }

  @Delete('teams/:id')
  @Roles(Role.SUPER_ADMIN)
  async deleteTeam(@Param('id') id: string) {
    await this.prisma.team.delete({ where: { id } }).catch(() => {
      throw Errors.notFound('TEAM_NOT_FOUND', 'Team not found');
    });
    return { deleted: true };
  }

  @Post('teams/:id/players')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SCORER, Role.TEAM_MANAGER, Role.PLAYER)
  async addPlayerToTeam(@CurrentUser() user: AuthUser, @Param('id') teamId: string, @Body() body: unknown) {
    const input = z
      .object({
        playerId: z.string().min(1),
        jerseyNo: z.coerce.number().int().min(0).max(999).optional(),
      })
      .parse(body);
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) throw Errors.notFound('TEAM_NOT_FOUND', 'Team not found');
    if (!canManageTeam(user, team)) throw Errors.forbidden();
    const player = await this.prisma.player.findUnique({ where: { id: input.playerId } });
    if (!player) throw Errors.notFound('PLAYER_NOT_FOUND', 'Player not found');
    const existing = await this.prisma.teamPlayer.findUnique({
      where: { teamId_playerId: { teamId, playerId: input.playerId } },
    });
    if (existing && !existing.leftAt) throw Errors.conflict('PLAYER_ALREADY_IN_TEAM', 'Player is already a member of this team');
    const row = existing
      ? await this.prisma.teamPlayer.update({
          where: { id: existing.id },
          data: { leftAt: null, jerseyNo: input.jerseyNo ?? existing.jerseyNo, joinedAt: existing.leftAt ? new Date() : existing.joinedAt },
          include: { player: { include: { profile: true } } },
        })
      : await this.prisma.teamPlayer.create({
          data: { teamId, playerId: input.playerId, jerseyNo: input.jerseyNo },
          include: { player: { include: { profile: true } } },
        });
    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'TEAM_PLAYER_ADDED',
        entity: 'Team',
        entityId: teamId,
        meta: { playerId: input.playerId },
      },
    });
    if (team.createdById) {
      void this.notifications.notify({
        userIds: [team.createdById],
        type: 'PLAYER_ADDED',
        title: 'Player added',
        body: `${player.name} was added to ${team.name}`,
        link: `/teams/${teamId}`,
        meta: { teamId, playerId: input.playerId },
      });
    }
    return row;
  }

  @Delete('teams/:id/players/:playerId')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SCORER, Role.TEAM_MANAGER, Role.PLAYER)
  async removePlayerFromTeam(
    @CurrentUser() user: AuthUser,
    @Param('id') teamId: string,
    @Param('playerId') playerId: string,
  ) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) throw Errors.notFound('TEAM_NOT_FOUND', 'Team not found');
    if (!canManageTeam(user, team)) throw Errors.forbidden();
    const row = await this.prisma.teamPlayer.findUnique({
      where: { teamId_playerId: { teamId, playerId } },
    });
    if (!row) throw Errors.notFound('PLAYER_NOT_ON_TEAM', 'Player is not on this team');
    await this.prisma.teamPlayer.update({ where: { id: row.id }, data: { leftAt: new Date() } });
    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'TEAM_PLAYER_REMOVED',
        entity: 'Team',
        entityId: teamId,
        meta: { playerId },
      },
    });
    return { removed: true };
  }

  @Post('players/lookup')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SCORER, Role.TEAM_MANAGER)
  async lookupPlayer(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    if (!canSensitivePlayerLookup(user.role)) throw Errors.forbidden();
    const input = z.object({ query: z.string().min(2).max(80), teamId: z.string().optional() }).parse(body);
    if (input.teamId) {
      const team = await this.prisma.team.findUnique({ where: { id: input.teamId } });
      if (!team) throw Errors.notFound('TEAM_NOT_FOUND', 'Team not found');
      if (!canManageTeam(user, team)) throw Errors.forbidden();
    }
    const sensitive = parseSensitiveLookup(input.query);
    if (sensitive?.kind === 'email') {
      const linked = await this.prisma.user.findUnique({
        where: { email: sensitive.value },
        include: { player: true },
      });
      return linked?.player ? [toLookupPlayer(linked.player)] : [];
    }
    if (sensitive?.kind === 'phone') {
      const phones = exactPhoneCandidates(sensitive.value);
      const linked = await this.prisma.user.findFirst({
        where: { phone: { in: phones } },
        include: { player: true },
      });
      return linked?.player ? [toLookupPlayer(linked.player)] : [];
    }
    const rows = await this.prisma.player.findMany({
      where: {
        OR: [
          { name: { contains: input.query, mode: 'insensitive' } },
          { profileCode: { equals: input.query.toUpperCase() } },
          { profileCode: { contains: input.query, mode: 'insensitive' } },
        ],
      },
      take: 10,
      orderBy: { name: 'asc' },
    });
    return rows.map(toLookupPlayer);
  }

  @Public()
  @Get('players')
  async listPlayers(@Query('q') q?: string, @Query('limit') limit?: string) {
    const query = (q ?? '').trim();
    const take = Math.min(Math.max(Number(limit) || (query ? 20 : 200), 1), query ? 50 : 500);
    const jersey = /^\d+$/.test(query) ? Number(query) : null;
    const rows = await this.prisma.player.findMany({
      where: query
        ? {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { profileCode: { contains: query, mode: 'insensitive' } },
              { role: { contains: query, mode: 'insensitive' } },
              ...(jersey != null
                ? [{ profile: { jerseyNo: jersey } }, { teams: { some: { jerseyNo: jersey } } }]
                : []),
            ],
          }
        : undefined,
      include: playerInclude,
      orderBy: { name: 'asc' },
      take,
    });
    return rows.map((player) => toPublicPlayer(player));
  }

  @Post('players')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SCORER, Role.TEAM_MANAGER, Role.PLAYER)
  async createPlayer(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const input = z
      .object({
        name: z.string().min(2),
        teamId: z.string().optional(),
        role: z.string().optional(),
        battingStyle: z.string().optional(),
        bowlingStyle: z.string().optional(),
        jerseyNo: z.coerce.number().int().min(0).max(999).optional(),
      })
      .parse(body);
    if (input.teamId) {
      const team = await this.prisma.team.findUnique({ where: { id: input.teamId } });
      if (!team) throw Errors.notFound('TEAM_NOT_FOUND', 'Team not found');
      if (!canManageTeam(user, team)) throw Errors.forbidden();
    }
    return this.prisma.player.create({
      data: {
        name: input.name,
        profileCode: profileCode(),
        role: input.role ?? 'BATTER',
        battingStyle: input.battingStyle,
        bowlingStyle: input.bowlingStyle,
        profile: { create: { jerseyNo: input.jerseyNo } },
        teams: input.teamId ? { create: { teamId: input.teamId, jerseyNo: input.jerseyNo } } : undefined,
      },
      include: playerInclude,
    });
  }

  @Public()
  @Get('players/:id')
  async getPlayer(@Param('id') id: string) {
    const player = await this.prisma.player.findUnique({
      where: { id },
      include: playerInclude,
    });
    if (!player) throw Errors.notFound('PLAYER_NOT_FOUND', 'Player not found');
    return toPublicPlayer(player);
  }

  @Patch('players/:id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SCORER, Role.TEAM_MANAGER, Role.PLAYER)
  async patchPlayer(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    const input = z
      .object({
        name: z.string().min(2).optional(),
        role: z.string().optional(),
        battingStyle: z.string().optional(),
        bowlingStyle: z.string().optional(),
      })
      .parse(body ?? {});
    const player = await this.prisma.player.findUnique({
      where: { id },
      include: { teams: { include: { team: true } } },
    });
    if (!player) throw Errors.notFound('PLAYER_NOT_FOUND', 'Player not found');
    if (!canManagePlayer(user, player)) throw Errors.forbidden();
    return this.prisma.player.update({ where: { id }, data: input });
  }

  @Delete('players/:id')
  @Roles(Role.SUPER_ADMIN)
  async deletePlayer(@Param('id') id: string) {
    await this.prisma.player.delete({ where: { id } }).catch(() => {
      throw Errors.notFound('PLAYER_NOT_FOUND', 'Player not found');
    });
    return { deleted: true };
  }

  @Public()
  @Get('clubs')
  listClubs() {
    return this.prisma.club.findMany({ include: { _count: { select: { teams: true } } }, orderBy: { name: 'asc' } });
  }

  @Public()
  @Get('clubs/:id')
  async getClub(@Param('id') id: string) {
    const club = await this.prisma.club.findUnique({
      where: { id },
      include: {
        _count: { select: { teams: true } },
        members: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } }, orderBy: { createdAt: 'asc' } },
      },
    });
    if (!club) throw Errors.notFound('CLUB_NOT_FOUND', 'Club not found');
    return club;
  }

  @Post('clubs')
  async createClub(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const input = createClubSchema.parse(body);
    return this.prisma.club.create({
      data: {
        name: input.name,
        city: input.city,
        establishedYear: input.establishedYear,
        logoUrl: input.logoUrl,
        description: input.description,
        ballTypes: clubBallTypes(input),
        createdById: user.id,
        members: { create: { userId: user.id, role: 'OWNER' } },
      },
      include: { _count: { select: { teams: true } }, members: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } } } },
    });
  }

  @Patch('clubs/:id')
  async patchClub(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    const club = await this.prisma.club.findUnique({
      where: { id },
      include: { members: true },
    });
    if (!club) throw Errors.notFound('CLUB_NOT_FOUND', 'Club not found');
    if (!canManageClub(user, club)) throw Errors.forbidden();
    const input = createClubSchema.partial().parse(body ?? {});
    return this.prisma.club.update({
      where: { id },
      data: {
        name: input.name,
        city: input.city,
        establishedYear: input.establishedYear,
        logoUrl: input.logoUrl,
        description: input.description,
        ballTypes: input.ballTypes
          ? clubBallTypes({
              name: input.name ?? club.name,
              city: input.city ?? club.city ?? '—',
              establishedYear: input.establishedYear ?? club.establishedYear ?? 2000,
              ballTypes: input.ballTypes,
            })
          : undefined,
      },
      include: { _count: { select: { teams: true } }, members: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } } } },
    });
  }
}
