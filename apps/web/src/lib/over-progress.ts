export function isLegalDelivery(extraType?: string | null) {
  return extraType !== 'WIDE' && extraType !== 'NO_BALL' && extraType !== 'PENALTY';
}

export function legalBallsInOver(
  events: Array<{ isUndone?: boolean; overNumber: number; extraType?: string | null }>,
  overNumber: number,
) {
  return events.filter(
    (e) => !e.isUndone && e.overNumber === overNumber && isLegalDelivery(e.extraType ?? 'NONE'),
  ).length;
}

/** Legal balls already in the current over — prefer events so a lagging snapshot cannot mark the over complete early. */
export function ballsFacedThisOver(opts: {
  events: Array<{ isUndone?: boolean; overNumber: number; extraType?: string | null }>;
  currentOver: number;
  snapshotBallsInOver: number;
  localBallsInOver: number | null;
  chooseBowler: boolean;
}) {
  if (opts.chooseBowler) return 0;
  const hasEventsForOver = opts.events.some((e) => !e.isUndone && e.overNumber === opts.currentOver);
  if (hasEventsForOver) return legalBallsInOver(opts.events, opts.currentOver);
  return opts.localBallsInOver ?? opts.snapshotBallsInOver;
}

/** Keep local over progress from being pulled backward onto a completed over. */
export function nextLocalBallsInOver(opts: {
  current: number | null;
  snapshotBallsInOver: number;
  lastOverBowlerId: string | null;
}) {
  const { current, snapshotBallsInOver, lastOverBowlerId } = opts;
  if (lastOverBowlerId && (current ?? 0) === 0 && snapshotBallsInOver !== 0) return 0;
  if (current != null && current > snapshotBallsInOver) return current;
  return snapshotBallsInOver;
}

export function recentOverNumber(opts: {
  currentOver: number;
  ballsInCurrentOver: number;
  chooseBowler: boolean;
}) {
  if (opts.chooseBowler || (opts.ballsInCurrentOver === 0 && opts.currentOver > 0)) {
    return Math.max(0, opts.currentOver - 1);
  }
  return opts.currentOver;
}
