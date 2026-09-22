import { BallType } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { clubBallTypes, createClubSchema } from './club.schema';

describe('createClubSchema', () => {
  it('accepts a club registration payload', () => {
    const parsed = createClubSchema.parse({
      name: 'Alpha Cricket Club',
      city: 'Pune',
      establishedYear: '2014',
      ballTypes: ['RUBBER'],
    });
    expect(parsed.name).toBe('Alpha Cricket Club');
    expect(parsed.establishedYear).toBe(2014);
    expect(clubBallTypes(parsed)).toEqual([BallType.RUBBER]);
  });

  it('rejects more than one ball type', () => {
    expect(() =>
      createClubSchema.parse({
        name: 'Alpha Cricket Club',
        city: 'Pune',
        establishedYear: 2014,
        ballTypes: ['TENNIS', 'LEATHER'],
      }),
    ).toThrow();
  });

  it('defaults to tennis when ball types are omitted', () => {
    const parsed = createClubSchema.parse({ name: 'Raghus', city: 'Mumbai', establishedYear: 2020 });
    expect(clubBallTypes(parsed)).toEqual([BallType.TENNIS]);
  });

  it('accepts a stored upload path for the logo', () => {
    const parsed = createClubSchema.parse({
      name: 'Alpha Cricket Club',
      city: 'Pune',
      establishedYear: 2014,
      logoUrl: '/uploads/123-ab.jpg',
      ballTypes: ['LEATHER'],
    });
    expect(parsed.logoUrl).toBe('/uploads/123-ab.jpg');
  });

  it('rejects an empty name', () => {
    expect(() => createClubSchema.parse({ name: 'A', city: 'Pune', establishedYear: 2020 })).toThrow();
  });
});
