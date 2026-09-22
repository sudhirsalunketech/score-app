/** Delivery run cap from the scoring API (`batsmanRuns` / `extraRuns` 0–13). */
export const MAX_DELIVERY_RUNS = 13;

export function parseRunDigits(raw: string, max = MAX_DELIVERY_RUNS): { text: string; value: number | null } {
  const integerPart = raw.split(/[.,]/)[0] ?? '';
  const digits = integerPart.replace(/\D/g, '');
  if (!digits) return { text: '', value: null };
  const n = Number(digits);
  if (!Number.isFinite(n)) return { text: '', value: null };
  if (n > max) return { text: String(max), value: max };
  return { text: String(n), value: n };
}
