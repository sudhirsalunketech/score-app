import { MatchStatus } from '@prisma/client';
import { Errors } from '../common/app-error';

const DELAY: MatchStatus[] = [MatchStatus.DRINKS_BREAK, MatchStatus.RAIN_DELAY, MatchStatus.MATCH_DELAY];

const ALLOWED: Record<MatchStatus, MatchStatus[]> = {
  DRAFT: ['SCHEDULED', 'TOSS_PENDING', 'CANCELLED'],
  SCHEDULED: ['TOSS_PENDING', 'CANCELLED', 'ABANDONED'],
  TOSS_PENDING: ['TOSS_COMPLETED', 'CANCELLED', 'ABANDONED'],
  TOSS_COMPLETED: ['LIVE', 'CANCELLED', 'ABANDONED'],
  LIVE: ['INNINGS_BREAK', 'SUPER_OVER_PENDING', 'COMPLETED', 'ABANDONED', 'CANCELLED', ...DELAY],
  INNINGS_BREAK: ['LIVE', 'COMPLETED', 'ABANDONED', 'CANCELLED', MatchStatus.RAIN_DELAY, MatchStatus.MATCH_DELAY],
  DRINKS_BREAK: ['LIVE', 'INNINGS_BREAK', 'COMPLETED', 'ABANDONED', 'CANCELLED', MatchStatus.RAIN_DELAY, MatchStatus.MATCH_DELAY],
  RAIN_DELAY: ['LIVE', 'INNINGS_BREAK', 'COMPLETED', 'ABANDONED', 'CANCELLED', MatchStatus.DRINKS_BREAK, MatchStatus.MATCH_DELAY],
  MATCH_DELAY: ['LIVE', 'INNINGS_BREAK', 'COMPLETED', 'ABANDONED', 'CANCELLED', MatchStatus.DRINKS_BREAK, MatchStatus.RAIN_DELAY],
  SUPER_OVER_PENDING: ['SUPER_OVER', 'COMPLETED', 'ABANDONED', 'CANCELLED'],
  SUPER_OVER: ['SUPER_OVER_PENDING', 'COMPLETED', 'ABANDONED', 'CANCELLED'],
  COMPLETED: [],
  ABANDONED: [],
  CANCELLED: [],
};

export function assertTransition(from: MatchStatus, to: MatchStatus) {
  if (from === to) return;
  if (!ALLOWED[from].includes(to)) {
    throw Errors.invalidState(`Cannot move match from ${from} to ${to}`);
  }
}

const STRUCTURE_LOCKED: MatchStatus[] = [
  MatchStatus.LIVE,
  MatchStatus.INNINGS_BREAK,
  MatchStatus.DRINKS_BREAK,
  MatchStatus.RAIN_DELAY,
  MatchStatus.MATCH_DELAY,
  MatchStatus.SUPER_OVER_PENDING,
  MatchStatus.SUPER_OVER,
  MatchStatus.COMPLETED,
  MatchStatus.ABANDONED,
  MatchStatus.CANCELLED,
];

export function matchIsPaused(status: MatchStatus) {
  return DELAY.includes(status);
}

export function matchStructureLocked(status: MatchStatus) {
  return STRUCTURE_LOCKED.includes(status);
}
