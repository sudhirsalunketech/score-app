import { describe, expect, it } from 'vitest';
import { ballsFacedThisOver, nextLocalBallsInOver, recentOverNumber } from './over-progress';

describe('ballsFacedThisOver', () => {
  it('uses events for the current over so a stale 5-ball snapshot cannot complete the next over early', () => {
    expect(
      ballsFacedThisOver({
        events: [],
        currentOver: 2,
        snapshotBallsInOver: 5,
        localBallsInOver: 5,
        chooseBowler: false,
      }),
    ).toBe(5);

    expect(
      ballsFacedThisOver({
        events: [{ overNumber: 2, extraType: 'NONE', isUndone: false }],
        currentOver: 2,
        snapshotBallsInOver: 5,
        localBallsInOver: 5,
        chooseBowler: false,
      }),
    ).toBe(1);
  });

  it('is 0 while choosing the next bowler', () => {
    expect(
      ballsFacedThisOver({
        events: [{ overNumber: 1, extraType: 'NONE' }],
        currentOver: 2,
        snapshotBallsInOver: 5,
        localBallsInOver: 0,
        chooseBowler: true,
      }),
    ).toBe(0);
  });
});

describe('nextLocalBallsInOver', () => {
  it('does not restore 5 balls from a lagging snapshot after an over has ended', () => {
    expect(
      nextLocalBallsInOver({
        current: 0,
        snapshotBallsInOver: 5,
        lastOverBowlerId: 'bowler-a',
      }),
    ).toBe(0);
  });

  it('does not rewind local progress if the snapshot is behind', () => {
    expect(
      nextLocalBallsInOver({
        current: 3,
        snapshotBallsInOver: 1,
        lastOverBowlerId: null,
      }),
    ).toBe(3);
  });
});

describe('recentOverNumber', () => {
  it('shows the completed over after the 6th legal ball, and the in-progress over otherwise', () => {
    expect(recentOverNumber({ currentOver: 3, ballsInCurrentOver: 0, chooseBowler: true })).toBe(2);
    expect(recentOverNumber({ currentOver: 2, ballsInCurrentOver: 1, chooseBowler: false })).toBe(2);
  });
});
