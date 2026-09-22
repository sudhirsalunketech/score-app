import type { DismissalType, ExtraType } from '@/types/api';

export type WicketByeKind = 'BYE' | 'LEG_BYE';
export type WicketIllegal = 'NO_BALL' | 'WIDE';

export type WicketFollowKind =
  | 'immediate'
  | 'extrasPad'
  | 'caught'
  | 'stumped'
  | 'hitWicket'
  | 'hitBallTwice'
  | 'timedOut'
  | 'retired'
  | 'runOut'
  | 'obstructing';

export function wicketFollowKind(type: DismissalType): WicketFollowKind {
  switch (type) {
    case 'CAUGHT':
      return 'caught';
    case 'STUMPED':
      return 'stumped';
    case 'HIT_WICKET':
      return 'hitWicket';
    case 'HIT_BALL_TWICE':
      return 'hitBallTwice';
    case 'TIMED_OUT':
      return 'timedOut';
    case 'RETIRED_OUT':
      return 'retired';
    case 'RUN_OUT':
      return 'runOut';
    case 'OBSTRUCTING':
      return 'obstructing';
    case 'OVER_THE_FENCE':
      return 'extrasPad';
    default:
      return 'immediate';
  }
}

export function wicketFormDelivery(input: {
  completedRuns: number | null;
  byeKind: WicketByeKind | null;
  illegal: WicketIllegal | null;
}): { batsmanRuns: number; extraType?: ExtraType; extraRuns?: number } {
  const runs = input.completedRuns ?? 0;
  if (input.illegal === 'WIDE') {
    return { batsmanRuns: 0, extraType: 'WIDE', extraRuns: 1 + runs };
  }
  if (input.illegal === 'NO_BALL') {
    if (input.byeKind) {
      return { batsmanRuns: 0, extraType: 'NO_BALL', extraRuns: 1 + runs };
    }
    return { batsmanRuns: runs, extraType: 'NO_BALL', extraRuns: 1 };
  }
  if (input.byeKind) {
    return { batsmanRuns: 0, extraType: input.byeKind, extraRuns: runs };
  }
  return { batsmanRuns: runs };
}
