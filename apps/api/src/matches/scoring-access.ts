import { Role } from '@prisma/client';

export function canScoreMatch(
  user: { id: string; role: Role },
  match: { createdById?: string | null; settings?: unknown } | null,
): boolean {
  if (user.role === Role.SUPER_ADMIN) return true;
  if (match?.createdById && match.createdById === user.id) return true;
  if (user.role !== Role.SCORER) return false;
  if (!match) return false;
  const settings = (match.settings ?? {}) as Record<string, unknown>;
  const assigned = Array.isArray(settings.scorerIds) ? (settings.scorerIds as unknown[]) : [];
  if (assigned.length) return assigned.includes(user.id);
  if (match.createdById) return match.createdById === user.id;
  return false;
}

export function canManageMatch(
  user: { id: string; role: Role },
  match: { createdById?: string | null; settings?: unknown } | null,
): boolean {
  return canScoreMatch(user, match);
}

export function canForcePlayingXi(user: { role: Role }): boolean {
  return user.role === Role.SUPER_ADMIN;
}

export function canManageTournament(
  user: { id: string; role: Role },
  tournament: { createdById?: string | null } | null,
): boolean {
  if (user.role === Role.SUPER_ADMIN) return true;
  if (!tournament) return false;
  return tournament.createdById === user.id;
}

export function canManageTeam(
  user: { id: string; role: Role },
  team: { createdById?: string | null } | null,
): boolean {
  if (user.role === Role.SUPER_ADMIN) return true;
  if (user.role === Role.SCORER) return true;
  if (team?.createdById === user.id) return true;
  return false;
}

export function canManageClub(
  user: { id: string; role: Role },
  club: { createdById?: string | null; members?: Array<{ userId: string; role: string }> } | null,
): boolean {
  if (!club) return false;
  if (user.role === Role.SUPER_ADMIN) return true;
  if (club.createdById && club.createdById === user.id) return true;
  return (club.members ?? []).some((row) => row.userId === user.id && (row.role === 'OWNER' || row.role === 'ADMIN'));
}

export function canManagePlayer(
  user: { id: string; role: Role },
  player: { userId?: string | null; teams?: Array<{ team: { createdById?: string | null } | null }> } | null,
): boolean {
  if (!player) return false;
  if (user.role === Role.SUPER_ADMIN) return true;
  if (player.userId && player.userId === user.id) return true;
  return (player.teams ?? []).some((row) => canManageTeam(user, row.team ?? null));
}

export function canViewPrivateMatch(
  user: { id: string; role: Role } | null,
  match: { createdById?: string | null; settings?: unknown } | null,
): boolean {
  if (!user) return false;
  return canManageMatch(user, match);
}

export function hasActiveAccessGrant(
  row: { status: string; expiresAt: Date | null } | null | undefined,
  now = new Date(),
): boolean {
  if (!row || row.status !== 'ACTIVE') return false;
  if (row.expiresAt && row.expiresAt < now) return false;
  return true;
}

export function canViewPrivateTournament(
  user: { id: string; role: Role } | null,
  tournament: { createdById?: string | null } | null,
): boolean {
  if (!user) return false;
  return canManageTournament(user, tournament);
}
