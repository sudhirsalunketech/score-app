import { describe, expect, it } from 'vitest';
import { canJoinLiveRoom, extractYoutubeVideoId } from '@crickscore/shared';

describe('public live visibility', () => {
  it('hides private matches from anonymous viewers', () => {
    expect(canJoinLiveRoom({ publicLiveEnabled: false, authenticated: false })).toBe(false);
  });
  it('allows scorers on private matches', () => {
    expect(canJoinLiveRoom({ publicLiveEnabled: false, authenticated: true })).toBe(true);
  });
  it('allows anonymous viewers when public live is on', () => {
    expect(canJoinLiveRoom({ publicLiveEnabled: true, authenticated: false })).toBe(true);
  });
});

describe('youtube URL validation (API contract)', () => {
  it('extracts ids and rejects hostile input', () => {
    expect(extractYoutubeVideoId('https://youtube.com/watch?v=abcdefghijk')).toBe('abcdefghijk');
    expect(extractYoutubeVideoId('https://not-youtube.com/watch?v=abcdefghijk')).toBeNull();
    expect(extractYoutubeVideoId('data:text/html,<script>')).toBeNull();
  });
});
