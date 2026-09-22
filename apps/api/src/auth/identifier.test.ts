import { describe, expect, it } from 'vitest';
import { looksLikePhone, normalizePhone, parseLoginIdentifier } from './identifier';

describe('parseLoginIdentifier', () => {
  it('accepts email', () => {
    expect(parseLoginIdentifier('Admin@crickscore.dev')).toEqual({
      kind: 'email',
      value: 'admin@crickscore.dev',
    });
  });

  it('accepts a 10-digit Indian mobile number', () => {
    expect(parseLoginIdentifier('9876543210')).toEqual({ kind: 'phone', value: '9876543210' });
    expect(parseLoginIdentifier('+91 98765 43210')).toEqual({ kind: 'phone', value: '9876543210' });
  });

  it('rejects short or mixed identifiers', () => {
    expect(() => parseLoginIdentifier('98765')).toThrow(/10-digit/);
    expect(() => parseLoginIdentifier('not-an-email')).toThrow(/10-digit|email/);
  });
});

describe('normalizePhone', () => {
  it('treats 10-digit and +91 as the same national number', () => {
    expect(normalizePhone('9876543210')).toBe('9876543210');
    expect(normalizePhone('+91 98765 43210')).toBe('9876543210');
    expect(normalizePhone('91')).toBeNull();
  });
});

describe('looksLikePhone', () => {
  it('treats digit-only input as mobile', () => {
    expect(looksLikePhone('98')).toBe(true);
    expect(looksLikePhone('admin@club.com')).toBe(false);
  });
});
