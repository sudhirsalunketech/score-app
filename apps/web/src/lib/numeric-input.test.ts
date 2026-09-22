import { describe, expect, it } from 'vitest';
import { sanitizeNumericInput } from './numeric-input';

describe('sanitizeNumericInput', () => {
  it('strips trailing non-numeric characters from a paste', () => {
    expect(sanitizeNumericInput('123abc')).toBe('123');
  });

  it('strips leading non-numeric characters from a paste', () => {
    expect(sanitizeNumericInput('abc123xyz')).toBe('123');
  });

  it('strips special characters interleaved with digits', () => {
    expect(sanitizeNumericInput('12@#34')).toBe('1234');
  });

  it('rejects a decimal point when decimal support is off', () => {
    expect(sanitizeNumericInput('12.5')).toBe('125');
  });

  it('keeps a single decimal point when decimal support is on', () => {
    expect(sanitizeNumericInput('12.5', { decimal: true })).toBe('12.5');
  });

  it('collapses multiple decimal points into one', () => {
    expect(sanitizeNumericInput('1.2.3.4', { decimal: true })).toBe('1.234');
  });

  it('leaves a trailing decimal point alone so typing can continue', () => {
    expect(sanitizeNumericInput('12.', { decimal: true })).toBe('12.');
  });

  it('strips a minus sign when negative values are not allowed', () => {
    expect(sanitizeNumericInput('-5')).toBe('5');
  });

  it('keeps a single leading minus sign when negative values are allowed', () => {
    expect(sanitizeNumericInput('-5', { allowNegative: true })).toBe('-5');
  });

  it('keeps a lone minus sign as a valid in-progress state when negative values are allowed', () => {
    expect(sanitizeNumericInput('-', { allowNegative: true })).toBe('-');
  });

  it('drops interior minus signs, keeping only a leading one', () => {
    expect(sanitizeNumericInput('1-2-3', { allowNegative: true })).toBe('123');
  });

  it('clamps a complete value above max down to max', () => {
    expect(sanitizeNumericInput('90', { max: 6 })).toBe('6');
  });

  it('clamps a complete value below min up to min', () => {
    expect(sanitizeNumericInput('0', { min: 1 })).toBe('1');
  });

  it('does not clamp an empty string so the field can be cleared', () => {
    expect(sanitizeNumericInput('', { min: 1, max: 10 })).toBe('');
  });

  it('does not clamp a lone minus sign mid-typing', () => {
    expect(sanitizeNumericInput('-', { allowNegative: true, min: -5, max: 5 })).toBe('-');
  });

  it('does not clamp a trailing decimal point mid-typing', () => {
    expect(sanitizeNumericInput('9.', { decimal: true, max: 6 })).toBe('9.');
  });

  it('passes through a value already within range unchanged', () => {
    expect(sanitizeNumericInput('4', { min: 0, max: 6 })).toBe('4');
  });
});
