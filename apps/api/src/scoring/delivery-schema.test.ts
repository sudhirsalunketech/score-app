import { describe, expect, it } from 'vitest';
import { deliverySchema } from './scoring.service';

const base = {
  idempotencyKey: 'idem-key-1',
  strikerId: 's1',
  nonStrikerId: 's2',
  bowlerId: 'b1',
  batsmanRuns: 0,
};

describe('deliverySchema penalty reason', () => {
  it('rejects a penalty delivery with no reason', () => {
    const result = deliverySchema.safeParse({ ...base, extraType: 'PENALTY', extraRuns: 5 });
    expect(result.success).toBe(false);
  });

  it('accepts a penalty delivery with a valid reason', () => {
    const result = deliverySchema.safeParse({
      ...base,
      extraType: 'PENALTY',
      extraRuns: 5,
      penaltyReason: 'TOURNAMENT_PENALTY',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an unknown penalty reason', () => {
    const result = deliverySchema.safeParse({
      ...base,
      extraType: 'PENALTY',
      extraRuns: 5,
      penaltyReason: 'MADE_UP_REASON',
    });
    expect(result.success).toBe(false);
  });

  it('does not require a reason for non-penalty deliveries', () => {
    const result = deliverySchema.safeParse({ ...base, extraType: 'WIDE', extraRuns: 1 });
    expect(result.success).toBe(true);
  });

  it('does not require a reason when extraType is omitted', () => {
    const result = deliverySchema.safeParse({ ...base, batsmanRuns: 4 });
    expect(result.success).toBe(true);
  });
});
