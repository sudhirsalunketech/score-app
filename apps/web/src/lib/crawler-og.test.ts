import { describe, expect, it } from 'vitest';
import { isSocialCrawler, socialPreviewApiPath } from '../../vite-crawler-og';

describe('crawler OG proxy', () => {
  it('maps public share paths without treating /live/match as a slug', () => {
    expect(socialPreviewApiPath('/live/alpha-xi-vs-raghus-challengers')).toBe(
      '/api/v1/public/matches/alpha-xi-vs-raghus-challengers/preview',
    );
    expect(socialPreviewApiPath('/live/match/alpha-xi-vs-raghus-challengers')).toBe(
      '/api/v1/public/matches/alpha-xi-vs-raghus-challengers/preview',
    );
    expect(socialPreviewApiPath('/match/alpha-xi-vs-raghus-challengers')).toBe(
      '/api/v1/public/matches/alpha-xi-vs-raghus-challengers/preview',
    );
    expect(socialPreviewApiPath('/tournament/street-cup')).toBe('/api/v1/public/tournaments/street-cup/preview');
    expect(socialPreviewApiPath('/live/match')).toBeNull();
    expect(socialPreviewApiPath('/matches/abc')).toBeNull();
  });

  it('detects WhatsApp and Telegram crawlers', () => {
    expect(isSocialCrawler('WhatsApp/2.0')).toBe(true);
    expect(isSocialCrawler('TelegramBot (like TwitterBot)')).toBe(true);
    expect(isSocialCrawler('Mozilla/5.0 Chrome')).toBe(false);
  });
});
