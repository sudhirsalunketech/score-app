import { describe, expect, it } from 'vitest';
import { MAX_DELIVERY_RUNS, parseRunDigits } from './run-input';

describe('parseRunDigits', () => {
  it('keeps digits only', () => {
    expect(parseRunDigits('12')).toEqual({ text: '12', value: 12 });
    expect(parseRunDigits('1a2b')).toEqual({ text: '12', value: 12 });
    expect(parseRunDigits('8.5')).toEqual({ text: '8', value: 8 });
    expect(parseRunDigits('+7')).toEqual({ text: '7', value: 7 });
    expect(parseRunDigits('abc')).toEqual({ text: '', value: null });
    expect(parseRunDigits('')).toEqual({ text: '', value: null });
  });

  it('allows 0 and clamps above the scoring limit', () => {
    expect(parseRunDigits('0')).toEqual({ text: '0', value: 0 });
    expect(parseRunDigits('13')).toEqual({ text: '13', value: 13 });
    expect(parseRunDigits('14')).toEqual({ text: '13', value: 13 });
    expect(parseRunDigits('99')).toEqual({ text: String(MAX_DELIVERY_RUNS), value: MAX_DELIVERY_RUNS });
  });
});
