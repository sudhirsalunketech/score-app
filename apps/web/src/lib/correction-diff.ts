export type CorrectionFieldTone = 'added' | 'removed' | 'changed';

export type CorrectionFieldChange = {
  field: string;
  before: unknown;
  after: unknown;
  tone: CorrectionFieldTone;
};

export const PLAYER_ID_FIELDS = new Set(['strikerId', 'nonStrikerId', 'bowlerId', 'fielderId', 'dismissedPlayerId']);

const FIELD_ORDER = [
  'batsmanRuns',
  'extraType',
  'extraRuns',
  'isWicket',
  'dismissalType',
  'strikerId',
  'nonStrikerId',
  'bowlerId',
  'fielderId',
  'dismissedPlayerId',
  'penaltyReason',
];

function isEmptyValue(value: unknown) {
  return value === null || value === undefined || value === '';
}

/**
 * `before`/`after` snapshots vary in shape by action (delete only sets `before`,
 * insert only sets `after`, correction sets both but as a partial field subset) —
 * missing keys and `null`/`undefined` are treated as the same "no value" state so
 * a field absent from one side doesn't falsely register as a change.
 */
export function diffCorrectionFields(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
): CorrectionFieldChange[] {
  const b = before ?? {};
  const a = after ?? {};
  const keys = new Set([...Object.keys(b), ...Object.keys(a)]);
  const known = FIELD_ORDER.filter((k) => keys.has(k));
  const unknown = [...keys].filter((k) => !FIELD_ORDER.includes(k)).sort();
  const changes: CorrectionFieldChange[] = [];
  for (const field of [...known, ...unknown]) {
    const beforeVal = b[field] ?? null;
    const afterVal = a[field] ?? null;
    if (JSON.stringify(beforeVal) === JSON.stringify(afterVal)) continue;
    const tone: CorrectionFieldTone = isEmptyValue(beforeVal) && !isEmptyValue(afterVal)
      ? 'added'
      : !isEmptyValue(beforeVal) && isEmptyValue(afterVal)
        ? 'removed'
        : 'changed';
    changes.push({ field, before: beforeVal, after: afterVal, tone });
  }
  return changes;
}
