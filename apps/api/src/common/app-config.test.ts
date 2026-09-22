import { describe, expect, it } from 'vitest';
import { denyMessage, publicConfig } from './app-config';

describe('publicConfig', () => {
  it('does not enable beta from production NODE_ENV alone', () => {
    const prev = { ...process.env };
    process.env.NODE_ENV = 'production';
    delete process.env.APP_ENV;
    delete process.env.BETA;
    delete process.env.BETA_BADGE_PUBLIC;
    const cfg = publicConfig();
    expect(cfg.beta).toBe(false);
    expect(cfg.badgeOnPublic).toBe(false);
    expect(cfg.features.BETA_FEEDBACK).toBe(false);
    expect(cfg.features.PUBLIC_SHARE).toBe(true);
    expect(cfg.devAuthHints).toBe(false);
    process.env = prev;
  });

  it('only reports Google login as available once a client id is configured', () => {
    const prev = { ...process.env };
    delete process.env.GOOGLE_CLIENT_ID;
    expect(publicConfig().features.GOOGLE_LOGIN).toBe(false);
    expect(publicConfig().googleClientId).toBeNull();
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    expect(publicConfig().features.GOOGLE_LOGIN).toBe(true);
    expect(publicConfig().googleClientId).toBe('test-client-id');
    process.env = prev;
  });
});

describe('denyMessage', () => {
  it('returns friendly scoring and expiry-adjacent copy', () => {
    expect(denyMessage('MATCH_SCORE')).toBe("You don't have permission to score this match.");
    expect(denyMessage('MATCH_EDIT')).toBe("You don't have permission to edit this match.");
    expect(denyMessage('MATCH_DELETE')).toBe("You don't have permission to delete this match.");
  });
});
