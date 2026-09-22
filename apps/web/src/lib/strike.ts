import type { ExtraType } from '@/types/api';

export function nextStrike(input: {
  strikerId: string;
  nonStrikerId: string;
  batsmanRuns: number;
  extraType: ExtraType;
  extraRuns?: number;
  ballsInCurrentOver: number;
  ballsPerOver: number;
}): { strikerId: string; nonStrikerId: string } {
  let strikerId = input.strikerId;
  let nonStrikerId = input.nonStrikerId;
  const extra = input.extraType;
  const extraRuns = input.extraRuns ?? (extra === 'WIDE' || extra === 'NO_BALL' ? 1 : 0);
  const rotateRuns =
    extra === 'BYE' || extra === 'LEG_BYE'
      ? extraRuns
      : extra === 'WIDE'
        ? Math.max(0, extraRuns - 1)
        : extra === 'NONE' || extra === 'NO_BALL'
          ? input.batsmanRuns
          : 0;
  if (rotateRuns % 2 === 1) {
    const tmp = strikerId;
    strikerId = nonStrikerId;
    nonStrikerId = tmp;
  }
  const legal = extra !== 'WIDE' && extra !== 'NO_BALL' && extra !== 'PENALTY';
  if (legal && input.ballsInCurrentOver + 1 >= input.ballsPerOver) {
    const tmp = strikerId;
    strikerId = nonStrikerId;
    nonStrikerId = tmp;
  }
  return { strikerId, nonStrikerId };
}
