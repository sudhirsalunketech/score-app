import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';
import { Errors } from '../common/app-error';
import { isDevMailDelivery, sendMail } from '../auth/mailer';

export const NOTIFICATION_TYPES = [
  'MATCH_STARTED',
  'MATCH_COMPLETED',
  'MATCH_RESULT',
  'TOURNAMENT_STARTED',
  'TOURNAMENT_RESULT',
  'PLAYER_ADDED',
  'TEAM_INVITE',
  'QUIZ_RESULT',
  'MVP_RESULT',
  'GENERIC',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

@Injectable()
export class NotificationsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  channels() {
    const email = Boolean(process.env.SMTP_HOST || process.env.SMTP_URL || process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY) || isDevMailDelivery();
    return {
      IN_APP: { configured: true },
      EMAIL: { configured: email, note: email ? null : 'Email delivery is not configured.' },
      PUSH: { configured: false, note: 'Push delivery is not configured.' },
    };
  }

  async list(userId: string) {
    const rows = await this.prisma.notification.findMany({
      where: { userId, channel: 'IN_APP' },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return {
      unread: rows.filter((r) => !r.readAt).length,
      channels: this.channels(),
      items: rows,
    };
  }

  async markRead(userId: string, id: string) {
    const row = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!row) throw Errors.notFound('NOT_FOUND', 'Notification not found');
    return this.prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
    return { ok: true };
  }

  async notify(input: {
    userIds: string[];
    type: NotificationType;
    title: string;
    body: string;
    link?: string;
    meta?: Record<string, unknown>;
  }) {
    const ids = [...new Set(input.userIds.filter(Boolean))];
    if (!ids.length) return [];
    await this.prisma.notification.createMany({
      data: ids.map((userId) => ({
        userId,
        type: input.type,
        title: input.title,
        body: input.body,
        link: input.link ?? null,
        channel: 'IN_APP',
        deliveryStatus: 'DELIVERED',
        meta: input.meta as never,
      })),
    });
    const email = this.channels().EMAIL.configured;
    if (email) {
      const users = await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { email: true } });
      for (const user of users) {
        try {
          await sendMail({ to: user.email, subject: input.title, text: `${input.body}${input.link ? `\n${input.link}` : ''}` });
        } catch {
          /* in-app row already stored; do not fake email success */
        }
      }
    }
    return { created: ids.length, emailAttempted: email };
  }

  async recipientsForMatch(matchId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: {
        createdById: true,
        homeTeamId: true,
        awayTeamId: true,
        tournamentId: true,
        access: { where: { status: 'ACTIVE' }, select: { userId: true } },
      },
    });
    if (!match) return [];
    const follows = await this.prisma.follow.findMany({
      where: {
        OR: [
          { targetType: 'TEAM', targetId: { in: [match.homeTeamId, match.awayTeamId] } },
          ...(match.tournamentId ? [{ targetType: 'TOURNAMENT' as const, targetId: match.tournamentId }] : []),
        ],
      },
      select: { userId: true },
    });
    return [...new Set([match.createdById, ...match.access.map((a) => a.userId), ...follows.map((f) => f.userId)].filter(Boolean))] as string[];
  }
}

export const notifySchema = z.object({
  type: z.enum(NOTIFICATION_TYPES).optional(),
});
