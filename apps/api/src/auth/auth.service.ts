import { createHash, randomBytes } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import { Role, User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';
import { Errors } from '../common/app-error';
import { normalizePhone, otpTokenHashInput, parseLoginIdentifier } from './identifier';
import { deliverOtpEmail, deliverResetEmail, isDevMailDelivery } from './mailer';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(2).max(80),
  phone: z.string().max(20).optional(),
});

const loginSchema = z
  .object({
    password: z.string().min(1),
    identifier: z.string().min(3).max(80).optional(),
    email: z.string().min(3).max(80).optional(),
  })
  .transform((v) => ({
    password: v.password,
    identifier: (v.identifier ?? v.email ?? '').trim(),
  }))
  .refine((v) => v.identifier.length >= 3, { message: 'Enter your email or mobile number.' });

function hashToken(raw: string) {
  return createHash('sha256').update(raw).digest('hex');
}

export type SessionMeta = { userAgent?: string | null; ipAddress?: string | null };

function publicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    avatarUrl: user.avatarUrl,
    locale: user.locale,
    phone: user.phone,
    isBeta: 'isBeta' in user ? Boolean((user as User & { isBeta?: boolean }).isBeta) : false,
  };
}

export function describeSession(userAgent?: string | null) {
  const agent = userAgent ?? '';
  const browser = /Edg\//.test(agent)
    ? 'Edge'
    : /Chrome\//.test(agent)
      ? 'Chrome'
      : /Firefox\//.test(agent)
        ? 'Firefox'
        : /Safari\//.test(agent)
          ? 'Safari'
          : agent
            ? 'Browser'
            : 'Unknown';
  const device = /iPad|Tablet/i.test(agent) ? 'Tablet' : /Mobile|Android|iPhone/i.test(agent) ? 'Mobile' : 'Desktop';
  return { device, browser };
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JwtService) private readonly jwt: JwtService,
  ) {}

  private async issue(user: User, meta?: SessionMeta) {
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    });
    const refreshRaw = randomBytes(48).toString('hex');
    const days = Number(process.env.JWT_REFRESH_DAYS ?? 365);
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshRaw),
        expiresAt: new Date(Date.now() + days * 86400000),
        userAgent: meta?.userAgent?.slice(0, 240) || null,
        ipAddress: meta?.ipAddress?.slice(0, 64) || null,
        lastActiveAt: new Date(),
      },
    });
    return { accessToken, refreshToken: refreshRaw, user: publicUser(user) };
  }

  async register(body: unknown, meta?: SessionMeta) {
    const input = registerSchema.parse(body);
    const exists = await this.prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (exists) throw Errors.conflict('USER_EXISTS', 'Email already registered');
    let phone: string | undefined;
    if (input.phone) {
      const national = normalizePhone(input.phone);
      if (!national) throw Errors.validation('Enter a valid 10-digit mobile number.');
      const taken = await this.prisma.user.findFirst({
        where: { OR: [{ phone: national }, { phone: `+91${national}` }] },
      });
      if (taken) throw Errors.conflict('PHONE_IN_USE', 'That mobile number is already registered.');
      phone = national;
    }
    const user = await this.prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        name: input.name,
        phone,
        passwordHash: await bcrypt.hash(input.password, 12),
        role: Role.PLAYER,
        preferences: { create: { locale: 'en' } },
        player: { create: { name: input.name, profileCode: `CS${Math.floor(100000 + Math.random() * 900000)}` } },
      },
    });
    await this.prisma.auditLog.create({
      data: { userId: user.id, action: 'REGISTER', entity: 'User', entityId: user.id },
    });
    return this.issue(user, meta);
  }

  private async findUserByIdentifier(raw: string) {
    const id = parseLoginIdentifier(raw);
    if (id.kind === 'email') {
      return this.prisma.user.findUnique({ where: { email: id.value } });
    }
    return this.prisma.user.findFirst({
      where: {
        OR: [{ phone: id.value }, { phone: { endsWith: id.value } }, { phone: `+91${id.value}` }],
      },
    });
  }

  private isDevDelivery() {
    return isDevMailDelivery();
  }

  private webOrigin() {
    return (process.env.WEB_ORIGIN ?? 'http://localhost:5173').replace(/\/$/, '');
  }

  async requestOtp(body: unknown) {
    const identifier = z.object({ identifier: z.string().min(3).max(80) }).parse(body).identifier;
    try {
      parseLoginIdentifier(identifier);
    } catch (err) {
      throw Errors.validation(err instanceof Error ? err.message : 'Enter your email or mobile number.');
    }
    const user = await this.findUserByIdentifier(identifier);
    if (user && !user.disabledAt) {
      const code = String(randomBytes(3).readUIntBE(0, 3) % 1_000_000).padStart(6, '0');
      await this.prisma.passwordReset.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(otpTokenHashInput(user.id, code)),
          expiresAt: new Date(Date.now() + 10 * 60_000),
        },
      });
      await deliverOtpEmail(user.email, code);
      if (this.isDevDelivery()) {
        return { sent: true, via: 'email' as const, devCode: code };
      }
    }
    return { sent: true, via: 'email' as const };
  }

  async verifyOtp(body: unknown, meta?: SessionMeta) {
    const input = z.object({ identifier: z.string().min(3).max(80), code: z.string().regex(/^\d{6}$/) }).parse(body);
    const user = await this.findUserByIdentifier(input.identifier);
    if (!user || user.disabledAt) throw Errors.unauthorized('Invalid or expired code.');
    const row = await this.prisma.passwordReset.findUnique({
      where: { tokenHash: hashToken(otpTokenHashInput(user.id, input.code)) },
    });
    if (!row || row.usedAt || row.expiresAt < new Date()) {
      throw Errors.unauthorized('Invalid or expired code.');
    }
    await this.prisma.passwordReset.update({ where: { id: row.id }, data: { usedAt: new Date() } });
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return this.issue(user, meta);
  }

  async login(body: unknown, meta?: SessionMeta) {
    const input = loginSchema.parse(body);
    try {
      parseLoginIdentifier(input.identifier);
    } catch (err) {
      throw Errors.validation(err instanceof Error ? err.message : 'Enter your email or mobile number.');
    }
    const user = await this.findUserByIdentifier(input.identifier);
    if (!user) throw Errors.unauthorized('Invalid credentials');
    if (user.disabledAt) throw Errors.forbidden('This account is disabled.');
    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) throw Errors.unauthorized('Invalid credentials');
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return this.issue(user, meta);
  }

  async googleLogin(body: unknown, meta?: SessionMeta) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) throw Errors.forbidden('Google sign-in is not configured.');
    const credential = z.object({ credential: z.string().min(10) }).parse(body).credential;

    const client = new OAuth2Client(clientId);
    let payload;
    try {
      const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
      payload = ticket.getPayload();
    } catch {
      throw Errors.unauthorized('Could not verify Google sign-in.');
    }
    if (!payload?.email || !payload.email_verified) {
      throw Errors.unauthorized('Could not verify Google sign-in.');
    }

    const email = payload.email.toLowerCase();
    let user = await this.prisma.user.findUnique({ where: { email } });
    if (user?.disabledAt) throw Errors.forbidden('This account is disabled.');
    if (!user) {
      const name = payload.name || [payload.given_name, payload.family_name].filter(Boolean).join(' ') || email;
      user = await this.prisma.user.create({
        data: {
          email,
          name,
          passwordHash: await bcrypt.hash(randomBytes(32).toString('hex'), 12),
          role: Role.PLAYER,
          avatarUrl: payload.picture || null,
          preferences: { create: { locale: 'en' } },
          player: { create: { name, profileCode: `CS${Math.floor(100000 + Math.random() * 900000)}` } },
        },
      });
      await this.prisma.auditLog.create({
        data: { userId: user.id, action: 'REGISTER', entity: 'User', entityId: user.id },
      });
    }
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return this.issue(user, meta);
  }

  async refresh(body: unknown, meta?: SessionMeta) {
    const refreshToken = z.object({ refreshToken: z.string().min(10) }).parse(body).refreshToken;
    const tokenHash = hashToken(refreshToken);
    const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash }, include: { user: true } });
    if (!row || row.revokedAt || row.expiresAt < new Date()) {
      throw Errors.unauthorized('Your session has expired. Please log in again.');
    }
    if (row.user.disabledAt) throw Errors.forbidden('This account is disabled.');
    await this.prisma.refreshToken.update({ where: { id: row.id }, data: { revokedAt: new Date() } });
    return this.issue(row.user, meta);
  }

  async logout(body: unknown) {
    const parsed = z.object({ refreshToken: z.string().optional() }).parse(body ?? {});
    if (parsed.refreshToken) {
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash: hashToken(parsed.refreshToken) },
        data: { revokedAt: new Date() },
      });
    }
    return { loggedOut: true };
  }

  async forgot(body: unknown) {
    const email = z.object({ email: z.string().email() }).parse(body).email.toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user) {
      const raw = randomBytes(32).toString('hex');
      await this.prisma.passwordReset.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(raw),
          expiresAt: new Date(Date.now() + 3600_000),
        },
      });
      const resetUrl = `${this.webOrigin()}/reset?token=${raw}`;
      try {
        await deliverResetEmail(user.email, resetUrl);
      } catch (err) {
        console.error('[reset-email] delivery-failed');
        if (!this.isDevDelivery()) {
          /* still hide whether the account exists */
        } else {
          throw err;
        }
      }
      if (this.isDevDelivery()) {
        return { sent: true, devResetUrl: resetUrl };
      }
    }
    return { sent: true };
  }

  async reset(body: unknown) {
    const input = z.object({ token: z.string().min(10), password: z.string().min(8).max(128) }).parse(body);
    const row = await this.prisma.passwordReset.findUnique({ where: { tokenHash: hashToken(input.token) } });
    if (!row || row.usedAt || row.expiresAt < new Date()) {
      throw Errors.validation('Invalid or expired reset token');
    }
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: row.userId },
        data: { passwordHash: await bcrypt.hash(input.password, 12) },
      }),
      this.prisma.passwordReset.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
      this.prisma.refreshToken.updateMany({ where: { userId: row.userId }, data: { revokedAt: new Date() } }),
    ]);
    return { reset: true };
  }

  async changePassword(userId: string, body: unknown) {
    const input = z
      .object({ currentPassword: z.string().min(1), newPassword: z.string().min(8).max(128) })
      .parse(body);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const ok = await bcrypt.compare(input.currentPassword, user.passwordHash);
    if (!ok) throw Errors.unauthorized('Invalid credentials');
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash: await bcrypt.hash(input.newPassword, 12) },
      }),
      this.prisma.refreshToken.updateMany({ where: { userId }, data: { revokedAt: new Date() } }),
    ]);
    return { changed: true };
  }

  async listSessions(userId: string, currentRefresh?: string) {
    const currentHash = currentRefresh ? hashToken(currentRefresh) : null;
    const rows = await this.prisma.refreshToken.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true, expiresAt: true, tokenHash: true, userAgent: true, lastActiveAt: true },
    });
    return rows.map((row) => {
      const device = describeSession(row.userAgent);
      return {
        id: row.id,
        createdAt: row.createdAt,
        expiresAt: row.expiresAt,
        lastActiveAt: row.lastActiveAt,
        device: device.device,
        browser: device.browser,
        current: currentHash ? row.tokenHash === currentHash : false,
      };
    });
  }

  async revokeSession(userId: string, sessionId: string) {
    const row = await this.prisma.refreshToken.findFirst({ where: { id: sessionId, userId } });
    if (!row) throw Errors.notFound('NOT_FOUND', 'Session not found');
    await this.prisma.refreshToken.update({ where: { id: row.id }, data: { revokedAt: new Date() } });
    return { revoked: true };
  }

  async logoutAll(userId: string) {
    await this.prisma.refreshToken.updateMany({ where: { userId }, data: { revokedAt: new Date() } });
    return { loggedOut: true };
  }

  publicUser = publicUser;
}
