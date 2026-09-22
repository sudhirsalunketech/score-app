import { Inject, Injectable } from '@nestjs/common';
import { AccessLevel, FeedbackSeverity, FeedbackStatus, Role } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';
import { Errors } from '../common/app-error';
import type { AuthUser } from '../common/auth.guard';
import { AccessService } from '../access/access.service';
import { isBetaEnv } from '../common/app-config';

const USER_TYPES = ['PLAYER', 'SCORER', 'MATCH_ADMIN', 'VIEWER'] as const;

function testerStatus(user: { disabledAt: Date | null } | null, invite: { acceptedAt: Date | null; revokedAt: Date | null; expiresAt: Date } | null) {
  if (user?.disabledAt) return 'DISABLED' as const;
  if (user) return 'ACTIVE' as const;
  if (invite && !invite.acceptedAt && !invite.revokedAt && invite.expiresAt >= new Date()) return 'INVITED' as const;
  if (invite && invite.revokedAt) return 'DISABLED' as const;
  return 'INVITED' as const;
}

@Injectable()
export class BetaService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AccessService) private readonly access: AccessService,
  ) {}

  assertAdmin(user: AuthUser) {
    if (user.role !== Role.SUPER_ADMIN && user.role !== Role.ADMIN) {
      throw Errors.forbidden("You don't have permission to manage users.");
    }
  }

  async canSubmitFeedback(user: AuthUser) {
    if (user.role === Role.SUPER_ADMIN || user.role === Role.ADMIN) return true;
    if (isBetaEnv()) return true;
    const row = await this.prisma.user.findUnique({ where: { id: user.id }, select: { isBeta: true } });
    return Boolean(row?.isBeta);
  }

  async listTesters(actor: AuthUser) {
    this.assertAdmin(actor);
    const [users, invitations] = await Promise.all([
      this.prisma.user.findMany({
        where: { isBeta: true },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          lastLoginAt: true,
          disabledAt: true,
          isBeta: true,
          matchAccess: {
            where: { status: { in: ['ACTIVE', 'PENDING'] } },
            select: { id: true, match: { select: { id: true, title: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.invitation.findMany({
        where: { kind: 'BETA', acceptedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 80,
      }),
    ]);
    const byEmail = new Set(users.map((u) => u.email.toLowerCase()));
    const invited = invitations
      .filter((inv) => !byEmail.has(inv.email.toLowerCase()))
      .map((inv) => ({
        id: inv.id,
        userId: null as string | null,
        invitationId: inv.id,
        name: inv.name,
        email: inv.email,
        role: inv.level,
        status: testerStatus(null, inv),
        matchesAssigned: [] as Array<{ id: string; title: string }>,
        lastLoginAt: null as Date | null,
        expiresAt: inv.expiresAt,
      }));
    return [
      ...users.map((u) => ({
        id: u.id,
        userId: u.id,
        invitationId: null as string | null,
        name: u.name,
        email: u.email,
        role: u.role,
        status: testerStatus(u, null),
        matchesAssigned: u.matchAccess.map((row) => row.match),
        lastLoginAt: u.lastLoginAt,
        expiresAt: null as Date | null,
      })),
      ...invited,
    ];
  }

  async inviteTester(actor: AuthUser, body: unknown) {
    this.assertAdmin(actor);
    const input = z
      .object({
        name: z.string().min(2).max(80),
        email: z.string().email(),
        userType: z.enum(USER_TYPES),
        tournamentId: z.string().optional(),
        matchId: z.string().optional(),
        permissions: z.array(z.string()).optional(),
      })
      .parse(body);
    const level = input.userType as AccessLevel;
    return this.access.invite(actor, {
      name: input.name,
      email: input.email,
      matchId: input.matchId,
      tournamentId: input.tournamentId,
      level,
      permissions: input.permissions,
      kind: 'BETA',
    });
  }

  async setDisabled(actor: AuthUser, userId: string, disabled: boolean) {
    this.assertAdmin(actor);
    if (userId === actor.id) throw Errors.validation('You cannot disable your own account');
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw Errors.notFound('NOT_FOUND', 'User not found');
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { disabledAt: disabled ? new Date() : null, isBeta: true },
      }),
      ...(disabled
        ? [this.prisma.refreshToken.updateMany({ where: { userId }, data: { revokedAt: new Date() } })]
        : []),
    ]);
    await this.access.audit(actor.id, disabled ? 'USER_DISABLED' : 'USER_ENABLED', 'User', userId);
    return { id: userId, disabled };
  }

  async revokeInvitation(actor: AuthUser, invitationId: string) {
    this.assertAdmin(actor);
    const row = await this.prisma.invitation.findUnique({ where: { id: invitationId } });
    if (!row) throw Errors.notFound('NOT_FOUND', 'Invitation not found');
    if (row.acceptedAt) throw Errors.validation('Invitation already accepted');
    await this.prisma.invitation.update({ where: { id: invitationId }, data: { revokedAt: new Date() } });
    await this.access.audit(actor.id, 'INVITATION_REVOKED', 'Invitation', invitationId);
    return { revoked: true };
  }

  async welcome(user: AuthUser) {
    const assigned = await this.access.myMatches(user);
    return {
      beta: isBetaEnv(),
      greeting: 'Welcome to CrickScore Beta',
      matches: assigned.map((match) => ({
        id: match.id,
        title: match.title,
        status: match.status,
        access: match.myAccess?.level ?? null,
        home: match.homeTeam?.name,
        away: match.awayTeam?.name,
      })),
    };
  }

  async listFeedback(actor: AuthUser) {
    this.assertAdmin(actor);
    return this.prisma.betaFeedback.findMany({
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async createFeedback(user: AuthUser, body: unknown) {
    if (!(await this.canSubmitFeedback(user))) throw Errors.forbidden("You don't have permission.");
    const input = z
      .object({
        title: z.string().min(3).max(120),
        description: z.string().min(8).max(4000),
        screen: z.string().max(120).optional(),
        severity: z.nativeEnum(FeedbackSeverity).optional(),
      })
      .parse(body);
    return this.prisma.betaFeedback.create({
      data: {
        userId: user.id,
        title: input.title,
        description: input.description,
        screen: input.screen,
        severity: input.severity ?? FeedbackSeverity.MEDIUM,
      },
    });
  }

  async patchFeedback(actor: AuthUser, id: string, body: unknown) {
    this.assertAdmin(actor);
    const input = z.object({ status: z.nativeEnum(FeedbackStatus) }).parse(body);
    const row = await this.prisma.betaFeedback.findUnique({ where: { id } });
    if (!row) throw Errors.notFound('NOT_FOUND', 'Feedback not found');
    return this.prisma.betaFeedback.update({ where: { id }, data: { status: input.status } });
  }
}
