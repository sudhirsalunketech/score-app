import { describe, expect, it } from 'vitest';
import { diffCorrectionFields } from './correction-diff';

describe('diffCorrectionFields', () => {
  it('only reports fields whose value actually changed', () => {
    const before = { batsmanRuns: 4, extraType: 'NONE', extraRuns: 0, strikerId: 'p1' };
    const after = { batsmanRuns: 6, extraType: 'NONE', extraRuns: 0, strikerId: 'p1' };
    expect(diffCorrectionFields(before, after)).toEqual([
      { field: 'batsmanRuns', before: 4, after: 6, tone: 'changed' },
    ]);
  });

  it('orders known fields in a fixed logical order regardless of input order', () => {
    const before = { strikerId: 'p1', batsmanRuns: 4 };
    const after = { strikerId: 'p2', batsmanRuns: 6 };
    expect(diffCorrectionFields(before, after).map((c) => c.field)).toEqual(['batsmanRuns', 'strikerId']);
  });

  it('marks a field going from empty to a value as added', () => {
    const before = { fielderId: null };
    const after = { fielderId: 'p3' };
    expect(diffCorrectionFields(before, after)).toEqual([
      { field: 'fielderId', before: null, after: 'p3', tone: 'added' },
    ]);
  });

  it('marks a field going from a value to empty as removed', () => {
    const before = { dismissalType: 'BOWLED' };
    const after = { dismissalType: null };
    expect(diffCorrectionFields(before, after)).toEqual([
      { field: 'dismissalType', before: 'BOWLED', after: null, tone: 'removed' },
    ]);
  });

  it('flags every populated field as removed when the after side is entirely null (delete record)', () => {
    const before = { batsmanRuns: 1, extraType: 'NONE' };
    const changes = diffCorrectionFields(before, null);
    expect(changes.map((c) => c.field)).toEqual(['batsmanRuns', 'extraType']);
    expect(changes.every((c) => c.tone === 'removed')).toBe(true);
  });

  it('returns no changes for identical before/after', () => {
    const snapshot = { batsmanRuns: 4, extraType: 'WIDE', extraRuns: 1 };
    expect(diffCorrectionFields(snapshot, { ...snapshot })).toEqual([]);
  });

  it('handles missing before/after entirely (insert-only or delete-only records)', () => {
    expect(diffCorrectionFields(null, { batsmanRuns: 4 })).toEqual([
      { field: 'batsmanRuns', before: null, after: 4, tone: 'added' },
    ]);
    expect(diffCorrectionFields({ batsmanRuns: 4 }, null)).toEqual([
      { field: 'batsmanRuns', before: 4, after: null, tone: 'removed' },
    ]);
  });

  it('appends unrecognized fields after the known field order, sorted alphabetically', () => {
    const before = { zField: 'a', batsmanRuns: 1 };
    const after = { zField: 'b', batsmanRuns: 2 };
    expect(diffCorrectionFields(before, after).map((c) => c.field)).toEqual(['batsmanRuns', 'zField']);
  });
});
