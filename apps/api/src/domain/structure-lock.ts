import { MatchStatus } from '@prisma/client';
import { matchStructureLocked } from './lifecycle';

export const STRUCTURE_LOCKED_MESSAGE = 'Match settings are locked after scoring starts.';

export function isMatchStructureLocked(status: MatchStatus, scoringEventCount = 0) {
  return matchStructureLocked(status) || scoringEventCount > 0;
}
