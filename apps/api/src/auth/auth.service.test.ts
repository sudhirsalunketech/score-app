import { describe, expect, it, vi } from 'vitest';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AuthService, describeSession } from './auth.service';

const { verifyIdToken } = vi.hoisted(() => ({ verifyIdToken: vi.fn() }));
vi.mock('google-auth-library', () => ({
  OAuth2Client: vi.fn().mockImplementation(() => ({ verifyIdToken })),
}));

const password = 'Secret12!';

async function userRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'u1',
    email: 'scorer@crickscore.dev',
    name: 'Sudhir',
    role: Role.SCORER,
    passwordHash: await bcrypt.hash(password, 4),
    avatarUrl: null,
    locale: 'en',
    phone: null,
    disabledAt: null,
    isBeta: false,
    ...overrides,
  };
}

function prismaFor(store: {
  user?: Record<string, unknown> | null;
  refresh?: {
    id: string;
    tokenHash: string;
    revokedAt: Date | null;
    expiresAt: Date;
    user: Record<string, unknown>;
    userAgent?: string | null;
    lastActiveAt?: Date;
  } | null;
  reset?: { id: string; userId: string; usedAt: Date | null; expiresAt: Date } | null;
  sessions?: Array<{
    id: string;
    createdAt: Date;
    expiresAt: Date;
    tokenHash: string;
    userAgent: string | null;
    lastActiveAt: Date;
  }>;
}) {
  const user = store.user === undefined ? null : store.user;
  return {
    user: {
      findUnique: vi.fn(async () => user),
      findFirst: vi.fn(async () => user),
      findUniqueOrThrow: vi.fn(async () => {
        if (!user) throw new Error('missing user');
        return user;
      }),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...(user ?? {}), ...data })),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'u-new',
        role: Role.PLAYER,
        avatarUrl: null,
        locale: 'en',
        phone: null,
        disabledAt: null,
        isBeta: false,
        ...data,
      })),
    },
    refreshToken: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'rt1', ...data })),
      findUnique: vi.fn(async () => store.refresh ?? null),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...(store.refresh ?? {}), ...data })),
      updateMany: vi.fn(async () => ({ count: 1 })),
      findMany: vi.fn(async () => store.sessions ?? []),
      findFirst: vi.fn(async () => store.sessions?.[0] ?? null),
    },
    passwordReset: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'pr1', ...data })),
      findUnique: vi.fn(async () => store.reset ?? null),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...(store.reset ?? {}), ...data })),
    },
    auditLog: { create: vi.fn(async () => ({})) },
    $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  };
}

function svc(prisma: ReturnType<typeof prismaFor>) {
  const jwt = { signAsync: vi.fn(async () => 'access.jwt.token') };
  return new AuthService(prisma as never, jwt as never);
}

describe('describeSession', () => {
  it('maps common user agents without exposing the raw string', () => {
    expect(describeSession('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15 Chrome/120.0')).toEqual({
      device: 'Mobile',
      browser: 'Chrome',
    });
    expect(describeSession('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Firefox/128.0')).toEqual({
      device: 'Desktop',
      browser: 'Firefox',
    });
    expect(describeSession(null)).toEqual({ device: 'Desktop', browser: 'Unknown' });
  });
});

describe('AuthService register', () => {
  it('creates a new account with the default PLAYER role, not admin', async () => {
    const prisma = prismaFor({ user: null });
    const auth = svc(prisma);
    const out = await auth.register({ email: 'newbie@crickscore.dev', password, name: 'New Bie' });
    expect(out.accessToken).toBe('access.jwt.token');
    expect(out.user).toMatchObject({ email: 'newbie@crickscore.dev', role: Role.PLAYER });
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: 'newbie@crickscore.dev', role: Role.PLAYER }),
      }),
    );
    expect(prisma.user.create).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: Role.ADMIN }) }),
    );
  });

  it('ignores any role supplied by the caller and still assigns PLAYER', async () => {
    const prisma = prismaFor({ user: null });
    const auth = svc(prisma);
    await auth.register({ email: 'sneaky@crickscore.dev', password, name: 'Sneaky', role: 'ADMIN' });
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: Role.PLAYER }) }),
    );
  });

  it('rejects a duplicate email with 409', async () => {
    const auth = svc(prismaFor({ user: await userRow() }));
    await expect(
      auth.register({ email: 'scorer@crickscore.dev', password, name: 'Dup' }),
    ).rejects.toMatchObject({ status: 409, code: 'USER_EXISTS' });
  });

  it('rejects a weak password before touching the database', async () => {
    const prisma = prismaFor({ user: null });
    const auth = svc(prisma);
    await expect(auth.register({ email: 'weak@crickscore.dev', password: 'short', name: 'Weak' })).rejects.toThrow();
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});

describe('AuthService login', () => {
  it('issues tokens for a valid email and password', async () => {
    const user = await userRow();
    const prisma = prismaFor({ user });
    const auth = svc(prisma);
    const out = await auth.login(
      { email: 'scorer@crickscore.dev', password },
      { userAgent: 'Mozilla/5.0 Chrome/120.0', ipAddress: '10.0.0.8' },
    );
    expect(out.accessToken).toBe('access.jwt.token');
    expect(out.refreshToken).toMatch(/^[a-f0-9]{96}$/);
    expect(out.user).toMatchObject({ id: 'u1', email: 'scorer@crickscore.dev', role: Role.SCORER });
    expect(out.user).not.toHaveProperty('passwordHash');
    expect(prisma.refreshToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'u1',
          userAgent: 'Mozilla/5.0 Chrome/120.0',
          ipAddress: '10.0.0.8',
        }),
      }),
    );
  });

  it('rejects an unknown user with 401', async () => {
    const auth = svc(prismaFor({ user: null }));
    await expect(auth.login({ email: 'nobody@x.dev', password })).rejects.toMatchObject({
      status: 401,
      message: 'Invalid credentials',
    });
  });

  it('rejects a wrong password with 401', async () => {
    const auth = svc(prismaFor({ user: await userRow() }));
    await expect(auth.login({ email: 'scorer@crickscore.dev', password: 'wrong-pass' })).rejects.toMatchObject({
      status: 401,
      message: 'Invalid credentials',
    });
  });

  it('rejects a disabled account with 403', async () => {
    const auth = svc(prismaFor({ user: await userRow({ disabledAt: new Date() }) }));
    await expect(auth.login({ email: 'scorer@crickscore.dev', password })).rejects.toMatchObject({ status: 403 });
  });
});

describe('AuthService googleLogin', () => {
  it('rejects when Google sign-in is not configured', async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    const auth = svc(prismaFor({}));
    await expect(auth.googleLogin({ credential: 'x'.repeat(20) })).rejects.toMatchObject({ status: 403 });
  });

  it('rejects an unverified Google email', async () => {
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    verifyIdToken.mockResolvedValueOnce({
      getPayload: () => ({ email: 'new@crickscore.dev', email_verified: false }),
    });
    const auth = svc(prismaFor({ user: null }));
    await expect(auth.googleLogin({ credential: 'x'.repeat(20) })).rejects.toMatchObject({ status: 401 });
    delete process.env.GOOGLE_CLIENT_ID;
  });

  it('logs in an existing user by email without creating a duplicate', async () => {
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    verifyIdToken.mockResolvedValueOnce({
      getPayload: () => ({ email: 'scorer@crickscore.dev', email_verified: true, name: 'Sudhir' }),
    });
    const user = await userRow();
    const prisma = prismaFor({ user });
    const out = await svc(prisma).googleLogin({ credential: 'x'.repeat(20) });
    expect(out.accessToken).toBe('access.jwt.token');
    expect(out.user).toMatchObject({ id: 'u1', email: 'scorer@crickscore.dev' });
    expect(prisma.user.create).not.toHaveBeenCalled();
    delete process.env.GOOGLE_CLIENT_ID;
  });

  it('creates a new account for a first-time Google sign-in', async () => {
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    verifyIdToken.mockResolvedValueOnce({
      getPayload: () => ({ email: 'newplayer@crickscore.dev', email_verified: true, name: 'New Player' }),
    });
    const prisma = prismaFor({ user: null });
    const out = await svc(prisma).googleLogin({ credential: 'x'.repeat(20) });
    expect(out.accessToken).toBe('access.jwt.token');
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: 'newplayer@crickscore.dev', name: 'New Player', role: Role.PLAYER }),
      }),
    );
    delete process.env.GOOGLE_CLIENT_ID;
  });

  it('rejects a disabled account', async () => {
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    verifyIdToken.mockResolvedValueOnce({
      getPayload: () => ({ email: 'scorer@crickscore.dev', email_verified: true, name: 'Sudhir' }),
    });
    const user = await userRow({ disabledAt: new Date() });
    const auth = svc(prismaFor({ user }));
    await expect(auth.googleLogin({ credential: 'x'.repeat(20) })).rejects.toMatchObject({ status: 403 });
    delete process.env.GOOGLE_CLIENT_ID;
  });
});

describe('AuthService refresh and logout', () => {
  it('rotates a valid refresh token', async () => {
    const user = await userRow();
    const prisma = prismaFor({
      user,
      refresh: {
        id: 'rt-old',
        tokenHash: 'abc',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        user,
      },
    });
    const out = await svc(prisma).refresh({ refreshToken: 'a'.repeat(20) });
    expect(out.accessToken).toBe('access.jwt.token');
    expect(prisma.refreshToken.update).toHaveBeenCalledWith({
      where: { id: 'rt-old' },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('rejects an expired refresh token', async () => {
    const user = await userRow();
    const auth = svc(
      prismaFor({
        refresh: {
          id: 'rt-old',
          tokenHash: 'abc',
          revokedAt: null,
          expiresAt: new Date(Date.now() - 1000),
          user,
        },
      }),
    );
    await expect(auth.refresh({ refreshToken: 'a'.repeat(20) })).rejects.toMatchObject({ status: 401 });
  });

  it('revokes the presented refresh token on logout', async () => {
    const prisma = prismaFor({});
    const out = await svc(prisma).logout({ refreshToken: 'a'.repeat(20) });
    expect(out).toEqual({ loggedOut: true });
    expect(prisma.refreshToken.updateMany).toHaveBeenCalled();
  });

  it('revokes every refresh token on logout-all', async () => {
    const prisma = prismaFor({});
    const out = await svc(prisma).logoutAll('u1');
    expect(out).toEqual({ loggedOut: true });
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      data: { revokedAt: expect.any(Date) },
    });
  });
});

describe('AuthService passwords', () => {
  it('changes the password and revokes all sessions', async () => {
    const user = await userRow();
    const prisma = prismaFor({ user });
    const out = await svc(prisma).changePassword('u1', { currentPassword: password, newPassword: 'NewSecret99' });
    expect(out).toEqual({ changed: true });
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('rejects change-password when the current password is wrong', async () => {
    const auth = svc(prismaFor({ user: await userRow() }));
    await expect(
      auth.changePassword('u1', { currentPassword: 'nope-nope', newPassword: 'NewSecret99' }),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('resets a password from a valid unused token', async () => {
    const prisma = prismaFor({
      user: await userRow(),
      reset: { id: 'pr1', userId: 'u1', usedAt: null, expiresAt: new Date(Date.now() + 60_000) },
    });
    const out = await svc(prisma).reset({ token: 'a'.repeat(20), password: 'ResetPass99' });
    expect(out).toEqual({ reset: true });
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('rejects an expired reset token', async () => {
    const auth = svc(
      prismaFor({
        reset: { id: 'pr1', userId: 'u1', usedAt: null, expiresAt: new Date(Date.now() - 1000) },
      }),
    );
    await expect(auth.reset({ token: 'a'.repeat(20), password: 'ResetPass99' })).rejects.toMatchObject({
      status: 400,
    });
  });
});

describe('AuthService sessions', () => {
  it('returns device and browser and never includes the raw IP', async () => {
    const prisma = prismaFor({
      sessions: [
        {
          id: 's1',
          createdAt: new Date('2026-08-17T04:00:00.000Z'),
          expiresAt: new Date('2026-08-24T04:00:00.000Z'),
          tokenHash: 'current-hash',
          userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/120.0',
          lastActiveAt: new Date('2026-08-17T05:00:00.000Z'),
        },
      ],
    });
    const rows = await svc(prisma).listSessions('u1');
    expect(rows).toEqual([
      expect.objectContaining({
        id: 's1',
        device: 'Mobile',
        browser: 'Chrome',
        current: false,
      }),
    ]);
    expect(JSON.stringify(rows)).not.toMatch(/10\.|ipAddress|userAgent/i);
  });
});
