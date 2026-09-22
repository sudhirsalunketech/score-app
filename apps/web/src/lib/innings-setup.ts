export type InningsPersonnel = {
  strikerId?: string | null;
  nonStrikerId?: string | null;
  bowlerId?: string | null;
};

export type StoredInningsPersonnel = {
  strikerId: string;
  nonStrikerId: string;
  bowlerId: string;
  confirmed: boolean;
};

export type PersonnelValidationKey =
  | 'personnelMissing'
  | 'personnelSameEnds'
  | 'personnelStrikerTeam'
  | 'personnelNonStrikerTeam'
  | 'personnelBowlerTeam';

const STORAGE_PREFIX = 'cs.inningsPersonnel.';

export function personnelStorageKey(matchId: string, inningsId: string) {
  return `${STORAGE_PREFIX}${matchId}.${inningsId}`;
}

export function validateInningsPersonnel(input: InningsPersonnel & {
  battingPlayerIds: Iterable<string>;
  bowlingPlayerIds: Iterable<string>;
  dismissedIds?: Iterable<string>;
}): PersonnelValidationKey | null {
  const { strikerId, nonStrikerId, bowlerId } = input;
  if (!strikerId || !nonStrikerId || !bowlerId) return 'personnelMissing';
  if (strikerId === nonStrikerId) return 'personnelSameEnds';
  const batting = new Set(input.battingPlayerIds);
  const bowling = new Set(input.bowlingPlayerIds);
  const dismissed = new Set(input.dismissedIds ?? []);
  if (!batting.has(strikerId) || dismissed.has(strikerId)) return 'personnelStrikerTeam';
  if (!batting.has(nonStrikerId) || dismissed.has(nonStrikerId)) return 'personnelNonStrikerTeam';
  if (!bowling.has(bowlerId)) return 'personnelBowlerTeam';
  return null;
}

export function suggestInningsPersonnel<T extends { id: string }>(
  batters: T[],
  bowlers: T[],
): StoredInningsPersonnel | null {
  const uniqueBat = uniqueById(batters);
  const uniqueBowl = uniqueById(bowlers);
  if (uniqueBat.length < 2 || uniqueBowl.length < 1) return null;
  const striker = uniqueBat[0]!;
  const nonStriker = uniqueBat[1]!;
  const bowler = uniqueBowl.find((p) => p.id !== striker.id && p.id !== nonStriker.id);
  if (!bowler) return null;
  return { strikerId: striker.id, nonStrikerId: nonStriker.id, bowlerId: bowler.id, confirmed: false };
}

export function readStoredPersonnel(matchId: string, inningsId: string): StoredInningsPersonnel | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(personnelStorageKey(matchId, inningsId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredInningsPersonnel>;
    if (!parsed.strikerId || !parsed.nonStrikerId || !parsed.bowlerId) return null;
    return {
      strikerId: parsed.strikerId,
      nonStrikerId: parsed.nonStrikerId,
      bowlerId: parsed.bowlerId,
      confirmed: Boolean(parsed.confirmed),
    };
  } catch {
    return null;
  }
}

export function writeStoredPersonnel(matchId: string, inningsId: string, value: StoredInningsPersonnel) {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(personnelStorageKey(matchId, inningsId), JSON.stringify(value));
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearStoredPersonnel(matchId: string, inningsId: string) {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(personnelStorageKey(matchId, inningsId));
  } catch {
    /* ignore */
  }
}

function uniqueById<T extends { id: string }>(rows: T[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}
