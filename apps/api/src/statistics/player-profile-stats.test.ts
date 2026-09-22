import { describe, expect, it } from 'vitest';
import { replayInnings, type ScoringEvent } from '@crickscore/shared';
import {
  addBatterInnings,
  addBowlerSpell,
  countRunBucket,
  emptyBuckets,
  emptySlice,
  presentSlice,
} from './player-profile-stats';

function ball(partial: Partial<ScoringEvent> & Pick<ScoringEvent, 'sequence'>): ScoringEvent {
  return {
    overNumber: 0,
    ballInOver: partial.sequence,
    strikerId: 'p1',
    nonStrikerId: 'p2',
    bowlerId: 'b1',
    batsmanRuns: 0,
    extraRuns: 0,
    extraType: 'NONE',
    isWicket: false,
    ...partial,
  };
}

function statsFromReplay(events: ScoringEvent[], playerId: string) {
  const snap = replayInnings(events, { ballsPerOver: 6, maxOvers: 5, maxWickets: 10 });
  const slice = emptySlice();
  const batter = snap.batters.find((row) => row.playerId === playerId);
  const bowler = snap.bowlers.find((row) => row.playerId === playerId);
  if (batter) addBatterInnings(slice, batter);
  if (bowler) addBowlerSpell(slice, bowler);
  return presentSlice(slice);
}

describe('player profile stats', () => {
  it('counts a real batting innings without inventing milestones', () => {
    const slice = emptySlice();
    addBatterInnings(slice, { runs: 12, balls: 10, fours: 1, sixes: 0, isOut: true });
    const view = presentSlice(slice);
    expect(view.runs).toBe(12);
    expect(view.thirties).toBe(0);
    expect(view.fifties).toBe(0);
    expect(view.average).toBe(12);
    expect(view.sr).toBe(120);
  });

  it('records bowling figures and best spell from actual wickets', () => {
    const slice = emptySlice();
    addBowlerSpell(slice, { balls: 12, runs: 8, wickets: 2, maidens: 0, dots: 6 });
    const view = presentSlice(slice);
    expect(view.wickets).toBe(2);
    expect(view.best).toBe('2-8');
    expect(view.threeW).toBe(0);
  });

  it('buckets only faced-ball run values that occurred', () => {
    const buckets = emptyBuckets();
    countRunBucket(buckets, 0);
    countRunBucket(buckets, 1);
    countRunBucket(buckets, 4);
    expect(buckets).toEqual({ 0: 1, 1: 1, 2: 0, 3: 0, 4: 1, 6: 0 });
  });

  it('recalculates player statistics from replay after an undo', () => {
    const scored: ScoringEvent[] = [
      ball({ sequence: 1, batsmanRuns: 4 }),
      ball({ sequence: 2, batsmanRuns: 6, isWicket: true, dismissalType: 'BOWLED', dismissedPlayerId: 'p1' }),
    ];
    const before = statsFromReplay(scored, 'p1');
    expect(before.runs).toBe(10);
    const undone = scored.map((event, index) => (index === 1 ? { ...event, isUndone: true } : event));
    const after = statsFromReplay(undone, 'p1');
    expect(after.runs).toBe(4);
    expect(after.runs).toBeLessThan(before.runs);
  });
});
