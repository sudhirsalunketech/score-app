import { Prisma, Role, type ShareVisibility } from '@prisma/client';
import { isLinkShareable, isPublicListed } from '@crickscore/shared';
import type { AuthUser } from '../common/auth.guard';
import { canViewPrivateMatch, canViewPrivateTournament } from '../matches/scoring-access';

export function matchDiscoveryWhere(user: AuthUser | null): Prisma.MatchWhereInput {
  if (user?.role === Role.SUPER_ADMIN) return {};
  if (!user) return { visibility: 'PUBLIC' };
  return {
    OR: [
      { visibility: 'PUBLIC' },
      { createdById: user.id },
      { settings: { path: ['scorerIds'], array_contains: user.id } },
      { access: { some: { userId: user.id, status: 'ACTIVE' } } },
      { tournament: { createdById: user.id } },
      { tournament: { access: { some: { userId: user.id, status: 'ACTIVE' } } } },
    ],
  };
}

export function tournamentDiscoveryWhere(user: AuthUser | null): Prisma.TournamentWhereInput {
  if (user?.role === Role.SUPER_ADMIN) return {};
  if (!user) return { visibility: 'PUBLIC' };
  return {
    OR: [
      { visibility: 'PUBLIC' },
      { createdById: user.id },
      { access: { some: { userId: user.id, status: 'ACTIVE' } } },
      { club: { members: { some: { userId: user.id } } } },
    ],
  };
}

export function canReadMatch(
  user: AuthUser | null,
  match: { visibility: ShareVisibility; createdById?: string | null; settings?: unknown },
): boolean {
  if (isLinkShareable(match.visibility)) return true;
  return canViewPrivateMatch(user, match);
}

export function canReadTournament(
  user: AuthUser | null,
  tournament: { visibility: ShareVisibility; createdById?: string | null },
): boolean {
  if (isLinkShareable(tournament.visibility)) return true;
  return canViewPrivateTournament(user, tournament);
}

export { isLinkShareable, isPublicListed };
