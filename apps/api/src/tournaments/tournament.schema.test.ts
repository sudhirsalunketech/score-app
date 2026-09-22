import { describe, expect, it } from 'vitest';
import { createTournamentSchema } from './tournament.schema';

describe('createTournamentSchema', () => {
  it('accepts name, club and dates', () => {
    const parsed = createTournamentSchema.parse({
      name: 'Summer Cup',
      clubId: 'c1',
      season: '2026',
      startDate: '2026-08-01',
      endDate: '2026-08-20',
    });
    expect(parsed.name).toBe('Summer Cup');
    expect(parsed.clubId).toBe('c1');
  });

  it('accepts default overs and wickets', () => {
    const parsed = createTournamentSchema.parse({ name: 'Cup', defaultOvers: 5, defaultMaxWickets: 7 });
    expect(parsed.defaultOvers).toBe(5);
    expect(parsed.defaultMaxWickets).toBe(7);
  });

  it('accepts a default over-wise-rules flag for matches created in the tournament', () => {
    const parsed = createTournamentSchema.parse({ name: 'Cup', defaultOverWiseRulesEnabled: true });
    expect(parsed.defaultOverWiseRulesEnabled).toBe(true);
  });

  it('accepts a stored upload path for the cover image', () => {
    const parsed = createTournamentSchema.parse({
      name: 'Cup',
      coverImageUrl: '/uploads/tn-ab.jpg',
    });
    expect(parsed.coverImageUrl).toBe('/uploads/tn-ab.jpg');
  });

  it('rejects a blob URL for the cover image', () => {
    expect(() => createTournamentSchema.parse({ name: 'Cup', coverImageUrl: 'blob:http://localhost/abc' })).toThrow();
  });

  it('rejects an end date before the start date', () => {
    expect(() =>
      createTournamentSchema.parse({
        name: 'Summer Cup',
        startDate: '2026-08-20',
        endDate: '2026-08-01',
      }),
    ).toThrow();
  });
});
