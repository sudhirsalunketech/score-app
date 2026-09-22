import { describe, expect, it } from 'vitest';
import { canScoreThisMatch } from './roles';
import type { Match, User } from '@/types/api';

const scorer = { id: 's1', role: 'SCORER' } as User;
const other = { id: 's2', role: 'SCORER' } as User;
const superAdmin = { id: 'sa1', role: 'SUPER_ADMIN' } as User;
const admin = { id: 'a1', role: 'ADMIN' } as User;
const viewer = { id: 'v1', role: 'VIEWER' } as User;

function match(partial: Partial<Match> = {}): Match {
  return {
    id: 'm1',
    title: 'A vs B',
    status: 'LIVE',
    createdById: 's1',
    settings: {},
    homeTeam: { id: 'h', name: 'Home' },
    awayTeam: { id: 'a', name: 'Away' },
    ...partial,
  } as Match;
}

describe('canScoreThisMatch', () => {
  it('allows super admin on any match', () => {
    expect(canScoreThisMatch(superAdmin, match({ createdById: 's1', settings: { scorerIds: ['s1'] } }))).toBe(true);
  });

  it('rejects a plain admin who is not the creator or assigned scorer', () => {
    expect(canScoreThisMatch(admin, match({ createdById: 's1', settings: { scorerIds: ['s1'] } }))).toBe(false);
  });

  it('allows the match creator regardless of role', () => {
    expect(canScoreThisMatch(viewer, match({ createdById: 'v1', settings: {} }))).toBe(true);
  });

  it('allows only the assigned scorer', () => {
    const row = match({ createdById: 'other', settings: { scorerIds: ['s1'] } });
    expect(canScoreThisMatch(scorer, row)).toBe(true);
    expect(canScoreThisMatch(other, row)).toBe(false);
  });

  it('supports multiple assigned scorers', () => {
    const row = match({ createdById: 'other', settings: { scorerIds: ['s1', 's2'] } });
    expect(canScoreThisMatch(scorer, row)).toBe(true);
    expect(canScoreThisMatch(other, row)).toBe(true);
  });

  it('rejects an unassigned scorer when the match has no creator', () => {
    expect(canScoreThisMatch(scorer, match({ createdById: null, settings: {} }))).toBe(false);
  });

  it('rejects viewers who are not the creator', () => {
    expect(canScoreThisMatch(viewer, match())).toBe(false);
  });
});
