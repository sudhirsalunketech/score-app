import { createHash, randomBytes } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { AccessLevel, AccessStatus, Prisma, Role } from '@prisma/client';
import { z } from 'zod';
import {
  effectiveAccessStatus,
  hasPermission,
  permissionsForLevel,
  resolvePermissions,
  sanitizePermissions,
  type Permission,
} from '@crickscore/shared';
import { PrismaService } from '../prisma/prisma.service';
import { Errors } from '../common/app-error';
import type { AuthUser } from '../common/auth.guard';
import { denyMessage } from '../common/app-config';
import { matchInclude } from '../domain/includes';

const INVITE_MS = 48 * 3600_000;

function hashToken(raw: string) {
  return createHash('sha256').update(raw).digest('hex');
}

function profileCode() {
  return `CS${Math.floor(100000 + Math.random() * 900000)}`;
}

function isAssignedScorer(settings: unknown, userId: string): boolean {
  const s = (settings ?? {}) as Record<string, unknown>;
  return Array.isArray(s.scorerIds) && (s.scorerIds as unknown[]).includes(userId);
}

@Injectable()
export class AccessService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  webOrigin() {
    return (process.env.WEB_ORIGIN || 'http://localhost:5173').split(',')[0]!.replace(/\/$/, '');
  }

  async matchPermissions(user: AuthUser | null, matchId: string, now = new Date()): Promise<Set<Permission>> {
    if (!user) return new Set();
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: { id: true, createdById: true, settings: true, tournamentId: true, tournament: { select: { createdById: true } } },
    });
    if (!match) return new Set();
    const [matchAccess, tournamentAccess] = await Promise.all([
      this.prisma.matchAccess.findUnique({ where: { matchId_userId: { matchId, userId: user.id } } }),
      match.tournamentId
        ? this.prisma.tournamentAccess.findUnique({
            where: { tournamentId_userId: { tournamentId: match.tournamentId, userId: user.id } },
          })
        : Promise.resolve(null),
    ]);
    if (matchAccess && effectiveAccessStatus({ ...matchAccess, now }) === 'EXPIRED' && matchAccess.status === AccessStatus.ACTIVE) {
      await this.prisma.matchAccess.update({ where: { id: matchAccess.id }, data: { status: AccessStatus.EXPIRED } });
    }
    return resolvePermissions({
      globalRole: user.role,
      matchAccess,
      tournamentAccess,
      isMatchCreator: match.createdById === user.id,
      isAssignedScorer: isAssignedScorer(match.settings, user.id),
      isTournamentCreator: match.tournament?.createdById === user.id,
      now,
    });
  }

  async tournamentPermissions(user: AuthUser | null, tournamentId: string, now = new Date()): Promise<Set<Permission>> {
    if (!user) return new Set();
    const tn = await this.prisma.tournament.findUnique({ where: { id: tournamentId }, select: { createdById: true, clubId: true } });
    if (!tn) return new Set();
    const row = await this.prisma.tournamentAccess.findUnique({
      where: { tournamentId_userId: { tournamentId, userId: user.id } },
    });
    if (row && effectiveAccessStatus({ ...row, now }) === 'EXPIRED' && row.status === AccessStatus.ACTIVE) {
      await this.prisma.tournamentAccess.update({ where: { id: row.id }, data: { status: AccessStatus.EXPIRED } });
    }
    const perms = resolvePermissions({
      globalRole: user.role,
      tournamentAccess: row,
      isTournamentCreator: tn.createdById === user.id,
      now,
    });
    if (tn.clubId) {
      const membership = await this.prisma.clubMember.findUnique({
        where: { clubId_userId: { clubId: tn.clubId, userId: user.id } },
      });
      if (membership) {
        perms.add('TOURNAMENT_VIEW');
        perms.add('TOURNAMENT_VIEW_STATS');
      }
    }
    return perms;
  }

  async canMatch(user: AuthUser | null, matchId: string, permission: Permission): Promise<boolean> {
    return hasPermission(await this.matchPermissions(user, matchId), permission);
  }

  async canTournament(user: AuthUser | null, tournamentId: string, permission: Permission): Promise<boolean> {
    return hasPermission(await this.tournamentPermissions(user, tournamentId), permission);
  }

  async attachMatchPermissions<
    T extends {
      id: string;
      createdById?: string | null;
      settings?: unknown;
      tournamentId?: string | null;
      tournament?: { createdById?: string | null } | null;
    },
  >(user: AuthUser | null, matches: T[]): Promise<(T & { myPermissions: Permission[] })[]> {
    if (!user) return matches.map((m) => ({ ...m, myPermissions: [] as Permission[] }));
    const now = new Date();
    const ids = matches.map((m) => m.id);
    const tourIds = [...new Set(matches.map((m) => m.tournamentId).filter((id): id is string => Boolean(id)))];
    const [matchRows, tourRows] = await Promise.all([
      ids.length
        ? this.prisma.matchAccess.findMany({ where: { userId: user.id, matchId: { in: ids } } })
        : Promise.resolve([]),
      tourIds.length
        ? this.prisma.tournamentAccess.findMany({ where: { userId: user.id, tournamentId: { in: tourIds } } })
        : Promise.resolve([]),
    ]);
    const matchMap = new Map(matchRows.map((row) => [row.matchId, row]));
    const tourMap = new Map(tourRows.map((row) => [row.tournamentId, row]));
    return matches.map((match) => ({
      ...match,
      myPermissions: this.dtoPerms(
        resolvePermissions({
          globalRole: user.role,
          matchAccess: matchMap.get(match.id),
          tournamentAccess: match.tournamentId ? tourMap.get(match.tournamentId) : null,
          isMatchCreator: match.createdById === user.id,
          isAssignedScorer: isAssignedScorer(match.settings, user.id),
          isTournamentCreator: match.tournament?.createdById === user.id,
          now,
        }),
      ),
    }));
  }

  async assertMatch(user: AuthUser, matchId: string, permission: Permission) {
    const ok = await this.canMatch(user, matchId, permission);
    await this.audit(user.id, permission, 'Match', matchId, { allowed: ok });
    if (ok) return;
    const access = await this.prisma.matchAccess.findUnique({
      where: { matchId_userId: { matchId, userId: user.id } },
    });
    if (access && effectiveAccessStatus(access) === 'EXPIRED') {
      throw Errors.forbidden('Your match access has expired.');
    }
    throw Errors.forbidden(denyMessage(permission));
  }

  async assertInnings(user: AuthUser, inningsId: string, permission: Permission) {
    const innings = await this.prisma.innings.findUnique({ where: { id: inningsId }, select: { matchId: true } });
    if (!innings) throw Errors.notFound('NOT_FOUND', 'Innings not found');
    await this.assertMatch(user, innings.matchId, permission);
  }

  async assertTournament(user: AuthUser, tournamentId: string, permission: Permission) {
    const ok = hasPermission(await this.tournamentPermissions(user, tournamentId), permission);
    await this.audit(user.id, permission, 'Tournament', tournamentId, { allowed: ok });
    if (!ok) throw Errors.forbidden(denyMessage(permission));
  }

  async audit(userId: string | null, action: string, entity: string, entityId: string | null, meta?: Prisma.InputJsonValue) {
    await this.prisma.auditLog.create({
      data: { userId: userId ?? undefined, action, entity, entityId, meta },
    });
  }

  dtoPerms(perms: Set<Permission>) {
    return [...perms];
  }

  async listMatchAccess(user: AuthUser, matchId: string) {
    await this.assertMatch(user, matchId, 'USER_MANAGE_ACCESS');
    const rows = await this.prisma.matchAccess.findMany({
      where: { matchId },
      include: { user: { select: { id: true, name: true, email: true, role: true, avatarUrl: true } }, grantedBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.accessDto(row));
  }

  async grantMatch(actor: AuthUser, matchId: string, body: unknown) {
    await this.assertMatch(actor, matchId, 'USER_MANAGE_ACCESS');
    const input = z
      .object({
        userId: z.string(),
        level: z.nativeEnum(AccessLevel),
        permissions: z.array(z.string()).optional(),
        expiresAt: z.string().datetime().optional().nullable(),
      })
      .parse(body);
    const perms = permissionsForLevel(input.level, sanitizePermissions(input.permissions));
    const row = await this.prisma.matchAccess.upsert({
      where: { matchId_userId: { matchId, userId: input.userId } },
      create: {
        matchId,
        userId: input.userId,
        level: input.level,
        permissions: perms,
        status: AccessStatus.ACTIVE,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        grantedById: actor.id,
      },
      update: {
        level: input.level,
        permissions: perms,
        status: AccessStatus.ACTIVE,
        expiresAt: input.expiresAt === undefined ? undefined : input.expiresAt ? new Date(input.expiresAt) : null,
        grantedById: actor.id,
      },
      include: { user: { select: { id: true, name: true, email: true, role: true, avatarUrl: true } }, grantedBy: { select: { id: true, name: true } } },
    });
    await this.audit(actor.id, 'ACCESS_GRANTED', 'Match', matchId, { userId: input.userId, level: input.level, permissions: perms });
    return this.accessDto(row);
  }

  async patchMatchAccess(actor: AuthUser, matchId: string, accessId: string, body: unknown) {
    await this.assertMatch(actor, matchId, 'USER_MANAGE_ACCESS');
    const input = z
      .object({
        level: z.nativeEnum(AccessLevel).optional(),
        permissions: z.array(z.string()).optional(),
        status: z.nativeEnum(AccessStatus).optional(),
        expiresAt: z.string().datetime().optional().nullable(),
      })
      .parse(body);
    const current = await this.prisma.matchAccess.findFirst({ where: { id: accessId, matchId } });
    if (!current) throw Errors.notFound('NOT_FOUND', 'Access not found');
    const level = input.level ?? current.level;
    const perms = input.permissions ? permissionsForLevel(level, sanitizePermissions(input.permissions)) : input.level ? permissionsForLevel(level) : current.permissions;
    const row = await this.prisma.matchAccess.update({
      where: { id: accessId },
      data: {
        level,
        permissions: perms,
        status: input.status,
        expiresAt: input.expiresAt === undefined ? undefined : input.expiresAt ? new Date(input.expiresAt) : null,
      },
      include: { user: { select: { id: true, name: true, email: true, role: true, avatarUrl: true } }, grantedBy: { select: { id: true, name: true } } },
    });
    await this.audit(actor.id, 'ACCESS_CHANGED', 'Match', matchId, { accessId, level, status: row.status });
    return this.accessDto(row);
  }

  async revokeMatchAccess(actor: AuthUser, matchId: string, accessId: string) {
    await this.assertMatch(actor, matchId, 'USER_MANAGE_ACCESS');
    const current = await this.prisma.matchAccess.findFirst({ where: { id: accessId, matchId } });
    if (!current) throw Errors.notFound('NOT_FOUND', 'Access not found');
    const row = await this.prisma.matchAccess.update({
      where: { id: accessId },
      data: { status: AccessStatus.REVOKED },
      include: { user: { select: { id: true, name: true, email: true, role: true, avatarUrl: true } }, grantedBy: { select: { id: true, name: true } } },
    });
    await this.audit(actor.id, 'ACCESS_REVOKED', 'Match', matchId, { accessId, userId: current.userId });
    return this.accessDto(row);
  }

  async listTournamentAccess(user: AuthUser, tournamentId: string) {
    await this.assertTournament(user, tournamentId, 'USER_MANAGE_ACCESS');
    const rows = await this.prisma.tournamentAccess.findMany({
      where: { tournamentId },
      include: { user: { select: { id: true, name: true, email: true, role: true, avatarUrl: true } }, grantedBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.accessDto(row));
  }

  async grantTournament(actor: AuthUser, tournamentId: string, body: unknown) {
    await this.assertTournament(actor, tournamentId, 'USER_MANAGE_ACCESS');
    const input = z
      .object({
        userId: z.string(),
        level: z.nativeEnum(AccessLevel),
        permissions: z.array(z.string()).optional(),
        expiresAt: z.string().datetime().optional().nullable(),
      })
      .parse(body);
    const perms = permissionsForLevel(input.level, sanitizePermissions(input.permissions));
    const row = await this.prisma.tournamentAccess.upsert({
      where: { tournamentId_userId: { tournamentId, userId: input.userId } },
      create: {
        tournamentId,
        userId: input.userId,
        level: input.level,
        permissions: perms,
        status: AccessStatus.ACTIVE,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        grantedById: actor.id,
      },
      update: {
        level: input.level,
        permissions: perms,
        status: AccessStatus.ACTIVE,
        expiresAt: input.expiresAt === undefined ? undefined : input.expiresAt ? new Date(input.expiresAt) : null,
        grantedById: actor.id,
      },
      include: { user: { select: { id: true, name: true, email: true, role: true, avatarUrl: true } }, grantedBy: { select: { id: true, name: true } } },
    });
    await this.audit(actor.id, 'ACCESS_GRANTED', 'Tournament', tournamentId, { userId: input.userId, level: input.level });
    return this.accessDto(row);
  }

  async patchTournamentAccess(actor: AuthUser, tournamentId: string, accessId: string, body: unknown) {
    await this.assertTournament(actor, tournamentId, 'USER_MANAGE_ACCESS');
    const input = z
      .object({
        level: z.nativeEnum(AccessLevel).optional(),
        permissions: z.array(z.string()).optional(),
        status: z.nativeEnum(AccessStatus).optional(),
        expiresAt: z.string().datetime().optional().nullable(),
      })
      .parse(body);
    const current = await this.prisma.tournamentAccess.findFirst({ where: { id: accessId, tournamentId } });
    if (!current) throw Errors.notFound('NOT_FOUND', 'Access not found');
    const level = input.level ?? current.level;
    const perms = input.permissions
      ? permissionsForLevel(level, sanitizePermissions(input.permissions))
      : input.level
        ? permissionsForLevel(level)
        : current.permissions;
    const row = await this.prisma.tournamentAccess.update({
      where: { id: accessId },
      data: {
        level,
        permissions: perms,
        status: input.status,
        expiresAt: input.expiresAt === undefined ? undefined : input.expiresAt ? new Date(input.expiresAt) : null,
      },
      include: { user: { select: { id: true, name: true, email: true, role: true, avatarUrl: true } }, grantedBy: { select: { id: true, name: true } } },
    });
    await this.audit(actor.id, 'ACCESS_CHANGED', 'Tournament', tournamentId, { accessId, level, status: row.status });
    return this.accessDto(row);
  }

  async revokeTournamentAccess(actor: AuthUser, tournamentId: string, accessId: string) {
    await this.assertTournament(actor, tournamentId, 'USER_MANAGE_ACCESS');
    const current = await this.prisma.tournamentAccess.findFirst({ where: { id: accessId, tournamentId } });
    if (!current) throw Errors.notFound('NOT_FOUND', 'Access not found');
    const row = await this.prisma.tournamentAccess.update({
      where: { id: accessId },
      data: { status: AccessStatus.REVOKED },
      include: { user: { select: { id: true, name: true, email: true, role: true, avatarUrl: true } }, grantedBy: { select: { id: true, name: true } } },
    });
    await this.audit(actor.id, 'ACCESS_REVOKED', 'Tournament', tournamentId, { accessId, userId: current.userId });
    return this.accessDto(row);
  }

  async searchPeople(actor: AuthUser, q: string) {
    const query = q.trim();
    if (query.length < 2) return { users: [], players: [] };
    const [users, players] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
            { phone: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: { id: true, name: true, email: true, role: true, avatarUrl: true, player: { select: { id: true, name: true, profileCode: true } } },
        take: 12,
      }),
      this.prisma.player.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { profileCode: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: { id: true, name: true, profileCode: true, photoUrl: true, userId: true, user: { select: { id: true, email: true, role: true } } },
        take: 12,
      }),
    ]);
    return { users, players };
  }

  async invite(actor: AuthUser, body: unknown) {
    const input = z
      .object({
        name: z.string().min(2).max(80),
        email: z.string().email(),
        phone: z.string().max(20).optional(),
        playerId: z.string().optional(),
        teamId: z.string().optional(),
        matchId: z.string().optional(),
        tournamentId: z.string().optional(),
        level: z.nativeEnum(AccessLevel).optional(),
        permissions: z.array(z.string()).optional(),
        kind: z.enum(['ACCESS', 'BETA']).optional(),
      })
      .parse(body);
    if (input.matchId) await this.assertMatch(actor, input.matchId, 'USER_INVITE');
    else if (input.tournamentId) await this.assertTournament(actor, input.tournamentId, 'USER_INVITE');
    else if (actor.role !== Role.SUPER_ADMIN) throw Errors.forbidden("You don't have permission");

    const kind = input.kind ?? 'ACCESS';
    const isBeta = kind === 'BETA';
    const email = input.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    const level = input.level ?? AccessLevel.PLAYER;
    const perms = permissionsForLevel(level, sanitizePermissions(input.permissions));
    if (existing) {
      if (input.playerId) {
        const player = await this.prisma.player.findUnique({ where: { id: input.playerId } });
        if (player && !player.userId) {
          await this.prisma.player.update({ where: { id: player.id }, data: { userId: existing.id } });
        }
      }
      if (input.matchId) {
        await this.prisma.matchAccess.upsert({
          where: { matchId_userId: { matchId: input.matchId, userId: existing.id } },
          create: { matchId: input.matchId, userId: existing.id, level, permissions: perms, grantedById: actor.id },
          update: { level, permissions: perms, status: AccessStatus.ACTIVE, grantedById: actor.id },
        });
      }
      if (input.tournamentId) {
        await this.prisma.tournamentAccess.upsert({
          where: { tournamentId_userId: { tournamentId: input.tournamentId, userId: existing.id } },
          create: { tournamentId: input.tournamentId, userId: existing.id, level, permissions: perms, grantedById: actor.id },
          update: { level, permissions: perms, status: AccessStatus.ACTIVE, grantedById: actor.id },
        });
      }
      if (isBeta) {
        await this.prisma.user.update({ where: { id: existing.id }, data: { isBeta: true } });
      }
      await this.audit(actor.id, 'USER_INVITED', 'User', existing.id, { email, linkedExisting: true, kind });
      return { granted: true, invited: false, userId: existing.id };
    }

    if (input.playerId) {
      const player = await this.prisma.player.findUnique({ where: { id: input.playerId } });
      if (player?.userId) throw Errors.conflict('PLAYER_LINKED', 'Player already has an account');
    }

    const raw = randomBytes(32).toString('hex');
    const row = await this.prisma.invitation.create({
      data: {
        email,
        name: input.name,
        phone: input.phone,
        tokenHash: hashToken(raw),
        expiresAt: new Date(Date.now() + INVITE_MS),
        playerId: input.playerId,
        teamId: input.teamId,
        matchId: input.matchId,
        tournamentId: input.tournamentId,
        level,
        permissions: perms,
        kind,
        invitedById: actor.id,
      },
    });
    await this.audit(actor.id, 'USER_INVITED', 'Invitation', row.id, { email, kind });
    const inviteUrl = `${this.webOrigin()}/invite/${raw}`;
    return { granted: false, invited: true, invitationId: row.id, expiresAt: row.expiresAt, inviteUrl };
  }

  async peekInvite(token: string) {
    const row = await this.prisma.invitation.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { player: { select: { id: true, name: true } } },
    });
    if (!row || row.acceptedAt || row.revokedAt || row.expiresAt < new Date()) throw Errors.notFound('NOT_FOUND', 'Invitation not found');
    return {
      name: row.name,
      email: row.email,
      playerName: row.player?.name ?? row.name,
      level: row.level,
      kind: row.kind,
      expiresAt: row.expiresAt,
    };
  }

  async acceptInvite(token: string, body: unknown) {
    const password = z.object({ password: z.string().min(8).max(128) }).parse(body).password;
    const row = await this.prisma.invitation.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!row || row.acceptedAt || row.revokedAt || row.expiresAt < new Date()) throw Errors.validation('Invalid or expired invitation');
    const exists = await this.prisma.user.findUnique({ where: { email: row.email } });
    if (exists) throw Errors.conflict('USER_EXISTS', 'Email already registered');
    const bcrypt = await import('bcryptjs');
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: row.email,
          name: row.name,
          phone: row.phone,
          passwordHash: await bcrypt.hash(password, 12),
          role: row.level === AccessLevel.VIEWER ? Role.VIEWER : Role.PLAYER,
          isBeta: row.kind === 'BETA',
          preferences: { create: { locale: 'en' } },
        },
      });
      if (row.playerId) {
        const player = await tx.player.findUnique({ where: { id: row.playerId } });
        if (player && !player.userId) {
          await tx.player.update({ where: { id: player.id }, data: { userId: created.id } });
        }
      } else {
        await tx.player.create({
          data: { name: row.name, profileCode: profileCode(), userId: created.id },
        });
      }
      if (row.teamId) {
        const player = await tx.player.findUnique({ where: { userId: created.id } });
        if (player) {
          await tx.teamPlayer.upsert({
            where: { teamId_playerId: { teamId: row.teamId, playerId: player.id } },
            create: { teamId: row.teamId, playerId: player.id },
            update: { leftAt: null },
          });
        }
      }
      if (row.matchId) {
        await tx.matchAccess.create({
          data: {
            matchId: row.matchId,
            userId: created.id,
            level: row.level,
            permissions: row.permissions,
            grantedById: row.invitedById,
          },
        });
      }
      if (row.tournamentId) {
        await tx.tournamentAccess.create({
          data: {
            tournamentId: row.tournamentId,
            userId: created.id,
            level: row.level,
            permissions: row.permissions,
            grantedById: row.invitedById,
          },
        });
      }
      await tx.invitation.update({ where: { id: row.id }, data: { acceptedAt: new Date() } });
      return created;
    });
    await this.audit(user.id, 'INVITATION_ACCEPTED', 'Invitation', row.id, { matchId: row.matchId });
    return { userId: user.id, email: user.email, matchId: row.matchId, tournamentId: row.tournamentId };
  }

  async myAccess(user: AuthUser) {
    const [matches, tournaments] = await Promise.all([
      this.prisma.matchAccess.findMany({
        where: { userId: user.id },
        include: { match: { select: { id: true, title: true, status: true, publicSlug: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.tournamentAccess.findMany({
        where: { userId: user.id },
        include: { tournament: { select: { id: true, name: true, publicSlug: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return {
      matches: matches.map((row) => ({
        ...this.accessDto(row),
        match: row.match,
      })),
      tournaments: tournaments.map((row) => ({
        ...this.accessDto(row),
        tournament: row.tournament,
      })),
    };
  }

  async myMatches(user: AuthUser) {
    const access = await this.prisma.matchAccess.findMany({
      where: { userId: user.id, status: { in: [AccessStatus.ACTIVE, AccessStatus.PENDING] } },
      include: { match: { include: matchInclude } },
      orderBy: { createdAt: 'desc' },
    });
    const now = new Date();
    const visible = access.filter(
      (row) => effectiveAccessStatus({ ...row, now }) === 'ACTIVE' || row.status === AccessStatus.PENDING,
    );
    const withPerms = await this.attachMatchPermissions(
      user,
      visible.map((row) => row.match),
    );
    return withPerms.map((match, i) => {
      const row = visible[i]!;
      return {
        ...match,
        myAccess: { level: row.level, status: effectiveAccessStatus({ ...row, now }), permissions: row.permissions },
      };
    });
  }

  async myPermissions(user: AuthUser) {
    return {
      role: user.role,
      globalAdmin: user.role === Role.SUPER_ADMIN,
    };
  }

  async adminOverview(user: AuthUser) {
    if (user.role !== Role.SUPER_ADMIN) throw Errors.forbidden("You don't have permission");
    const [users, invitations, matchAccess, tournamentAccess] = await Promise.all([
      this.prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          lastLoginAt: true,
          isBeta: true,
          disabledAt: true,
          player: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 80,
      }),
      this.prisma.invitation.findMany({ orderBy: { createdAt: 'desc' }, take: 40 }),
      this.prisma.matchAccess.findMany({
        include: { user: { select: { name: true, email: true } }, match: { select: { title: true } } },
        orderBy: { createdAt: 'desc' },
        take: 40,
      }),
      this.prisma.tournamentAccess.findMany({
        include: { user: { select: { name: true, email: true } }, tournament: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 40,
      }),
    ]);
    return {
      users,
      invitations: invitations.map(({ tokenHash: _tokenHash, ...rest }) => rest),
      matchAccess,
      tournamentAccess,
    };
  }

  async logs(user: AuthUser, entity: string, entityId: string) {
    if (entity === 'Match') await this.assertMatch(user, entityId, 'USER_MANAGE_ACCESS');
    else if (entity === 'Tournament') await this.assertTournament(user, entityId, 'USER_MANAGE_ACCESS');
    else if (user.role !== Role.SUPER_ADMIN) throw Errors.forbidden();
    return this.prisma.auditLog.findMany({
      where: { entity, entityId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { user: { select: { id: true, name: true } } },
    });
  }

  private accessDto(row: {
    id: string;
    level: AccessLevel;
    permissions: string[];
    status: AccessStatus;
    expiresAt: Date | null;
    createdAt: Date;
    user?: { id: string; name: string; email?: string; role?: string; avatarUrl?: string | null };
    grantedBy?: { id: string; name: string } | null;
  }) {
    return {
      id: row.id,
      level: row.level,
      permissions: row.permissions,
      status: effectiveAccessStatus(row),
      expiresAt: row.expiresAt,
      grantedAt: row.createdAt,
      user: row.user,
      grantedBy: row.grantedBy ?? null,
    };
  }
}
