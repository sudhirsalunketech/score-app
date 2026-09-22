import { describe, expect, it } from 'vitest';
import { clubRegisterSchema, CURRENT_YEAR } from './club-register';

describe('clubRegisterSchema', () => {
  const base = {
    name: 'Alpha Cricket Club',
    city: 'Pune',
    establishedYear: 2014,
    ballTypes: ['TENNIS'] as ['TENNIS'],
  };

  it('registers without a logo', () => {
    const parsed = clubRegisterSchema.parse(base);
    expect(parsed.logoUrl).toBeUndefined();
  });

  it('registers with a stored upload logo', () => {
    const parsed = clubRegisterSchema.parse({ ...base, logoUrl: '/uploads/club-ab.jpg' });
    expect(parsed.logoUrl).toBe('/uploads/club-ab.jpg');
  });

  it('rejects blob URLs and missing required fields', () => {
    expect(() => clubRegisterSchema.parse({ ...base, logoUrl: 'blob:http://localhost/abc' })).toThrow();
    expect(() => clubRegisterSchema.parse({ ...base, name: '' })).toThrow();
    expect(() => clubRegisterSchema.parse({ ...base, city: '' })).toThrow();
  });

  it('rejects a year in the future', () => {
    expect(() => clubRegisterSchema.parse({ ...base, establishedYear: CURRENT_YEAR + 1 })).toThrow();
  });

  it('requires exactly one ball type', () => {
    expect(() => clubRegisterSchema.parse({ ...base, ballTypes: [] })).toThrow();
    expect(() => clubRegisterSchema.parse({ ...base, ballTypes: ['TENNIS', 'LEATHER'] })).toThrow();
  });
});
