export type MappingKind = 'RUN' | 'WICKET' | 'OTHER';
export type MappingRow = { kind: MappingKind; count: string; value: string };

function isMappingKind(v: unknown): v is MappingKind {
  return v === 'RUN' || v === 'WICKET' || v === 'OTHER';
}

export function mappingToRows(mapping: unknown): MappingRow[] {
  const list = Array.isArray(mapping) ? mapping : [];
  if (!list.length) return [{ kind: 'RUN', count: '', value: '' }];
  return list.map((row) => {
    const r = (row ?? {}) as Record<string, unknown>;
    return {
      kind: isMappingKind(r.kind) ? r.kind : 'RUN',
      count: r.count != null ? String(r.count) : '',
      value: r.value != null ? String(r.value) : '',
    };
  });
}

export function rowsToMapping(rows: MappingRow[]): Array<{ kind: MappingKind; count: number; value: number }> {
  const out: Array<{ kind: MappingKind; count: number; value: number }> = [];
  for (const row of rows) {
    const value = Number(row.value);
    if (!Number.isFinite(value) || value <= 0) continue;
    if (row.kind === 'OTHER') {
      out.push({ kind: 'OTHER', count: 0, value: Math.trunc(value) });
      continue;
    }
    const count = row.count.trim();
    const countNum = Number(count);
    if (!count || !Number.isFinite(countNum) || countNum < 0) continue;
    out.push({ kind: row.kind, count: Math.trunc(countNum), value: Math.trunc(value) });
  }
  return out;
}
