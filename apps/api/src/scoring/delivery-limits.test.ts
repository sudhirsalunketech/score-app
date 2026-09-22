import { describe, expect, it } from 'vitest';
import { deliveryBlockedMessage } from '@crickscore/shared';

describe('scoring delivery limits (API contract)', () => {
  it('exposes the over-limit message the scorer API must return', () => {
    expect(
      deliveryBlockedMessage(
        { isComplete: true, totalWickets: 1, currentOver: 5, totalRuns: 32 },
        { maxOvers: 5, maxWickets: 7 },
      ),
    ).toBe('This match is limited to 5 overs. No additional overs can be added.');
  });

  it('exposes the wicket-limit message the scorer API must return', () => {
    expect(
      deliveryBlockedMessage(
        { isComplete: true, totalWickets: 7, currentOver: 2, totalRuns: 12 },
        { maxOvers: 5, maxWickets: 7 },
        { isWicket: true, dismissalType: 'CAUGHT' },
      ),
    ).toBe('The maximum number of wickets for this innings has been reached.');
  });
});
