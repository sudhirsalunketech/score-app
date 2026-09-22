import { describe, expect, it } from 'vitest';
import { quizzesStepError, todayIsoDate, tournamentCreateSchema } from './tournament-create';

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

describe('tournamentCreateSchema', () => {
  const base = {
    name: 'Summer Cup',
    clubId: '',
    season: 'Year 2026',
    coverImageUrl: '',
    startDate: addDays(7),
    endDate: addDays(21),
    visibility: 'PRIVATE' as const,
    defaultOvers: 5,
    defaultMaxWickets: 7,
    stageType: 'GROUP_STAGE' as const,
  };

  it('requires name, season and dates', () => {
    expect(() => tournamentCreateSchema.parse({ ...base, name: '' })).toThrow(/required/);
    expect(() => tournamentCreateSchema.parse({ ...base, season: '' })).toThrow(/required/);
    expect(() => tournamentCreateSchema.parse({ ...base, startDate: '' })).toThrow(/required/);
    expect(() => tournamentCreateSchema.parse({ ...base, endDate: '' })).toThrow(/required/);
  });

  it('rejects an end date before the start date', () => {
    expect(() => tournamentCreateSchema.parse({ ...base, startDate: addDays(21), endDate: addDays(7) })).toThrow();
  });

  it('rejects a start date in the past', () => {
    expect(() => tournamentCreateSchema.parse({ ...base, startDate: addDays(-1), endDate: addDays(7) })).toThrow(/past/);
  });

  it('accepts a start date of today', () => {
    const parsed = tournamentCreateSchema.parse({ ...base, startDate: todayIsoDate(), endDate: addDays(7) });
    expect(parsed.startDate).toBe(todayIsoDate());
  });

  it('rejects overs and wickets outside range', () => {
    expect(() => tournamentCreateSchema.parse({ ...base, defaultOvers: 0 })).toThrow();
    expect(() => tournamentCreateSchema.parse({ ...base, defaultMaxWickets: 11 })).toThrow();
  });

  it('accepts a stored upload logo', () => {
    const parsed = tournamentCreateSchema.parse({ ...base, coverImageUrl: '/uploads/tn-ab.jpg' });
    expect(parsed.coverImageUrl).toBe('/uploads/tn-ab.jpg');
  });
});

describe('quizzesStepError', () => {
  it('requires a quiz name only when fan quiz is enabled', () => {
    expect(quizzesStepError(false, [{ name: '', startAt: '', endAt: '' }])).toBeNull();
    expect(quizzesStepError(true, [{ name: '', startAt: '', endAt: '' }])?.message).toMatch(/required/);
    expect(quizzesStepError(true, [{ name: 'Fan Challenge', startAt: '', endAt: '' }])).toBeNull();
  });

  it('flags the specific card index that fails validation', () => {
    const result = quizzesStepError(true, [
      { name: 'Quiz 1', startAt: '', endAt: '' },
      { name: '', startAt: '', endAt: '' },
    ]);
    expect(result?.index).toBe(1);
  });

  it('rejects an end date before the start date', () => {
    const result = quizzesStepError(true, [{ name: 'Quiz 1', startAt: '2026-08-20T10:00', endAt: '2026-08-01T10:00' }]);
    expect(result?.message).toMatch(/end/i);
  });
});
