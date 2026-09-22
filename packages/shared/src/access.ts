export const MATCH_PERMISSIONS = [
  'MATCH_VIEW',
  'MATCH_EDIT',
  'MATCH_DELETE',
  'MATCH_SCORE',
  'MATCH_UNDO',
  'MATCH_CORRECT_BALL',
  'MATCH_MANAGE_PLAYERS',
  'MATCH_MANAGE_PLAYING_XI',
  'MATCH_MANAGE_TOSS',
  'MATCH_MANAGE_RESULT',
  'MATCH_SHARE',
  'MATCH_VIEW_STATS',
  'MATCH_VIEW_MVP',
  'FAN_MANAGE',
] as const;

export const TOURNAMENT_PERMISSIONS = [
  'TOURNAMENT_VIEW',
  'TOURNAMENT_EDIT',
  'TOURNAMENT_MANAGE_TEAMS',
  'TOURNAMENT_MANAGE_MATCHES',
  'TOURNAMENT_MANAGE_PLAYERS',
  'TOURNAMENT_MANAGE_RULES',
  'TOURNAMENT_VIEW_STATS',
] as const;

export const USER_PERMISSIONS = ['USER_INVITE', 'USER_MANAGE_ACCESS'] as const;

export const PERMISSIONS = [...MATCH_PERMISSIONS, ...TOURNAMENT_PERMISSIONS, ...USER_PERMISSIONS] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ACCESS_LEVELS = ['VIEWER', 'PLAYER', 'SCORER', 'MATCH_ADMIN', 'TOURNAMENT_ADMIN', 'CUSTOM'] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];

export const ACCESS_STATUSES = ['PENDING', 'ACTIVE', 'REVOKED', 'EXPIRED'] as const;
export type AccessStatus = (typeof ACCESS_STATUSES)[number];

export const GLOBAL_ADMIN_ROLES = ['SUPER_ADMIN'] as const;

const VIEW: Permission[] = ['MATCH_VIEW', 'MATCH_SHARE', 'MATCH_VIEW_STATS', 'MATCH_VIEW_MVP'];
const SCORE: Permission[] = [...VIEW, 'MATCH_SCORE', 'MATCH_UNDO'];
const MATCH_ADMIN: Permission[] = [
  ...SCORE,
  'MATCH_EDIT',
  'MATCH_CORRECT_BALL',
  'MATCH_MANAGE_PLAYERS',
  'MATCH_MANAGE_PLAYING_XI',
  'MATCH_MANAGE_TOSS',
  'MATCH_MANAGE_RESULT',
  'USER_INVITE',
  'USER_MANAGE_ACCESS',
  'FAN_MANAGE',
];
const TOURNAMENT_ADMIN: Permission[] = [
  ...MATCH_ADMIN,
  'MATCH_DELETE',
  'TOURNAMENT_VIEW',
  'TOURNAMENT_EDIT',
  'TOURNAMENT_MANAGE_TEAMS',
  'TOURNAMENT_MANAGE_MATCHES',
  'TOURNAMENT_MANAGE_PLAYERS',
  'TOURNAMENT_MANAGE_RULES',
  'TOURNAMENT_VIEW_STATS',
];

export const ACCESS_PRESETS: Record<Exclude<AccessLevel, 'CUSTOM'>, Permission[]> = {
  VIEWER: VIEW,
  PLAYER: VIEW,
  SCORER: SCORE,
  MATCH_ADMIN,
  TOURNAMENT_ADMIN,
};

/** Dangerous tournament privileges never cascade from a scorer/viewer grant. */
export const HIGH_PRIVILEGE: Permission[] = [
  'TOURNAMENT_MANAGE_RULES',
  'MATCH_DELETE',
  'MATCH_CORRECT_BALL',
  'USER_MANAGE_ACCESS',
  'USER_INVITE',
  'FAN_MANAGE',
];

export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}

export function sanitizePermissions(values: string[] | null | undefined): Permission[] {
  return [...new Set((values ?? []).filter(isPermission))];
}

export function permissionsForLevel(level: AccessLevel, custom: string[] = []): Permission[] {
  if (level === 'CUSTOM') return sanitizePermissions(custom);
  return [...ACCESS_PRESETS[level]];
}

export function effectiveAccessStatus(input: {
  status: string;
  expiresAt?: Date | string | null;
  now?: Date;
}): AccessStatus {
  if (input.status === 'REVOKED' || input.status === 'PENDING') return input.status;
  if (input.status === 'EXPIRED') return 'EXPIRED';
  if (input.expiresAt) {
    const exp = input.expiresAt instanceof Date ? input.expiresAt : new Date(input.expiresAt);
    if (!Number.isNaN(exp.getTime()) && exp.getTime() <= (input.now ?? new Date()).getTime()) return 'EXPIRED';
  }
  return 'ACTIVE';
}

export type AccessGrant = {
  level: AccessLevel | string;
  permissions?: string[];
  status: string;
  expiresAt?: Date | string | null;
};

function grantPerms(grant: AccessGrant | null | undefined, now?: Date): Permission[] {
  if (!grant) return [];
  if (effectiveAccessStatus(grant) !== 'ACTIVE') return [];
  const level = (ACCESS_LEVELS as readonly string[]).includes(grant.level) ? (grant.level as AccessLevel) : 'CUSTOM';
  return permissionsForLevel(level, grant.permissions);
}

function cascadeMatchFromTournament(grant: AccessGrant | null | undefined, now?: Date): Permission[] {
  const perms = grantPerms(grant, now);
  if (!perms.length) return [];
  const level = grant?.level;
  if (level === 'TOURNAMENT_ADMIN') return permissionsForLevel('TOURNAMENT_ADMIN');
  if (level === 'MATCH_ADMIN') return permissionsForLevel('MATCH_ADMIN');
  if (level === 'SCORER') return permissionsForLevel('SCORER');
  if (level === 'CUSTOM') {
    return perms.filter((p) => p.startsWith('MATCH_') || p === 'USER_MANAGE_ACCESS' || p === 'USER_INVITE');
  }
  return permissionsForLevel('VIEWER');
}

export function resolvePermissions(input: {
  globalRole: string;
  matchAccess?: AccessGrant | null;
  tournamentAccess?: AccessGrant | null;
  isMatchCreator?: boolean;
  isAssignedScorer?: boolean;
  isTournamentCreator?: boolean;
  now?: Date;
}): Set<Permission> {
  const out = new Set<Permission>();
  if (GLOBAL_ADMIN_ROLES.includes(input.globalRole as (typeof GLOBAL_ADMIN_ROLES)[number])) {
    for (const p of PERMISSIONS) out.add(p);
    return out;
  }
  const add = (list: Permission[]) => {
    for (const p of list) out.add(p);
  };
  if (input.isTournamentCreator) add(permissionsForLevel('TOURNAMENT_ADMIN'));
  if (input.isMatchCreator) add(permissionsForLevel('MATCH_ADMIN'));
  if (input.isAssignedScorer) add(permissionsForLevel('SCORER'));
  add(grantPerms(input.matchAccess, input.now));
  add(cascadeMatchFromTournament(input.tournamentAccess, input.now));
  add(grantPerms(input.tournamentAccess, input.now).filter((p) => p.startsWith('TOURNAMENT_')));
  return out;
}

export function hasPermission(perms: Iterable<Permission>, permission: Permission): boolean {
  return [...perms].includes(permission);
}
