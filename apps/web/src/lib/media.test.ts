import { describe, expect, it } from 'vitest';
import { avatarSrc, DEFAULT_PROFILE_PHOTO, DEFAULT_TEAM_PHOTO, LOGO_MAX_BYTES, mediaSrc, validateLogoFile } from './media';

describe('media', () => {
  it('keeps absolute and default paths', () => {
    expect(mediaSrc('https://cdn.example.com/a.jpg')).toBe('https://cdn.example.com/a.jpg');
    expect(mediaSrc('/defaults/profile.svg')).toBe('/defaults/profile.svg');
  });

  it('uses default photos when none is set', () => {
    expect(avatarSrc(null, 'person')).toBe(DEFAULT_PROFILE_PHOTO);
    expect(avatarSrc(undefined, 'team')).toBe(DEFAULT_TEAM_PHOTO);
    expect(avatarSrc(null)).toBeUndefined();
  });
});

describe('validateLogoFile', () => {
  it('accepts png jpg and webp', () => {
    expect(validateLogoFile({ name: 'logo.png', type: 'image/png', size: 1200 })).toBeNull();
    expect(validateLogoFile({ name: 'logo.jpg', type: 'image/jpeg', size: 1200 })).toBeNull();
    expect(validateLogoFile({ name: 'logo.webp', type: 'image/webp', size: 1200 })).toBeNull();
  });

  it('rejects invalid types', () => {
    expect(validateLogoFile({ name: 'logo.svg', type: 'image/svg+xml', size: 100 })).toBe('PHOTO_TYPE');
    expect(validateLogoFile({ name: 'logo.gif', type: 'image/gif', size: 100 })).toBe('PHOTO_TYPE');
    expect(validateLogoFile({ name: 'logo.html', type: 'text/html', size: 100 })).toBe('PHOTO_TYPE');
  });

  it('rejects files larger than 5 MB', () => {
    expect(validateLogoFile({ name: 'logo.png', type: 'image/png', size: LOGO_MAX_BYTES + 1 })).toBe('PHOTO_SIZE');
    expect(validateLogoFile({ name: 'logo.png', type: 'image/png', size: LOGO_MAX_BYTES })).toBeNull();
  });
});
