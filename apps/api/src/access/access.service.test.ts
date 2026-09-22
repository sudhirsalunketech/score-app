import { describe, expect, it, vi } from 'vitest';
import { AccessStatus, Role } from '@prisma/client';
import { AccessService } from './access.service';
import type { AuthUser } from '../common/auth.guard';

const player: AuthUser = { id: 'p1', email: 'p@x.dev', name: 'Rahul', role: Role.PLAYER };
const viewer: AuthUser = { id: 'v1', email: 'v@x.dev', name: 'Amit', role: Role.VIEWER };
const scorer: AuthUser = { id: 's1', email: 's@x.dev', name: 'Sudhir', role: Role.SCORER };
const admin: AuthUser = { id: 'a1', email: 'a@x.dev', name: 'Admin', role: Role.ADMIN };
const superAdmin: AuthUser = { id: 'sa1', email: 'sa@x.dev', name: 'Super Admin', role: Role.SUPER_ADMIN };

function prismaFor(opts: {
  match?: { id: string; createdById: string; settings?: unknown; tournamentId?: string | null; tournament?: { createdById: string } | null };
  matchAccess?: { id: string; level: string; permissions: string[]; status: string; expiresAt?: Date | null } | null;
  tournament?: { createdById: string } | null;
  tournamentAccess?: { id: string; level: string; permissions: string[]; status: string; expiresAt?: Date | null } | null;
}) {
  return {
    match: {
      findUnique: vi.fn(async () => opts.match ?? { id: 'mA', createdById: 'owner', settings: {}, tournamentId: null, tournament: null }),
    },
    tournament: {
      findUnique: vi.fn(async () => opts.tournament ?? { createdById: 'owner' }),
    },
    matchAccess: {
      findUnique: vi.fn(async () => opts.matchAccess ?? null),
      update: vi.fn(async (args: { data: { status: string } }) => ({ ...opts.matchAccess, status: args.data.status })),
    },
    tournamentAccess: {
      findUnique: vi.fn(async () => opts.tournamentAccess ?? null),
      update: vi.fn(async () => opts.tournamentAccess),
    },
    innings: {
      findUnique: vi.fn(async () => ({ matchId: opts.match?.id ?? 'mA' })),
    },
    auditLog: { create: vi.fn(async () => ({})) },
  };
}

describe('AccessService authorization', () => {
  it('blocks an unauthenticated-equivalent empty permission set from scoring', async () => {
    const svc = new AccessService(prismaFor({}) as never);
    expect(await svc.canMatch(null, 'mA', 'MATCH_SCORE')).toBe(false);
  });

  it('blocks a viewer from scoring', async () => {
    const svc = new AccessService(prismaFor({ matchAccess: null }) as never);
    expect(await svc.canMatch(viewer, 'mA', 'MATCH_SCORE')).toBe(false);
    await expect(svc.assertMatch(viewer, 'mA', 'MATCH_SCORE')).rejects.toMatchObject({
      status: 403,
      message: "You don't have permission to score this match.",
    });
  });

  it('blocks a player from scoring without MATCH_SCORE', async () => {
    const svc = new AccessService(prismaFor({ matchAccess: null }) as never);
    expect(await svc.canMatch(player, 'mA', 'MATCH_SCORE')).toBe(false);
  });

  it('lets a player score when MATCH_SCORE is granted on that match', async () => {
    const svc = new AccessService(
      prismaFor({
        matchAccess: {
          id: 'g1',
          level: 'CUSTOM',
          permissions: ['MATCH_VIEW', 'MATCH_SCORE', 'MATCH_UNDO'],
          status: AccessStatus.ACTIVE,
        },
      }) as never,
    );
    expect(await svc.canMatch(player, 'mA', 'MATCH_SCORE')).toBe(true);
    expect(await svc.canMatch(player, 'mA', 'MATCH_UNDO')).toBe(true);
    expect(await svc.canMatch(player, 'mA', 'MATCH_EDIT')).toBe(false);
    expect(await svc.canMatch(player, 'mA', 'MATCH_DELETE')).toBe(false);
  });

  it('blocks a player from editing without MATCH_EDIT', async () => {
    const svc = new AccessService(
      prismaFor({
        matchAccess: { id: 'g1', level: 'SCORER', permissions: [], status: AccessStatus.ACTIVE },
      }) as never,
    );
    expect(await svc.canMatch(player, 'mA', 'MATCH_EDIT')).toBe(false);
    await expect(svc.assertMatch(player, 'mA', 'MATCH_EDIT')).rejects.toMatchObject({ status: 403 });
  });

  it('blocks a scorer from deleting a match', async () => {
    const svc = new AccessService(
      prismaFor({
        match: { id: 'mA', createdById: 'owner', settings: { scorerIds: ['s1'] }, tournamentId: null, tournament: null },
      }) as never,
    );
    expect(await svc.canMatch(scorer, 'mA', 'MATCH_SCORE')).toBe(true);
    expect(await svc.canMatch(scorer, 'mA', 'MATCH_DELETE')).toBe(false);
  });

  it('lets a match admin edit', async () => {
    const svc = new AccessService(
      prismaFor({
        matchAccess: { id: 'g1', level: 'MATCH_ADMIN', permissions: [], status: AccessStatus.ACTIVE },
      }) as never,
    );
    expect(await svc.canMatch(player, 'mA', 'MATCH_EDIT')).toBe(true);
    expect(await svc.canMatch(player, 'mA', 'MATCH_DELETE')).toBe(false);
  });

  it('lets a tournament admin manage tournament rules', async () => {
    const svc = new AccessService(
      prismaFor({
        tournament: { createdById: 'owner' },
        tournamentAccess: { id: 't1', level: 'TOURNAMENT_ADMIN', permissions: [], status: AccessStatus.ACTIVE },
      }) as never,
    );
    expect(await svc.canTournament(player, 't1', 'TOURNAMENT_MANAGE_RULES')).toBe(true);
    expect(await svc.canTournament(player, 't1', 'TOURNAMENT_MANAGE_MATCHES')).toBe(true);
  });

  it('blocks revoked access immediately', async () => {
    const svc = new AccessService(
      prismaFor({
        matchAccess: { id: 'g1', level: 'SCORER', permissions: [], status: AccessStatus.REVOKED },
      }) as never,
    );
    expect(await svc.canMatch(player, 'mA', 'MATCH_SCORE')).toBe(false);
  });

  it('blocks expired access and marks the row expired', async () => {
    const db = prismaFor({
      matchAccess: {
        id: 'g1',
        level: 'SCORER',
        permissions: [],
        status: AccessStatus.ACTIVE,
        expiresAt: new Date('2020-01-01'),
      },
    });
    const svc = new AccessService(db as never);
    expect(await svc.canMatch(player, 'mA', 'MATCH_SCORE')).toBe(false);
    expect(db.matchAccess.update).toHaveBeenCalled();
    await expect(svc.assertMatch(player, 'mA', 'MATCH_SCORE')).rejects.toMatchObject({
      status: 403,
      message: 'Your match access has expired.',
    });
  });

  it('does not leak Match A access onto Match B', async () => {
    const withA = new AccessService(
      prismaFor({
        match: { id: 'mA', createdById: 'owner', settings: {}, tournamentId: null, tournament: null },
        matchAccess: { id: 'g1', level: 'VIEWER', permissions: [], status: AccessStatus.ACTIVE },
      }) as never,
    );
    const withB = new AccessService(
      prismaFor({
        match: { id: 'mB', createdById: 'owner', settings: {}, tournamentId: null, tournament: null },
        matchAccess: null,
      }) as never,
    );
    expect(await withA.canMatch(viewer, 'mA', 'MATCH_VIEW')).toBe(true);
    expect(await withB.canMatch(viewer, 'mB', 'MATCH_VIEW')).toBe(false);
    expect(await withB.canMatch(viewer, 'mB', 'MATCH_SCORE')).toBe(false);
  });

  it('keeps super admin able to score and delete any match', async () => {
    const svc = new AccessService(prismaFor({ matchAccess: null }) as never);
    expect(await svc.canMatch(superAdmin, 'mA', 'MATCH_SCORE')).toBe(true);
    expect(await svc.canMatch(superAdmin, 'mA', 'MATCH_DELETE')).toBe(true);
  });

  it('does not let a plain admin score or delete a match they did not create', async () => {
    const svc = new AccessService(prismaFor({ matchAccess: null }) as never);
    expect(await svc.canMatch(admin, 'mA', 'MATCH_SCORE')).toBe(false);
    expect(await svc.canMatch(admin, 'mA', 'MATCH_DELETE')).toBe(false);
  });
});
