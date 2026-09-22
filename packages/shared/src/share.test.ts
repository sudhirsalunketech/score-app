import { describe, expect, it } from 'vitest';
import {
  canAnonymousViewShare,
  DEFAULT_SHARE_COPY,
  escapeHtml,
  isLinkShareable,
  matchShareText,
  ogMatchTitle,
  socialPreviewHtml,
  tournamentShareText,
  playerShareText,
} from './share';

describe('share visibility', () => {
  it('allows public and unlisted links, not private', () => {
    expect(isLinkShareable('PUBLIC')).toBe(true);
    expect(isLinkShareable('UNLISTED')).toBe(true);
    expect(isLinkShareable('PRIVATE')).toBe(false);
  });

  it('hides MVP when the flag is off', () => {
    expect(canAnonymousViewShare({ visibility: 'PUBLIC', feature: 'mvp', publicMvpEnabled: false })).toBe(false);
    expect(canAnonymousViewShare({ visibility: 'UNLISTED', feature: 'mvp', publicMvpEnabled: true })).toBe(true);
    expect(canAnonymousViewShare({ visibility: 'PRIVATE', feature: 'live', publicLiveEnabled: true })).toBe(false);
  });

  it('requires public live for anonymous live score', () => {
    expect(canAnonymousViewShare({ visibility: 'UNLISTED', feature: 'live', publicLiveEnabled: false })).toBe(false);
    expect(canAnonymousViewShare({ visibility: 'UNLISTED', feature: 'live', publicLiveEnabled: true })).toBe(true);
  });
});

describe('share text', () => {
  it('builds a live WhatsApp message from current score', () => {
    const text = matchShareText({
      homeName: 'Alpha XI',
      awayName: 'Raghus Challengers',
      tournamentName: 'Street Cup',
      status: 'LIVE',
      runs: 10,
      wickets: 1,
      overs: '3.5',
      url: 'https://example.com/live/alpha-xi-vs-raghus-challengers',
    });
    expect(text).toContain('LIVE NOW');
    expect(text).toContain('Watch the live score of Alpha XI vs Raghus Challengers');
    expect(text).toContain('Alpha XI 10/1');
    expect(text).toContain('3.5 Overs');
    expect(text).toContain('https://example.com/live/alpha-xi-vs-raghus-challengers');
  });

  it('localizes the live watch sentence', () => {
    const text = matchShareText(
      {
        homeName: 'Alpha XI',
        awayName: 'Beta XI',
        status: 'LIVE',
        url: 'https://example.com/live/alpha',
      },
      {
        ...DEFAULT_SHARE_COPY,
        watchLiveOf: '{home} बनाम {away} का लाइव स्कोर देखें',
      },
    );
    expect(text).toContain('Alpha XI बनाम Beta XI का लाइव स्कोर देखें');
  });

  it('builds a completed result message', () => {
    const text = matchShareText({
      homeName: 'Alpha XI',
      awayName: 'Raghus Challengers',
      status: 'COMPLETED',
      winnerName: 'Alpha XI',
      margin: '6 wickets',
      url: 'https://example.com/live/alpha',
    });
    expect(text).toContain('MATCH RESULT');
    expect(text).toContain('Alpha XI won by 6 wickets');
  });

  it('builds a tournament message', () => {
    const text = tournamentShareText({ name: 'Street Cup', season: '2026', url: 'https://example.com/tournament/street-cup' });
    expect(text).toContain('Street Cup');
    expect(text).toContain('Points table');
    expect(text).toContain('https://example.com/tournament/street-cup');
  });

  it('escapes OG HTML', () => {
    expect(escapeHtml('A <b> vs "B"')).toBe('A &lt;b&gt; vs &quot;B&quot;');
    const html = socialPreviewHtml({
      title: 'Alpha vs Beta',
      description: 'Follow the live score',
      url: 'https://example.com/live/alpha',
      heading: 'Watch Live Score',
    });
    expect(html).toContain('og:title');
    expect(html).toContain('twitter:card');
    expect(html).not.toContain('password');
  });

  it('builds a public player profile share without PII', () => {
    const text = playerShareText({
      name: 'Sudhir',
      teamName: 'CrickScore Player',
      url: 'https://example.com/players/p1',
      matches: 48,
      runs: 820,
      wickets: 31,
      best: '74*',
      strikeRate: 142.4,
    });
    expect(text).toContain('Sudhir');
    expect(text).toContain('CrickScore Player');
    expect(text).toContain('Runs 820');
    expect(text).toContain('https://example.com/players/p1');
    expect(text).not.toContain('@');
    expect(text).not.toContain('phone');
  });
});
