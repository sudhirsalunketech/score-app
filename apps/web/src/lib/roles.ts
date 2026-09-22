import type { Match, MatchStatus, User } from '@/types/api';
import { hasMatchPerm, isGlobalAdmin } from '@/lib/access';

const LIVE: MatchStatus[] = ['LIVE', 'INNINGS_BREAK'];
const UPCOMING: MatchStatus[] = ['DRAFT', 'SCHEDULED', 'TOSS_PENDING', 'TOSS_COMPLETED'];
const COMPLETED: MatchStatus[] = ['COMPLETED', 'ABANDONED'];

export function isLiveMatch(status: MatchStatus) {
  return LIVE.includes(status);
}

export function isUpcomingMatch(status: MatchStatus) {
  return UPCOMING.includes(status);
}

export function isFinishedMatch(status: MatchStatus) {
  return COMPLETED.includes(status);
}

export function isCancelledMatch(status: MatchStatus) {
  return status === 'CANCELLED';
}

export function filterMatches(
  matches: Match[],
  tab: 'all' | 'live' | 'upcoming' | 'completed' | 'cancelled' | 'mine',
  userId?: string,
) {
  if (tab === 'live') return matches.filter((m) => isLiveMatch(m.status));
  if (tab === 'upcoming') return matches.filter((m) => isUpcomingMatch(m.status));
  if (tab === 'completed') return matches.filter((m) => isFinishedMatch(m.status));
  if (tab === 'cancelled') return matches.filter((m) => isCancelledMatch(m.status));
  if (tab === 'mine' && userId) {
    return matches.filter((m) => {
      const scorerIds = Array.isArray(m.settings?.scorerIds) ? (m.settings.scorerIds as unknown[]) : [];
      return m.createdById === userId || scorerIds.includes(userId);
    });
  }
  return matches;
}

export function canScoreRole(role?: string | null) {
  return role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'SCORER';
}

export function canCreateMatch(role?: string | null) {
  return role !== 'VIEWER' && Boolean(role);
}

export function isPlayerRole(role?: string | null) {
  return role === 'PLAYER';
}

export function canSeeDrawerItem(
  user: { role?: string | null } | null,
  item: { guestOnly?: boolean; guestOpen?: boolean; create?: boolean; admin?: boolean; hideForPlayer?: boolean; auth?: boolean },
  isAuthenticated: boolean,
) {
  if (item.guestOnly) return !isAuthenticated;
  if (!isAuthenticated) return Boolean(item.guestOpen);
  if (item.create && !canCreateMatch(user?.role)) return false;
  if (item.hideForPlayer && isPlayerRole(user?.role) && !canCreateMatch(user?.role) && !isGlobalAdmin(user?.role)) return false;
  if (item.admin && !isGlobalAdmin(user?.role)) return false;
  if (item.auth && !isAuthenticated) return false;
  return true;
}

export function canManageThisTeam(user: User | null, team: { createdById?: string | null } | null | undefined) {
  if (!user || !team) return false;
  if (isGlobalAdmin(user.role)) return true;
  if (user.role === 'SCORER') return true;
  return user.id === team.createdById;
}

export function canScoreThisMatch(user: User | null, match: Match) {
  if (!user) return false;
  if (match.myPermissions) return hasMatchPerm(match, 'MATCH_SCORE');
  if (isGlobalAdmin(user.role)) return true;
  if (match.createdById && match.createdById === user.id) return true;
  if (user.role !== 'SCORER') return false;
  const assigned = Array.isArray(match.settings?.scorerIds) ? (match.settings.scorerIds as unknown[]) : [];
  if (assigned.length) return assigned.includes(user.id);
  if (match.createdById) return match.createdById === user.id;
  return false;
}

export function canManageThisMatch(user: User | null, match: Match) {
  if (!user) return false;
  if (match.myPermissions) return hasMatchPerm(match, 'MATCH_EDIT');
  return canScoreThisMatch(user, match);
}

export function canManageThisTournament(user: User | null, tournament: { createdById?: string | null; myPermissions?: string[] }) {
  if (!user) return false;
  if (tournament.myPermissions) return hasMatchPerm(tournament, 'TOURNAMENT_EDIT');
  if (isGlobalAdmin(user.role)) return true;
  return user.id === tournament.createdById;
}
