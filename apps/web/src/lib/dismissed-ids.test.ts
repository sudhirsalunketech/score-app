import { describe, expect, it } from 'vitest';
import { dismissedIdsFromSnapshot } from './dismissed-ids';

describe('dismissedIdsFromSnapshot', () => {
  it('keeps unrelated dismissals after undo of a non-wicket', () => {
    const next = dismissedIdsFromSnapshot(
      [
        { playerId: 'a', isOut: true },
        { playerId: 'b', isOut: false },
      ],
      ['a', 'b'],
    );
    expect(next).toEqual(['a']);
  });

  it('does not clear every id when snapshot has outs', () => {
    expect(dismissedIdsFromSnapshot([{ playerId: 'a', isOut: true }], [])).toEqual(['a']);
  });
});
