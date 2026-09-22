export const LIVE_MATCH_STATUSES = new Set(['LIVE', 'INNINGS_BREAK']);
export const UPCOMING_MATCH_STATUSES = new Set(['DRAFT', 'SCHEDULED', 'TOSS_PENDING', 'TOSS_COMPLETED']);
export const COMPLETED_MATCH_STATUSES = new Set(['COMPLETED', 'ABANDONED']);

export type HistoryQuery = {
  status?: string;
  tournamentId?: string;
  teamId?: string;
  season?: string;
  from?: string;
  to?: string;
  page?: string | number;
  limit?: string | number;
};

export function parsePageLimit(page?: string | number, limit?: string | number) {
  const parsedPage = Math.max(1, Math.floor(Number(page) || 1));
  const parsedLimit = Math.min(50, Math.max(1, Math.floor(Number(limit) || 20)));
  return { page: parsedPage, limit: parsedLimit, skip: (parsedPage - 1) * parsedLimit };
}

export function paginated<T>(items: T[], total: number, page: number, limit: number) {
  return { items, page, limit, total, hasMore: page * limit < total };
}

export function isIsoDate(value?: string) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

export function dayBounds(iso: string, end = false) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year!, month! - 1, day, end ? 23 : 0, end ? 59 : 0, end ? 59 : 0, end ? 999 : 0);
}

/** Date filter is applied in the query (before skip/take). */
export function dateRangeWhere(from?: string, to?: string) {
  const start = isIsoDate(from) ? dayBounds(from!) : null;
  const finish = isIsoDate(to) ? dayBounds(to!, true) : isIsoDate(from) ? dayBounds(from!, true) : null;
  if (!start && !finish) return {};
  const range: { gte?: Date; lte?: Date } = {};
  if (start) range.gte = start;
  if (finish) range.lte = finish;
  return {
    OR: [{ scheduledAt: range }, { AND: [{ scheduledAt: null }, { createdAt: range }] }],
  };
}

export function statusesForGroup(status?: string) {
  if (!status || status === 'all') return undefined;
  if (status === 'live') return [...LIVE_MATCH_STATUSES];
  if (status === 'upcoming') return [...UPCOMING_MATCH_STATUSES];
  if (status === 'completed') return [...COMPLETED_MATCH_STATUSES];
  return [status];
}

export function isCurrentTeamMember(leftAt: Date | string | null | undefined) {
  return leftAt == null;
}

export function matchStatusGroup(status: string): 'live' | 'upcoming' | 'completed' | 'other' {
  if (LIVE_MATCH_STATUSES.has(status)) return 'live';
  if (UPCOMING_MATCH_STATUSES.has(status)) return 'upcoming';
  if (COMPLETED_MATCH_STATUSES.has(status)) return 'completed';
  return 'other';
}

export function matchInvolvesPlayer(
  match: { id: string; homeTeamId: string; awayTeamId: string },
  currentTeamIds: Iterable<string>,
  playedMatchIds: Iterable<string>,
) {
  const teams = new Set(currentTeamIds);
  const played = new Set(playedMatchIds);
  return teams.has(match.homeTeamId) || teams.has(match.awayTeamId) || played.has(match.id);
}

export function eventInvolvesPlayer(
  event: {
    strikerId: string;
    nonStrikerId?: string | null;
    bowlerId: string;
    dismissedPlayerId?: string | null;
    fielderId?: string | null;
    isUndone?: boolean;
  },
  playerId: string,
) {
  if (event.isUndone) return false;
  return (
    event.strikerId === playerId ||
    event.nonStrikerId === playerId ||
    event.bowlerId === playerId ||
    event.dismissedPlayerId === playerId ||
    event.fielderId === playerId
  );
}

/** Career/tournament numbers come from match events, not the current TeamPlayer roster. */
export function statsSourceIsMatchHistory(playedMatchIds: string[], currentTeamIds: string[]) {
  return { matchIds: [...playedMatchIds], teamIds: [...currentTeamIds] };
}
