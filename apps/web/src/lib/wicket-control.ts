export function isWicketControlEnabled(input: {
  strikerId?: string | null;
  nonStrikerId?: string | null;
  bowlerId?: string | null;
  matchStatus?: string | null;
  inningsStatus?: string | null;
  inningsComplete?: boolean;
  wickets?: number;
  maxWickets?: number;
}) {
  if (!input.strikerId || !input.nonStrikerId || !input.bowlerId) return false;
  if (input.matchStatus !== 'LIVE') return false;
  if (input.inningsStatus === 'COMPLETED' || input.inningsComplete) return false;
  if ((input.wickets ?? 0) >= (input.maxWickets ?? 0)) return false;
  return true;
}

export function shouldResetMatchPersonnel(previousMatchId: string | null, nextMatchId: string | null | undefined) {
  return Boolean(nextMatchId && previousMatchId !== nextMatchId);
}

export function isScoringReady(input: {
  setupConfirmed?: boolean;
  strikerId?: string | null;
  nonStrikerId?: string | null;
  bowlerId?: string | null;
  matchStatus?: string | null;
  inningsStatus?: string | null;
  inningsComplete?: boolean;
  wickets?: number;
  maxWickets?: number;
}) {
  return Boolean(input.setupConfirmed) && isWicketControlEnabled(input);
}
