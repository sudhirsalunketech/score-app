import { describe, expect, it, vi } from 'vitest';
import { Role } from '@prisma/client';
import { JwtAuthGuard, RolesGuard, type AuthUser } from './auth.guard';

function ctxWith(req: Record<string, unknown>) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => req }),
  } as never;
}

function reflector(returns: unknown) {
  return { getAllAndOverride: vi.fn(() => returns) } as never;
}

describe('JwtAuthGuard', () => {
  it('rejects a request with no token with 401', async () => {
    const jwt = { verify: vi.fn() };
    const prisma = { user: { findUnique: vi.fn() } };
    const guard = new JwtAuthGuard(jwt as never, reflector(false), prisma as never);
    const req: Record<string, unknown> = { headers: {} };
    await expect(guard.canActivate(ctxWith(req))).rejects.toMatchObject({ status: 401 });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('lets a public route through with no token', async () => {
    const jwt = { verify: vi.fn() };
    const prisma = { user: { findUnique: vi.fn() } };
    const guard = new JwtAuthGuard(jwt as never, reflector(true), prisma as never);
    const req: Record<string, unknown> = { headers: {} };
    await expect(guard.canActivate(ctxWith(req))).resolves.toBe(true);
  });

  it('rejects an invalid/expired token with 401', async () => {
    const jwt = {
      verify: vi.fn(() => {
        throw new Error('bad token');
      }),
    };
    const prisma = { user: { findUnique: vi.fn() } };
    const guard = new JwtAuthGuard(jwt as never, reflector(false), prisma as never);
    const req: Record<string, unknown> = { headers: { authorization: 'Bearer garbage' } };
    await expect(guard.canActivate(ctxWith(req))).rejects.toMatchObject({ status: 401 });
  });

  it('rejects a disabled account with 403 even with a valid token', async () => {
    const jwt = { verify: vi.fn(() => ({ sub: 'u1', email: 'a@b.dev', role: Role.ADMIN, name: 'A' })) };
    const prisma = { user: { findUnique: vi.fn(async () => ({ disabledAt: new Date() })) } };
    const guard = new JwtAuthGuard(jwt as never, reflector(false), prisma as never);
    const req: Record<string, unknown> = { headers: { authorization: 'Bearer good' } };
    await expect(guard.canActivate(ctxWith(req))).rejects.toMatchObject({ status: 403 });
  });

  it('attaches the decoded user onto the request and allows it through', async () => {
    const jwt = { verify: vi.fn(() => ({ sub: 'u1', email: 'a@b.dev', role: Role.ADMIN, name: 'A' })) };
    const prisma = { user: { findUnique: vi.fn(async () => ({ disabledAt: null })) } };
    const guard = new JwtAuthGuard(jwt as never, reflector(false), prisma as never);
    const req: Record<string, unknown> = { headers: { authorization: 'Bearer good' } };
    await expect(guard.canActivate(ctxWith(req))).resolves.toBe(true);
    expect(req.user).toMatchObject({ id: 'u1', role: Role.ADMIN });
  });
});

describe('RolesGuard', () => {
  function userCtx(user: AuthUser | undefined) {
    return ctxWith({ user });
  }

  it('lets any authenticated user through when no @Roles are declared', () => {
    const guard = new RolesGuard(reflector(undefined));
    expect(guard.canActivate(userCtx({ id: 'u1', email: 'a@b.dev', role: Role.VIEWER, name: 'A' }))).toBe(true);
  });

  it('rejects an unauthenticated request with 401', () => {
    const guard = new RolesGuard(reflector([Role.ADMIN]));
    expect(() => guard.canActivate(userCtx(undefined))).toThrow(expect.objectContaining({ status: 401 }));
  });

  it('rejects a non-admin role with 403', () => {
    const guard = new RolesGuard(reflector([Role.ADMIN]));
    const user: AuthUser = { id: 'u1', email: 'a@b.dev', role: Role.PLAYER, name: 'A' };
    expect(() => guard.canActivate(userCtx(user))).toThrow(expect.objectContaining({ status: 403 }));
  });

  it('allows an ADMIN through when ADMIN is in the required roles', () => {
    const guard = new RolesGuard(reflector([Role.SUPER_ADMIN, Role.ADMIN]));
    const user: AuthUser = { id: 'u1', email: 'a@b.dev', role: Role.ADMIN, name: 'A' };
    expect(guard.canActivate(userCtx(user))).toBe(true);
  });

  it('lets SUPER_ADMIN bypass any role restriction', () => {
    const guard = new RolesGuard(reflector([Role.TEAM_MANAGER]));
    const user: AuthUser = { id: 'u1', email: 'a@b.dev', role: Role.SUPER_ADMIN, name: 'A' };
    expect(guard.canActivate(userCtx(user))).toBe(true);
  });
});
