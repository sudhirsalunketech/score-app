export function ruleBallLabel(actual: number, counted: number): string | null {
  if (actual === counted) return null;
  if (counted === 0) return `${actual} (0 counted)`;
  if (actual > 0 && counted === actual * 2) return `${actual} × 2 = ${counted}`;
  if (actual > 0 && counted === actual * 3) return `${actual} × 3 = ${counted}`;
  return `${actual} → ${counted}`;
}

export function ruleBySequence(
  items?: Array<{ sequence: number; actual?: number; originalRuns?: number; counted?: number; countedRuns?: number; reason?: string }> | null,
): Map<number, { label: string; reason?: string }> {
  const map = new Map<number, { label: string; reason?: string }>();
  for (const item of items ?? []) {
    const actual = item.actual ?? item.originalRuns ?? 0;
    const counted = item.counted ?? item.countedRuns ?? actual;
    const label = ruleBallLabel(actual, counted);
    if (label) map.set(item.sequence, { label, reason: item.reason });
  }
  return map;
}

