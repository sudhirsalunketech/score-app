import { describe, expect, it } from 'vitest';
import { deliveryPersonnelError } from './delivery-personnel';

describe('deliveryPersonnelError', () => {
  it('rejects first-innings batsmen after the sides swap', () => {
    expect(
      deliveryPersonnelError({
        strikerId: 'alpha-1',
        nonStrikerId: 'alpha-2',
        bowlerId: 'alpha-3',
        battingPlayerIds: ['beta-1', 'beta-2'],
        bowlingPlayerIds: ['alpha-1', 'alpha-2', 'alpha-3'],
      }),
    ).toBe('Batsmen must belong to the batting team.');
  });

  it('rejects the same player as striker and non-striker', () => {
    expect(
      deliveryPersonnelError({
        strikerId: 'beta-1',
        nonStrikerId: 'beta-1',
        bowlerId: 'alpha-1',
        battingPlayerIds: ['beta-1', 'beta-2'],
        bowlingPlayerIds: ['alpha-1', 'alpha-2'],
      }),
    ).toBe('Striker and non-striker must be different players.');
  });

  it('accepts personnel from the current batting and bowling sides', () => {
    expect(
      deliveryPersonnelError({
        strikerId: 'beta-1',
        nonStrikerId: 'beta-2',
        bowlerId: 'alpha-1',
        battingPlayerIds: ['beta-1', 'beta-2'],
        bowlingPlayerIds: ['alpha-1', 'alpha-2'],
      }),
    ).toBeNull();
  });
});
