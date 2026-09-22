import { describe, expect, it } from 'vitest';
import { ruleBallLabel } from './custom-rules-display';

describe('ruleBallLabel', () => {
  it('hides identical actual and counted runs', () => {
    expect(ruleBallLabel(4, 4)).toBeNull();
  });

  it('formats multipliers and ignored runs', () => {
    expect(ruleBallLabel(4, 8)).toBe('4 × 2 = 8');
    expect(ruleBallLabel(4, 12)).toBe('4 × 3 = 12');
    expect(ruleBallLabel(4, 0)).toBe('4 (0 counted)');
    expect(ruleBallLabel(4, 2)).toBe('4 → 2');
  });
});
