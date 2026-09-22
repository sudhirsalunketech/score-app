import { describe, expect, it } from 'vitest';
import { canAnonymousViewShare, canJoinLiveRoom, isLinkShareable } from '@crickscore/shared';

describe('share access', () => {
  it('rejects private matches for anonymous viewers', () => {
    expect(isLinkShareable('PRIVATE')).toBe(false);
    expect(canJoinLiveRoom({ publicLiveEnabled: true, authenticated: false, visibility: 'PRIVATE' })).toBe(false);
    expect(canAnonymousViewShare({ visibility: 'PRIVATE', feature: 'scorecard' })).toBe(false);
  });

  it('allows unlisted live with the share link', () => {
    expect(isLinkShareable('UNLISTED')).toBe(true);
    expect(canJoinLiveRoom({ publicLiveEnabled: true, authenticated: false, visibility: 'UNLISTED' })).toBe(true);
  });

  it('hides MVP independently of live score', () => {
    expect(canAnonymousViewShare({ visibility: 'PUBLIC', feature: 'mvp', publicMvpEnabled: false })).toBe(false);
    expect(canAnonymousViewShare({ visibility: 'PUBLIC', feature: 'live', publicLiveEnabled: true })).toBe(true);
  });
});
