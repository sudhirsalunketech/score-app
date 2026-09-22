export const KNOCKOUT_ROUNDS = ['ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'THIRD_PLACE', 'FINAL'] as const;
export type KnockoutRound = (typeof KNOCKOUT_ROUNDS)[number];

export const TOURNAMENT_STAGE_TYPES = ['GROUP_STAGE', 'KNOCKOUT', 'GROUP_AND_KNOCKOUT'] as const;
export type TournamentStageType = (typeof TOURNAMENT_STAGE_TYPES)[number];

export type KnockoutPairing = 'SEEDED' | 'ADJACENT' | 'MANUAL';

export type KnockoutSlotPlan = {
  key: string;
  round: KnockoutRound;
  slot: number;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeSourceKey: string | null;
  awaySourceKey: string | null;
  feedsIntoKey: string | null;
  feedsIntoSide: 'HOME' | 'AWAY' | null;
  title: string;
};

const ROUND_LABEL: Record<KnockoutRound, string> = {
  ROUND_OF_16: 'Round of 16',
  QUARTER_FINAL: 'Quarter Final',
  SEMI_FINAL: 'Semi Final',
  THIRD_PLACE: 'Third Place',
  FINAL: 'Final',
};

export function knockoutRoundLabel(round: KnockoutRound) {
  return ROUND_LABEL[round];
}

export function nextPowerOfTwo(n: number) {
  let p = 2;
  while (p < n) p *= 2;
  return p;
}

export function openingRoundFor(teamCount: number): KnockoutRound {
  const size = nextPowerOfTwo(teamCount);
  if (size <= 2) return 'FINAL';
  if (size <= 4) return 'SEMI_FINAL';
  if (size <= 8) return 'QUARTER_FINAL';
  return 'ROUND_OF_16';
}

export function nextKnockoutRound(round: KnockoutRound): KnockoutRound | null {
  if (round === 'ROUND_OF_16') return 'QUARTER_FINAL';
  if (round === 'QUARTER_FINAL') return 'SEMI_FINAL';
  if (round === 'SEMI_FINAL') return 'FINAL';
  return null;
}

/** Standard seeded pairs (1vN, 4v5, 2vN-1, …) using 0-based seed indexes. */
export function seededPairs(count: number): Array<[number, number]> {
  const size = nextPowerOfTwo(count);
  const seeds = [0];
  while (seeds.length < size) {
    const next: number[] = [];
    const sum = seeds.length * 2 - 1;
    for (const seed of seeds) next.push(seed, sum - seed);
    seeds.splice(0, seeds.length, ...next);
  }
  const pairs: Array<[number, number]> = [];
  for (let i = 0; i < seeds.length; i += 2) pairs.push([seeds[i]!, seeds[i + 1]!]);
  return pairs;
}

export function adjacentPairs(count: number): Array<[number, number]> {
  const size = nextPowerOfTwo(count);
  const pairs: Array<[number, number]> = [];
  for (let i = 0; i < size; i += 2) pairs.push([i, i + 1]);
  return pairs;
}

export function buildKnockoutPlan(input: {
  teamIds: string[];
  pairing?: KnockoutPairing;
  includeThirdPlace?: boolean;
  manualPairs?: Array<[string, string]>;
}): KnockoutSlotPlan[] {
  const teamIds = input.teamIds.filter(Boolean);
  if (teamIds.length < 2) throw new Error('At least two teams are required for knockout.');
  if (teamIds.length > 16) throw new Error('Knockout supports at most 16 teams.');
  const unique = new Set(teamIds);
  if (unique.size !== teamIds.length) throw new Error('Duplicate teams cannot enter the same knockout.');

  const size = nextPowerOfTwo(teamIds.length);
  const padded = [...teamIds];
  while (padded.length < size) padded.push('');

  let pairs: Array<[string, string]>;
  if (input.pairing === 'MANUAL' && input.manualPairs?.length) {
    if (input.manualPairs.length !== size / 2) throw new Error('Manual pairing count must match the opening round.');
    pairs = input.manualPairs;
  } else {
    const indexes = input.pairing === 'ADJACENT' ? adjacentPairs(size) : seededPairs(size);
    pairs = indexes.map(([a, b]) => [padded[a] || '', padded[b] || '']);
  }

  const opening = openingRoundFor(size);
  const slots: KnockoutSlotPlan[] = [];
  const byKey = new Map<string, KnockoutSlotPlan>();

  const add = (slot: KnockoutSlotPlan) => {
    slots.push(slot);
    byKey.set(slot.key, slot);
  };

  pairs.forEach(([home, away], i) => {
    const slot = i + 1;
    const key = `${opening}-${slot}`;
    add({
      key,
      round: opening,
      slot,
      homeTeamId: home || null,
      awayTeamId: away || null,
      homeSourceKey: null,
      awaySourceKey: null,
      feedsIntoKey: null,
      feedsIntoSide: null,
      title: `${ROUND_LABEL[opening]} ${slot}`,
    });
  });

  let current = opening;
  while (current !== 'FINAL') {
    const nxt = nextKnockoutRound(current);
    if (!nxt) break;
    const prev = slots.filter((s) => s.round === current);
    const nextCount = prev.length / 2;
    for (let i = 0; i < nextCount; i += 1) {
      const a = prev[i * 2]!;
      const b = prev[i * 2 + 1]!;
      const key = `${nxt}-${i + 1}`;
      add({
        key,
        round: nxt,
        slot: i + 1,
        homeTeamId: null,
        awayTeamId: null,
        homeSourceKey: a.key,
        awaySourceKey: b.key,
        feedsIntoKey: null,
        feedsIntoSide: null,
        title: nxt === 'FINAL' ? 'Final' : `${ROUND_LABEL[nxt]} ${i + 1}`,
      });
      a.feedsIntoKey = key;
      a.feedsIntoSide = 'HOME';
      b.feedsIntoKey = key;
      b.feedsIntoSide = 'AWAY';
    }
    current = nxt;
  }

  if (input.includeThirdPlace) {
    const semis = slots.filter((s) => s.round === 'SEMI_FINAL');
    if (semis.length === 2) {
      add({
        key: 'THIRD_PLACE-1',
        round: 'THIRD_PLACE',
        slot: 1,
        homeTeamId: null,
        awayTeamId: null,
        homeSourceKey: semis[0]!.key,
        awaySourceKey: semis[1]!.key,
        feedsIntoKey: null,
        feedsIntoSide: null,
        title: 'Third Place',
      });
    }
  }

  return slots;
}

export function groupKnockoutSlots<T extends { knockoutRound?: KnockoutRound | null; knockoutSlot?: number | null }>(
  matches: T[],
) {
  const order: KnockoutRound[] = ['ROUND_OF_16', 'QUARTER_FINAL', 'SEMI_FINAL', 'THIRD_PLACE', 'FINAL'];
  return order
    .map((round) => ({
      round,
      label: ROUND_LABEL[round],
      matches: matches
        .filter((m) => m.knockoutRound === round)
        .sort((a, b) => (a.knockoutSlot ?? 0) - (b.knockoutSlot ?? 0)),
    }))
    .filter((row) => row.matches.length > 0);
}
