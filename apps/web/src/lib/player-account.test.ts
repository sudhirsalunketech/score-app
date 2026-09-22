import { describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { playerShareText } from '@/lib/share-text';
import { parseProfileTab, parseStatsPanel } from './profile-tab';
import { canManageThisTeam, canScoreThisMatch, canSeeDrawerItem, isPlayerRole } from './roles';
import type { Match, User } from '@/types/api';

describe('player profile tabs', () => {
  it('accepts teams and tournaments tabs', () => {
    expect(parseProfileTab('teams')).toBe('teams');
    expect(parseProfileTab('tournaments')).toBe('tournaments');
    expect(parseProfileTab('stats')).toBe('statistics');
    expect(parseProfileTab('insights')).toBe('statistics');
    expect(parseProfileTab('compare')).toBe('statistics');
    expect(parseStatsPanel('insights', 'statistics')).toBe('insights');
    expect(parseStatsPanel('compare', 'statistics')).toBe('compare');
    expect(parseProfileTab('fan')).toBe('statistics');
    expect(parseStatsPanel('fan', 'statistics')).toBe('fan');
  });
});

describe('public player share', () => {
  it('includes career totals and omits contact fields', () => {
    const text = playerShareText({
      name: 'Sudhir',
      teamName: 'CrickScore Player',
      url: 'https://example.com/players/abc',
      matches: 48,
      runs: 820,
      wickets: 31,
    });
    expect(text).toContain('820');
    expect(text).not.toContain('email');
    expect(text).not.toContain('phone');
  });

  it.each([
    ['en', "Check out Sudhir's CrickScore profile"],
    ['hi', 'Sudhir की CrickScore प्रोफ़ाइल देखें'],
    ['mr', 'Sudhir ची CrickScore प्रोफाइल पहा'],
  ] as const)('localizes the player share headline in %s', async (lng, headline) => {
    await i18n.changeLanguage(lng);
    const text = playerShareText({
      name: 'Sudhir',
      url: 'https://example.com/players/abc',
    });
    expect(text).toContain(headline);
    expect(text).not.toContain('@');
    await i18n.changeLanguage('en');
  });
});

describe('PLAYER role UI permissions', () => {
  const player = { id: 'p1', role: 'PLAYER' } as User;

  it('allows scoring and managing a team/match the PLAYER created, but not someone else\'s', () => {
    expect(isPlayerRole(player.role)).toBe(true);
    expect(canManageThisTeam(player, { createdById: 'p1' })).toBe(true);
    expect(canManageThisTeam(player, { createdById: 'other' })).toBe(false);
    const match = (createdById: string) =>
      ({
        id: 'm1',
        title: 'A vs B',
        status: 'LIVE',
        createdById,
        settings: {},
        homeTeam: { id: 'h', name: 'Home' },
        awayTeam: { id: 'a', name: 'Away' },
      }) as Match;
    expect(canScoreThisMatch(player, match('p1'))).toBe(true);
    expect(canScoreThisMatch(player, match('other'))).toBe(false);
  });

  it('builds PLAYER navigation from permissions, not a second menu', () => {
    expect(canSeeDrawerItem(player, { create: true }, true)).toBe(true);
    expect(canSeeDrawerItem(player, { admin: true }, true)).toBe(false);
    expect(canSeeDrawerItem(player, { hideForPlayer: true }, true)).toBe(true);
    expect(canSeeDrawerItem(player, { auth: true }, true)).toBe(true);
    expect(canSeeDrawerItem({ role: 'ADMIN' }, { create: true, admin: true }, true)).toBe(false);
    expect(canSeeDrawerItem({ role: 'SUPER_ADMIN' }, { create: true, admin: true }, true)).toBe(true);
    expect(canSeeDrawerItem({ role: 'VIEWER' }, { create: true }, true)).toBe(false);
    expect(canSeeDrawerItem(null, { guestOpen: true }, false)).toBe(true);
  });
});
