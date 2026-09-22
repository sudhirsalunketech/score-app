import { Body, Controller, Delete, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FollowTarget, Prisma } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser, type AuthUser } from '../common/auth.guard';
import { Errors } from '../common/app-error';

const targetSchema = z.object({
  targetType: z.nativeEnum(FollowTarget),
  targetId: z.string().min(1),
});

@ApiTags('follows')
@ApiBearerAuth()
@Controller()
export class FollowsController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get('users/me/following')
  async list(@CurrentUser() user: AuthUser) {
    const rows = await this.prisma.follow.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    const playerIds = rows.filter((r) => r.targetType === FollowTarget.PLAYER).map((r) => r.targetId);
    const teamIds = rows.filter((r) => r.targetType === FollowTarget.TEAM).map((r) => r.targetId);
    const tournamentIds = rows.filter((r) => r.targetType === FollowTarget.TOURNAMENT).map((r) => r.targetId);
    const [players, teams, tournaments] = await Promise.all([
      playerIds.length
        ? this.prisma.player.findMany({ where: { id: { in: playerIds } }, select: { id: true, name: true, photoUrl: true, role: true, profileCode: true } })
        : [],
      teamIds.length
        ? this.prisma.team.findMany({ where: { id: { in: teamIds } }, select: { id: true, name: true, logoUrl: true, location: true } })
        : [],
      tournamentIds.length
        ? this.prisma.tournament.findMany({ where: { id: { in: tournamentIds } }, select: { id: true, name: true, season: true, coverImageUrl: true } })
        : [],
    ]);
    return {
      players: playerIds.map((id) => players.find((p) => p.id === id)).filter(Boolean),
      teams: teamIds.map((id) => teams.find((t) => t.id === id)).filter(Boolean),
      tournaments: tournamentIds.map((id) => tournaments.find((t) => t.id === id)).filter(Boolean),
    };
  }

  @Get('follows/status')
  async status(@CurrentUser() user: AuthUser, @Query('targetType') targetType?: string, @Query('targetId') targetId?: string) {
    const input = targetSchema.parse({ targetType, targetId });
    const row = await this.prisma.follow.findUnique({
      where: { userId_targetType_targetId: { userId: user.id, targetType: input.targetType, targetId: input.targetId } },
    });
    return { following: Boolean(row), id: row?.id ?? null };
  }

  @Post('follows')
  async follow(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const input = targetSchema.parse(body ?? {});
    await this.assertTarget(input.targetType, input.targetId);
    try {
      const row = await this.prisma.follow.create({
        data: { userId: user.id, targetType: input.targetType, targetId: input.targetId },
      });
      return { following: true, id: row.id };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await this.prisma.follow.findUnique({
          where: { userId_targetType_targetId: { userId: user.id, targetType: input.targetType, targetId: input.targetId } },
        });
        return { following: true, id: existing?.id ?? null };
      }
      throw error;
    }
  }

  @Delete('follows/:id')
  async unfollowById(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const row = await this.prisma.follow.findFirst({ where: { id, userId: user.id } });
    if (!row) throw Errors.notFound('FOLLOW_NOT_FOUND', 'Follow not found');
    await this.prisma.follow.delete({ where: { id: row.id } });
    return { following: false };
  }

  @Delete('follows')
  async unfollow(@CurrentUser() user: AuthUser, @Query('targetType') targetType?: string, @Query('targetId') targetId?: string) {
    const input = targetSchema.parse({ targetType, targetId });
    await this.prisma.follow.deleteMany({
      where: { userId: user.id, targetType: input.targetType, targetId: input.targetId },
    });
    return { following: false };
  }

  private async assertTarget(type: FollowTarget, id: string) {
    if (type === FollowTarget.PLAYER) {
      const row = await this.prisma.player.findUnique({ where: { id } });
      if (!row) throw Errors.notFound('PLAYER_NOT_FOUND', 'Player not found');
    } else if (type === FollowTarget.TEAM) {
      const row = await this.prisma.team.findUnique({ where: { id } });
      if (!row) throw Errors.notFound('TEAM_NOT_FOUND', 'Team not found');
    } else {
      const row = await this.prisma.tournament.findUnique({ where: { id } });
      if (!row) throw Errors.notFound('TOURNAMENT_NOT_FOUND', 'Tournament not found');
    }
  }
}
