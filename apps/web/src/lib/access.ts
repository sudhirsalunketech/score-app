export const MATCH_PERM_KEYS = [
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

export const TOURNAMENT_PERM_KEYS = [
  'TOURNAMENT_VIEW',
  'TOURNAMENT_EDIT',
  'TOURNAMENT_MANAGE_TEAMS',
  'TOURNAMENT_MANAGE_MATCHES',
  'TOURNAMENT_MANAGE_PLAYERS',
  'TOURNAMENT_MANAGE_RULES',
  'TOURNAMENT_VIEW_STATS',
] as const;

export const USER_PERM_KEYS = ['USER_INVITE', 'USER_MANAGE_ACCESS'] as const;

export type PermissionKey =
  | (typeof MATCH_PERM_KEYS)[number]
  | (typeof TOURNAMENT_PERM_KEYS)[number]
  | (typeof USER_PERM_KEYS)[number];

export type AccessLevelKey = 'VIEWER' | 'PLAYER' | 'SCORER' | 'MATCH_ADMIN' | 'TOURNAMENT_ADMIN' | 'CUSTOM';

const VIEW: PermissionKey[] = ['MATCH_VIEW', 'MATCH_SHARE', 'MATCH_VIEW_STATS', 'MATCH_VIEW_MVP'];
const SCORE: PermissionKey[] = [...VIEW, 'MATCH_SCORE', 'MATCH_UNDO'];
const MATCH_ADMIN: PermissionKey[] = [
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
const TOURNAMENT_ADMIN: PermissionKey[] = [
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

export const ACCESS_PRESETS: Record<Exclude<AccessLevelKey, 'CUSTOM'>, PermissionKey[]> = {
  VIEWER: VIEW,
  PLAYER: VIEW,
  SCORER: SCORE,
  MATCH_ADMIN,
  TOURNAMENT_ADMIN,
};

export function hasPerm(list: string[] | null | undefined, permission: PermissionKey) {
  return Boolean(list?.includes(permission));
}

export function hasMatchPerm(match: { myPermissions?: string[] } | null | undefined, permission: PermissionKey) {
  return hasPerm(match?.myPermissions, permission);
}

export function isGlobalAdmin(role?: string | null) {
  return role === 'SUPER_ADMIN';
}

export function matchChecklist() {
  return MATCH_PERM_KEYS;
}

export function tournamentChecklist() {
  return [...TOURNAMENT_PERM_KEYS, ...USER_PERM_KEYS];
}
