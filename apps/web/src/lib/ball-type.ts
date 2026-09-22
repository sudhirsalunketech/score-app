import type { BallType } from '@/types/api';

export const BALL_TYPES = ['LEATHER', 'TENNIS', 'RUBBER'] as const satisfies readonly BallType[];

export function matchBallLabelKey(type: BallType): 'match.leather' | 'match.tennis' | 'match.rubber' {
  if (type === 'LEATHER') return 'match.leather';
  if (type === 'RUBBER') return 'match.rubber';
  return 'match.tennis';
}

export function clubBallLabelKey(type: BallType): 'clubs.leatherBall' | 'clubs.tennisBall' | 'clubs.rubberBall' {
  if (type === 'LEATHER') return 'clubs.leatherBall';
  if (type === 'RUBBER') return 'clubs.rubberBall';
  return 'clubs.tennisBall';
}

export function isLeatherBall(type: BallType) {
  return type === 'LEATHER';
}
