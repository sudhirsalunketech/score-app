export type UndoSnapshot = {
  strikerId?: string | null;
  nonStrikerId?: string | null;
  bowlerId?: string | null;
  ballsInCurrentOver: number;
  currentOver: number;
  isComplete?: boolean;
  batters?: Array<{ playerId: string; isOut?: boolean }>;
};

export type UndoneDelivery = {
  strikerId: string;
  nonStrikerId: string;
  bowlerId: string;
};

export type UndoRestoreState = {
  strikerId: string;
  nonStrikerId: string;
  bowlerId: string;
  ballsInOver: number;
  chooseBowler: boolean;
  lastOverBowlerId: string | null;
  dismissedIds: string[];
};

/** Restore crease, over progress, and dismissals after the last ball is undone. */
export function undoRestoreState(input: {
  snapshot: UndoSnapshot | null | undefined;
  undone: UndoneDelivery;
}): UndoRestoreState {
  const snap = input.snapshot;
  const balls = snap?.ballsInCurrentOver ?? 0;
  const currentOver = snap?.currentOver ?? 0;
  const atNewOver = balls === 0 && currentOver > 0 && !snap?.isComplete;
  const strikerId = snap?.strikerId || input.undone.strikerId;
  const nonStrikerId = snap?.nonStrikerId || input.undone.nonStrikerId;
  const bowlerId = atNewOver ? input.undone.bowlerId : snap?.bowlerId || input.undone.bowlerId;
  const previousBowler = snap?.bowlerId ?? null;
  return {
    strikerId,
    nonStrikerId,
    bowlerId,
    ballsInOver: balls,
    chooseBowler: false,
    lastOverBowlerId: atNewOver && previousBowler && previousBowler !== bowlerId ? previousBowler : null,
    dismissedIds: (snap?.batters ?? []).filter((b) => b.isOut).map((b) => b.playerId),
  };
}
