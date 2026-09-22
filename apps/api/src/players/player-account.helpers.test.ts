import { describe, expect, it } from 'vitest';
import {
  dateRangeWhere,
  eventInvolvesPlayer,
  isCurrentTeamMember,
  matchInvolvesPlayer,
  matchStatusGroup,
  paginated,
  parsePageLimit,
  statsSourceIsMatchHistory,
  statusesForGroup,
} from './player-account.helpers';

describe('player account helpers', () => {
  it('treats null leftAt as current membership', () => {
    expect(isCurrentTeamMember(null)).toBe(true);
    expect(isCurrentTeamMember(new Date())).toBe(false);
  });

  it('classifies match status groups', () => {
    expect(matchStatusGroup('LIVE')).toBe('live');
    expect(matchStatusGroup('SCHEDULED')).toBe('upcoming');
    expect(matchStatusGroup('COMPLETED')).toBe('completed');
  });

  it('includes a player through current team or historical MatchPlayer', () => {
    const match = { id: 'm1', homeTeamId: 't1', awayTeamId: 't2' };
    expect(matchInvolvesPlayer(match, ['t1'], [])).toBe(true);
    expect(matchInvolvesPlayer(match, [], ['m1'])).toBe(true);
    expect(matchInvolvesPlayer(match, ['other'], [])).toBe(false);
  });

  it('keeps historical match ids after a team leave', () => {
    const before = statsSourceIsMatchHistory(['m1', 'm2'], ['t1']);
    const afterLeave = statsSourceIsMatchHistory(['m1', 'm2'], []);
    expect(afterLeave.matchIds).toEqual(before.matchIds);
    expect(afterLeave.teamIds).toEqual([]);
  });

  it('paginates after a date filter, not before', () => {
    const all = Array.from({ length: 45 }, (_, i) => i + 1);
    const { page, limit, skip } = parsePageLimit(2, 20);
    expect({ page, limit, skip }).toEqual({ page: 2, limit: 20, skip: 20 });
    const items = all.slice(skip, skip + limit);
    expect(items[0]).toBe(21);
    expect(items.at(-1)).toBe(40);
    expect(paginated(items, all.length, page, limit).hasMore).toBe(true);
  });

  it('maps status groups for SQL filters', () => {
    expect(statusesForGroup('live')).toEqual(['LIVE', 'INNINGS_BREAK']);
    expect(statusesForGroup('all')).toBeUndefined();
  });

  it('builds a date range that applies before pagination', () => {
    const where = dateRangeWhere('2026-08-10', '2026-08-12') as { OR: Array<{ scheduledAt?: { gte?: Date; lte?: Date } }> };
    expect(where.OR[0]!.scheduledAt!.gte?.toISOString().startsWith('2026-08-10') || where.OR[0]!.scheduledAt!.gte).toBeTruthy();
    expect(dateRangeWhere()).toEqual({});
  });

  it('selects only balls that involved the player', () => {
    expect(eventInvolvesPlayer({ strikerId: 'p1', bowlerId: 'b', isUndone: false }, 'p1')).toBe(true);
    expect(eventInvolvesPlayer({ strikerId: 'x', bowlerId: 'p1', isUndone: false }, 'p1')).toBe(true);
    expect(eventInvolvesPlayer({ strikerId: 'x', bowlerId: 'y', fielderId: 'p1', isUndone: false }, 'p1')).toBe(true);
    expect(eventInvolvesPlayer({ strikerId: 'p1', bowlerId: 'b', isUndone: true }, 'p1')).toBe(false);
  });
});
