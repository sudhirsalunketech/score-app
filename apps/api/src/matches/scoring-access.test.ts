import { describe, expect, it } from 'vitest';
import { Role } from '@prisma/client';
import { canForcePlayingXi, canManageClub, canManageMatch, canManagePlayer, canManageTeam, canManageTournament, canScoreMatch, hasActiveAccessGrant } from './scoring-access';

const scorer = { id: 's1', role: Role.SCORER };
const other = { id: 's2', role: Role.SCORER };
const superAdmin = { id: 'sa1', role: Role.SUPER_ADMIN };
const admin = { id: 'a1', role: Role.ADMIN };
const viewer = { id: 'v1', role: Role.VIEWER };
const manager = { id: 'm1', role: Role.TEAM_MANAGER };

describe('canScoreMatch', () => {
  it('allows super admin on any match', () => {
    expect(canScoreMatch(superAdmin, { createdById: 's1', settings: { scorerIds: ['s1'] } })).toBe(true);
  });

  it('rejects a plain admin who is not the creator or assigned scorer', () => {
    expect(canScoreMatch(admin, { createdById: 's1', settings: { scorerIds: ['s1'] } })).toBe(false);
  });

  it('allows the match creator regardless of role', () => {
    expect(canScoreMatch(admin, { createdById: 'a1', settings: {} })).toBe(true);
    expect(canScoreMatch(viewer, { createdById: 'v1', settings: {} })).toBe(true);
  });

  it('allows an assigned scorer', () => {
    const match = { createdById: 'other', settings: { scorerIds: ['s1'] } };
    expect(canScoreMatch(scorer, match)).toBe(true);
    expect(canScoreMatch(other, match)).toBe(false);
  });

  it('supports multiple assigned scorers', () => {
    const match = { createdById: 'other', settings: { scorerIds: ['s1', 's2'] } };
    expect(canScoreMatch(scorer, match)).toBe(true);
    expect(canScoreMatch(other, match)).toBe(true);
  });

  it('falls back to creator when no scorer is assigned', () => {
    expect(canScoreMatch(scorer, { createdById: 's1', settings: {} })).toBe(true);
    expect(canScoreMatch(other, { createdById: 's1', settings: {} })).toBe(false);
  });

  it('rejects an unassigned scorer when the match has no creator', () => {
    expect(canScoreMatch(scorer, { createdById: null, settings: {} })).toBe(false);
  });
});

describe('playing XI permissions', () => {
  it('allows the match creator to edit setup', () => {
    expect(canManageMatch(manager, { createdById: 'm1', settings: {} })).toBe(true);
    expect(canManageMatch(manager, { createdById: 's1', settings: {} })).toBe(false);
  });

  it('rejects viewers from editing matches they did not create', () => {
    expect(canManageMatch(viewer, { createdById: 'other', settings: {} })).toBe(false);
  });

  it('only super admin can force a locked Playing XI', () => {
    expect(canForcePlayingXi(superAdmin)).toBe(true);
    expect(canForcePlayingXi(admin)).toBe(false);
    expect(canForcePlayingXi(scorer)).toBe(false);
  });
});

describe('tournament rule permissions', () => {
  it('allows super admin and the tournament creator, regardless of role', () => {
    expect(canManageTournament(superAdmin, { createdById: 's1' })).toBe(true);
    expect(canManageTournament(admin, { createdById: 's1' })).toBe(false);
    expect(canManageTournament(scorer, { createdById: 's1' })).toBe(true);
    expect(canManageTournament(other, { createdById: 's1' })).toBe(false);
    expect(canManageTournament(viewer, { createdById: 'v1' })).toBe(true);
    expect(canManageTournament(manager, { createdById: 'm1' })).toBe(true);
    expect(canManageTournament(manager, { createdById: 's1' })).toBe(false);
  });
});

describe('team membership permissions', () => {
  it('allows scorers and the team creator', () => {
    expect(canManageTeam(scorer, { createdById: 'other' })).toBe(true);
    expect(canManageTeam(manager, { createdById: 'm1' })).toBe(true);
    expect(canManageTeam(manager, { createdById: 'other' })).toBe(false);
    expect(canManageTeam(viewer, { createdById: 'v1' })).toBe(true);
    expect(canManageTeam(viewer, { createdById: 'other' })).toBe(false);
  });
});

describe('club permissions', () => {
  it('allows the owner, club admins, and super admin only', () => {
    const club = { createdById: 'm1', members: [{ userId: 'v1', role: 'MEMBER' }] };
    expect(canManageClub(superAdmin, club)).toBe(true);
    expect(canManageClub(admin, club)).toBe(false);
    expect(canManageClub(manager, club)).toBe(true);
    expect(canManageClub(viewer, club)).toBe(false);
    expect(canManageClub(viewer, { createdById: 'other', members: [{ userId: 'v1', role: 'ADMIN' }] })).toBe(true);
  });
});

describe('hasActiveAccessGrant', () => {
  it('accepts an active unexpired grant', () => {
    expect(hasActiveAccessGrant({ status: 'ACTIVE', expiresAt: null })).toBe(true);
    expect(hasActiveAccessGrant({ status: 'REVOKED', expiresAt: null })).toBe(false);
    expect(hasActiveAccessGrant({ status: 'ACTIVE', expiresAt: new Date(Date.now() - 1000) })).toBe(false);
  });
});

describe('player profile permissions', () => {
  const player = { id: 'p1', role: Role.PLAYER };

  it('allows a player to edit only their linked profile', () => {
    expect(canManagePlayer(player, { userId: 'p1', teams: [] })).toBe(true);
    expect(canManagePlayer(player, { userId: 'other', teams: [] })).toBe(false);
  });

  it('allows a PLAYER to score, manage and tournament-manage things they created', () => {
    expect(canScoreMatch(player, { createdById: 'p1', settings: { scorerIds: ['p1'] } })).toBe(true);
    expect(canManageMatch(player, { createdById: 'p1', settings: {} })).toBe(true);
    expect(canManageTournament(player, { createdById: 'p1' })).toBe(true);
    expect(canManageTeam(player, { createdById: 'p1' })).toBe(true);
  });

  it('rejects PLAYER from managing things created by someone else', () => {
    expect(canScoreMatch(player, { createdById: 'other', settings: {} })).toBe(false);
    expect(canManageTournament(player, { createdById: 'other' })).toBe(false);
    expect(canManageTeam(player, { createdById: 'other' })).toBe(false);
  });

  it('allows a team manager only for players on their team', () => {
    expect(canManagePlayer(manager, { userId: 'other', teams: [{ team: { createdById: 'm1' } }] })).toBe(true);
    expect(canManagePlayer(manager, { userId: 'other', teams: [{ team: { createdById: 'other' } }] })).toBe(false);
  });

  it('allows super admin on any player', () => {
    expect(canManagePlayer(superAdmin, { userId: 'other', teams: [] })).toBe(true);
    expect(canManagePlayer(admin, { userId: 'other', teams: [] })).toBe(false);
  });
});
