import { describe, expect, it } from 'vitest';
import { snapshotFromJson } from './rules.service';

describe('rule snapshot JSON', () => {
  it('accepts a versioned snapshot and rejects junk', () => {
    expect(snapshotFromJson({ enabled: true, version: 4, rules: [] })).toMatchObject({ enabled: true, version: 4 });
    expect(snapshotFromJson(null)).toBeNull();
    expect(snapshotFromJson(['nope'])).toBeNull();
    expect(snapshotFromJson({ enabled: 'yes', rules: [] })).toBeNull();
    expect(snapshotFromJson({ enabled: true, version: 1, rules: [], mvp: { bowling: { pointsPerWicket: 3 } } })?.mvp?.bowling.pointsPerWicket).toBe(3);
  });
});
