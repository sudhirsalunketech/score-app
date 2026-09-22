import { describe, expect, it } from 'vitest';
import { correctionSchema, deleteBallSchema, insertBallSchema } from './scoring.service';

describe('correctionSchema', () => {
  it('requires a reason of at least 3 characters', () => {
    expect(correctionSchema.safeParse({ batsmanRuns: 4, reason: 'ab' }).success).toBe(false);
    expect(correctionSchema.safeParse({ batsmanRuns: 4, reason: '' }).success).toBe(false);
    expect(correctionSchema.safeParse({ batsmanRuns: 4, reason: 'fixed' }).success).toBe(true);
  });

  it('allows every field to be omitted except reason, so only changed fields need to be sent', () => {
    expect(correctionSchema.safeParse({ reason: 'no-op correction' }).success).toBe(true);
  });

  it('requires a dismissal type when marking a wicket', () => {
    expect(correctionSchema.safeParse({ isWicket: true, reason: 'add missed wicket' }).success).toBe(false);
    expect(
      correctionSchema.safeParse({ isWicket: true, dismissalType: 'BOWLED', reason: 'add missed wicket' }).success,
    ).toBe(true);
  });

  it('allows explicitly clearing a wicket by setting isWicket false, dismissalType null', () => {
    const result = correctionSchema.safeParse({
      isWicket: false,
      dismissalType: null,
      dismissedPlayerId: null,
      reason: 'this was not actually a wicket',
    });
    expect(result.success).toBe(true);
  });
});

describe('insertBallSchema', () => {
  const base = {
    afterEventId: null,
    strikerId: 's1',
    nonStrikerId: 's2',
    bowlerId: 'b1',
    batsmanRuns: 4,
    reason: 'scorer missed this ball entirely',
  };

  it('accepts a well-formed insert at the start of the innings', () => {
    expect(insertBallSchema.safeParse(base).success).toBe(true);
  });

  it('accepts inserting after a specific existing ball', () => {
    expect(insertBallSchema.safeParse({ ...base, afterEventId: 'evt_123' }).success).toBe(true);
  });

  it('accepts a wicket ball with a dismissal type', () => {
    expect(insertBallSchema.safeParse({ ...base, isWicket: true, dismissalType: 'BOWLED' }).success).toBe(true);
  });

  it('requires a correction reason', () => {
    const { reason, ...withoutReason } = base;
    expect(insertBallSchema.safeParse(withoutReason).success).toBe(false);
  });
});

describe('deleteBallSchema', () => {
  it('requires a reason of at least 3 characters', () => {
    expect(deleteBallSchema.safeParse({ reason: 'no' }).success).toBe(false);
    expect(deleteBallSchema.safeParse({ reason: 'duplicate ball entry' }).success).toBe(true);
  });
});
