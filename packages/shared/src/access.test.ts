import { describe, expect, it } from 'vitest';
import {
  effectiveAccessStatus,
  hasPermission,
  permissionsForLevel,
  resolvePermissions,
} from './access';

const player = 'PLAYER';
const viewer = 'VIEWER';
const scorer = 'SCORER';

describe('access presets', () => {
  it('does not let viewers or players score by default', () => {
    expect(permissionsForLevel('VIEWER')).not.toContain('MATCH_SCORE');
    expect(permissionsForLevel('PLAYER')).not.toContain('MATCH_SCORE');
    expect(permissionsForLevel('PLAYER')).toContain('MATCH_VIEW');
  });

  it('lets scorers score and undo but not edit or delete', () => {
    const p = permissionsForLevel('SCORER');
    expect(p).toContain('MATCH_SCORE');
    expect(p).toContain('MATCH_UNDO');
    expect(p).not.toContain('MATCH_EDIT');
    expect(p).not.toContain('MATCH_DELETE');
    expect(p).not.toContain('TOURNAMENT_MANAGE_RULES');
    expect(p).not.toContain('FAN_MANAGE');
  });

  it('gives match admins fan management but not scorers', () => {
    expect(permissionsForLevel('MATCH_ADMIN')).toContain('FAN_MANAGE');
    expect(permissionsForLevel('TOURNAMENT_ADMIN')).toContain('FAN_MANAGE');
    expect(permissionsForLevel('SCORER')).not.toContain('FAN_MANAGE');
    expect(permissionsForLevel('VIEWER')).not.toContain('FAN_MANAGE');
  });

  it('lets match admins edit but not change tournament rules', () => {
    const p = permissionsForLevel('MATCH_ADMIN');
    expect(p).toContain('MATCH_EDIT');
    expect(p).toContain('MATCH_MANAGE_PLAYING_XI');
    expect(p).toContain('MATCH_MANAGE_TOSS');
    expect(p).toContain('MATCH_MANAGE_RESULT');
    expect(p).not.toContain('TOURNAMENT_MANAGE_RULES');
    expect(p).not.toContain('MATCH_DELETE');
  });
});

describe('resolvePermissions', () => {
  it('gives super admins every permission', () => {
    const p = resolvePermissions({ globalRole: 'SUPER_ADMIN' });
    expect(hasPermission(p, 'MATCH_DELETE')).toBe(true);
    expect(hasPermission(p, 'TOURNAMENT_MANAGE_RULES')).toBe(true);
  });

  it('lets a player score only when MATCH_SCORE is granted on that match', () => {
    const none = resolvePermissions({ globalRole: player });
    expect(hasPermission(none, 'MATCH_SCORE')).toBe(false);
    const granted = resolvePermissions({
      globalRole: player,
      matchAccess: {
        level: 'CUSTOM',
        permissions: ['MATCH_VIEW', 'MATCH_SCORE', 'MATCH_UNDO'],
        status: 'ACTIVE',
      },
    });
    expect(hasPermission(granted, 'MATCH_SCORE')).toBe(true);
    expect(hasPermission(granted, 'MATCH_UNDO')).toBe(true);
    expect(hasPermission(granted, 'MATCH_EDIT')).toBe(false);
    expect(hasPermission(granted, 'MATCH_DELETE')).toBe(false);
    expect(hasPermission(granted, 'TOURNAMENT_MANAGE_RULES')).toBe(false);
  });

  it('blocks viewers from scoring', () => {
    const p = resolvePermissions({ globalRole: viewer });
    expect(hasPermission(p, 'MATCH_SCORE')).toBe(false);
  });

  it('does not leak Match A grants onto Match B', () => {
    const matchA = resolvePermissions({
      globalRole: viewer,
      matchAccess: { level: 'VIEWER', status: 'ACTIVE', permissions: [] },
    });
    const matchB = resolvePermissions({ globalRole: viewer, matchAccess: null });
    expect(hasPermission(matchA, 'MATCH_VIEW')).toBe(true);
    expect(hasPermission(matchB, 'MATCH_VIEW')).toBe(false);
  });

  it('treats expired and revoked grants as inactive without deleting them', () => {
    const expired = resolvePermissions({
      globalRole: player,
      matchAccess: {
        level: 'SCORER',
        status: 'ACTIVE',
        expiresAt: new Date('2020-01-01'),
      },
      now: new Date('2026-08-15'),
    });
    expect(hasPermission(expired, 'MATCH_SCORE')).toBe(false);
    expect(effectiveAccessStatus({ status: 'ACTIVE', expiresAt: new Date('2020-01-01'), now: new Date('2026-08-15') })).toBe(
      'EXPIRED',
    );
    const revoked = resolvePermissions({
      globalRole: scorer,
      matchAccess: { level: 'SCORER', status: 'REVOKED' },
    });
    expect(hasPermission(revoked, 'MATCH_SCORE')).toBe(false);
  });

  it('cascades tournament scorer access to matches without rule-edit rights', () => {
    const p = resolvePermissions({
      globalRole: player,
      tournamentAccess: { level: 'SCORER', status: 'ACTIVE' },
    });
    expect(hasPermission(p, 'MATCH_SCORE')).toBe(true);
    expect(hasPermission(p, 'MATCH_VIEW')).toBe(true);
    expect(hasPermission(p, 'TOURNAMENT_MANAGE_RULES')).toBe(false);
    expect(hasPermission(p, 'MATCH_DELETE')).toBe(false);
  });

  it('allows tournament match management without rule edits', () => {
    const p = resolvePermissions({
      globalRole: player,
      tournamentAccess: {
        level: 'CUSTOM',
        status: 'ACTIVE',
        permissions: ['TOURNAMENT_VIEW', 'TOURNAMENT_MANAGE_MATCHES'],
      },
    });
    expect(hasPermission(p, 'TOURNAMENT_MANAGE_MATCHES')).toBe(true);
    expect(hasPermission(p, 'TOURNAMENT_MANAGE_RULES')).toBe(false);
  });

  it('keeps assigned scorers able to score (legacy settings.scorerId)', () => {
    const p = resolvePermissions({ globalRole: scorer, isAssignedScorer: true });
    expect(hasPermission(p, 'MATCH_SCORE')).toBe(true);
    expect(hasPermission(p, 'MATCH_DELETE')).toBe(false);
  });

  it('does not let a match creator change tournament rules unless they own the tournament', () => {
    const matchOnly = resolvePermissions({ globalRole: scorer, isMatchCreator: true });
    expect(hasPermission(matchOnly, 'MATCH_EDIT')).toBe(true);
    expect(hasPermission(matchOnly, 'TOURNAMENT_MANAGE_RULES')).toBe(false);
    const tour = resolvePermissions({ globalRole: scorer, isTournamentCreator: true });
    expect(hasPermission(tour, 'TOURNAMENT_MANAGE_RULES')).toBe(true);
  });
});
