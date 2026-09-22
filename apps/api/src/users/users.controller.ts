import { Body, Controller, Delete, Get, Headers, Inject, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser, type AuthUser } from '../common/auth.guard';
import { AuthService } from '../auth/auth.service';
import { storedImageUrlSchema } from '../uploads/image-upload';
import { Errors } from '../common/app-error';
import { normalizePhone } from '../auth/identifier';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  @Get('scorers')
  listScorers() {
    return this.prisma.user.findMany({
      where: { role: { in: [Role.SUPER_ADMIN, Role.ADMIN, Role.SCORER] } },
      select: { id: true, name: true, role: true, avatarUrl: true },
      orderBy: { name: 'asc' },
    });
  }

  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    await this.ensurePlayer(user);
    const row = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { player: { include: { careerStats: true, teams: { include: { team: true } }, profile: true } } },
    });
    return {
      ...this.auth.publicUser(row),
      player: row.player
        ? {
            id: row.player.id,
            name: row.player.name,
            photoUrl: row.player.photoUrl,
            role: row.player.role,
            battingStyle: row.player.battingStyle,
            bowlingStyle: row.player.bowlingStyle,
            profileCode: row.player.profileCode,
            jerseyNo: row.player.profile?.jerseyNo ?? row.player.teams.find((tp) => tp.leftAt == null)?.jerseyNo ?? null,
            teams: row.player.teams.map((tp) => tp.team),
            stats: row.player.careerStats,
          }
        : null,
    };
  }

  @Patch('me')
  async patch(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const input = z
      .object({
        name: z.string().min(2).max(80).optional(),
        locale: z.enum(['en', 'hi', 'mr']).optional(),
        phone: z.string().max(20).optional(),
        avatarUrl: storedImageUrlSchema,
        player: z
          .object({
            name: z.string().min(2).max(80).optional(),
            photoUrl: storedImageUrlSchema,
            role: z.string().max(40).optional(),
            battingStyle: z.string().max(40).optional(),
            bowlingStyle: z.string().max(40).optional(),
          })
          .optional(),
      })
      .parse(body ?? {});
    let phone = input.phone;
    if (phone !== undefined && phone !== '') {
      const national = normalizePhone(phone);
      if (!national) throw Errors.validation('Enter a valid 10-digit mobile number.');
      const taken = await this.prisma.user.findFirst({
        where: { id: { not: user.id }, OR: [{ phone: national }, { phone: `+91${national}` }] },
      });
      if (taken) throw Errors.conflict('PHONE_IN_USE', 'That mobile number is already registered.');
      phone = national;
    }
    const row = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        name: input.name,
        locale: input.locale,
        phone,
        avatarUrl: input.avatarUrl === undefined ? undefined : input.avatarUrl,
        preferences: input.locale ? { upsert: { create: { locale: input.locale }, update: { locale: input.locale } } } : undefined,
        player:
          input.player || input.name
            ? {
                upsert: {
                  create: {
                    name: input.player?.name ?? input.name ?? user.name,
                    profileCode: `CS${Math.floor(100000 + Math.random() * 900000)}`,
                    photoUrl: input.player?.photoUrl,
                    role: input.player?.role,
                    battingStyle: input.player?.battingStyle,
                    bowlingStyle: input.player?.bowlingStyle,
                  },
                  update: {
                    name: input.player?.name ?? input.name,
                    photoUrl: input.player?.photoUrl,
                    role: input.player?.role,
                    battingStyle: input.player?.battingStyle,
                    bowlingStyle: input.player?.bowlingStyle,
                  },
                },
              }
            : undefined,
      },
      include: { player: true },
    });
    return this.auth.publicUser(row);
  }

  private async ensurePlayer(user: AuthUser) {
    const existing = await this.prisma.player.findUnique({ where: { userId: user.id } });
    if (existing) return existing;
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        return await this.prisma.player.create({
          data: {
            userId: user.id,
            name: user.name,
            profileCode: `CS${Math.floor(100000 + Math.random() * 900000)}`,
          },
        });
      } catch {
        /* profileCode collision */
      }
    }
    return this.prisma.player.findUnique({ where: { userId: user.id } });
  }

  @Post('me/change-password')
  changePassword(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.auth.changePassword(user.id, body);
  }

  @Get('me/sessions')
  listSessions(@CurrentUser() user: AuthUser, @Headers('x-refresh-token') refresh?: string) {
    return this.auth.listSessions(user.id, refresh);
  }

  @Delete('me/sessions/:sid')
  revokeSession(@CurrentUser() user: AuthUser, @Param('sid') sid: string) {
    return this.auth.revokeSession(user.id, sid);
  }

  @Post('me/logout-all')
  logoutAll(@CurrentUser() user: AuthUser) {
    return this.auth.logoutAll(user.id);
  }
}
