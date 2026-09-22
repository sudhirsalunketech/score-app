import { describe, expect, it } from 'vitest';
import { undoRestoreState } from './undo-restore';

const undone = { strikerId: 'a', nonStrikerId: 'b', bowlerId: 'bowl1' };

describe('undoRestoreState', () => {
  it('puts the same batsman back after undoing a wicket', () => {
    const next = undoRestoreState({
      snapshot: {
        strikerId: 'a',
        nonStrikerId: 'b',
        bowlerId: 'bowl1',
        ballsInCurrentOver: 0,
        currentOver: 0,
        batters: [
          { playerId: 'a', isOut: false },
          { playerId: 'b', isOut: false },
        ],
      },
      undone: { ...undone, strikerId: 'a' },
    });
    expect(next.strikerId).toBe('a');
    expect(next.nonStrikerId).toBe('b');
    expect(next.dismissedIds).toEqual([]);
    expect(next.ballsInOver).toBe(0);
    expect(next.chooseBowler).toBe(false);
  });

  it('rewinds runs and the ball after undoing a six', () => {
    const next = undoRestoreState({
      snapshot: {
        strikerId: 'a',
        nonStrikerId: 'b',
        bowlerId: 'bowl1',
        ballsInCurrentOver: 2,
        currentOver: 0,
        batters: [{ playerId: 'a', isOut: false }],
      },
      undone,
    });
    expect(next.strikerId).toBe('a');
    expect(next.bowlerId).toBe('bowl1');
    expect(next.ballsInOver).toBe(2);
    expect(next.chooseBowler).toBe(false);
  });

  it('stays in the over after undoing the last legal ball', () => {
    const next = undoRestoreState({
      snapshot: {
        strikerId: 'b',
        nonStrikerId: 'a',
        bowlerId: 'bowl1',
        ballsInCurrentOver: 5,
        currentOver: 0,
      },
      undone: { strikerId: 'a', nonStrikerId: 'b', bowlerId: 'bowl1' },
    });
    expect(next.ballsInOver).toBe(5);
    expect(next.chooseBowler).toBe(false);
    expect(next.bowlerId).toBe('bowl1');
    expect(next.lastOverBowlerId).toBeNull();
  });

  it('keeps the new bowler after undoing the first ball of a new over', () => {
    const next = undoRestoreState({
      snapshot: {
        strikerId: 'b',
        nonStrikerId: 'a',
        bowlerId: 'bowl1',
        ballsInCurrentOver: 0,
        currentOver: 1,
      },
      undone: { strikerId: 'b', nonStrikerId: 'a', bowlerId: 'bowl2' },
    });
    expect(next.bowlerId).toBe('bowl2');
    expect(next.ballsInOver).toBe(0);
    expect(next.chooseBowler).toBe(false);
    expect(next.lastOverBowlerId).toBe('bowl1');
  });

  it('restores the original crease when every ball is undone', () => {
    const next = undoRestoreState({
      snapshot: {
        strikerId: null,
        nonStrikerId: null,
        bowlerId: null,
        ballsInCurrentOver: 0,
        currentOver: 0,
        batters: [],
      },
      undone,
    });
    expect(next.strikerId).toBe('a');
    expect(next.nonStrikerId).toBe('b');
    expect(next.bowlerId).toBe('bowl1');
    expect(next.ballsInOver).toBe(0);
  });
});
