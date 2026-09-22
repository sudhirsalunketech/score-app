import { describe, expect, it } from 'vitest';
import { shouldResetInningsPersonnel } from './innings-personnel';

describe('shouldResetInningsPersonnel', () => {
  it('resets only when the innings id actually changes', () => {
    expect(shouldResetInningsPersonnel(null, 'inn1')).toBe(false);
    expect(shouldResetInningsPersonnel('inn1', 'inn1')).toBe(false);
    expect(shouldResetInningsPersonnel('inn1', 'inn2')).toBe(true);
  });
});
