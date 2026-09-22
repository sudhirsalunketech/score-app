export type InningsStopReason = 'overs' | 'wickets' | 'target' | 'complete';

type LimitSnapshot = {
  isComplete: boolean;
  totalWickets: number;
  currentOver: number;
  totalRuns: number;
};

type LimitOptions = {
  maxOvers?: number;
  maxWickets?: number;
  targetRuns?: number | null;
};

export function inningsStopReason(snapshot: LimitSnapshot, options: LimitOptions): InningsStopReason | null {
  const maxOvers = options.maxOvers ?? 20;
  const maxWickets = options.maxWickets ?? 10;
  if (snapshot.totalWickets >= maxWickets) return 'wickets';
  if (snapshot.currentOver >= maxOvers) return 'overs';
  if (options.targetRuns != null && snapshot.totalRuns >= options.targetRuns) return 'target';
  if (snapshot.isComplete) return 'complete';
  return null;
}

export function deliveryBlockedMessage(
  snapshot: LimitSnapshot,
  options: LimitOptions,
  incoming?: { isWicket?: boolean; dismissalType?: string | null },
): string | null {
  const maxOvers = options.maxOvers ?? 20;
  const maxWickets = options.maxWickets ?? 10;
  const reason = inningsStopReason(snapshot, options);
  if (reason === 'overs') {
    return `This match is limited to ${maxOvers} overs. No additional overs can be added.`;
  }
  if (reason === 'wickets') {
    return 'The maximum number of wickets for this innings has been reached.';
  }
  if (reason === 'target') {
    return 'The target has been reached. No additional balls can be added.';
  }
  if (reason === 'complete') {
    return 'This innings is already complete. No additional balls can be added.';
  }
  if (incoming?.isWicket && incoming.dismissalType !== 'RETIRED_HURT' && snapshot.totalWickets >= maxWickets) {
    return 'The maximum number of wickets for this innings has been reached.';
  }
  return null;
}
