import { describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { copyText, matchShareText, playerShareText } from '@/lib/share-text';

describe('share helpers', () => {
  it('builds live share text from the current score', () => {
    const text = matchShareText({
      homeName: 'Alpha XI',
      awayName: 'Raghus Challengers',
      status: 'LIVE',
      runs: 10,
      wickets: 1,
      overs: '3.5',
      url: 'https://example.com/live/alpha-xi-vs-raghus-challengers',
    });
    expect(text).toContain('LIVE NOW');
    expect(text).toContain('Watch the live score of Alpha XI vs Raghus Challengers');
    expect(text).toContain('Alpha XI 10/1');
    expect(text).toContain('Watch live:');
  });

  it('copyText falls back without throwing', async () => {
    const ok = await copyText('https://example.com/live/test');
    expect(typeof ok).toBe('boolean');
  });

  it.each([
    ['en', "Check out Asha's CrickScore profile"],
    ['hi', 'Asha की CrickScore प्रोफ़ाइल देखें'],
    ['mr', 'Asha ची CrickScore प्रोफाइल पहा'],
  ] as const)('builds player share copy in %s', async (lng, headline) => {
    await i18n.changeLanguage(lng);
    const text = playerShareText({ name: 'Asha', url: 'https://example.com/players/asha' });
    expect(text).toContain(headline);
    await i18n.changeLanguage('en');
  });
});
