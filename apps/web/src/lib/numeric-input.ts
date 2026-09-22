export type NumericInputOptions = {
  decimal?: boolean;
  allowNegative?: boolean;
  min?: number;
  max?: number;
};

/**
 * Strips a raw (typed or pasted) string down to a valid numeric-input value:
 * digits only by default, a single decimal point when `decimal` is set, and a
 * single leading `-` only when `allowNegative` is set. Clamps to `min`/`max`
 * once the string is a complete number, but leaves transitional states like
 * '', '-', or a trailing '.' alone so the field stays typeable.
 */
export function sanitizeNumericInput(raw: string, opts: NumericInputOptions = {}): string {
  const { decimal = false, allowNegative = false, min, max } = opts;
  const negative = allowNegative && /^\s*-/.test(raw);
  let digits = raw.replace(/[^0-9.]/g, '');
  if (decimal) {
    const dot = digits.indexOf('.');
    if (dot !== -1) digits = digits.slice(0, dot + 1) + digits.slice(dot + 1).replace(/\./g, '');
  } else {
    digits = digits.replace(/\./g, '');
  }
  let result = (negative ? '-' : '') + digits;
  if ((min !== undefined || max !== undefined) && result !== '' && result !== '-' && !result.endsWith('.')) {
    const n = Number(result);
    if (Number.isFinite(n)) {
      const clamped = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
      if (clamped !== n) result = String(clamped);
    }
  }
  return result;
}
